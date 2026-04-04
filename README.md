# Entree

An MCP server that visualizes AI exploration as an interactive tree in your browser.

When AI agents analyze problems, they often explore multiple directions — debugging hypotheses, architecture options, code paths. Entree makes this process visible: every branch and insight is rendered as a real-time, interactive tree.

Works with any MCP-compatible client: Claude Code, Cursor, Windsurf, Cline, and more.

## Quick Start

### One-click: Let your AI agent install it

Paste this to your AI agent (Claude Code, Cursor, etc.):

```
Help me install and configure entree-mcp. Follow the instructions at https://raw.githubusercontent.com/Robin2292/Entree/main/AGENTS.md
```

### Manual Install

```bash
npm install -g entree-mcp
```

### Configure as MCP Server

Add to your MCP client settings:

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "entree": {
      "command": "npx",
      "args": ["-y", "entree-mcp"]
    }
  }
}
```

**Cursor / Windsurf / Other MCP clients** — use the same command config in your client's MCP server settings.

### Guide the AI

Add instructions to your project's AI config file (`CLAUDE.md`, `.cursorrules`, etc.):

```markdown
## Entree

Call `tree_new_topic` at the start of each analytical task. Use only during analytical work (debugging, architecture, research), not simple Q&A. Previous topics are preserved.

- `tree_new_topic`: start a new analysis topic. Creates a topic node under root and moves cursor there.
- `tree_branch`: only at **decision forks** — multiple hypotheses, competing approaches, or classification dimensions. Never for execution steps (writing code, running tests).
- `tree_add_insight`: append findings/conclusions to existing nodes.
- Structure = logical containment (topic → dimensions → items → analysis). Plan the tree shape before creating nodes.
```

> **Note:** The prompt above is intentionally minimal to save tokens. Customize it to fit your workflow — add specific rules for when to branch, what to record, or how deep to go.

> **Tip:** Due to LLM attention limitations, AI agents may sometimes forget to use MCP tools during long conversations. If the tree stops updating, explicitly prompt the agent (e.g., "use entree to record your exploration").

### Standalone Viewer

Run without an AI client to browse and edit trees:

```bash
npx entree-mcp
```

## How It Works

```
AI Client ←→ MCP (stdio) ←→ Entree Server ←→ Web UI (WebSocket)
                                    ↕
                             ~/.entree/trees/*.json
```

1. The AI calls MCP tools (`tree_branch`, `tree_add_insight`, etc.) as it explores
2. Entree persists the tree to disk and pushes updates via WebSocket
3. The browser UI renders the tree in real-time with pan, zoom, search, and export

## MCP Tools

| Tool | Purpose |
|------|---------|
| `tree_new_topic` | Start a new analysis topic (preserves history) |
| `tree_branch` | Add multiple exploration directions from a node |
| `tree_add_insight` | Add analysis/findings to a node |
| `tree_delete` | Remove a node and its subtree |
| `tree_set_topic` | Set the exploration title |
| `tree_get` | Dump the full tree (prefer branch/insight for efficiency) |

All node references support **fuzzy label matching** — you can use a node's label instead of its UUID.

A **cursor** tracks the last active node, so tools default to the current position without needing an explicit node reference.

## Web UI Features

- **Real-time sync** — tree updates instantly as the AI explores
- **Pan & zoom** — drag to pan, scroll to zoom, `Cmd+1` to fit
- **Search** — `Cmd+F` for full-text search across labels and content
- **Multi-session** — tabs for multiple concurrent sessions
- **Undo / Redo** — `Cmd+Z` / `Cmd+Shift+Z`, up to 50 steps
- **Import / Export** — JSON format, full tree backup and restore
- **Detail panel** — click any node to view full content with Markdown rendering (tables, code blocks, task lists, strikethrough)
- **Resizable panel** — drag the left edge to adjust detail panel width
- **Keyboard shortcuts** — `Cmd+0` reset view, `Cmd+[/]` switch tabs, `Esc` close panel
- **Token auth** — per-session token protects the web UI

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
npm test        # run test suite
npm run mcp     # run MCP server directly
npm start       # run standalone CLI viewer
```

## License

MIT
