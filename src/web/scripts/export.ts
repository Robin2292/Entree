/** Export, Import (JSON), Undo, Redo. */
export const exportScript = `
  // =====================
  //  Undo / Redo
  // =====================

  function updateUndoButtons(canUndo, canRedo) {
    document.getElementById('btn-undo').disabled = !canUndo;
    document.getElementById('btn-redo').disabled = !canRedo;
  }

  async function doUndo() {
    const entry = sessions.get(activeId);
    if (!entry) return;
    try {
      const resp = await authFetch('http://localhost:' + entry.info.port + '/api/undo', { method: 'POST' });
      const data = await resp.json();
      updateUndoButtons(data.canUndo, data.canRedo);
      if (!data.ok) showToast('Nothing to undo', 'error');
    } catch (err) {
      showToast('Undo failed: ' + err.message, 'error');
    }
  }

  async function doRedo() {
    const entry = sessions.get(activeId);
    if (!entry) return;
    try {
      const resp = await authFetch('http://localhost:' + entry.info.port + '/api/redo', { method: 'POST' });
      const data = await resp.json();
      updateUndoButtons(data.canUndo, data.canRedo);
      if (!data.ok) showToast('Nothing to redo', 'error');
    } catch (err) {
      showToast('Redo failed: ' + err.message, 'error');
    }
  }

  // =====================
  //  Export
  // =====================

  function exportJSON() {
    const tree = getActiveTree();
    if (!tree) { showToast('No tree data to export', 'error'); return; }
    const name = (tree.title || 'exploration').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name + '.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported as JSON', 'success');
  }

  // =====================
  //  Import
  // =====================

  const importFileInput = document.getElementById('import-file-input');

  function importJSON() {
    importFileInput.value = '';
    importFileInput.click();
  }

  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        showToast('Invalid JSON file', 'error');
        return;
      }

      const entry = sessions.get(activeId);
      if (!entry) { showToast('No active session', 'error'); return; }

      const resp = await authFetch('http://localhost:' + entry.info.port + '/api/tree/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (resp.ok) {
        const result = await resp.json();
        showToast('Imported: ' + result.nodeCount + ' nodes', 'success');
        requestAnimationFrame(fitToView);
      } else {
        const err = await resp.json().catch(() => ({}));
        showToast('Import failed: ' + (err.error || 'unknown error'), 'error');
      }
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  });
`;
