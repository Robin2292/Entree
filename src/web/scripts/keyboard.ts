/** Global keyboard shortcuts. */
export const keyboardScript = `
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
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); doRedo(); }
    if (mod && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      const ids = [...sessions.keys()];
      const idx = ids.indexOf(activeId);
      if (idx < 0) return;
      const next = e.key === ']' ? (idx + 1) % ids.length : (idx - 1 + ids.length) % ids.length;
      switchTo(ids[next]);
    }
  });
`;
