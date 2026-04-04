/**
 * Composes the full HTML page from styles + structure + script modules.
 * Each script module is a self-contained feature that shares global state.
 * Load order matters: state → utils → sessions → camera → renderer → panel → search → export → keyboard → init
 */

import type { Session } from "../registry.js";
import { styles } from "./styles.js";
import { stateScript } from "./scripts/state.js";
import { utilsScript } from "./scripts/utils.js";
import { sessionsScript } from "./scripts/sessions.js";
import { cameraScript } from "./scripts/camera.js";
import { rendererScript } from "./scripts/renderer.js";
import { panelScript } from "./scripts/panel.js";
import { searchScript } from "./scripts/search.js";
import { exportScript } from "./scripts/export.js";
import { keyboardScript } from "./scripts/keyboard.js";
import { initScript } from "./scripts/init.js";

export function getHTML(session: Session): string {
  const selfJson = JSON.stringify(session).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entree</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='80' font-size='80'%3E🌳%3C/text%3E%3C/svg%3E">
<style>${styles}</style>
</head>
<body>

<div id="header">
  <span class="logo">🌳</span>
  <div id="tabs"></div>
  <div class="controls">
    <button class="ctrl-btn search-btn" id="search-toggle-btn" onclick="toggleSearch()" title="Search (Cmd+F)">⌕ Search</button>
    <div class="divider"></div>
    <button class="ctrl-btn" id="btn-undo" onclick="doUndo()" title="Undo (Cmd+Z)" disabled>↶</button>
    <button class="ctrl-btn" id="btn-redo" onclick="doRedo()" title="Redo (Cmd+Shift+Z)" disabled>↷</button>
    <div class="divider"></div>
    <button class="ctrl-btn io-btn" onclick="exportJSON()" title="Export JSON">↓ Export</button>
    <button class="ctrl-btn io-btn" onclick="importJSON()" title="Import JSON">↑ Import</button>
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
  <div id="panel-resize-handle"></div>
  <button class="close-btn" onclick="closePanel()">&times;</button>
  <h3 id="panel-label"></h3>
  <div class="meta" id="panel-meta"></div>
  <div class="body" id="panel-content"></div>
  <div class="panel-actions">
    <button class="action-btn danger" id="btn-delete" onclick="deleteSelected()">Delete</button>
  </div>
</div>

<input type="file" id="import-file-input" accept=".json" style="display:none" />

<script>
${stateScript(selfJson)}
${utilsScript}
${sessionsScript}
${cameraScript}
${rendererScript}
${panelScript}
${searchScript}
${exportScript}
${keyboardScript}
${initScript}
</script>
</body>
</html>`;
}
