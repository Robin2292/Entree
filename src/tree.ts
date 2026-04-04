import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, renameSync, existsSync } from "fs";

export interface TreeNode {
  id: string;
  label: string;
  content: string;
  parentId: string | null;
  children: string[];
  depth: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ExplorationTree {
  id: string;
  title: string;
  rootId: string;
  nodes: Record<string, TreeNode>;
  createdAt: string;
  updatedAt: string;
}

type TreeChangeListener = (tree: ExplorationTree) => void;

export class TreeManager {
  private tree: ExplorationTree;
  private listeners: TreeChangeListener[] = [];
  private dataPath: string;
  private cursorId: string;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || `${process.cwd()}/.exploration-tree.json`;

    if (existsSync(this.dataPath)) {
      try {
        this.tree = JSON.parse(readFileSync(this.dataPath, "utf-8"));
      } catch {
        // Backup corrupt file before starting fresh
        try {
          const backupPath = this.dataPath + ".bak";
          renameSync(this.dataPath, backupPath);
          process.stderr.write(
            `⚠️ Failed to parse ${this.dataPath}, backed up to ${backupPath}\n`
          );
        } catch {
          process.stderr.write(
            `⚠️ Failed to parse ${this.dataPath}, starting fresh\n`
          );
        }
        this.tree = this.createEmptyTree();
      }
    } else {
      this.tree = this.createEmptyTree();
    }
    this.cursorId = this.tree.rootId;
  }

