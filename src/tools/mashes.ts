import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { v4 as uuidv4 } from 'uuid';
import { getDb, isReadOnly } from '../db.js';
import type { Mash, MashStatus, MashType } from '../types.js';

const VALID_TYPES: MashType[] = ['결정', '문제', '인사이트', '질문'];
const VALID_STATUSES: MashStatus[] = [
  'MASH_TUN',
  'ON_STILL',
  'DISTILLED',
  'JARRED',
  'RE_EMBED',
  'RE_EXTRACT',
];

export function registerMashTools(server: McpServer): void {
  // list_mashes
  server.tool(
    'list_mashes',
    'List mashes with optional filtering by status and type',
    {
      status: z
        .enum(VALID_STATUSES as [string, ...string[]])
        .optional()
        .describe('Filter by status'),
      type: z
        .enum(VALID_TYPES as [string, ...string[]])
        .optional()
        .describe('Filter by type'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max results'),
      offset: z.number().int().min(0).default(0).describe('Offset for pagination'),
    },
    ({ status, type, limit, offset }) => {
      const db = getDb();
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      if (type) {
        conditions.push('type = ?');
        params.push(type);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT id, type, status, summary, context, memo, created_at, updated_at
                   FROM mashes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = db.prepare(sql).all(...params) as Mash[];
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // get_mash
  server.tool(
    'get_mash',
    'Get a single mash by ID',
    { id: z.string().describe('Mash UUID') },
    ({ id }) => {
      const db = getDb();
      const row = db
        .prepare(
          'SELECT id, type, status, summary, context, memo, created_at, updated_at FROM mashes WHERE id = ?',
        )
        .get(id) as Mash | undefined;

      if (!row) {
        return {
          content: [{ type: 'text' as const, text: `Mash not found: ${id}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
    },
  );

  // create_mash
  server.tool(
    'create_mash',
    'Create a new mash (knowledge entry)',
    {
      type: z.enum(VALID_TYPES as [string, ...string[]]).describe('Mash type'),
      summary: z.string().min(1).describe('Summary text'),
      context: z.string().default('').describe('Additional context'),
      memo: z.string().default('').describe('Personal memo'),
    },
    ({ type, summary, context, memo }) => {
      if (isReadOnly()) {
        return {
          content: [{ type: 'text' as const, text: 'Cannot create: database is in read-only mode' }],
          isError: true,
        };
      }

      const db = getDb();
      const id = uuidv4();
      const now = Date.now();

      db.prepare(
        `INSERT INTO mashes (id, type, status, summary, context, memo, created_at, updated_at)
         VALUES (?, ?, 'MASH_TUN', ?, ?, ?, ?, ?)`,
      ).run(id, type, summary, context, memo, now, now);

      const row = db
        .prepare(
          'SELECT id, type, status, summary, context, memo, created_at, updated_at FROM mashes WHERE id = ?',
        )
        .get(id) as Mash;
      return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
    },
  );

  // update_mash
  server.tool(
    'update_mash',
    'Update an existing mash (partial update)',
    {
      id: z.string().describe('Mash UUID'),
      type: z
        .enum(VALID_TYPES as [string, ...string[]])
        .optional()
        .describe('New type'),
      summary: z.string().min(1).optional().describe('New summary'),
      context: z.string().optional().describe('New context'),
      memo: z.string().optional().describe('New memo'),
    },
    ({ id, type, summary, context, memo }) => {
      if (isReadOnly()) {
        return {
          content: [{ type: 'text' as const, text: 'Cannot update: database is in read-only mode' }],
          isError: true,
        };
      }

      const db = getDb();
      const existing = db.prepare('SELECT id FROM mashes WHERE id = ?').get(id);
      if (!existing) {
        return {
          content: [{ type: 'text' as const, text: `Mash not found: ${id}` }],
          isError: true,
        };
      }

      const sets: string[] = [];
      const params: unknown[] = [];

      if (type !== undefined) {
        sets.push('type = ?');
        params.push(type);
      }
      if (summary !== undefined) {
        sets.push('summary = ?');
        params.push(summary);
      }
      if (context !== undefined) {
        sets.push('context = ?');
        params.push(context);
      }
      if (memo !== undefined) {
        sets.push('memo = ?');
        params.push(memo);
      }

      if (sets.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No fields to update' }],
          isError: true,
        };
      }

      sets.push('updated_at = ?');
      params.push(Date.now());
      params.push(id);

      db.prepare(`UPDATE mashes SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const row = db
        .prepare(
          'SELECT id, type, status, summary, context, memo, created_at, updated_at FROM mashes WHERE id = ?',
        )
        .get(id) as Mash;
      return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
    },
  );

  // delete_mash
  server.tool(
    'delete_mash',
    'Delete a mash and its associated edges (CASCADE)',
    { id: z.string().describe('Mash UUID') },
    ({ id }) => {
      if (isReadOnly()) {
        return {
          content: [{ type: 'text' as const, text: 'Cannot delete: database is in read-only mode' }],
          isError: true,
        };
      }

      const db = getDb();
      const existing = db.prepare('SELECT id FROM mashes WHERE id = ?').get(id);
      if (!existing) {
        return {
          content: [{ type: 'text' as const, text: `Mash not found: ${id}` }],
          isError: true,
        };
      }

      db.prepare('DELETE FROM mashes WHERE id = ?').run(id);
      return { content: [{ type: 'text' as const, text: `Deleted mash: ${id}` }] };
    },
  );
}
