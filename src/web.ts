import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import type { TreeManager } from "./tree.js";
import { getSessions, type Session } from "./registry.js";

export function startWebServer(
  treeManager: TreeManager,
  port: number,
  session: Session
) {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.get("/", (_req, res) => {
    res.type("html")
      .set("Content-Security-Policy",
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*; img-src 'self' data:")
      .send(getHTML(session));
  });

  app.get("/api/tree", (_req, res) => {
    res.json(treeManager.getTree());
  });

  app.get("/api/sessions", (_req, res) => {
    res.json(getSessions());
  });

  // Delete node from browser
  app.use(express.json());
  app.post("/api/nodes/:id/delete", (req, res) => {
    try {
      const result = treeManager.deleteNode(req.params.id);
      res.json({ ok: true, deleted: result.deleted.length });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "tree", data: treeManager.getTree() }));

    const unsub = treeManager.onChange((tree) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "tree", data: tree }));
      }
    });

    ws.on("close", unsub);
  });

  httpServer.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `🌳 Exploration Tree UI: http://localhost:${port}\n`
    );
  });
}

function getHTML(session: Session): string {
  // Escape < to prevent </script> injection in embedded JSON
  const selfJson = JSON.stringify(session).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exploration Tree</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-dim: #8b949e;
    --accent: #58a6ff;
    --accent-glow: rgba(88, 166, 255, 0.15);
    --green: #3fb950;
    --purple: #bc8cff;
    --red: #f85149;
    --yellow: #d29922;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
    height: 100vh;
    user-select: none;
  }

  /* ---- Header ---- */
  #header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 48px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    z-index: 100;
    gap: 8px;
  }

  #header .logo { font-size: 20px; flex-shrink: 0; }

  /* ---- Tabs ---- */
  #tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    padding: 4px 0;
    scrollbar-width: none;
  }
  #tabs::-webkit-scrollbar { display: none; }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-dim);
    transition: all 0.15s;
    border: 1px solid transparent;
    flex-shrink: 0;
  }

  .tab:hover { background: rgba(255,255,255,0.04); }

  .tab.active {
    color: var(--text);
    background: var(--bg);
    border-color: var(--border);
  }

  .tab-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--text-dim);
    transition: background 0.2s;
  }
  .tab.connected .tab-dot { background: var(--green); }
  .tab.disconnected .tab-dot { background: var(--red); }

  .tab-name { font-weight: 500; }

  .tab-dir {
    color: var(--text-dim);
    font-size: 10px;
    opacity: 0.6;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab.self .tab-name::after {
    content: ' (this)';
    font-weight: 400;
    opacity: 0.5;
  }

  /* ---- Controls ---- */
  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .zoom-display {
    font-size: 11px;
    color: var(--text-dim);
    min-width: 42px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .ctrl-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: 6px;
    width: 28px; height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.15s;
  }
  .ctrl-btn:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    flex-shrink: 0;
  }

  /* ---- Viewport / Canvas ---- */
  #viewport {
    position: absolute;
    top: 48px; left: 0; right: 0; bottom: 0;
    overflow: hidden;
    cursor: grab;
    background-image: radial-gradient(circle, rgba(48,54,61,0.35) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  #viewport.panning { cursor: grabbing; }

  #canvas {
    position: absolute;
    top: 0; left: 0;
    transform-origin: 0 0;
    will-change: transform;
  }

  .tree-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: max-content;
    padding: 60px 80px;
  }

  /* ---- Nodes ---- */
  .node-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  .node {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 18px;
    min-width: 160px;
    max-width: 280px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    user-select: none;
  }
  .node:hover {
    border-color: var(--accent);
    box-shadow: 0 0 20px var(--accent-glow);
    transform: translateY(-1px);
  }
  .node.root {
    border-color: var(--accent);
    background: linear-gradient(135deg, var(--surface), rgba(88,166,255,0.08));
  }
  .node.selected {
    border-color: var(--purple);
    box-shadow: 0 0 24px rgba(188,140,255,0.2);
  }

  .node .label {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: 1.3;
  }
  .node .content {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .node .depth-badge {
    position: absolute;
    top: -8px; right: -8px;
    background: var(--accent);
    color: var(--bg);
    font-size: 10px;
    font-weight: 700;
    width: 20px; height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .collapse-toggle {
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    transition: all 0.15s;
    z-index: 2;
    font-family: inherit;
    line-height: 1;
  }
  .collapse-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-glow);
  }

  .children-row {
    display: flex;
    gap: 16px;
    position: relative;
    justify-content: center;
  }

  .connector {
    width: 2px;
    height: 28px;
    background: var(--border);
    margin: 0 auto;
  }

  svg.lines {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    overflow: visible;
  }
  svg.lines line {
    stroke: var(--border);
    stroke-width: 2;
  }

  /* ---- Detail panel ---- */
  #detail-panel {
    position: fixed;
    top: 48px; right: 0;
    width: 340px; bottom: 0;
    background: var(--surface);
    border-left: 1px solid var(--border);
    padding: 20px;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    z-index: 50;
    overflow-y: auto;
  }
  #detail-panel.open { transform: translateX(0); }

  #detail-panel h3 {
    font-size: 16px;
    margin-bottom: 12px;
    color: var(--accent);
  }
  #detail-panel .meta {
    font-size: 11px;
    color: var(--text-dim);
    margin-bottom: 16px;
  }
  #detail-panel .body {
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  #detail-panel .close-btn {
    position: absolute;
    top: 12px; right: 12px;
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 18px;
  }

  #detail-panel .panel-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .action-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn:hover {
    border-color: var(--text-dim);
    color: var(--text);
  }
  .action-btn.danger:hover {
    border-color: var(--red);
    color: var(--red);
    background: rgba(248,81,73,0.08);
  }

  .empty-state {
    text-align: center;
    padding-top: 20vh;
    color: var(--text-dim);
  }
  .empty-state .icon { font-size: 64px; margin-bottom: 16px; }
  .empty-state p { font-size: 14px; max-width: 400px; margin: 8px auto; }

  /* ---- Connection banner ---- */
  #conn-banner {
    position: fixed;
    top: 48px; left: 0; right: 0;
    height: 32px;
    background: rgba(210, 153, 34, 0.12);
    border-bottom: 1px solid var(--yellow);
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--yellow);
    z-index: 90;
    gap: 8px;
  }
  #conn-banner.visible { display: flex; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 12px; height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  /* ---- Toasts ---- */
  #toasts {
    position: fixed;
    bottom: 20px; left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
  }
  .toast {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    pointer-events: auto;
    animation: toastIn 0.2s ease, toastOut 0.3s ease 3s forwards;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    max-width: 400px;
    text-align: center;
  }
  .toast.error  { border-color: var(--red);   color: var(--red); }
  .toast.success { border-color: var(--green); color: var(--green); }

  @keyframes toastIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes toastOut { from { opacity:1; } to { opacity:0; } }

  .empty-state .spinner { width: 28px; height: 28px; border-width: 3px; margin: 0 auto 16px; color: var(--accent); }

  /* ---- Markdown in panel ---- */
  #detail-panel .body h1, #detail-panel .body h2, #detail-panel .body h3 {
    color: var(--text); margin: 12px 0 6px; line-height: 1.3;
  }
  #detail-panel .body h1 { font-size: 16px; }
  #detail-panel .body h2 { font-size: 14px; }
  #detail-panel .body h3 { font-size: 13px; }
  #detail-panel .body p { margin: 6px 0; }
  #detail-panel .body ul, #detail-panel .body ol {
    margin: 6px 0; padding-left: 20px;
  }
  #detail-panel .body li { margin: 3px 0; }
  #detail-panel .body code {
    background: var(--bg); padding: 2px 5px; border-radius: 4px;
    font-size: 12px; font-family: 'SF Mono', Consolas, monospace;
  }
  #detail-panel .body pre {
    background: var(--bg); padding: 10px 12px; border-radius: 6px;
    overflow-x: auto; margin: 8px 0; border: 1px solid var(--border);
  }
  #detail-panel .body pre code {
    background: none; padding: 0; font-size: 12px;
  }
  #detail-panel .body strong { color: var(--text); }
  #detail-panel .body a {
    color: var(--accent); text-decoration: none;
  }
  #detail-panel .body a:hover { text-decoration: underline; }
  #detail-panel .body blockquote {
    border-left: 3px solid var(--border); padding-left: 12px;
    color: var(--text-dim); margin: 8px 0;
  }
  #detail-panel .body hr {
    border: none; border-top: 1px solid var(--border); margin: 12px 0;
  }
  #detail-panel .body user-select { user-select: text; }

  /* ---- Search bar ---- */
  #search-bar {
    display: none;
    position: fixed;
    top: 56px; right: 16px;
    z-index: 110;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
    gap: 8px;
    align-items: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  #search-bar.open { display: flex; }

  #search-input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 13px;
    padding: 4px 8px;
    width: 200px;
    outline: none;
  }
  #search-input:focus { border-color: var(--accent); }
  #search-info {
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .node.search-match {
    outline: 2px solid var(--yellow);
    outline-offset: 2px;
  }
  .node.search-active {
    outline-color: var(--accent);
    outline-width: 3px;
  }
