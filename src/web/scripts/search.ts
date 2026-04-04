/** Search bar: toggle, query, navigate results. */
export const searchScript = `
  // =====================
  //  Search
  // =====================

  let searchOpen = false;

  function toggleSearch() {
    searchOpen = !searchOpen;
    const bar = document.getElementById('search-bar');
    const btn = document.getElementById('search-toggle-btn');
    if (searchOpen) {
      bar.classList.add('open');
      btn.classList.add('active');
      document.getElementById('search-input').focus();
    } else {
      bar.classList.remove('open');
      btn.classList.remove('active');
      document.getElementById('search-input').value = '';
      searchMatches = [];
      searchIdx = -1;
      searchQuery = '';
      document.getElementById('search-info').textContent = '';
      renderTree();
    }
  }

  function doSearch() {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    searchMatches = [];
    searchIdx = -1;
    searchQuery = q;
    if (!q) {
      document.getElementById('search-info').textContent = '';
      renderTree();
      return;
    }

    const tree = getActiveTree();
    if (!tree) return;
    for (const node of Object.values(tree.nodes)) {
      if (node.label.toLowerCase().includes(q) || node.content.toLowerCase().includes(q)) {
        searchMatches.push(node.id);
      }
    }
    document.getElementById('search-info').textContent = searchMatches.length + ' found';
    renderTree();
    if (searchMatches.length > 0) searchNav(0);
  }

  function searchNav(dir) {
    if (searchMatches.length === 0) return;
    if (dir === 0) searchIdx = 0;
    else searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;

    renderTree();

    const nid = searchMatches[searchIdx];
    const el = document.querySelector('.node[data-id="' + CSS.escape(nid) + '"]');
    if (el) {
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

  document.getElementById('search-input').addEventListener('input', doSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchNav(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); toggleSearch(); }
  });
`;
