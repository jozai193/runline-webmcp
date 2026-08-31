import assert from 'node:assert/strict';
const origin = process.env.RUNLINE_TEST_URL ?? 'http://localhost:3000';
let cookie = '',
  count = 0;
const checks = [];
async function request(url, options) {
  // Consume every response, including expected errors, before recycling sockets.
  // This also keeps the HTTP test harness from leaking unread response streams.
  const response = await fetch(url, options);
  const body = await response.text();
  return new Response(body, { status: response.status, headers: response.headers });
}
async function post(body, extra = {}) {
  return request(origin + '/api/workspace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-Runline-Action': '1',
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  count++;
}
let response = await post({ action: 'create' });
check('workspace created', response.status === 201 || response.status === 200);
const setCookie = response.headers.get('set-cookie');
check(
  'HttpOnly SameSite cookie',
  Boolean(
    setCookie?.includes('HttpOnly') && setCookie.includes('SameSite=Strict'),
  ),
);
cookie = setCookie.split(';')[0];
let state = await response.json();
check('12 sample sessions', state.sessions.length === 12);
const original = JSON.stringify(state.sessions);
response = await post({
  action: 'report_disruption',
  version: state.version,
  disruption: { kind: 'speaker_delay', targetId: 'mira', start: 540, end: 840 },
});
check('disruption persisted', response.ok);
state = await response.json();
check(
  'disruption does not move sessions',
  JSON.stringify(state.sessions) === original,
);
response = await post({
  action: 'propose_repair',
  version: state.version,
  actor: 'agent',
  objective: 'fewest_changes',
});
check('agent repair succeeds', response.ok);
state = await response.json();
check('proposal is feasible', state.proposals[0].conflicts.length === 0);
check(
  'proposal does not mutate schedule',
  JSON.stringify(state.sessions) === original,
);
response = await post({
  action: 'apply_proposal',
  actor: 'agent',
  version: state.version,
  id: state.proposals[0].id,
});
check('agent cannot approve', response.status === 400);
response = await post({
  action: 'apply_proposal',
  actor: 'human',
  version: state.version,
  id: state.proposals[0].id,
});
check('human approval succeeds', response.ok);
state = await response.json();
check('approved changes saved', JSON.stringify(state.sessions) !== original);
response = await request(origin + '/api/workspace', {
  headers: { Cookie: cookie },
});
check(
  'saved state survives reload',
  JSON.stringify((await response.json()).sessions) ===
    JSON.stringify(state.sessions),
);
response = await post({ action: 'reset', version: 0 });
check('stale writes rejected', response.status === 409);
const concurrent = await Promise.all([
  post({
    action: 'set_lock',
    version: state.version,
    id: 'motion',
    locked: true,
  }),
  post({
    action: 'set_lock',
    version: state.version,
    id: 'craft',
    locked: true,
  }),
]);
check(
  'concurrent writes use atomic version guard',
  concurrent.filter((r) => r.status === 200).length === 1 &&
    concurrent.filter((r) => r.status === 409).length === 1,
);
response = await post(
  { action: 'reset', version: 0 },
  { Origin: 'https://untrusted.example' },
);
check('cross-origin mutations blocked', response.status === 403);
response = await post(
  { action: 'reset', version: 0 },
  { 'X-Runline-Action': '' },
);
check('missing CSRF header blocked', response.status === 403);
response = await request(origin + '/api/workspace');
check('workspace unavailable without cookie', response.status === 404);
response = await request(origin + '/api/workspace', {
  headers: { Cookie: 'runline_workspace=' + 'a'.repeat(64) },
});
check('unknown workspace token rejected', response.status === 404);
cookie = '';
response = await post({ action: 'create' });
const second = await response.json();
check(
  'another browser gets isolated sample',
  second.version === 0 && second.disruptions.length === 0,
);
response = await request(origin + '/api/workspace', {
  method: 'POST',
  headers: {
    Origin: origin,
    'X-Runline-Action': '1',
    'Content-Type': 'application/json',
  },
  body: '{',
});
check('malformed JSON rejected', response.status === 400);
response = await request(origin + '/api/workspace', {
  method: 'POST',
  headers: {
    Origin: origin,
    'X-Runline-Action': '1',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'create', note: 'x'.repeat(60001) }),
});
check('oversized request rejected before parsing', response.status === 413);
response = await request(origin + '/api/workspace', {
  method: 'POST',
  headers: {
    Origin: origin,
    'X-Runline-Action': '1',
    'Content-Type': 'text/plain',
  },
  body: '{}',
});
check('non-JSON requests rejected', response.status === 415);
console.log(JSON.stringify({ passed: count, checks }, null, 2));
