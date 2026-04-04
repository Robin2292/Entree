/** Pure utilities: escaping, toasts, markdown renderer. */
export const utilsScript = `
  // =====================
  //  Utilities
  // =====================

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escAttr(str) {
    return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url, allowDataImage) {
    if (!url) return '';
    var trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('#') || trimmed.startsWith('/')) return url;
    if (allowDataImage && trimmed.startsWith('data:image/')) return url;
    return '';
  }

  function showToast(msg, type) {
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function highlightText(text, query) {
    if (!query) return esc(text);
    const escaped = esc(text);
    const q = esc(query);
    const re = new RegExp('(' + q.replace(/[.*+?^$\\x7b\\x7d()|\\\\[\\\\]\\\\\\\\]/g, '\\\\\\\\$&') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function countSubtree(tree, nodeId) {
    const node = tree.nodes[nodeId];
    if (!node) return 0;
    let count = 1;
    for (const cid of node.children) count += countSubtree(tree, cid);
    return count;
  }

  // =====================
  //  Markdown renderer
  // =====================

  function renderMd(raw) {
    if (!raw) return '<span style="color:var(--text-dim)">(No detailed content yet)</span>';
    var s = esc(raw);

    // Code blocks (must be first — protect contents from further transforms)
    var codeBlocks = [];
    s = s.replace(/\\x60\\x60\\x60(\\w*?)\\n([\\s\\S]*?)\\x60\\x60\\x60/g, function(_m, lang, code) {
      codeBlocks.push('<pre><code>' + code + '</code></pre>');
      return '\\x00CB' + (codeBlocks.length - 1) + '\\x00';
    });
    s = s.replace(/\\x60\\x60\\x60([\\s\\S]*?)\\x60\\x60\\x60/g, function(_m, code) {
      codeBlocks.push('<pre><code>' + code + '</code></pre>');
      return '\\x00CB' + (codeBlocks.length - 1) + '\\x00';
    });

    // Inline code (protect from further transforms)
    var inlineCodes = [];
    s = s.replace(/\\x60([^\\x60]+)\\x60/g, function(_m, code) {
      inlineCodes.push('<code>' + code + '</code>');
      return '\\x00IC' + (inlineCodes.length - 1) + '\\x00';
    });

    // Tables: detect consecutive lines with | separators
    s = s.replace(/(^|\\n)(\\|.+\\|\\n\\|[\\s:|-]+\\|\\n(?:\\|.+\\|(?:\\n|$))*)/g, function(_m, pre, block) {
      var rows = block.trim().split('\\n');
      if (rows.length < 2) return pre + block;
      // Parse alignment from separator row
      var seps = rows[1].split('|').filter(function(c) { return c.trim() !== ''; });
      var aligns = seps.map(function(c) {
        c = c.trim();
        if (c.charAt(0) === ':' && c.charAt(c.length - 1) === ':') return 'center';
        if (c.charAt(c.length - 1) === ':') return 'right';
        return 'left';
      });
      // Header
      var hCells = rows[0].split('|').filter(function(c) { return c.trim() !== ''; });
      var html = '<table><thead><tr>';
      hCells.forEach(function(c, i) {
        html += '<th style="text-align:' + (aligns[i] || 'left') + '">' + c.trim() + '</th>';
      });
      html += '</tr></thead><tbody>';
      // Body rows
      for (var r = 2; r < rows.length; r++) {
        var cells = rows[r].split('|').filter(function(c) { return c.trim() !== ''; });
        html += '<tr>';
        cells.forEach(function(c, i) {
          html += '<td style="text-align:' + (aligns[i] || 'left') + '">' + c.trim() + '</td>';
        });
        html += '</tr>';
      }
      html += '</tbody></table>';
      return pre + html;
    });

    // Headers
    s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Blockquote (esc turned > into &gt;)
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // HR
    s = s.replace(/^---$/gm, '<hr>');

    // Strikethrough
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Bold + italic
    s = s.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    s = s.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

    // Images ![alt](url) — sanitize URL protocol
    s = s.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, function(_m, alt, url) {
      return '<img src="' + escAttr(sanitizeUrl(url, true)) + '" alt="' + escAttr(alt) + '" />';
    });

    // Links [text](url) — sanitize URL protocol
    s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(_m, text, url) {
      return '<a href="' + escAttr(sanitizeUrl(url, false)) + '" target="_blank" rel="noopener">' + text + '</a>';
    });

    // Task lists (- [x] or - [ ])
    s = s.replace(/(^|\\n)((?:[-*] \\[[ xX]\\] .+(?:\\n|$))+)/g, function(_m, pre, block) {
      var items = block.trim().split('\\n').map(function(l) {
        var checked = /^[-*] \\[[xX]\\]/.test(l);
        var text = l.replace(/^[-*] \\[[ xX]\\] /, '');
        return '<li class="task-item"><input type="checkbox"' + (checked ? ' checked' : '') + ' />' + text + '</li>';
      }).join('');
      return pre + '<ul>' + items + '</ul>';
    });

    // Unordered lists (- or * items, but not task lists already handled)
    s = s.replace(/(^|\\n)((?:[-*] (?!\\[[ xX]\\]).+(?:\\n|$))+)/g, function(_m, pre, block) {
      var items = block.trim().split('\\n').map(function(l) { return '<li>' + l.replace(/^[-*] /, '') + '</li>'; }).join('');
      return pre + '<ul>' + items + '</ul>';
    });

    // Ordered lists
    s = s.replace(/(^|\\n)((?:\\d+\\. .+(?:\\n|$))+)/g, function(_m, pre, block) {
      var items = block.trim().split('\\n').map(function(l) { return '<li>' + l.replace(/^\\d+\\. /, '') + '</li>'; }).join('');
      return pre + '<ol>' + items + '</ol>';
    });

    // Paragraphs
    s = s.replace(/\\n\\n+/g, '</p><p>');
    s = s.replace(/\\n/g, '<br>');

    // Restore inline code
    for (var i = 0; i < inlineCodes.length; i++) {
      s = s.replace('\\x00IC' + i + '\\x00', inlineCodes[i]);
    }

    // Restore code blocks
    for (var i = 0; i < codeBlocks.length; i++) {
      s = s.replace('\\x00CB' + i + '\\x00', codeBlocks[i]);
    }

    return '<p>' + s + '</p>';
  }
`;
