/** Global config, state, and DOM refs. Must load first. */
export function stateScript(selfJson: string): string {
  return `
  // === Config ===
  const SELF = ${selfJson};
  const ZOOM_MIN = 0.15;
  const ZOOM_MAX = 3;
  const SESSION_POLL_MS = 4000;

  // === State ===
  const sessions = new Map(); // id -> { info, ws, treeData, connected }
  let activeId = null;
  let selectedNodeId = null;
  const collapsedNodes = new Set();
  const cam = { x: 0, y: 0, zoom: 1 };

  // Shared between renderer and search
  let searchQuery = '';
  let searchMatches = [];
  let searchIdx = -1;
  let lastRenderedAt = null;

  // Auth
  const TOKEN = SELF.token || '';

  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Authorization': 'Bearer ' + TOKEN }, opts.headers || {});
    return fetch(url, opts).catch(err => {
      // Provide clearer error for cross-origin / network failures
      try {
        const u = new URL(url, location.origin);
        if (u.origin !== location.origin) {
          throw new Error('Cannot reach session at ' + u.origin + ' (cross-origin request blocked or session is down)');
        }
      } catch (parseErr) {
        if (parseErr.message.includes('Cannot reach session')) throw parseErr;
      }
      throw err;
    });
  }

  // DOM refs
  const viewport = document.getElementById('viewport');
  const canvasEl = document.getElementById('canvas');
  const tabsEl = document.getElementById('tabs');
`;
}
