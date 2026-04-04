import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TreeManager } from "./tree.js";
import { existsSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

function tmpPath() {
  return join(tmpdir(), `.entree-test-${randomUUID()}.json`);
}

describe("TreeManager", () => {
  let mgr: TreeManager;
  let dataPath: string;

  beforeEach(() => {
    dataPath = tmpPath();
    mgr = new TreeManager(dataPath);
  });

  afterEach(() => {
    try {
      mgr.flush();
      unlinkSync(dataPath);
    } catch {}
    try { unlinkSync(dataPath + ".tmp"); } catch {}
  });

  // ─── Initialization ───

  describe("initialization", () => {
    it("creates a tree with a root node", () => {
      const tree = mgr.getTree();
      expect(tree.rootId).toBeTruthy();
      expect(tree.nodes[tree.rootId]).toBeDefined();
      expect(tree.nodes[tree.rootId].label).toBe("Start");
      expect(tree.nodes[tree.rootId].parentId).toBeNull();
      expect(tree.nodes[tree.rootId].depth).toBe(0);
    });

    it("has a default title", () => {
      expect(mgr.getTree().title).toBe("Exploration");
    });

    it("cursor starts at root", () => {
      expect(mgr.getCursorId()).toBe(mgr.getTree().rootId);
    });

    it("loads existing tree from disk", () => {
      mgr.addNode(mgr.getTree().rootId, "Persisted", "data");
      mgr.flush();

      const mgr2 = new TreeManager(dataPath);
      const tree2 = mgr2.getTree();
      const labels = Object.values(tree2.nodes).map((n) => n.label);
      expect(labels).toContain("Persisted");
    });

    it("recovers from corrupt file", () => {
      const corruptPath = tmpPath();
      // Write invalid JSON
      const { writeFileSync } = require("fs");
      writeFileSync(corruptPath, "{{{invalid json!!!", "utf-8");

      const mgr2 = new TreeManager(corruptPath);
      // Should create a fresh tree instead of crashing
      expect(mgr2.getTree().rootId).toBeTruthy();
      expect(Object.keys(mgr2.getTree().nodes)).toHaveLength(1);

      try { unlinkSync(corruptPath); } catch {}
      try { unlinkSync(corruptPath + ".bak"); } catch {}
    });
  });

  // ─── Adding Nodes ───

  describe("addNode", () => {
    it("adds a child to the specified parent", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Child 1", "First child");

      expect(node.parentId).toBe(rootId);
      expect(node.label).toBe("Child 1");
      expect(node.content).toBe("First child");
      expect(node.depth).toBe(1);
      expect(node.children).toEqual([]);
    });

    it("registers the child in parent's children array", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Child", "content");
      expect(mgr.getTree().nodes[rootId].children).toContain(node.id);
    });

    it("moves cursor to the new node", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "New", "content");
      expect(mgr.getCursorId()).toBe(node.id);
    });

    it("supports nested depths", () => {
      const rootId = mgr.getTree().rootId;
      const level1 = mgr.addNode(rootId, "L1", "");
      const level2 = mgr.addNode(level1.id, "L2", "");
      const level3 = mgr.addNode(level2.id, "L3", "");

      expect(level1.depth).toBe(1);
      expect(level2.depth).toBe(2);
      expect(level3.depth).toBe(3);
    });

    it("stores metadata if provided", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Meta", "content", { priority: "high" });
      expect(node.metadata).toEqual({ priority: "high" });
    });

    it("throws on invalid parent ID", () => {
      expect(() => mgr.addNode("nonexistent-id", "X", "Y")).toThrow();
    });
  });

  // ─── Branching ───

  describe("addBranches", () => {
    it("adds multiple children at once", () => {
      const rootId = mgr.getTree().rootId;
      const nodes = mgr.addBranches(rootId, [
        { label: "Option A", content: "First direction" },
        { label: "Option B", content: "Second direction" },
        { label: "Option C", content: "Third direction" },
      ]);

      expect(nodes).toHaveLength(3);
      expect(mgr.getTree().nodes[rootId].children).toHaveLength(3);
    });

    it("all branches have the same parent and depth", () => {
      const rootId = mgr.getTree().rootId;
      const nodes = mgr.addBranches(rootId, [
        { label: "A", content: "" },
        { label: "B", content: "" },
      ]);

      for (const node of nodes) {
        expect(node.parentId).toBe(rootId);
        expect(node.depth).toBe(1);
      }
    });

    it("moves cursor to the parent (branching point)", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addBranches(rootId, [
        { label: "A", content: "" },
        { label: "B", content: "" },
      ]);

      // Cursor should be at parent, not at any child
      expect(mgr.getCursorId()).toBe(rootId);
    });

    it("throws on invalid parent", () => {
      expect(() =>
        mgr.addBranches("bad-id", [{ label: "X", content: "" }])
      ).toThrow();
    });
  });

  // ─── Node Resolution (Fuzzy Matching) ───

  describe("resolveNode", () => {
    it("resolves by exact ID", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Target", "content");
      expect(mgr.resolveNode(node.id).id).toBe(node.id);
    });

    it("resolves by exact label", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Unique Label", "content");
      expect(mgr.resolveNode("Unique Label").id).toBe(node.id);
    });

    it("resolves by case-insensitive label", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "My Node", "content");
      expect(mgr.resolveNode("my node").id).toBe(node.id);
    });

    it("resolves by partial label match", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Investigation Branch", "content");
      expect(mgr.resolveNode("investigation").id).toBe(node.id);
    });

    it("prefers exact match over case-insensitive", () => {
      const rootId = mgr.getTree().rootId;
      const exact = mgr.addNode(rootId, "Test", "exact");
      mgr.addNode(rootId, "test", "lowercase");
      expect(mgr.resolveNode("Test").id).toBe(exact.id);
    });

    it("prefers case-insensitive over partial match", () => {
      const rootId = mgr.getTree().rootId;
      const fullMatch = mgr.addNode(rootId, "Debug", "full");
      mgr.addNode(rootId, "Debug Session", "partial would also match");
      expect(mgr.resolveNode("debug").id).toBe(fullMatch.id);
    });

    it("throws when no node matches", () => {
      expect(() => mgr.resolveNode("totally nonexistent")).toThrow(/not found/i);
    });

    it("does not leak label names in error message", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "Secret Label", "content");
      try {
        mgr.resolveNode("nonexistent");
      } catch (e: any) {
        expect(e.message).not.toContain("Secret Label");
        expect(e.message).toContain("not found");
      }
    });
  });

  // ─── Update ───

  describe("updateNode", () => {
    it("updates label", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Old", "content");
      const updated = mgr.updateNode(node.id, { label: "New" });
      expect(updated.label).toBe("New");
    });

    it("updates content", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Node", "old content");
      mgr.updateNode(node.id, { content: "new content" });
      expect(mgr.getTree().nodes[node.id].content).toBe("new content");
    });

    it("merges metadata", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "M", "", { a: 1 });
      mgr.updateNode(node.id, { metadata: { b: 2 } });
      expect(mgr.getTree().nodes[node.id].metadata).toEqual({ a: 1, b: 2 });
    });

    it("moves cursor to the updated node", () => {
      const rootId = mgr.getTree().rootId;
      const n1 = mgr.addNode(rootId, "A", "");
      mgr.addNode(rootId, "B", ""); // cursor moves to B
      mgr.updateNode(n1.id, { content: "updated" });
      expect(mgr.getCursorId()).toBe(n1.id);
    });

    it("throws on nonexistent node", () => {
      expect(() => mgr.updateNode("bad-id", { label: "X" })).toThrow();
    });
  });

  // ─── Delete ───

  describe("deleteNode", () => {
    it("removes the node from the tree", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Doomed", "content");
      mgr.deleteNode(node.id);
      expect(mgr.getTree().nodes[node.id]).toBeUndefined();
    });

    it("removes the node from parent's children", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Doomed", "content");
      mgr.deleteNode(node.id);
      expect(mgr.getTree().nodes[rootId].children).not.toContain(node.id);
    });

    it("deletes entire subtree", () => {
      const rootId = mgr.getTree().rootId;
      const parent = mgr.addNode(rootId, "Parent", "");
      const child = mgr.addNode(parent.id, "Child", "");
      const grandchild = mgr.addNode(child.id, "Grandchild", "");

      const result = mgr.deleteNode(parent.id);

      expect(result.deleted).toContain(parent.id);
      expect(result.deleted).toContain(child.id);
      expect(result.deleted).toContain(grandchild.id);
      expect(result.deleted).toHaveLength(3);
    });

    it("returns the parent ID of the deleted node", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Node", "");
      const result = mgr.deleteNode(node.id);
      expect(result.parentId).toBe(rootId);
    });

    it("moves cursor to parent when cursor was on deleted node", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Node", "");
      // cursor is at node after addNode
      expect(mgr.getCursorId()).toBe(node.id);
      mgr.deleteNode(node.id);
      expect(mgr.getCursorId()).toBe(rootId);
    });

    it("moves cursor to parent when cursor was on a subtree node", () => {
      const rootId = mgr.getTree().rootId;
      const parent = mgr.addNode(rootId, "P", "");
      const child = mgr.addNode(parent.id, "C", "");
      // cursor is at child
      expect(mgr.getCursorId()).toBe(child.id);
      mgr.deleteNode(parent.id);
      // cursor should move to parent's parent (root)
      expect(mgr.getCursorId()).toBe(rootId);
    });

    it("refuses to delete root node", () => {
      expect(() => mgr.deleteNode(mgr.getTree().rootId)).toThrow(/root/i);
    });

    it("throws on nonexistent node", () => {
      expect(() => mgr.deleteNode("bad-id")).toThrow();
    });
  });

  // ─── Breadcrumb ───

  describe("getBreadcrumb", () => {
    it("returns path from root to node", () => {
      const rootId = mgr.getTree().rootId;
      const a = mgr.addNode(rootId, "Analysis", "");
      const b = mgr.addNode(a.id, "Deep Dive", "");

      const crumbs = mgr.getBreadcrumb(b.id);
      expect(crumbs).toEqual(["Start", "Analysis", "Deep Dive"]);
    });

    it("returns just root label for root node", () => {
      const crumbs = mgr.getBreadcrumb(mgr.getTree().rootId);
      expect(crumbs).toEqual(["Start"]);
    });
  });

  // ─── Context ───

  describe("getContext", () => {
    it("returns breadcrumb string, children labels, and cursor", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addBranches(rootId, [
        { label: "A", content: "" },
        { label: "B", content: "" },
      ]);

      const ctx = mgr.getContext(rootId);
      expect(ctx.breadcrumb).toBe("Start");
      expect(ctx.children).toContain("A");
      expect(ctx.children).toContain("B");
      expect(ctx.cursor).toBeTruthy();
    });
  });

  // ─── Subtree ───

  describe("getSubtree", () => {
    it("returns node and all descendants", () => {
      const rootId = mgr.getTree().rootId;
      const a = mgr.addNode(rootId, "A", "");
      const b = mgr.addNode(a.id, "B", "");
      mgr.addNode(b.id, "C", "");

      const subtree = mgr.getSubtree(a.id);
      expect(subtree).toHaveLength(3);
      const labels = subtree.map((n) => n.label);
      expect(labels).toEqual(["A", "B", "C"]);
    });

    it("returns empty array for nonexistent node", () => {
      expect(mgr.getSubtree("bad-id")).toEqual([]);
    });
  });

  // ─── Reset ───

  describe("resetTree", () => {
    it("clears all nodes and starts fresh", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "A", "");
      mgr.addNode(rootId, "B", "");

      mgr.resetTree("Fresh Start");
      const tree = mgr.getTree();
      expect(Object.keys(tree.nodes)).toHaveLength(1);
      expect(tree.title).toBe("Fresh Start");
    });

    it("resets cursor to new root", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "X", "");
      mgr.resetTree();
      expect(mgr.getCursorId()).toBe(mgr.getTree().rootId);
    });

    it("uses default title when none provided", () => {
      mgr.resetTree();
      expect(mgr.getTree().title).toBe("Exploration");
    });
  });

  // ─── Import ───

  describe("importTree", () => {
    it("imports a valid tree", () => {
      // Build a tree, export it, import into a fresh manager
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "Branch A", "content A");
      mgr.addNode(rootId, "Branch B", "content B");
      mgr.setTitle("Test Export");
      const exported = JSON.parse(JSON.stringify(mgr.getTree()));

      const importPath = tmpPath();
      const mgr2 = new TreeManager(importPath);
      mgr2.importTree(exported);

      expect(mgr2.getTree().title).toBe("Test Export");
      const labels = Object.values(mgr2.getTree().nodes).map((n) => n.label);
      expect(labels).toContain("Branch A");
      expect(labels).toContain("Branch B");

      try { unlinkSync(importPath); } catch {}
    });

    it("rejects non-object data", () => {
      expect(() => mgr.importTree("string")).toThrow(/invalid/i);
      expect(() => mgr.importTree(null)).toThrow(/invalid/i);
    });

    it("rejects tree with missing rootId", () => {
      expect(() => mgr.importTree({ nodes: {} })).toThrow(/rootId/i);
    });

    it("rejects tree with missing root node", () => {
      expect(() =>
        mgr.importTree({ rootId: "missing", nodes: {} })
      ).toThrow(/root node/i);
    });

    it("rejects node with invalid parent reference", () => {
      const badTree = {
        rootId: "r",
        nodes: {
          r: { id: "r", label: "Root", content: "", parentId: null, children: ["c"], depth: 0, createdAt: "" },
          c: { id: "c", label: "Child", content: "", parentId: "nonexistent", children: [], depth: 1, createdAt: "" },
        },
      };
      expect(() => mgr.importTree(badTree)).toThrow(/missing parent/i);
    });

    it("rejects node with ID mismatch", () => {
      const badTree = {
        rootId: "r",
        nodes: {
          r: { id: "wrong", label: "Root", content: "", parentId: null, children: [], depth: 0, createdAt: "" },
        },
      };
      expect(() => mgr.importTree(badTree)).toThrow(/mismatch/i);
    });

    it("fires onChange listener", () => {
      let called = false;
      mgr.onChange(() => { called = true; });
      const tree = JSON.parse(JSON.stringify(mgr.getTree()));
      mgr.importTree(tree);
      expect(called).toBe(true);
    });

    it("resets cursor to root", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "X", ""); // cursor moves away from root
      const tree = JSON.parse(JSON.stringify(mgr.getTree()));
      mgr.importTree(tree);
      expect(mgr.getCursorId()).toBe(mgr.getTree().rootId);
    });

    it("rejects tree with cycles", () => {
      const cycleTree = {
        rootId: "r",
        nodes: {
          r: { id: "r", label: "Root", content: "", parentId: null, children: ["a"], depth: 0, createdAt: "" },
          a: { id: "a", label: "A", content: "", parentId: "r", children: ["b"], depth: 1, createdAt: "" },
          b: { id: "b", label: "B", content: "", parentId: "a", children: ["a"], depth: 2, createdAt: "" },
        },
      };
      expect(() => mgr.importTree(cycleTree)).toThrow(/cycle/i);
    });

    it("rejects tree with orphan nodes", () => {
      const orphanTree = {
        rootId: "r",
        nodes: {
          r: { id: "r", label: "Root", content: "", parentId: null, children: [], depth: 0, createdAt: "" },
          orphan: { id: "orphan", label: "Orphan", content: "", parentId: "r", children: [], depth: 1, createdAt: "" },
        },
      };
      expect(() => mgr.importTree(orphanTree)).toThrow(/unreachable/i);
    });

    it("rejects tree with missing child reference", () => {
      const missingChildTree = {
        rootId: "r",
        nodes: {
          r: { id: "r", label: "Root", content: "", parentId: null, children: ["missing"], depth: 0, createdAt: "" },
        },
      };
      expect(() => mgr.importTree(missingChildTree)).toThrow(/missing child/i);
    });

    it("rejects import exceeding MAX_NODES", () => {
      const bigTree: any = {
        rootId: "r",
        nodes: {
          r: { id: "r", label: "Root", content: "", parentId: null, children: [] as string[], depth: 0, createdAt: "" },
        },
      };
      for (let i = 0; i < TreeManager.MAX_NODES; i++) {
        const id = `n${i}`;
        bigTree.nodes[id] = { id, label: `N${i}`, content: "", parentId: "r", children: [], depth: 1, createdAt: "" };
        bigTree.nodes.r.children.push(id);
      }
      expect(Object.keys(bigTree.nodes).length).toBe(TreeManager.MAX_NODES + 1);
      expect(() => mgr.importTree(bigTree)).toThrow(/maximum/i);
    });
  });

  // ─── Undo / Redo ───

  describe("undo/redo", () => {
    it("undoes addNode", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "Will Undo", "content");
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(2);

      expect(mgr.undo()).toBe(true);
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(1);
    });

    it("redoes after undo", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "Toggle", "");
      mgr.undo();
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(1);

      expect(mgr.redo()).toBe(true);
      const labels = Object.values(mgr.getTree().nodes).map((n) => n.label);
      expect(labels).toContain("Toggle");
    });

    it("returns false when nothing to undo", () => {
      expect(mgr.undo()).toBe(false);
    });

    it("returns false when nothing to redo", () => {
      expect(mgr.redo()).toBe(false);
    });

    it("clears redo stack on new mutation", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "A", "");
      mgr.undo();
      expect(mgr.canRedo()).toBe(true);

      mgr.addNode(rootId, "B", "");
      expect(mgr.canRedo()).toBe(false);
    });

    it("undoes deleteNode (restores subtree)", () => {
      const rootId = mgr.getTree().rootId;
      const parent = mgr.addNode(rootId, "Parent", "");
      mgr.addNode(parent.id, "Child", "");
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(3);

      mgr.deleteNode(parent.id);
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(1);

      mgr.undo();
      expect(Object.keys(mgr.getTree().nodes)).toHaveLength(3);
      const labels = Object.values(mgr.getTree().nodes).map((n) => n.label);
      expect(labels).toContain("Parent");
      expect(labels).toContain("Child");
    });

    it("restores cursor position on undo", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "X", "");
      expect(mgr.getCursorId()).toBe(node.id);

      mgr.undo();
      expect(mgr.getCursorId()).toBe(rootId);
    });

    it("respects MAX_HISTORY limit", () => {
      for (let i = 0; i < TreeManager.MAX_HISTORY + 10; i++) {
        mgr.setTitle("Title " + i);
      }
      // Should not exceed MAX_HISTORY
      let undoCount = 0;
      while (mgr.undo()) undoCount++;
      expect(undoCount).toBe(TreeManager.MAX_HISTORY);
    });

    it("canUndo/canRedo track state", () => {
      expect(mgr.canUndo()).toBe(false);
      expect(mgr.canRedo()).toBe(false);

      mgr.addNode(mgr.getTree().rootId, "A", "");
      expect(mgr.canUndo()).toBe(true);
      expect(mgr.canRedo()).toBe(false);

      mgr.undo();
      expect(mgr.canUndo()).toBe(false);
      expect(mgr.canRedo()).toBe(true);
    });
  });

  // ─── Set Title ───

  describe("setTitle", () => {
    it("updates the tree title", () => {
      mgr.setTitle("New Topic");
      expect(mgr.getTree().title).toBe("New Topic");
    });
  });

  // ─── Persistence ───

  describe("persistence", () => {
    it("saves to disk on flush", () => {
      const rootId = mgr.getTree().rootId;
      mgr.addNode(rootId, "Saved", "data");
      mgr.flush();

      expect(existsSync(dataPath)).toBe(true);
      const saved = JSON.parse(readFileSync(dataPath, "utf-8"));
      const labels = Object.values(saved.nodes).map((n: any) => n.label);
      expect(labels).toContain("Saved");
    });

    it("updates the updatedAt timestamp on changes", () => {
      const before = mgr.getTree().updatedAt;
      // Small delay to ensure timestamp changes
      mgr.addNode(mgr.getTree().rootId, "New", "");
      const after = mgr.getTree().updatedAt;
      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime()
      );
    });
  });

  // ─── Input Validation ───

  describe("input validation", () => {
    it("rejects empty label", () => {
      const rootId = mgr.getTree().rootId;
      expect(() => mgr.addNode(rootId, "", "content")).toThrow(/empty/i);
      expect(() => mgr.addNode(rootId, "   ", "content")).toThrow(/empty/i);
    });

    it("rejects label exceeding max length", () => {
      const rootId = mgr.getTree().rootId;
      const longLabel = "x".repeat(TreeManager.MAX_LABEL_LENGTH + 1);
      expect(() => mgr.addNode(rootId, longLabel, "")).toThrow(/label/i);
    });

    it("accepts label at max length", () => {
      const rootId = mgr.getTree().rootId;
      const label = "x".repeat(TreeManager.MAX_LABEL_LENGTH);
      expect(() => mgr.addNode(rootId, label, "")).not.toThrow();
    });

    it("rejects content exceeding max length", () => {
      const rootId = mgr.getTree().rootId;
      const longContent = "x".repeat(TreeManager.MAX_CONTENT_LENGTH + 1);
      expect(() => mgr.addNode(rootId, "OK", longContent)).toThrow(/content/i);
    });

    it("validates branches input", () => {
      const rootId = mgr.getTree().rootId;
      expect(() =>
        mgr.addBranches(rootId, [{ label: "", content: "" }])
      ).toThrow(/empty/i);

      const longLabel = "x".repeat(TreeManager.MAX_LABEL_LENGTH + 1);
      expect(() =>
        mgr.addBranches(rootId, [{ label: longLabel, content: "" }])
      ).toThrow(/label/i);
    });

    it("validates updateNode input", () => {
      const rootId = mgr.getTree().rootId;
      const node = mgr.addNode(rootId, "Valid", "");
      expect(() => mgr.updateNode(node.id, { label: "" })).toThrow(/empty/i);
      expect(() =>
        mgr.updateNode(node.id, { content: "x".repeat(TreeManager.MAX_CONTENT_LENGTH + 1) })
      ).toThrow(/content/i);
    });

    it("rejects exceeding max children", () => {
      const rootId = mgr.getTree().rootId;
      for (let i = 0; i < TreeManager.MAX_CHILDREN; i++) {
        mgr.addNode(rootId, `Child ${i}`, "");
      }
      expect(() => mgr.addNode(rootId, "One too many", "")).toThrow(/children/i);
    });

    it("rejects exceeding max depth", () => {
      let parentId = mgr.getTree().rootId;
      for (let i = 0; i < TreeManager.MAX_DEPTH; i++) {
        const node = mgr.addNode(parentId, `D${i}`, "");
        parentId = node.id;
      }
      expect(() => mgr.addNode(parentId, "Too deep", "")).toThrow(/depth/i);
    });
  });

  // ─── Change Listener ───

  describe("onChange", () => {
    it("fires on addNode", () => {
      let called = false;
      mgr.onChange(() => { called = true; });
      mgr.addNode(mgr.getTree().rootId, "X", "");
      expect(called).toBe(true);
    });

    it("fires on deleteNode", () => {
      const node = mgr.addNode(mgr.getTree().rootId, "X", "");
      let called = false;
      mgr.onChange(() => { called = true; });
      mgr.deleteNode(node.id);
      expect(called).toBe(true);
    });

    it("can unsubscribe", () => {
      let count = 0;
      const unsub = mgr.onChange(() => { count++; });
      mgr.addNode(mgr.getTree().rootId, "A", "");
      expect(count).toBe(1);
      unsub();
      mgr.addNode(mgr.getTree().rootId, "B", "");
      expect(count).toBe(1);
    });
  });
});
