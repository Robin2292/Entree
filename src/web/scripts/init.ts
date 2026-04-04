/** Boot sequence: must load last. */
export const initScript = `
  applyTransform();
  openSession(SELF);
  activeId = SELF.id;
  setInterval(pollSessions, SESSION_POLL_MS);
  setTimeout(pollSessions, 500);
`;
