<p align="center">
  <img src="docs/logo.png" width="96" alt="Moonshine" />
</p>

<h1 align="center">Moonshine MCP Server</h1>

<p align="center">
  <em>Let AI assistants tap into your knowledge graph.</em>
</p>

<p align="center">
  <strong><a href="docs/README_ko.md">한국어</a></strong>
</p>

---

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that connects AI assistants — Claude, ChatGPT, Gemini, and others — directly to your [Moonshine](https://github.com/Cognito-Distillery/moonshine) knowledge graph.

It reads the SQLite database file directly, so **Moonshine does not need to be running**.

---

## Prerequisites

- **[Node.js](https://nodejs.org/) v20+**
- **[Moonshine](https://github.com/Cognito-Distillery/moonshine)** installed with at least one mash created
- *(Optional)* An API key from **OpenAI** or **Google Gemini** — only needed for `search_semantic`

---

## Setup

### Claude Desktop

Add to your Claude Desktop config:

| Platform | Config Path |
|----------|-------------|
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "moonshine": {
      "command": "npx",
      "args": ["@cognito-distillery/moonshine-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add moonshine -- npx @cognito-distillery/moonshine-mcp
```

### Other MCP Clients

Any MCP-compatible client can connect via **stdio transport**:

```bash
npx @cognito-distillery/moonshine-mcp
```

---

## Database Path

The server automatically finds your Moonshine database:

| Platform | Default Path |
|----------|------|
| **Linux** | `~/.local/share/com.moonshine.app/moonshine.db` |
| **macOS** | `~/Library/Application Support/com.moonshine.app/moonshine.db` |
| **Windows** | `C:\Users\{user}\AppData\Roaming\com.moonshine.app\moonshine.db` |

Override with the `MOONSHINE_DB_PATH` environment variable if needed:

```json
{
  "mcpServers": {
    "moonshine": {
      "command": "npx",
      "args": ["@cognito-distillery/moonshine-mcp"],
      "env": {
        "MOONSHINE_DB_PATH": "/custom/path/to/moonshine.db"
      }
    }
  }
}
```

---

## Tools

### Mash CRUD

| Tool | Description |
|------|-------------|
| `list_mashes` | List mashes with optional filtering by status and type |
| `get_mash` | Get a single mash by ID |
| `create_mash` | Create a new mash (starts as MASH_TUN) |
| `update_mash` | Partially update a mash's type, summary, context, or memo |
| `delete_mash` | Delete a mash and its associated edges |

### Search

| Tool | Description |
|------|-------------|
| `search_keyword` | Full-text keyword search using FTS5 trigram tokenizer (Korean-friendly) |
| `search_semantic` | Semantic similarity search using embeddings (requires API key in Moonshine settings) |

### Knowledge Graph

| Tool | Description |
|------|-------------|
| `get_graph` | Get the full graph of JARRED mashes with optional filtering by type, relation, or source |
| `get_node_detail` | Get a node with its neighbors and connecting edges |
| `add_edge` | Add or upsert a relationship between two mashes |
| `update_edge` | Update an edge's relation type or confidence |
| `delete_edge` | Delete an edge |

### Stats

| Tool | Description |
|------|-------------|
| `get_stats` | Get mash counts by status/type and total edge count |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MOONSHINE_DB_PATH` | Override database file path | Auto-detected per platform |
| `MOONSHINE_READ_ONLY` | Set to `true` to block all write operations | `false` |
| `MOONSHINE_DEBUG` | Set to `true` for verbose stderr logging | `false` |

---

## Verifying

Run the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test tools interactively:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Security

- `password_hash` and `session_token` are **never exposed** through any tool
- API keys are read from the settings table internally but **never returned** in tool responses
- Use `MOONSHINE_READ_ONLY=true` to prevent any database writes
- WAL mode enables safe concurrent reads alongside the running Moonshine app

---

## License

[MIT](LICENSE)

---

<p align="center"><sub>under the moonlight, in silence.</sub></p>
