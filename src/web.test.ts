import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TreeManager } from "./tree.js";
import { startWebServer } from "./web/index.js";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { unlinkSync } from "fs";
import type { Session } from "./registry.js";
import http from "http";

const TEST_PORT = 39876; // high port unlikely to conflict
let treeManager: TreeManager;
let dataPath: string;

const TEST_TOKEN = "test-token-secret";

const session: Session = {
  id: "test-web-session",
  name: "Test",
  port: TEST_PORT,
  pid: process.pid,
  cwd: "/tmp",
  startedAt: new Date().toISOString(),
  token: TEST_TOKEN,
};

function fetch(path: string, options: { method?: string; body?: string; noAuth?: boolean } = {}): Promise<{
  status: number;
  body: string;
  json: () => any;
}> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (!options.noAuth) headers["Authorization"] = `Bearer ${TEST_TOKEN}`;
    if (options.body) headers["Content-Type"] = "application/json";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        method: options.method || "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            body: data,
            json: () => JSON.parse(data),
          })
        );
      }
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

beforeAll(async () => {
  dataPath = join(tmpdir(), `.entree-web-test-${randomUUID()}.json`);
  treeManager = new TreeManager(dataPath);
  startWebServer(treeManager, TEST_PORT, session);
  // Give server time to start
  await new Promise((r) => setTimeout(r, 200));
});

afterAll(() => {
  treeManager.flush();
  try { unlinkSync(dataPath); } catch {}
});

describe("Web API", () => {
  describe("GET /", () => {
    it("returns HTML page with valid token", async () => {
      const res = await fetch(`/?token=${TEST_TOKEN}`, { noAuth: true });
      expect(res.status).toBe(200);
      expect(res.body).toContain("<!DOCTYPE html>");
      expect(res.body).toContain("Entree");
    });

    it("rejects without token", async () => {
      const res = await fetch("/", { noAuth: true });
      expect(res.status).toBe(401);
    });
  });

  describe("auth", () => {
    it("rejects API calls without token", async () => {
      const res = await fetch("/api/tree", { noAuth: true });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/tree", () => {
    it("returns the current tree as JSON", async () => {
      const res = await fetch("/api/tree");
      expect(res.status).toBe(200);
      const tree = res.json();
      expect(tree.rootId).toBeTruthy();
      expect(tree.nodes).toBeDefined();
      expect(tree.nodes[tree.rootId].label).toBe("Start");
    });
  });

  describe("GET /api/sessions", () => {
    it("returns an array", async () => {
      const res = await fetch("/api/sessions");
      expect(res.status).toBe(200);
      const sessions = res.json();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe("POST /api/nodes/:id/delete", () => {
    it("deletes an existing node", async () => {
      // Add a node to delete
      const rootId = treeManager.getTree().rootId;
      const node = treeManager.addNode(rootId, "ToDelete", "content");

      const res = await fetch(`/api/nodes/${node.id}/delete`, {
        method: "POST",
        body: "{}",
      });

      expect(res.status).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.deleted).toBeGreaterThanOrEqual(1);

      // Verify node is gone
      expect(treeManager.getTree().nodes[node.id]).toBeUndefined();
    });

    it("returns 400 for nonexistent node", async () => {
      const res = await fetch(`/api/nodes/nonexistent-id/delete`, {
        method: "POST",
        body: "{}",
      });

      expect(res.status).toBe(400);
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeTruthy();
    });

    it("returns 400 when trying to delete root", async () => {
      const rootId = treeManager.getTree().rootId;
      const res = await fetch(`/api/nodes/${rootId}/delete`, {
        method: "POST",
        body: "{}",
      });

      expect(res.status).toBe(400);
      const body = res.json();
      expect(body.ok).toBe(false);
    });
  });

  describe("POST /api/tree/import", () => {
    it("imports a valid tree JSON", async () => {
      const tree = JSON.parse(JSON.stringify(treeManager.getTree()));
      tree.title = "Imported Tree";

      const res = await fetch("/api/tree/import", {
        method: "POST",
        body: JSON.stringify(tree),
      });

      expect(res.status).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.title).toBe("Imported Tree");
      expect(body.nodeCount).toBeGreaterThanOrEqual(1);
      expect(treeManager.getTree().title).toBe("Imported Tree");
    });

    it("returns 400 for invalid data", async () => {
      const res = await fetch("/api/tree/import", {
        method: "POST",
        body: JSON.stringify({ bad: "data" }),
      });

      expect(res.status).toBe(400);
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeTruthy();
    });
  });

  describe("POST /api/undo and /api/redo", () => {
    it("undoes and redoes a mutation", async () => {
      const rootId = treeManager.getTree().rootId;
      treeManager.addNode(rootId, "UndoMe", "");
      expect(Object.keys(treeManager.getTree().nodes).length).toBeGreaterThan(1);

      const undoRes = await fetch("/api/undo", { method: "POST", body: "{}" });
      expect(undoRes.status).toBe(200);
      const undoBody = undoRes.json();
      expect(undoBody.ok).toBe(true);
      expect(undoBody.canRedo).toBe(true);

      const redoRes = await fetch("/api/redo", { method: "POST", body: "{}" });
      expect(redoRes.status).toBe(200);
      const redoBody = redoRes.json();
      expect(redoBody.ok).toBe(true);
    });

    it("returns ok=false when stack is empty", async () => {
      // Drain the undo stack
      let drained = false;
      while (!drained) {
        const r = await fetch("/api/undo", { method: "POST", body: "{}" });
        drained = !r.json().ok;
      }
      // Now stack is truly empty
      const res = await fetch("/api/undo", { method: "POST", body: "{}" });
      expect(res.json().ok).toBe(false);
    });
  });
});

describe("WebSocket", () => {
  it("sends tree on connection with valid token", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?token=${TEST_TOKEN}`);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); reject(new Error("WS timeout")); }, 3000);
    });

    expect(message.type).toBe("tree");
    expect(message.data.rootId).toBeTruthy();
  });

  it("rejects connection without token", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

    const code = await new Promise<number>((resolve) => {
      ws.on("close", (c) => resolve(c));
      ws.on("error", () => {}); // ignore error, we care about close code
      setTimeout(() => { ws.close(); resolve(0); }, 3000);
    });

    expect(code).toBe(4001);
  });

  it("accepts cross-session connection from loopback", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?cross=1`);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); reject(new Error("WS timeout")); }, 3000);
    });

    expect(message.type).toBe("tree");
  });

  it("pushes updates when tree changes", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?token=${TEST_TOKEN}`);

    const messages: any[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length === 1) {
          // First message is initial tree; now trigger a change
          treeManager.addNode(treeManager.getTree().rootId, "WS Test", "");
        }
        if (messages.length >= 2) {
          ws.close();
          resolve();
        }
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); resolve(); }, 3000);
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    // Second message should contain the new node
    const lastTree = messages[messages.length - 1].data;
    const labels = Object.values(lastTree.nodes).map((n: any) => n.label);
    expect(labels).toContain("WS Test");
  });
});