</style>
</head>
<body>

<div id="header">
  <span class="logo">🌳</span>
  <div id="tabs"></div>
  <div class="controls">
    <button class="ctrl-btn" onclick="toggleSearch()" title="Search (Cmd+F)">⌕</button>
    <div class="divider"></div>
    <button class="ctrl-btn" onclick="exportMarkdown()" title="Export Markdown">↓M</button>
    <button class="ctrl-btn" onclick="exportMermaid()" title="Export Mermaid">↓D</button>
    <div class="divider"></div>
    <button class="ctrl-btn" onclick="zoomBy(-0.15)" title="Zoom out">−</button>
    <span class="zoom-display" id="zoom-display">100%</span>
    <button class="ctrl-btn" onclick="zoomBy(0.15)" title="Zoom in">+</button>
    <div class="divider"></div>
    <button class="ctrl-btn" onclick="fitToView()" title="Fit to view (Cmd+1)">⊞</button>
    <button class="ctrl-btn" onclick="resetView()" title="Reset view (Cmd+0)">↺</button>
  </div>
</div>

<div id="search-bar">
  <input id="search-input" type="text" placeholder="Search nodes..." />
  <span id="search-info"></span>
  <button class="ctrl-btn" onclick="searchNav(-1)" title="Previous" style="width:22px;height:22px;font-size:11px">▲</button>
  <button class="ctrl-btn" onclick="searchNav(1)" title="Next" style="width:22px;height:22px;font-size:11px">▼</button>
  <button class="ctrl-btn" onclick="toggleSearch()" style="width:22px;height:22px;font-size:13px">&times;</button>
