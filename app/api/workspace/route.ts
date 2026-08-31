import { DomainError } from '@/lib/domain';
import { transition } from '@/lib/actions';
import { createSample } from '@/lib/sample';
import {
  cookieToken,
  hashToken,
  initDatabase,
  loadWorkspace,
  saveWorkspace,
} from '@/lib/storage';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) => Response.json(body, { status, headers: { ...headers, ...extra } });
function workspaceCookie(token: string, request: Request) {
  return `runline_workspace=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return json(
      { error: error.message, code: error.code },
      error.code.startsWith('STALE')
        ? 409
        : error.code === 'STORAGE_UNAVAILABLE'
          ? 503
          : 400,
    );
  console.error(
    'Workspace request failed:',
    error instanceof Error ? error.message : 'unknown error',
  );
  return json(
    {
      error:
        'The workspace could not be saved. Try again; no unconfirmed changes are shown as saved.',
      code: 'STORAGE_ERROR',
    },
    503,
  );
}
function validOrigin(request: Request) {
  return (
    request.headers.get('origin') === new URL(request.url).origin &&
    request.headers.get('x-runline-action') === '1'
  );
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0,
    text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 60000) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function GET(request: Request) {
  try {
    const result = await loadWorkspace(request);
    return result
      ? json(result.state)
      : json(
          { error: 'Start a workspace to continue.', code: 'NO_WORKSPACE' },
          404,
        );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    // Drain a bounded body before rejecting: Wrangler's static-assets proxy can
    // terminate its process if a response leaves a request stream unread.
    // https://github.com/cloudflare/workers-sdk/issues/15203
    const raw = await readBody(request);
    if (raw === null)
      return json(
        { error: 'This request is too large.', code: 'TOO_LARGE' },
        413,
      );
    if (!validOrigin(request))
      return json(
        { error: 'A same-origin request is required.', code: 'ORIGIN_REQUIRED' },
        403,
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Use application/json.', code: 'CONTENT_TYPE' }, 415);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON.', code: 'INVALID_JSON' }, 400);
    }
    if (
      input &&
      typeof input === 'object' &&
      'action' in input &&
      input.action === 'create'
    ) {
      const existing = await loadWorkspace(request);
      if (existing) return json(existing.state);
      const token = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
      const db = await initDatabase(),
        state = createSample();
      await db
        .prepare('DELETE FROM workspaces WHERE updated_at < ?')
        .bind(Date.now() - 7 * 86400000)
        .run();
      await db
        .prepare(
          'INSERT INTO workspaces(token_hash, version, payload, updated_at) VALUES (?, ?, ?, ?)',
        )
        .bind(await hashToken(token), 0, JSON.stringify(state), Date.now())
        .run();
      return json(state, 201, {
        'Set-Cookie': workspaceCookie(token, request),
      });
    }
    const existing = await loadWorkspace(request);
    if (!existing)
      return json(
        {
          error: 'Your demo workspace expired. Reload to start a new one.',
          code: 'NO_WORKSPACE',
        },
        404,
      );
    const next = transition(existing.state, input);
    await saveWorkspace(existing.key, existing.state.version, next);
    return json(next, 200, {
      'Set-Cookie': workspaceCookie(cookieToken(request)!, request),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
