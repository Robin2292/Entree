# Entree — Agent Setup Guide

You are an AI agent helping a user install and configure Entree, an MCP server that visualizes your exploration process as an interactive tree in the browser.

## Step 1: Install

Run in the user's project root (or globally):

```bash
npm install -g entree-mcp
```

## Step 2: Add MCP Server Config

Create or edit `.mcp.json` in the project root:

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

If `.mcp.json` already exists, merge the `entree` key into the existing `mcpServers` object.

## Step 3: Add AI Instructions

Append to the project's AI instruction file (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, or equivalent):

```markdown
## Entree

Call `tree_reset` at conversation start. Use only during analytical work (debugging, architecture, research), not simple Q&A.

- `tree_branch`: only at **decision forks** — multiple hypotheses, competing approaches, or classification dimensions. Never for execution steps (writing code, running tests).
- `tree_add_insight`: append findings/conclusions to existing nodes.
- Structure = logical containment (topic → dimensions → items → analysis). Plan the tree shape before creating nodes.
```

## Step 4: Verify

After setup, the following MCP tools should be available:

- `tree_reset` — start new session
- `tree_branch` — create exploration branches
- `tree_add_insight` — add findings to nodes
- `tree_delete` — remove node and subtree
- `tree_set_topic` — set title
- `tree_get` — dump full tree

A browser window opens automatically at `http://localhost:3200` showing the tree visualization.

## Notes

- Requires Node.js >= 20
- Web UI runs on localhost only (port 3200, auto-increments if taken)
- Each session is token-authenticated
- Set `TREE_NO_OPEN=1` to disable auto-opening the browser

## Important: LLM Attention Limitation

Due to how LLMs manage attention over long conversations, AI agents may sometimes stop using MCP tools mid-session. If this happens, the user should explicitly prompt you (e.g., "use entree to record your analysis"). This is normal behavior and not a bug — a brief reminder is enough to re-engage the tools.
