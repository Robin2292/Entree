/** Session lifecycle: WebSocket, connection banner, tabs. */
export const sessionsScript = `
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
      const resp = await authFetch('/api/sessions');
      const list = await resp.json();
      const ids = new Set(list.map(s => s.id));

      for (const s of list) {
        if (!sessions.has(s.id)) openSession(s);
      }

      for (const [id] of sessions) {
        if (!ids.has(id) && id !== SELF.id) closeSession(id);
      }

      renderTabs();
    } catch (err) {
      console.warn('Session poll failed:', err);
    }
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

    const wsUrl = (id === SELF.id
      ? 'ws://' + location.host
      : 'ws://localhost:' + entry.info.port)
      + '?token=' + encodeURIComponent(TOKEN);

    const ws = new WebSocket(wsUrl);
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
      const delay = Math.min(1000 * Math.pow(2, entry.retryCount - 1), 30000);
      setTimeout(() => {
        if (sessions.has(id)) connectWs(id);
      }, delay);
    };

    ws.onerror = () => {};
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
`;
