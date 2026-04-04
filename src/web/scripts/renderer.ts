/** Tree rendering: DOM build, SVG connectors, node click handling. */
export const rendererScript = `
  // =====================
  //  Tree rendering
  // =====================

  function getActiveTree() {
    const entry = sessions.get(activeId);
    return entry?.treeData || null;
  }

  let renderRafId = null;

  function scheduleRender() {
    if (renderRafId) return;
    renderRafId = requestAnimationFrame(() => {
      renderRafId = null;
      const tree = getActiveTree();
      const ts = tree?.updatedAt;
      if (ts && ts === lastRenderedAt) return;
      lastRenderedAt = ts || null;
      renderTree();
    });
  }

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
          + '<div class="icon">\u{1F331}</div>'
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
    const isMatch = searchMatches.includes(nodeId);
    const isActive = searchIdx >= 0 && searchMatches[searchIdx] === nodeId;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(nodeId);
    const cls = 'node' + (isRoot ? ' root' : '') + (isSelected ? ' selected' : '')
      + (isMatch ? ' search-match' : '') + (isActive ? ' search-active' : '');

    const labelHtml = isMatch ? highlightText(node.label, searchQuery) : esc(node.label);
    const contentHtml = node.content ? (isMatch ? highlightText(node.content, searchQuery) : esc(node.content)) : '';

    let h = '<div class="node-group" data-node-id="' + escAttr(nodeId) + '">'
      + '<div class="' + cls + '" data-id="' + escAttr(nodeId) + '">'
      + (!isRoot ? '<span class="depth-badge">' + node.depth + '</span>' : '')
      + '<div class="label">' + labelHtml + '</div>'
      + (node.content ? '<div class="content">' + contentHtml + '</div>' : '');

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

  // SVG connectors
  function drawLines() {
    document.querySelectorAll('svg.lines').forEach(s => s.remove());

    const z = cam.zoom || 1;
    const rows = document.querySelectorAll('.children-row');
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
        const cy = (cr.top - rr.top) / z;
        const vl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vl.setAttribute('x1', cx); vl.setAttribute('y1', 0);
        vl.setAttribute('x2', cx); vl.setAttribute('y2', cy);
        svg.appendChild(vl);
      }
      row.appendChild(svg);
    }
  }
`;
