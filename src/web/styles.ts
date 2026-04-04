/** All CSS for the Entree web UI. */
export const styles = `
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
  .ctrl-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--text);
  }
  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    flex-shrink: 0;
  }

  /* ---- IO buttons ---- */
  .io-btn {
    width: auto !important;
    padding: 0 10px !important;
    font-size: 11px !important;
    gap: 3px;
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
    padding-top: 20px;
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
    width: 480px; bottom: 0;
    min-width: 320px;
    max-width: 80vw;
    background: var(--surface);
    border-left: 1px solid var(--border);
    padding: 20px 20px 20px 28px;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    z-index: 50;
    overflow-y: auto;
  }
  #detail-panel.open { transform: translateX(0); }

  /* Resize handle */
  #panel-resize-handle {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 51;
    background: transparent;
    transition: background 0.15s;
  }
  #panel-resize-handle:hover,
  #panel-resize-handle.dragging {
    background: var(--accent);
  }

  #detail-panel h3 {
    font-size: 16px;
    margin-bottom: 12px;
    color: var(--accent);
    user-select: text;
    cursor: text;
  }
  #detail-panel .meta {
    font-size: 11px;
    color: var(--text-dim);
    margin-bottom: 16px;
    user-select: text;
    cursor: text;
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
  #detail-panel .body del {
    color: var(--text-dim);
    text-decoration: line-through;
  }
  #detail-panel .body table {
    border-collapse: collapse;
    margin: 8px 0;
    width: 100%;
    font-size: 12px;
  }
  #detail-panel .body th, #detail-panel .body td {
    border: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
  }
  #detail-panel .body th {
    background: var(--bg);
    font-weight: 600;
    color: var(--text);
  }
  #detail-panel .body tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  #detail-panel .body .task-item {
    list-style: none;
    margin-left: -20px;
  }
  #detail-panel .body .task-item input[type="checkbox"] {
    margin-right: 6px;
    pointer-events: none;
  }
  #detail-panel .body img {
    max-width: 100%;
    border-radius: 6px;
    margin: 6px 0;
  }
  #detail-panel .body { user-select: text; cursor: text; }

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

  /* Search button */
  .search-btn {
    width: auto !important;
    padding: 0 12px !important;
    gap: 5px;
    font-size: 12px !important;
    background: rgba(88,166,255,0.1) !important;
    border-color: var(--accent) !important;
    color: var(--accent) !important;
    font-weight: 500;
  }
  .search-btn:hover {
    background: rgba(88,166,255,0.2) !important;
    box-shadow: 0 0 12px rgba(88,166,255,0.2);
  }
  .search-btn.active {
    background: var(--accent) !important;
    color: var(--bg) !important;
  }

  /* Search match highlighting */
  .node.search-match {
    outline: 2px solid var(--yellow);
    outline-offset: 3px;
    box-shadow: 0 0 16px rgba(210,153,34,0.25);
  }
  .node.search-active {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
    box-shadow: 0 0 28px rgba(88,166,255,0.35);
    transform: translateY(-2px);
  }

  .node .label mark, .node .content mark {
    background: rgba(210,153,34,0.3);
    color: var(--yellow);
    border-radius: 2px;
    padding: 0 2px;
  }
  .node.search-active .label mark, .node.search-active .content mark {
    background: rgba(88,166,255,0.3);
    color: var(--accent);
  }
`;