</div>

<div id="conn-banner">
  <span class="spinner"></span>
  <span id="conn-banner-text">Reconnecting...</span>
</div>

<div id="viewport">
  <div id="canvas"></div>
</div>

<div id="toasts"></div>

<div id="detail-panel">
  <button class="close-btn" onclick="closePanel()">&times;</button>
  <h3 id="panel-label"></h3>
  <div class="meta" id="panel-meta"></div>
  <div class="body" id="panel-content"></div>
  <div class="panel-actions">
    <button class="action-btn danger" id="btn-delete" onclick="deleteSelected()">Delete</button>
  </div>
</div>

<script>
  // === Config ===
  const SELF = ${selfJson};
  const ZOOM_MIN = 0.15;
  const ZOOM_MAX = 3;
  const SESSION_POLL_MS = 4000;

  // === State ===
  const sessions = new Map(); // id -> { info, ws, treeData, connected }
  let activeId = null;
  let selectedNodeId = null;
  const collapsedNodes = new Set();
  const cam = { x: 0, y: 0, zoom: 1 };

  const viewport = document.getElementById('viewport');
  const canvasEl = document.getElementById('canvas');
  const tabsEl = document.getElementById('tabs');

  // =====================
  //  Toast notifications
  // =====================

  function showToast(msg, type) {
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // =====================
  //  Connection banner
  // =====================

  function updateConnBanner() {
    const entry = activeId ? sessions.get(activeId) : null;
    const banner = document.getElementById('conn-banner');
    const vp = document.getElementById('viewport');
    if (entry && !entry.connected) {
      document.getElementById('conn-banner-text').textContent =
        'Reconnecting to ' + (entry.treeData?.title || entry.info.name || 'session') + '...';
      banner.classList.add('visible');
      vp.style.top = '80px';
    } else {
      banner.classList.remove('visible');
      vp.style.top = '48px';
    }
  }

  // =====================
  //  Session management
  // =====================

  async function pollSessions() {
    try {
      const resp = await fetch('/api/sessions');
      const list = await resp.json();
      const ids = new Set(list.map(s => s.id));

      // Add new sessions
      for (const s of list) {
        if (!sessions.has(s.id)) openSession(s);
      }

      // Remove stale sessions (but never remove self)
      for (const [id] of sessions) {
        if (!ids.has(id) && id !== SELF.id) closeSession(id);
      }

      renderTabs();
    } catch {}
  }

  function openSession(info) {
    const entry = { info, ws: null, treeData: null, connected: false, retryCount: 0 };
    sessions.set(info.id, entry);
    connectWs(info.id);

    if (!activeId) {
      activeId = info.id;
    }
  }

  function connectWs(id) {
    const entry = sessions.get(id);
    if (!entry) return;

    const url = id === SELF.id
      ? 'ws://' + location.host
      : 'ws://localhost:' + entry.info.port;

    const ws = new WebSocket(url);
    entry.ws = ws;

    ws.onopen = () => {
      const wasRetrying = entry.retryCount > 0;
      entry.connected = true;
      entry.retryCount = 0;
      renderTabs();
      updateConnBanner();
      if (wasRetrying && id === activeId) showToast('Reconnected', 'success');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'tree') {
        const isFirst = entry.treeData === null;
        entry.treeData = msg.data;
        if (id === activeId) scheduleRender();
        renderTabs();
        if (isFirst && id === activeId) {
          requestAnimationFrame(fitToView);
        }
      }
    };

    ws.onclose = () => {
      const wasConnected = entry.connected;
      entry.connected = false;
      entry.ws = null;
      entry.retryCount = (entry.retryCount || 0) + 1;
      renderTabs();
      updateConnBanner();
      if (wasConnected && id === activeId) {
        showToast('Connection lost, retrying...', 'error');
      }
      // Exponential backoff: 1s → 2s → 4s → ... → max 30s
      const delay = Math.min(1000 * Math.pow(2, entry.retryCount - 1), 30000);
      setTimeout(() => {
        if (sessions.has(id)) connectWs(id);
      }, delay);
    };

    ws.onerror = () => {}; // onclose will fire
  }

  function closeSession(id) {
    const entry = sessions.get(id);
    if (entry?.ws) {
      try { entry.ws.close(); } catch {}
    }
    sessions.delete(id);
    if (activeId === id) {
      activeId = sessions.keys().next().value || null;
      renderTree();
    }
    renderTabs();
    updateConnBanner();
  }

  function switchTo(id) {
    if (id === activeId) return;
    activeId = id;
    selectedNodeId = null;
    lastRenderedAt = null;
    closePanel();
    renderTabs();
    updateConnBanner();
    renderTree();
    requestAnimationFrame(fitToView);
  }

  // =====================
  //  Tabs
  // =====================

  function renderTabs() {
    let html = '';
    for (const [id, entry] of sessions) {
      const active = id === activeId;
      const connClass = entry.connected ? 'connected' : 'disconnected';
      const selfClass = id === SELF.id ? 'self' : '';
      const title = entry.treeData?.title || entry.info.name;
      const dir = entry.info.cwd.split('/').pop() || entry.info.cwd;

      html += '<div class="tab ' + (active ? 'active ' : '') + connClass + ' ' + selfClass
        + '" data-sid="' + escAttr(id) + '">'
        + '<span class="tab-dot"></span>'
        + '<span class="tab-name">' + esc(title) + '</span>'
        + '<span class="tab-dir">' + esc(dir) + '</span>'
        + '</div>';
    }
    tabsEl.innerHTML = html;
  }

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab && tab.dataset.sid) switchTo(tab.dataset.sid);
  });

  // =====================
  //  Camera (pan + zoom)
  // =====================

  function applyTransform() {
    canvasEl.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.zoom + ')';
    document.getElementById('zoom-display').textContent = Math.round(cam.zoom * 100) + '%';

    // Move grid with camera
    const gs = 24 * cam.zoom;
    viewport.style.backgroundSize = gs + 'px ' + gs + 'px';
    viewport.style.backgroundPosition = (cam.x % gs) + 'px ' + (cam.y % gs) + 'px';
  }

  // Pan
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let camStart = { x: 0, y: 0 };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.node')) return;
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    camStart = { x: cam.x, y: cam.y };
    viewport.classList.add('panning');
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    cam.x = camStart.x + (e.clientX - panStart.x);
    cam.y = camStart.y + (e.clientY - panStart.y);
    applyTransform();
  });
  viewport.addEventListener('pointerup', () => {
    isPanning = false;
    viewport.classList.remove('panning');
  });
  viewport.addEventListener('pointercancel', () => {
    isPanning = false;
    viewport.classList.remove('panning');
  });

  // Zoom (wheel)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = (mx - cam.x) / cam.zoom;
    const cy = (my - cam.y) / cam.zoom;
    cam.zoom = clampZoom(cam.zoom * (1 - e.deltaY * 0.001));
    cam.x = mx - cx * cam.zoom;
    cam.y = my - cy * cam.zoom;
    applyTransform();
  }, { passive: false });

  function clampZoom(z) { return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)); }

  function zoomBy(delta) {
    const rect = viewport.getBoundingClientRect();
    const cx = (rect.width / 2 - cam.x) / cam.zoom;
    const cy = (rect.height / 2 - cam.y) / cam.zoom;
    cam.zoom = clampZoom(cam.zoom + delta);
    cam.x = rect.width / 2 - cx * cam.zoom;
    cam.y = rect.height / 2 - cy * cam.zoom;
    applyTransform();
  }

  function resetView() {
    cam.x = 0; cam.y = 0; cam.zoom = 1;
    applyTransform();
  }

  function fitToView() {
    const c = canvasEl.querySelector('.tree-container');
    if (!c) return;
    const rect = viewport.getBoundingClientRect();
    const cw = c.scrollWidth;
    const ch = c.scrollHeight;
    if (!cw || !ch) return;
    const pad = 60;
    cam.zoom = clampZoom(Math.min((rect.width - pad * 2) / cw, (rect.height - pad * 2) / ch));
    cam.x = (rect.width - cw * cam.zoom) / 2;
    cam.y = (rect.height - ch * cam.zoom) / 2;
    applyTransform();
  }

  // =====================
  //  Tree rendering
  // =====================

  function getActiveTree() {
    const entry = sessions.get(activeId);
    return entry?.treeData || null;
  }

  // Debounced render: coalesces rapid updates into one frame
  let renderRafId = null;
  let lastRenderedAt = null;

  function scheduleRender() {
    if (renderRafId) return;
    renderRafId = requestAnimationFrame(() => {
      renderRafId = null;
      const tree = getActiveTree();
      const ts = tree?.updatedAt;
      if (ts && ts === lastRenderedAt) return; // skip identical state
      lastRenderedAt = ts || null;
      renderTree();
    });
  }

  // Pre-computed subtree counts (built once per render, O(n) total)
  let subtreeCounts = {};

  function buildSubtreeCounts(tree) {
    const counts = {};
    function walk(nodeId) {
      const node = tree.nodes[nodeId];
      if (!node) return 0;
      let c = 1;
      for (const cid of node.children) c += walk(cid);
      counts[nodeId] = c;
      return c;
    }
    walk(tree.rootId);
    return counts;
  }

  function renderTree() {
    const tree = getActiveTree();
    if (!tree || !tree.nodes[tree.rootId]) {
      const entry = activeId ? sessions.get(activeId) : null;
      const isConnecting = !entry || !entry.connected;
      canvasEl.innerHTML = isConnecting
        ? '<div class="empty-state">'
          + '<div class="spinner"></div>'
          + '<p>Connecting to session...</p>'
          + '</div>'
        : '<div class="empty-state">'
          + '<div class="icon">🌱</div>'
          + '<p>Waiting for exploration to begin...</p>'
          + '<p style="font-size:12px">Claude will build the tree as it explores.</p>'
          + '</div>';
      return;
    }
    subtreeCounts = buildSubtreeCounts(tree);
    canvasEl.innerHTML = '<div class="tree-container">' + renderNode(tree, tree.rootId) + '</div>';
    requestAnimationFrame(drawLines);
  }

  function renderNode(tree, nodeId) {
    const node = tree.nodes[nodeId];
    if (!node) return '';
    const isRoot = node.parentId === null;
    const isSelected = nodeId === selectedNodeId;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(nodeId);
    const cls = 'node' + (isRoot ? ' root' : '') + (isSelected ? ' selected' : '');

    let h = '<div class="node-group" data-node-id="' + escAttr(nodeId) + '">'
      + '<div class="' + cls + '" data-id="' + escAttr(nodeId) + '">'
      + (!isRoot ? '<span class="depth-badge">' + node.depth + '</span>' : '')
      + '<div class="label">' + esc(node.label) + '</div>'
      + (node.content ? '<div class="content">' + esc(node.content) + '</div>' : '');

    if (hasChildren) {
      const descendantCount = (subtreeCounts[nodeId] || 1) - 1;
      h += '<button class="collapse-toggle" data-toggle="' + escAttr(nodeId) + '">'
        + (isCollapsed ? '&#9654; ' + descendantCount : '&#9660;')
        + '</button>';
    }

    h += '</div>';

    if (hasChildren && !isCollapsed) {
      h += '<div class="connector"></div><div class="children-row">';
      for (const cid of node.children) h += renderNode(tree, cid);
      h += '</div>';
    }
    return h + '</div>';
  }

  // Node click (event delegation, drag-safe)
  let ptrDown = null;
  canvasEl.addEventListener('pointerdown', (e) => { ptrDown = { x: e.clientX, y: e.clientY }; });
  canvasEl.addEventListener('click', (e) => {
    if (ptrDown) {
      const dx = e.clientX - ptrDown.x, dy = e.clientY - ptrDown.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) return;
    }
    // Handle collapse toggle click
    const toggle = e.target.closest('.collapse-toggle');
    if (toggle && toggle.dataset.toggle) {
      const nid = toggle.dataset.toggle;
      if (collapsedNodes.has(nid)) collapsedNodes.delete(nid);
      else collapsedNodes.add(nid);
      renderTree();
      return;
    }
    const el = e.target.closest('.node');
    if (el && el.dataset.id) selectNode(el.dataset.id);
  });

  // SVG connectors — batch reads then batch writes to avoid layout thrashing
  function drawLines() {
    document.querySelectorAll('svg.lines').forEach(s => s.remove());

    const z = cam.zoom || 1;
    const rows = document.querySelectorAll('.children-row');
    // Phase 1: batch-read all geometry
    const measurements = [];
    for (const row of rows) {
      const conn = row.previousElementSibling;
      if (!conn) continue;
      const children = row.querySelectorAll(':scope > .node-group > .node');
      if (children.length <= 1) continue;
      const rr = row.getBoundingClientRect();
      const childRects = [];
      for (const ch of children) childRects.push(ch.getBoundingClientRect());
      measurements.push({ row, rr, childRects });
    }
    // Phase 2: batch-write SVG elements (no layout reflow)
    for (const { row, rr, childRects } of measurements) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('lines');

      const x1 = (childRects[0].left + childRects[0].width / 2 - rr.left) / z;
      const x2 = (childRects[childRects.length - 1].left + childRects[childRects.length - 1].width / 2 - rr.left) / z;

      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', x1); hLine.setAttribute('y1', 0);
      hLine.setAttribute('x2', x2); hLine.setAttribute('y2', 0);
      svg.appendChild(hLine);

      for (const cr of childRects) {
        const cx = (cr.left + cr.width / 2 - rr.left) / z;
        const vl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vl.setAttribute('x1', cx); vl.setAttribute('y1', 0);
        vl.setAttribute('x2', cx); vl.setAttribute('y2', 0);
        svg.appendChild(vl);
      }
      row.appendChild(svg);
    }
  }

  // =====================
  //  Detail panel
  // =====================

  function selectNode(nodeId) {
    const tree = getActiveTree();
    if (!tree) return;
    selectedNodeId = nodeId;
    const node = tree.nodes[nodeId];
    if (!node) return;

    document.getElementById('panel-label').textContent = node.label;
    document.getElementById('panel-meta').textContent =
      'Depth: ' + node.depth + ' · Children: ' + node.children.length + ' · ID: ' + node.id.slice(0,8) + '...';
    document.getElementById('panel-content').innerHTML = renderMd(node.content);
    document.getElementById('detail-panel').classList.add('open');

    // Hide delete button for root node
    document.getElementById('btn-delete').style.display = node.parentId === null ? 'none' : '';

    document.querySelectorAll('.node.selected').forEach(n => n.classList.remove('selected'));
    const el = document.querySelector('.node[data-id="' + CSS.escape(nodeId) + '"]');
    if (el) el.classList.add('selected');
  }

  function closePanel() {
    selectedNodeId = null;
    document.getElementById('detail-panel').classList.remove('open');
    document.querySelectorAll('.node.selected').forEach(n => n.classList.remove('selected'));
  }

  async function deleteSelected() {
    if (!selectedNodeId || !activeId) return;
    const tree = getActiveTree();
    if (!tree) return;
    const node = tree.nodes[selectedNodeId];
    if (!node) return;
    if (node.parentId === null) return; // can't delete root

    const childCount = countSubtree(tree, selectedNodeId) - 1;
    const msg = childCount > 0
      ? 'Delete "' + node.label + '" and ' + childCount + ' child node(s)?'
      : 'Delete "' + node.label + '"?';
    if (!confirm(msg)) return;

    const entry = sessions.get(activeId);
    if (!entry) return;
    const port = entry.info.port;

    try {
      const resp = await fetch('http://localhost:' + port + '/api/nodes/' + encodeURIComponent(selectedNodeId) + '/delete', {
        method: 'POST',
      });
      if (resp.ok) {
        closePanel();
        showToast('Node deleted', 'success');
      } else {
        const data = await resp.json().catch(() => ({}));
        showToast('Delete failed: ' + (data.error || 'unknown error'), 'error');
      }
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  }

  function countSubtree(tree, nodeId) {
    const node = tree.nodes[nodeId];
    if (!node) return 0;
    let count = 1;
    for (const cid of node.children) count += countSubtree(tree, cid);
    return count;
  }

  // =====================
  //  Utilities
  // =====================

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escAttr(str) {
    return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // =====================
  //  Markdown renderer
  // =====================

  function renderMd(raw) {
    if (!raw) return '<span style="color:var(--text-dim)">(No detailed content yet)</span>';
    // Escape HTML first (XSS safe), then apply markdown transforms
    var s = esc(raw);
    // Code blocks: use \\x60 hex escape for backtick (avoids template literal conflict)
    s = s.replace(/\\x60\\x60\\x60\\w*?\\n([\\s\\S]*?)\\x60\\x60\\x60/g, '<pre><code>$1</code></pre>');
    s = s.replace(/\\x60\\x60\\x60([\\s\\S]*?)\\x60\\x60\\x60/g, '<pre><code>$1</code></pre>');
    // Inline code
    s = s.replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
    // Headers
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Blockquote (esc turned > into &gt;)
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    // HR
    s = s.replace(/^---$/gm, '<hr>');
    // Bold + italic
    s = s.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    s = s.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    // Links [text](url)
    s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Unordered lists (- or * items)
    s = s.replace(/(^|\\n)((?:[-*] .+(?:\\n|$))+)/g, function(_m, pre, block) {
      var items = block.trim().split('\\n').map(function(l) { return '<li>' + l.replace(/^[-*] /, '') + '</li>'; }).join('');
      return pre + '<ul>' + items + '</ul>';
    });
    // Ordered lists
    s = s.replace(/(^|\\n)((?:\\d+\\. .+(?:\\n|$))+)/g, function(_m, pre, block) {
      var items = block.trim().split('\\n').map(function(l) { return '<li>' + l.replace(/^\\d+\\. /, '') + '</li>'; }).join('');
      return pre + '<ol>' + items + '</ol>';
    });
    // Paragraphs (double newline)
    s = s.replace(/\\n\\n+/g, '</p><p>');
    // Single newlines to <br>
    s = s.replace(/\\n/g, '<br>');
    return '<p>' + s + '</p>';
  }

  // =====================
  //  Search
  // =====================

  let searchOpen = false;
  let searchMatches = [];
  let searchIdx = -1;

  function toggleSearch() {
    searchOpen = !searchOpen;
    const bar = document.getElementById('search-bar');
    if (searchOpen) {
      bar.classList.add('open');
      document.getElementById('search-input').focus();
    } else {
      bar.classList.remove('open');
      document.getElementById('search-input').value = '';
      clearSearchHighlights();
      searchMatches = [];
      searchIdx = -1;
      document.getElementById('search-info').textContent = '';
    }
  }

  function doSearch() {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    clearSearchHighlights();
    searchMatches = [];
    searchIdx = -1;
    if (!q) { document.getElementById('search-info').textContent = ''; return; }

    const tree = getActiveTree();
    if (!tree) return;
    for (const node of Object.values(tree.nodes)) {
      if (node.label.toLowerCase().includes(q) || node.content.toLowerCase().includes(q)) {
        searchMatches.push(node.id);
      }
    }
    document.getElementById('search-info').textContent = searchMatches.length + ' found';
    // Highlight matches
    for (const nid of searchMatches) {
      const el = document.querySelector('.node[data-id="' + CSS.escape(nid) + '"]');
      if (el) el.classList.add('search-match');
    }
    if (searchMatches.length > 0) searchNav(0);
  }

  function searchNav(dir) {
    if (searchMatches.length === 0) return;
    // Remove previous active
    if (searchIdx >= 0) {
      const prev = document.querySelector('.node.search-active');
      if (prev) prev.classList.remove('search-active');
    }
    if (dir === 0) searchIdx = 0;
    else searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;

    const nid = searchMatches[searchIdx];
    const el = document.querySelector('.node[data-id="' + CSS.escape(nid) + '"]');
    if (el) {
      el.classList.add('search-active');
      // Scroll into view by adjusting camera
      const rect = el.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 - vr.left;
      const cy = rect.top + rect.height / 2 - vr.top;
      cam.x += vr.width / 2 - cx;
      cam.y += vr.height / 2 - cy;
      applyTransform();
      requestAnimationFrame(drawLines);
    }
    document.getElementById('search-info').textContent = (searchIdx + 1) + '/' + searchMatches.length;
  }

  function clearSearchHighlights() {
    document.querySelectorAll('.node.search-match, .node.search-active')
      .forEach(n => { n.classList.remove('search-match', 'search-active'); });
  }

  document.getElementById('search-input').addEventListener('input', doSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchNav(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); toggleSearch(); }
  });

  // =====================
  //  Export
  // =====================

  function treeToMarkdown() {
    const tree = getActiveTree();
    if (!tree) return '';
    const lines = ['# ' + (tree.title || 'Exploration Tree'), ''];
    function walk(nodeId, indent) {
      const node = tree.nodes[nodeId];
      if (!node) return;
      const prefix = indent === 0 ? '' : '  '.repeat(indent - 1) + '- ';
      lines.push(prefix + '**' + node.label + '**' + (node.content ? ': ' + node.content.split('\\n')[0] : ''));
      for (const cid of node.children) walk(cid, indent + 1);
    }
    walk(tree.rootId, 0);
    return lines.join('\\n');
  }

  function treeToMermaid() {
    const tree = getActiveTree();
    if (!tree) return '';
    const lines = ['mindmap'];
    function walk(nodeId, depth) {
      const node = tree.nodes[nodeId];
      if (!node) return;
      const indent = '  '.repeat(depth + 1);
      const label = node.label.replace(/[()]/g, ' ');
      lines.push(indent + label);
      for (const cid of node.children) walk(cid, depth + 1);
    }
    walk(tree.rootId, 0);
    return lines.join('\\n');
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    const md = treeToMarkdown();
    if (!md) { showToast('No tree data to export', 'error'); return; }
    const tree = getActiveTree();
    const name = (tree?.title || 'exploration').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(name + '.md', md);
    showToast('Exported as Markdown', 'success');
  }

  function exportMermaid() {
    const mm = treeToMermaid();
    if (!mm) { showToast('No tree data to export', 'error'); return; }
    const tree = getActiveTree();
    const name = (tree?.title || 'exploration').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(name + '.mmd', mm);
    showToast('Exported as Mermaid', 'success');
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchOpen) toggleSearch();
      else closePanel();
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'f') { e.preventDefault(); if (!searchOpen) toggleSearch(); else document.getElementById('search-input').focus(); }
    if (mod && e.key === '0') { e.preventDefault(); resetView(); }
    if (mod && e.key === '1') { e.preventDefault(); fitToView(); }
    if (mod && e.key === '=') { e.preventDefault(); zoomBy(0.15); }
    if (mod && e.key === '-') { e.preventDefault(); zoomBy(-0.15); }
    // Tab switching: Cmd+[ / Cmd+]
    if (mod && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      const ids = [...sessions.keys()];
      const idx = ids.indexOf(activeId);
      if (idx < 0) return;
      const next = e.key === ']' ? (idx + 1) % ids.length : (idx - 1 + ids.length) % ids.length;
      switchTo(ids[next]);
    }
  });

  // =====================
  //  Init
  // =====================

  applyTransform();
  // Boot self session immediately, then poll for others
  openSession(SELF);
  activeId = SELF.id;
  setInterval(pollSessions, SESSION_POLL_MS);
  // First poll after a short delay
  setTimeout(pollSessions, 500);
</script>
</body>
</html>`;
}