  private createEmptyTree(): ExplorationTree {
    const rootId = randomUUID();
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      title: "Exploration",
      rootId,
      nodes: {
        [rootId]: {
          id: rootId,
          label: "Start",
          content: "",
          parentId: null,
          children: [],
          depth: 0,
          createdAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  onChange(listener: TreeChangeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private notify() {
    this.tree.updatedAt = new Date().toISOString();
    this.scheduleSave();
    for (const listener of this.listeners) {
      listener(this.tree);
    }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 100);
  }

  /** Flush pending save immediately (call before process exit). */
  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.save();
    }
  }

  private save() {
    try {
      const tmp = this.dataPath + ".tmp";
      writeFileSync(tmp, JSON.stringify(this.tree, null, 2), { mode: 0o600 });
      renameSync(tmp, this.dataPath);
    } catch (err) {
      process.stderr.write(`⚠️ Failed to save tree: ${err}\n`);
    }
  }

  // --- Cursor ---

  getCursorId(): string {
    return this.cursorId;
  }

  // --- Resolve: ID or label ---

  resolveNode(idOrLabel: string): TreeNode {
    // Try exact ID first
    if (this.tree.nodes[idOrLabel]) {
      return this.tree.nodes[idOrLabel];
    }

    // Fuzzy label match: exact first, then case-insensitive, then includes
    const lower = idOrLabel.toLowerCase();
    let exact: TreeNode | undefined;
    let caseInsensitive: TreeNode | undefined;
    let partial: TreeNode | undefined;

    for (const node of Object.values(this.tree.nodes)) {
      if (node.label === idOrLabel) {
        exact = node;
        break;
      }
      if (!caseInsensitive && node.label.toLowerCase() === lower) {
        caseInsensitive = node;
      }
      if (!partial && node.label.toLowerCase().includes(lower)) {
        partial = node;
      }
    }

    const found = exact || caseInsensitive || partial;
    if (!found) {
      throw new Error(
        `Node "${idOrLabel}" not found. Available: ${this.listLabels().join(", ")}`
      );
    }
    return found;
  }

  private listLabels(): string[] {
    return Object.values(this.tree.nodes)
      .filter((n) => n.parentId !== null) // skip root
      .map((n) => `"${n.label}"`);
  }

  // --- Breadcrumb ---

  getBreadcrumb(nodeId: string): string[] {
    const crumbs: string[] = [];
    let current = this.tree.nodes[nodeId];
    while (current) {
      crumbs.unshift(current.label);
      current = current.parentId ? this.tree.nodes[current.parentId] : undefined!;
    }
    return crumbs;
  }

  // --- Context: breadcrumb + direct children labels ---

  getContext(nodeId: string): {
    breadcrumb: string;
    children: string[];
    cursor: string;
  } {
    const node = this.tree.nodes[nodeId];
    return {
      breadcrumb: this.getBreadcrumb(nodeId).join(" > "),
      children: node
        ? node.children.map((cid) => this.tree.nodes[cid]?.label).filter(Boolean)
        : [],
      cursor: this.tree.nodes[this.cursorId]?.label || "root",
    };
  }

  // --- Core operations ---

  getTree(): ExplorationTree {
    return this.tree;
  }

  resetTree(title?: string): ExplorationTree {
    this.tree = this.createEmptyTree();
    if (title) this.tree.title = title;
    this.cursorId = this.tree.rootId;
    this.notify();
    return this.tree;
  }

  setTitle(title: string) {
    this.tree.title = title;
    this.notify();
  }

  addNode(
    parentId: string,
    label: string,
    content: string,
    metadata?: Record<string, unknown>
  ): TreeNode {
    const parent = this.tree.nodes[parentId];
    if (!parent) throw new Error(`Parent node ${parentId} not found`);

    const node: TreeNode = {
      id: randomUUID(),
      label,
      content,
      parentId,
      children: [],
      depth: parent.depth + 1,
      createdAt: new Date().toISOString(),
      metadata,
    };

    this.tree.nodes[node.id] = node;
    parent.children.push(node.id);
    this.cursorId = node.id;
    this.notify();
    return node;
  }

  addBranches(
    parentId: string,
    branches: Array<{
      label: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>
  ): TreeNode[] {
    const parent = this.tree.nodes[parentId];
    if (!parent) throw new Error(`Parent node ${parentId} not found`);

    const nodes: TreeNode[] = branches.map((b) => ({
      id: randomUUID(),
      label: b.label,
      content: b.content,
      parentId,
      children: [],
      depth: parent.depth + 1,
      createdAt: new Date().toISOString(),
      metadata: b.metadata,
    }));

    for (const node of nodes) {
      this.tree.nodes[node.id] = node;
      parent.children.push(node.id);
    }

    // Cursor moves to parent (branching point)
    this.cursorId = parentId;
    this.notify();
    return nodes;
  }

  updateNode(
    nodeId: string,
    updates: {
      label?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): TreeNode {
    const node = this.tree.nodes[nodeId];
    if (!node) throw new Error(`Node ${nodeId} not found`);

    if (updates.label !== undefined) node.label = updates.label;
    if (updates.content !== undefined) node.content = updates.content;
    if (updates.metadata !== undefined) {
      node.metadata = { ...node.metadata, ...updates.metadata };
    }

    // Cursor moves to updated node
    this.cursorId = nodeId;
    this.notify();
    return node;
  }

  deleteNode(nodeId: string): { deleted: string[]; parentId: string | null } {
    const node = this.tree.nodes[nodeId];
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (node.parentId === null) throw new Error("Cannot delete root node");

    // Remove from parent's children list
    const parent = this.tree.nodes[node.parentId];
    if (parent) {
      parent.children = parent.children.filter((id) => id !== nodeId);
    }

    // Collect and delete entire subtree
    const subtree = this.getSubtree(nodeId);
    const deletedIds = subtree.map((n) => n.id);
    for (const n of subtree) {
      delete this.tree.nodes[n.id];
    }

    // If cursor was on a deleted node, move to parent
    if (deletedIds.includes(this.cursorId)) {
      this.cursorId = node.parentId || this.tree.rootId;
    }

    this.notify();
    return { deleted: deletedIds, parentId: node.parentId };
  }

  getNode(nodeId: string): TreeNode | undefined {
    return this.tree.nodes[nodeId];
  }

  getSubtree(nodeId: string): TreeNode[] {
    const node = this.tree.nodes[nodeId];
    if (!node) return [];

    const result: TreeNode[] = [node];
    for (const childId of node.children) {
      result.push(...this.getSubtree(childId));
    }
    return result;
  }
}
