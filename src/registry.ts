import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface Session {
  id: string;
  name: string;
  port: number;
  pid: number;
  cwd: string;
  startedAt: string;
  token?: string;
}

const BASE_DIR = join(homedir(), ".entree");
const SESSIONS_FILE = join(BASE_DIR, "sessions.json");
const TREES_DIR = join(BASE_DIR, "trees");

export function getTreesDir() {
  mkdirSync(TREES_DIR, { recursive: true, mode: 0o700 });
  return TREES_DIR;
}

function ensureDirs() {
  mkdirSync(TREES_DIR, { recursive: true, mode: 0o700 });
}

function readSessions(): Session[] {
  ensureDirs();
  if (!existsSync(SESSIONS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeSessions(sessions: Session[]) {
  ensureDirs();
  const tmp = SESSIONS_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(sessions, null, 2), { mode: 0o600 });
  renameSync(tmp, SESSIONS_FILE);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function cleanStaleSessions(): Session[] {
  const all = readSessions();
  const alive: Session[] = [];
  for (const s of all) {
    if (isAlive(s.pid)) {
      alive.push(s);
    } else {
      // Clean up stale tree file
      const treeFile = join(TREES_DIR, `${s.id}.json`);
      try { unlinkSync(treeFile); } catch {}
    }
  }
  writeSessions(alive);
  return alive;
}

export function registerSession(session: Session) {
  const sessions = cleanStaleSessions().filter((s) => s.id !== session.id);
  sessions.push(session);
  writeSessions(sessions);
}

export function unregisterSession(id: string) {
  const sessions = readSessions().filter((s) => s.id !== id);
  writeSessions(sessions);
  const treeFile = join(TREES_DIR, `${id}.json`);
  try { unlinkSync(treeFile); } catch {}
}

export function getSessions(): Session[] {
  return cleanStaleSessions();
}
