import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerSession,
  unregisterSession,
  getSessions,
  cleanStaleSessions,
  getTreesDir,
  type Session,
} from "./registry.js";
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const ENTREE_DIR = join(homedir(), ".entree");
const SESSIONS_FILE = join(ENTREE_DIR, "sessions.json");
const TREES_DIR = join(ENTREE_DIR, "trees");

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "Test Session",
    port: 3299,
    pid: process.pid, // current process is always alive
    cwd: "/tmp",
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Save and restore sessions file to avoid polluting the real registry
let originalSessions: string | null = null;

beforeEach(() => {
  try {
    originalSessions = readFileSync(SESSIONS_FILE, "utf-8");
  } catch {
    originalSessions = null;
  }
});

afterEach(() => {
  if (originalSessions !== null) {
    writeFileSync(SESSIONS_FILE, originalSessions, { mode: 0o600 });
  } else {
    try { rmSync(SESSIONS_FILE); } catch {}
  }
});

describe("registry", () => {
  describe("getTreesDir", () => {
    it("returns the trees directory path", () => {
      const dir = getTreesDir();
      expect(dir).toBe(TREES_DIR);
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe("registerSession", () => {
    it("registers a new session", () => {
      const session = makeSession();
      registerSession(session);

      const sessions = getSessions();
      expect(sessions.some((s) => s.id === session.id)).toBe(true);
    });

    it("replaces session with same ID on re-register", () => {
      const session = makeSession();
      registerSession(session);
      registerSession({ ...session, name: "Updated" });

      const sessions = getSessions();
      const found = sessions.filter((s) => s.id === session.id);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe("Updated");
    });
  });

  describe("unregisterSession", () => {
    it("removes the session", () => {
      const session = makeSession();
      registerSession(session);
      unregisterSession(session.id);

      const sessions = getSessions();
      expect(sessions.some((s) => s.id === session.id)).toBe(false);
    });

    it("cleans up the tree file", () => {
      const session = makeSession();
      const treeFile = join(TREES_DIR, `${session.id}.json`);
      mkdirSync(TREES_DIR, { recursive: true });
      writeFileSync(treeFile, "{}", "utf-8");

      registerSession(session);
      unregisterSession(session.id);

      expect(existsSync(treeFile)).toBe(false);
    });
  });

  describe("cleanStaleSessions", () => {
    it("removes sessions with dead PIDs", () => {
      const staleSession = makeSession({
        pid: 999999, // very unlikely to be a real process
      });
      // Directly write to bypass cleanStaleSessions in registerSession
      const currentSessions = getSessions();
      currentSessions.push(staleSession);
      writeFileSync(
        SESSIONS_FILE,
        JSON.stringify(currentSessions, null, 2),
        { mode: 0o600 }
      );

      const alive = cleanStaleSessions();
      expect(alive.some((s) => s.id === staleSession.id)).toBe(false);
    });

    it("keeps sessions with live PIDs", () => {
      const liveSession = makeSession({ pid: process.pid });
      registerSession(liveSession);

      const alive = cleanStaleSessions();
      expect(alive.some((s) => s.id === liveSession.id)).toBe(true);
    });
  });

  describe("getSessions", () => {
    it("returns an array", () => {
      const sessions = getSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});
