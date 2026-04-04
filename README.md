# Entree

An MCP server that visualizes Claude Code's exploration process as an interactive tree.

When Claude Code analyzes problems, it often explores multiple directions — debugging hypotheses, architecture options, code paths. Entree makes this process visible: every branch and insight is rendered as a real-time, interactive tree in your browser.

## Quick Start

### Install

```bash
npm install
npm run build
```

### Configure as MCP Server

Add to your Claude Code MCP settings (`.mcp.json` or Settings > MCP Servers):

```json
{
  "mcpServers": {
    "entree": {
      "command": "node",
      "args": ["/path/to/claude-exploration-tree/dist/server.js"]
    }
  }
}
```

Then instruct Claude when to use it via `CLAUDE.md`:

```markdown
## Exploration Tree

Call `tree_reset` at conversation start.
Use `tree_branch` to record exploration directions, `tree_add_insight` to record findings.
```

### Standalone Viewer

Run without Claude Code to browse existing trees:

```bash
npx entree
# or
npm start
```

## How It Works

```
Claude Code ←→ MCP (stdio) ←→ Entree Server ←→ Web UI (WebSocket)
                                     ↕
                              ~/.entree/trees/*.json
```

1. Claude calls MCP tools (`tree_branch`, `tree_add_insight`, etc.) as it explores
2. Entree persists the tree to disk and pushes updates via WebSocket
3. The browser UI renders the tree in real-time with pan, zoom, search, and export

## MCP Tools

| Tool | Purpose |
|------|---------|
| `tree_reset` | Start a new exploration session |
| `tree_branch` | Add multiple exploration directions from a node |
| `tree_add_insight` | Add analysis/findings to a node |
| `tree_delete` | Remove a node and its subtree |
| `tree_set_topic` | Set the exploration title |
| `tree_get` | Dump the full tree (prefer branch/insight for efficiency) |

All node references support **fuzzy label matching** — you can use a node's label instead of its UUID.

A **cursor** tracks the last active node, so tools default to the current position without needing an explicit node reference.

## Web UI Features

- **Real-time sync** — tree updates instantly as Claude explores
- **Pan & zoom** — drag to pan, scroll to zoom, `Cmd+1` to fit
- **Search** — `Cmd+F` for full-text search across labels and content
- **Multi-session** — tabs for multiple concurrent Claude sessions
- **Export** — download as Markdown outline or Mermaid mindmap
- **Detail panel** — click any node to view its full content with Markdown rendering
- **Keyboard shortcuts** — `Cmd+0` reset view, `Cmd+[/]` switch tabs, `Esc` close panel

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TREE_SESSION_NAME` | `Session {pid}` | Custom session display name |
| `TREE_WEB_PORT` | `3200` | Base port for web server (auto-increments if taken) |
| `TREE_NO_OPEN` | — | Set to `1` to skip auto-opening the browser |

## File Locations

| Path | Content |
|------|---------|
| `~/.entree/sessions.json` | Active session registry |
| `~/.entree/trees/{id}.json` | Per-session tree data |

Trees are saved with debounced atomic writes (tmp + rename). Stale sessions are cleaned up automatically on startup.

## Development

```bash
npm run dev     # watch mode (rebuilds on change)
npm run build   # production build
npm run mcp     # run MCP server directly
npm start       # run standalone CLI viewer
```

## License

MIT
