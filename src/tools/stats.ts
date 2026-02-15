import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db.js';

export function registerStatsTools(server: McpServer): void {
  server.tool('get_stats', 'Get statistics: mash counts by status/type, edge count', {}, () => {
    const db = getDb();

    const byStatus = db
      .prepare('SELECT status, COUNT(*) as count FROM mashes GROUP BY status')
      .all() as { status: string; count: number }[];

    const byType = db
      .prepare('SELECT type, COUNT(*) as count FROM mashes GROUP BY type')
      .all() as { type: string; count: number }[];

    const edgeCount = db.prepare('SELECT COUNT(*) as count FROM edges').get() as { count: number };

    const totalMashes = db.prepare('SELECT COUNT(*) as count FROM mashes').get() as {
      count: number;
    };

    const stats = {
      total_mashes: totalMashes.count,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      by_type: Object.fromEntries(byType.map((r) => [r.type, r.count])),
      total_edges: edgeCount.count,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
  });
}
