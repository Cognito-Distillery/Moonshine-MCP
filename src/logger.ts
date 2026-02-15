/**
 * stderr-only logger. MCP uses stdout for JSON-RPC, so all logging must go to stderr.
 */
export const logger = {
  info: (...args: unknown[]) => console.error('[INFO]', ...args),
  warn: (...args: unknown[]) => console.error('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => {
    if (process.env.MOONSHINE_DEBUG === 'true') {
      console.error('[DEBUG]', ...args);
    }
  },
};
