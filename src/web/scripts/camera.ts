/** Camera: pan, zoom, fit-to-view. */
export const cameraScript = `
  // =====================
  //  Camera (pan + zoom)
  // =====================

  function applyTransform() {
    canvasEl.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.zoom + ')';
    document.getElementById('zoom-display').textContent = Math.round(cam.zoom * 100) + '%';

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
`;
