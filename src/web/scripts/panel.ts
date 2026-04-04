/** Detail panel: select, close, delete, resize handle. */
export const panelScript = `
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
      'Depth: ' + node.depth + ' \\u00b7 Children: ' + node.children.length + ' \\u00b7 ID: ' + node.id.slice(0,8) + '...';
    document.getElementById('panel-content').innerHTML = renderMd(node.content);
    document.getElementById('detail-panel').classList.add('open');

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
    if (node.parentId === null) return;

    const childCount = countSubtree(tree, selectedNodeId) - 1;
    const msg = childCount > 0
      ? 'Delete "' + node.label + '" and ' + childCount + ' child node(s)?'
      : 'Delete "' + node.label + '"?';
    if (!confirm(msg)) return;

    const entry = sessions.get(activeId);
    if (!entry) return;
    const port = entry.info.port;

    try {
      const resp = await authFetch('http://localhost:' + port + '/api/nodes/' + encodeURIComponent(selectedNodeId) + '/delete', {
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

  async function copyNodeContent() {
    if (!selectedNodeId) return;
    const tree = getActiveTree();
    if (!tree) return;
    const node = tree.nodes[selectedNodeId];
    if (!node) return;
    var text = node.label + (node.content ? '\\n\\n' + node.content : '');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  }

  // =====================
  //  Panel resize
  // =====================

  (function() {
    const handle = document.getElementById('panel-resize-handle');
    const panel = document.getElementById('detail-panel');
    let dragging = false;
    let startX = 0;
    let startW = 0;

    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startW = panel.offsetWidth;
      handle.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const delta = startX - e.clientX;
      const newW = Math.min(window.innerWidth * 0.8, Math.max(320, startW + delta));
      panel.style.width = newW + 'px';
    });

    handle.addEventListener('pointerup', () => {
      dragging = false;
      handle.classList.remove('dragging');
      panel.style.transition = '';
    });

    handle.addEventListener('pointercancel', () => {
      dragging = false;
      handle.classList.remove('dragging');
      panel.style.transition = '';
    });
  })();
`;
