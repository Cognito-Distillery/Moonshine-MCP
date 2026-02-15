#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';
import { closeDb } from './db.js';
import { registerStatsTools } from './tools/stats.js';
import { registerMashTools } from './tools/mashes.js';
import { registerGraphTools } from './tools/graph.js';
import { registerSearchTools } from './tools/search.js';

const server = new McpServer({
  name: 'moonshine',
  version: '0.1.0',
});

// Register all tools
registerStatsTools(server);
registerMashTools(server);
registerGraphTools(server);
registerSearchTools(server);

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Moonshine MCP server started (stdio)');
}

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

main().catch((err) => {
  logger.error('Failed to start MCP server:', err);
  process.exit(1);
});
