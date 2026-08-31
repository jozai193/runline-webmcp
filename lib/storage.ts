import { env } from 'cloudflare:workers';
import { DomainError } from './domain.ts';
import type { Workspace } from './domain.ts';

function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db)
    throw new DomainError(
      'STORAGE_UNAVAILABLE',
      'Workspace storage is temporarily unavailable. Your changes have not been saved.',
    );
  return db;
}

export async function initDatabase() {
  const db = database();
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS workspaces (
    token_hash TEXT PRIMARY KEY NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`)
    .run();
  await db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at)',
    )
    .run();
  return db;
}
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function cookieToken(request: Request) {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('runline_workspace='))
    ?.slice('runline_workspace='.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function loadWorkspace(request: Request) {
  const token = cookieToken(request);
  if (!token) return null;
  const key = await hashToken(token),
    db = await initDatabase();
  const row = await db
    .prepare(
      'SELECT payload, version FROM workspaces WHERE token_hash = ? AND updated_at >= ?',
    )
    .bind(key, Date.now() - 7 * 86400000)
    .first<{ payload: string; version: number }>();
  if (!row) return null;
  const state = JSON.parse(row.payload) as Workspace;
  return { key, state: { ...state, version: row.version } };
}
export async function saveWorkspace(
  key: string,
  previousVersion: number,
  state: Workspace,
) {
  const db = database();
  const result = await db
    .prepare(
      'UPDATE workspaces SET payload = ?, version = ?, updated_at = ? WHERE token_hash = ? AND version = ?',
    )
    .bind(
      JSON.stringify(state),
      state.version,
      Date.now(),
      key,
      previousVersion,
    )
    .run();
  if (result.meta.changes !== 1)
    throw new DomainError(
      'STALE_VERSION',
      'A newer edit was saved first. Refresh before making this change.',
    );
}
