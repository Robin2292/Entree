/** Boot sequence: must load last. Binds all UI events (no inline onclick). */
export const initScript = `
  // Header buttons
  document.getElementById('search-toggle-btn').addEventListener('click', toggleSearch);
  document.getElementById('btn-undo').addEventListener('click', doUndo);
  document.getElementById('btn-redo').addEventListener('click', doRedo);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', importJSON);
  document.getElementById('btn-zoom-out').addEventListener('click', function() { zoomBy(-0.15); });
  document.getElementById('btn-zoom-in').addEventListener('click', function() { zoomBy(0.15); });
  document.getElementById('btn-fit').addEventListener('click', fitToView);
  document.getElementById('btn-reset-view').addEventListener('click', resetView);

  // Search bar buttons
  document.getElementById('btn-search-prev').addEventListener('click', function() { searchNav(-1); });
  document.getElementById('btn-search-next').addEventListener('click', function() { searchNav(1); });
  document.getElementById('btn-search-close').addEventListener('click', toggleSearch);

  // Detail panel buttons
  document.getElementById('btn-close-panel').addEventListener('click', closePanel);
  document.getElementById('btn-copy').addEventListener('click', copyNodeContent);
  document.getElementById('btn-delete').addEventListener('click', deleteSelected);

  // Boot
  applyTransform();
  openSession(SELF);
  activeId = SELF.id;
  setInterval(pollSessions, SESSION_POLL_MS);
  setTimeout(pollSessions, 500);
`;
