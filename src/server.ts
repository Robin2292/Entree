import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { createServer as createNetServer } from "net";
import { join } from "path";
import { TreeManager } from "./tree.js";
import { startWebServer } from "./web.js";
import {
  registerSession,
  unregisterSession,
  getTreesDir,
  type Session,
} from "./registry.js";

function detectSessionName(): string {
  if (process.env.TREE_SESSION_NAME) return process.env.TREE_SESSION_NAME;
  return `Session ${process.pid}`;
}

async function findPort(base: number): Promise<number> {
  for (let p = base; p < base + 100; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = createNetServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p);
    });
    if (ok) return p;
  }
  throw new Error(`No available port in range ${base}-${base + 99}`);
}

async function main() {
  const sessionId = randomUUID();
  const sessionName = detectSessionName();
  const basePort = parseInt(process.env.TREE_WEB_PORT || "3200");
  const webPort = await findPort(basePort);
  const autoOpen = process.env.TREE_NO_OPEN !== "1";

  const dataPath = join(getTreesDir(), `${sessionId}.json`);
  const treeManager = new TreeManager(dataPath);

  // Register session
  const session: Session = {
    id: sessionId,
    name: sessionName,
    port: webPort,
    pid: process.pid,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
  };
  registerSession(session);

  const cleanup = () => { treeManager.flush(); unregisterSession(sessionId); };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  // --- MCP Server ---
  const server = new McpServer({
    name: "exploration-tree",
    version: "0.1.0",
  });

  server.tool(
    "tree_branch",
    `Create exploration branches from a node.
Use when you identify multiple directions to explore.
The parent can be a node ID or label (fuzzy matched). Omit to branch from cursor (last active node).
Response includes breadcrumb + existing children so you always know where you are.`,
    {
      parent: z
        .string()
        .optional()
        .describe(
          "Parent node ID or label (fuzzy matched). Omit to branch from cursor."
        ),
      branches: z
        .array(
          z.object({
            label: z
              .string()
              .describe("Short label for this direction (2-8 words)"),
            content: z
              .string()
              .describe("Brief description of this exploration direction"),
          })
        )
        .min(1)
        .describe("The branches/directions to add"),
    },
    async ({ parent, branches }) => {
      // Resolve parent: explicit → cursor → root
      let parentNode;
      if (parent) {
        parentNode = treeManager.resolveNode(parent);
      } else {
        parentNode = treeManager.getNode(treeManager.getCursorId());
        if (!parentNode) {
          parentNode = treeManager.getNode(treeManager.getTree().rootId)!;
        }
      }

      const nodes = treeManager.addBranches(parentNode.id, branches);
      const ctx = treeManager.getContext(parentNode.id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `Added ${nodes.length} branches`,
              breadcrumb: ctx.breadcrumb,
              existingChildren: ctx.children,
              added: nodes.map((n) => ({ id: n.id, label: n.label })),
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "tree_add_insight",
    `Add information or insight to a node.
The node can be specified by ID or label (fuzzy matched). Omit to add to cursor.
Use for detailed analysis on a direction. Moves cursor to this node.`,
    {
      node: z
        .string()
        .optional()
        .describe(
          "Node ID or label (fuzzy matched). Omit to add to cursor."
        ),
      content: z.string().describe("The insight or information to add"),
      label: z
        .string()
        .optional()
        .describe("Update the node label if needed"),
    },
    async ({ node: nodeRef, content, label }) => {
      let target;
      if (nodeRef) {
        target = treeManager.resolveNode(nodeRef);
      } else {
        target = treeManager.getNode(treeManager.getCursorId());
        if (!target) throw new Error("No active cursor node");
      }

      const updated = treeManager.updateNode(target.id, {
        content,
        ...(label ? { label } : {}),
      });
      const ctx = treeManager.getContext(updated.id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Node updated",
              breadcrumb: ctx.breadcrumb,
              children: ctx.children,
              node: { id: updated.id, label: updated.label },
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "tree_delete",
    "Delete a node and its entire subtree. Node can be specified by ID or label.",
    {
      node: z
        .string()
        .describe("Node ID or label (fuzzy matched) to delete"),
    },
    async ({ node: nodeRef }) => {
      const target = treeManager.resolveNode(nodeRef);
      const result = treeManager.deleteNode(target.id);
      const ctx = treeManager.getContext(result.parentId || treeManager.getTree().rootId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `Deleted ${result.deleted.length} node(s)`,
              breadcrumb: ctx.breadcrumb,
              remainingChildren: ctx.children,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "tree_get",
    "Get the full tree structure. Prefer tree_branch/tree_add_insight with label navigation instead — they return local context without fetching the entire tree.",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(treeManager.getTree(), null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "tree_set_topic",
    "Set or update the exploration topic/title.",
    {
      title: z.string().describe("The exploration topic"),
    },
    async ({ title }) => {
      treeManager.setTitle(title);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ message: "Topic set", title }),
          },
        ],
      };
    }
  );

  server.tool(
    "tree_reset",
    "Reset the tree for a new exploration session. Cursor resets to root.",
    {
      title: z.string().optional().describe("Title for the new exploration"),
    },
    async ({ title }) => {
      const tree = treeManager.resetTree(title);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Tree reset",
              rootId: tree.rootId,
              title: tree.title,
            }),
          },
        ],
      };
    }
  );

  // --- Start Web UI ---
  startWebServer(treeManager, webPort, session);

  const url = `http://localhost:${webPort}`;
  process.stderr.write(`🌳 Web UI: ${url}\n`);

  if (autoOpen) {
    const openCmd =
      process.platform === "darwin"
        ? `open "${url}"`
        : process.platform === "win32"
          ? `start "${url}"`
          : `xdg-open "${url}"`;
    exec(openCmd);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
