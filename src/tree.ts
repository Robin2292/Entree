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

  // Undo/redo
  static readonly MAX_HISTORY = 50;
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(dataPath?: string) {
    this.dataPath = dataPath || `${process.cwd()}/.entree.json`;

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

  /** Save current state to undo stack before a mutation. */
  private pushSnapshot() {
    this.undoStack.push(JSON.stringify({ tree: this.tree, cursorId: this.cursorId }));
    if (this.undoStack.length > TreeManager.MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    // Save current state for redo
    this.redoStack.push(JSON.stringify({ tree: this.tree, cursorId: this.cursorId }));
    const { tree, cursorId } = JSON.parse(snapshot);
    this.tree = tree;
    this.cursorId = cursorId;
    this.notify();
    return true;
  }

  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return false;
    // Save current state for undo (without clearing redo)
    this.undoStack.push(JSON.stringify({ tree: this.tree, cursorId: this.cursorId }));
    const { tree, cursorId } = JSON.parse(snapshot);
    this.tree = tree;
    this.cursorId = cursorId;
    this.notify();
    return true;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

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
      throw new Error(`Node "${idOrLabel}" not found`);
    }
    return found;
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
    this.pushSnapshot();
    this.tree = this.createEmptyTree();
    if (title) this.tree.title = title;
    this.cursorId = this.tree.rootId;
    this.notify();
    return this.tree;
  }

  setTitle(title: string) {
    this.pushSnapshot();
    this.tree.title = title;
    this.notify();
  }

  importTree(data: unknown): ExplorationTree {
    const tree = data as ExplorationTree;
    // Structural validation
    if (!tree || typeof tree !== "object") throw new Error("Invalid tree data");
    if (!tree.rootId || !tree.nodes || typeof tree.nodes !== "object")
      throw new Error("Missing required fields: rootId, nodes");
    const nodeCount = Object.keys(tree.nodes).length;
    if (nodeCount > TreeManager.MAX_NODES)
      throw new Error(`Tree exceeds maximum of ${TreeManager.MAX_NODES} nodes (has ${nodeCount})`);
    if (!tree.nodes[tree.rootId])
      throw new Error("Root node not found in nodes");

    // Validate every node
    for (const [id, node] of Object.entries(tree.nodes)) {
      if (node.id !== id)
        throw new Error(`Node ID mismatch: key "${id}" vs node.id "${node.id}"`);
      if (!node.label || typeof node.label !== "string")
        throw new Error(`Node "${id}" has invalid label`);
      if (node.parentId !== null && !tree.nodes[node.parentId])
        throw new Error(`Node "${id}" references missing parent "${node.parentId}"`);
      if (!Array.isArray(node.children))
        throw new Error(`Node "${id}" has invalid children`);
    }

    // Cycle detection + reachability check (BFS from root)
    const visited = new Set<string>();
    const queue = [tree.rootId];
    visited.add(tree.rootId);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = tree.nodes[id];
      for (const childId of node.children) {
        if (!tree.nodes[childId])
          throw new Error(`Node "${id}" references missing child "${childId}"`);
        if (visited.has(childId))
          throw new Error(`Cycle detected: node "${childId}" is reachable via multiple paths`);
        visited.add(childId);
        queue.push(childId);
      }
    }
    if (visited.size !== Object.keys(tree.nodes).length) {
      throw new Error("Unreachable nodes detected");
    }

    // Accept — fill in defaults for optional fields
    const now = new Date().toISOString();
    tree.id = tree.id || randomUUID();
    tree.title = tree.title || "Imported";
    tree.createdAt = tree.createdAt || now;
    tree.updatedAt = now;

    this.pushSnapshot();
    this.tree = tree;
    this.cursorId = tree.rootId;
    this.notify();
    return this.tree;
  }

  // ─── Input validation ───

  static readonly MAX_NODES = 5000;
  static readonly MAX_LABEL_LENGTH = 200;
  static readonly MAX_CONTENT_LENGTH = 50_000;
  static readonly MAX_CHILDREN = 50;
  static readonly MAX_DEPTH = 20;

  private validateLabel(label: string) {
    if (!label || !label.trim()) throw new Error("Label must not be empty");
    if (label.length > TreeManager.MAX_LABEL_LENGTH)
      throw new Error(`Label exceeds ${TreeManager.MAX_LABEL_LENGTH} characters`);
  }

  private validateContent(content: string) {
    if (content.length > TreeManager.MAX_CONTENT_LENGTH)
      throw new Error(`Content exceeds ${TreeManager.MAX_CONTENT_LENGTH} characters`);
  }

  private validateDepth(parent: TreeNode) {
    if (parent.depth >= TreeManager.MAX_DEPTH)
      throw new Error(`Maximum tree depth (${TreeManager.MAX_DEPTH}) reached`);
  }

  private validateChildCount(parent: TreeNode, adding: number) {
    if (parent.children.length + adding > TreeManager.MAX_CHILDREN)
      throw new Error(`Node would exceed ${TreeManager.MAX_CHILDREN} children`);
  }

  addNode(
    parentId: string,
    label: string,
    content: string,
    metadata?: Record<string, unknown>
  ): TreeNode {
    const parent = this.tree.nodes[parentId];
    if (!parent) throw new Error(`Parent node ${parentId} not found`);
    this.validateLabel(label);
    this.validateContent(content);
    this.validateDepth(parent);
    this.validateChildCount(parent, 1);
    this.pushSnapshot();

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
    for (const b of branches) {
      this.validateLabel(b.label);
      this.validateContent(b.content);
    }
    this.validateDepth(parent);
    this.validateChildCount(parent, branches.length);
    this.pushSnapshot();

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

    if (updates.label !== undefined) this.validateLabel(updates.label);
    if (updates.content !== undefined) this.validateContent(updates.content);
    this.pushSnapshot();

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
    this.pushSnapshot();

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
    const result: TreeNode[] = [];
    const visited = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = this.tree.nodes[id];
      if (!node) continue;
      result.push(node);
      for (const childId of node.children) {
        stack.push(childId);
      }
    }
    return result;
  }
}
