import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampusSample, createSample } from '../lib/sample.ts';
import { transition } from '../lib/actions.ts';
import {
  applyMoves,
  expectedAttendance,
  findConflicts,
  repairSchedule,
} from '../lib/engine.ts';
import { parseSchedule } from '../lib/validation.ts';
import { portableSchedule, scheduleCSV, scheduleICS } from '../lib/export.ts';
import { timeLabel, timeValue } from '../lib/domain.ts';
import type { Workspace } from '../lib/domain.ts';
import { buildTools, registerRunlineTools } from '../lib/webmcp.ts';
import { parseScheduleInput } from '../lib/import.ts';

const act = (
  s: Workspace,
  action: string,
  args: Record<string, unknown> = {},
) => transition(s, { version: s.version, action, ...args });
const delayed = () =>
  act(createSample(), 'report_disruption', {
    disruption: {
      kind: 'speaker_delay',
      targetId: 'mira',
      start: 540,
      end: 840,
      note: 'Mira arrives at 14:00.',
    },
  });
const throws = (f: () => unknown, code: string) =>
  assert.throws(f, (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && e.code === code),
  );
const confirmAll = (workspace: Workspace, proposalId: string) => {
  let next = workspace;
  const proposal = next.proposals.find((item) => item.id === proposalId)!;
  for (const consent of proposal.speakerConsents)
    next = act(next, 'record_speaker_consent', {
      id: proposalId,
      speakerId: consent.speakerId,
      decision: 'confirmed',
    });
  return next;
};

void test('sample is valid, isolated, and conflict-free', () => {
  const a = createSample(),
    b = createSample();
  assert.equal(findConflicts(a).length, 0);
  assert.equal(a.sessions.length, 12);
  assert.deepEqual(parseSchedule(a), portableSchedule(a));
  a.sessions[0].title = 'Changed';
  assert.notEqual(a.sessions[0].title, b.sessions[0].title);
});
void test('time conversions reject malformed values', () => {
  assert.equal(timeValue('14:30'), 870);
  assert.equal(timeLabel(615), '10:15');
  for (const bad of ['24:00', '12:99', '', '1:00', 'abc'])
    throws(() => timeValue(bad), 'INVALID_TIME');
});
void test('delay affects the matching speaker, not every session', () => {
  const s = delayed(),
    c = findConflicts(s);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].sessionIds, ['motion']);
});
void test('disruptions do not mutate session placements', () => {
  assert.deepEqual(delayed().sessions, createSample().sessions);
});
void test('room and speaker turnover are enforced on both orderings', () => {
  const s = createSample();
  s.sessions = [
    { ...s.sessions[1], start: 600, duration: 60 },
    { ...s.sessions[8], start: 660, duration: 60 },
  ];
  assert.equal(
    findConflicts(s).filter((c) => c.kind === 'speaker_overlap').length,
    1,
  );
  s.sessions.reverse();
  assert.equal(
    findConflicts(s).filter((c) => c.kind === 'speaker_overlap').length,
    1,
  );
  s.sessions[0].start = 675;
  assert.equal(findConflicts(s).length, 0);
});
void test('room overlap detects insufficient turnover', () => {
  const s = createSample();
  s.sessions[1].start = 600;
  assert.ok(findConflicts(s).some((c) => c.kind === 'room_overlap'));
  s.sessions[1].start = 615;
  assert.ok(!findConflicts(s).some((c) => c.kind === 'room_overlap'));
});
void test('capacity uses the highest current attendance requirement', () => {
  let s = act(createSample(), 'report_disruption', {
    disruption: { kind: 'attendance', targetId: 'make', attendees: 140 },
  });
  assert.equal(
    expectedAttendance(
      s,
      s.sessions.find((x) => x.id === 'make')!,
    ),
    140,
  );
  assert.ok(findConflicts(s).some((c) => c.kind === 'capacity'));
  s = act(s, 'report_disruption', {
    disruption: { kind: 'attendance', targetId: 'make', attendees: 110 },
  });
  assert.equal(
    expectedAttendance(
      s,
      s.sessions.find((x) => x.id === 'make')!,
    ),
    140,
  );
});
void test('hard boundaries and protected lunch are detected', () => {
  const s = createSample();
  s.sessions[1].start = 780;
  assert.ok(findConflicts(s).some((c) => c.kind === 'break'));
  s.sessions[1].start = 1005;
  assert.ok(findConflicts(s).some((c) => c.kind === 'hours'));
});
for (const objective of [
  'fewest_changes',
  'preserve_times',
  'preserve_rooms',
] as const)
  for (const scenario of ['delay', 'closure', 'capacity'] as const)
    void test(`${scenario}: ${objective} repairs without moving locks`, () => {
      let s = createSample();
      const disruption =
        scenario === 'delay'
          ? { kind: 'speaker_delay', targetId: 'mira', start: 540, end: 840 }
          : scenario === 'closure'
            ? { kind: 'room_closed', targetId: 'studio', start: 600, end: 720 }
            : { kind: 'attendance', targetId: 'make', attendees: 140 };
      s = act(s, 'report_disruption', { disruption });
      const before = structuredClone(s);
      const p = repairSchedule(s, objective);
      assert.deepEqual(s, before);
      assert.equal(p.conflicts.length, 0);
      assert.ok(p.changes.length > 0);
      assert.ok(p.metrics.evaluated <= 4500);
      const after = applyMoves(s, p.changes);
      assert.equal(findConflicts({ ...s, sessions: after }).length, 0);
      assert.deepEqual(
        after.filter((x) => x.locked),
        s.sessions.filter((x) => x.locked),
      );
    });
void test('combined incidents can be repaired or explicitly blocked, never falsely safe', () => {
  let s = delayed();
  s = act(s, 'report_disruption', {
    disruption: {
      kind: 'room_closed',
      targetId: 'studio',
      start: 600,
      end: 720,
    },
  });
  s = act(s, 'report_disruption', {
    disruption: { kind: 'attendance', targetId: 'make', attendees: 140 },
  });
  const p = repairSchedule(s);
  assert.deepEqual(
    findConflicts({ ...s, sessions: applyMoves(s, p.changes) }),
    p.conflicts,
  );
  assert.deepEqual(
    s.sessions.filter((x) => x.locked),
    createSample().sessions.filter((x) => x.locked),
  );
});
void test('a blocked locked keynote cannot be silently moved', () => {
  const s = act(createSample(), 'report_disruption', {
      disruption: {
        kind: 'room_closed',
        targetId: 'auditorium',
        start: 540,
        end: 600,
      },
    }),
    p = repairSchedule(s);
  assert.ok(p.conflicts.length > 0);
  assert.equal(p.changes.length, 0);
  throws(
    () =>
      applyMoves(s, [
        { sessionId: 'opening', start: 615, roomId: 'auditorium' },
      ]),
    'LOCKED_SESSION',
  );
});
void test('impossible attendance remains blocked', () => {
  const s = act(createSample(), 'report_disruption', {
      disruption: { kind: 'attendance', targetId: 'make', attendees: 1000 },
    }),
    p = repairSchedule(s);
  assert.ok(p.conflicts.length > 0);
});
void test('no-op search is explicit and cannot be applied', () => {
  const s = act(createSample(), 'propose_repair', {
    objective: 'fewest_changes',
  });
  assert.equal(s.proposals[0].changes.length, 0);
  throws(
    () => act(s, 'apply_proposal', { id: s.proposals[0].id }),
    'EMPTY_PROPOSAL',
  );
});
void test('proposal creation leaves the schedule and revision untouched', () => {
  const s = delayed(),
    next = act(s, 'propose_repair', { objective: 'fewest_changes' });
  assert.deepEqual(next.sessions, s.sessions);
  assert.equal(next.revision, s.revision);
  assert.equal(next.version, s.version + 1);
});
void test('human approval atomically commits valid changes and records history', () => {
  let s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' });
  const plan = s.proposals[0].id;
  assert.ok(s.proposals[0].speakerConsents.length > 0);
  throws(
    () => act(s, 'apply_proposal', { id: plan }),
    'SPEAKER_CONSENT_REQUIRED',
  );
  s = confirmAll(s, plan);
  const next = act(s, 'apply_proposal', { id: plan });
  assert.equal(findConflicts(next).length, 0);
  assert.equal(next.proposals[0].status, 'applied');
  assert.equal(next.revision, s.revision + 1);
  assert.equal(next.audit[0].action, 'apply_proposal');
  assert.ok(next.undo);
  throws(() => act(next, 'apply_proposal', { id: plan }), 'NOT_FOUND');
});
void test('agent interface cannot directly approve, unlock, undo, reset or remove', () => {
  const s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' });
  for (const action of [
    'apply_proposal',
    'set_lock',
    'undo',
    'reset',
    'remove_session',
    'save_session',
    'record_speaker_consent',
  ])
    throws(
      () => act(s, action, { actor: 'agent', id: s.proposals[0].id }),
      'HUMAN_REVIEW_REQUIRED',
    );
});
void test('stale version is rejected before any mutation', () => {
  const s = delayed(),
    old = structuredClone(s);
  throws(() => transition(s, { version: 0, action: 'reset' }), 'STALE_VERSION');
  assert.deepEqual(s, old);
});
void test('human locks invalidate earlier proposals', () => {
  let s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' });
  const plan = s.proposals[0].id;
  s = act(s, 'set_lock', { id: 'future', locked: true });
  throws(() => act(s, 'apply_proposal', { id: plan }), 'STALE_PROPOSAL');
});
void test('custom proposal fails on duplicate, unknown, locked and off-grid moves', () => {
  const s = createSample();
  throws(
    () =>
      applyMoves(s, [
        { sessionId: 'motion', start: 600, roomId: 'studio' },
        { sessionId: 'motion', start: 615, roomId: 'studio' },
      ]),
    'DUPLICATE_MOVE',
  );
  throws(
    () =>
      applyMoves(s, [{ sessionId: 'unknown', start: 600, roomId: 'studio' }]),
    'UNKNOWN_TARGET',
  );
  throws(
    () =>
      applyMoves(s, [{ sessionId: 'motion', start: 601, roomId: 'studio' }]),
    'INVALID_TIME',
  );
});
void test('conflicting custom proposals may be inspected but not approved', () => {
  const s = act(createSample(), 'propose_moves', {
    moves: [{ sessionId: 'motion', roomId: 'auditorium', start: 540 }],
    note: 'Conflict test',
  });
  assert.ok(s.proposals[0].conflicts.length > 0);
  throws(
    () => act(s, 'apply_proposal', { id: s.proposals[0].id }),
    'UNSAFE_PROPOSAL',
  );
  throws(
    () => act(s, 'request_approval', { id: s.proposals[0].id, actor: 'agent' }),
    'UNSAFE_PROPOSAL',
  );
});
void test('approval request is not approval', () => {
  const s = act(delayed(), 'propose_repair', {
      objective: 'fewest_changes',
      actor: 'agent',
    }),
    next = act(s, 'request_approval', {
      id: s.proposals[0].id,
      actor: 'agent',
    });
  assert.deepEqual(next.sessions, s.sessions);
  assert.equal(next.proposals[0].status, 'pending');
  assert.equal(next.revision, s.revision);
});
void test('undo restores prior placements while preserving active disruptions', () => {
  const original = delayed(),
    proposed = act(original, 'propose_repair', {
      objective: 'fewest_changes',
    }),
    s = confirmAll(proposed, proposed.proposals[0].id),
    applied = act(s, 'apply_proposal', { id: s.proposals[0].id }),
    undo = act(applied, 'undo');
  assert.deepEqual(undo.sessions, original.sessions);
  assert.deepEqual(undo.disruptions, original.disruptions);
  assert.ok(findConflicts(undo).length > 0);
  throws(() => act(undo, 'undo'), 'STALE_UNDO');
});
void test('new edits disable undo so newer decisions cannot be overwritten', () => {
  let s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' });
  s = confirmAll(s, s.proposals[0].id);
  s = act(s, 'apply_proposal', { id: s.proposals[0].id });
  s = act(s, 'set_lock', { id: 'motion', locked: true });
  throws(() => act(s, 'undo'), 'STALE_UNDO');
});
void test('reject leaves schedule intact', () => {
  const s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' }),
    next = act(s, 'reject_proposal', { id: s.proposals[0].id });
  assert.deepEqual(next.sessions, s.sessions);
  assert.equal(next.proposals[0].status, 'rejected');
});
void test('rejected and current proposals are excluded from the next repair', () => {
  let s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' });
  const first = s.proposals[0],
    firstSignature = first.changes
      .map((change) => `${change.sessionId}/${change.start}/${change.roomId}`)
      .sort()
      .join('|');
  s = act(s, 'reject_proposal', { id: first.id });
  s = act(s, 'propose_repair', { objective: 'fewest_changes' });
  const second = s.proposals[0],
    secondSignature = second.changes
      .map((change) => `${change.sessionId}/${change.start}/${change.roomId}`)
      .sort()
      .join('|');
  assert.equal(second.conflicts.length, 0);
  assert.notEqual(secondSignature, firstSignature);
  assert.match(second.note, /distinct feasible alternative/i);
});
void test('a speaker decline rejects the plan and preserves the schedule', () => {
  const s = act(delayed(), 'propose_repair', { objective: 'fewest_changes' }),
    plan = s.proposals[0],
    next = act(s, 'record_speaker_consent', {
      id: plan.id,
      speakerId: plan.speakerConsents[0].speakerId,
      decision: 'declined',
    });
  assert.deepEqual(next.sessions, s.sessions);
  assert.equal(next.proposals[0].status, 'rejected');
  assert.equal(next.proposals[0].speakerConsents[0].status, 'declined');
  throws(() => act(next, 'apply_proposal', { id: plan.id }), 'NOT_FOUND');
});
void test('locked edits and removals are rejected', () => {
  const s = createSample();
  throws(
    () =>
      act(s, 'save_session', { session: { ...s.sessions[0], title: 'New' } }),
    'LOCKED_SESSION',
  );
  throws(() => act(s, 'remove_session', { id: 'opening' }), 'LOCKED_SESSION');
});
void test('adding, editing, and removing a session is functional', () => {
  let s = createSample();
  const session = {
    ...s.sessions[1],
    id: 'new-session',
    title: 'New session',
    start: 915,
    attendees: 80,
    roomId: 'workshop',
  };
  s = act(s, 'save_session', { session });
  assert.equal(s.sessions.length, 13);
  s = act(s, 'save_session', { session: { ...session, title: 'Updated' } });
  assert.equal(
    s.sessions.find((x) => x.id === 'new-session')?.title,
    'Updated',
  );
  s = act(s, 'remove_session', { id: 'new-session' });
  assert.equal(s.sessions.length, 12);
});
void test('weekly exceptions apply to one week and reset to the template', () => {
  let s = createSample();
  s = act(s, 'save_event', {
    event: s.event,
    recurrenceMode: 'weekly',
  });
  assert.equal(s.recurrence?.activeWeek, '2026-09-14');
  const changed = { ...s.sessions[1], day: 2, start: 900 };
  s = act(s, 'save_session', {
    session: changed,
    scope: 'this_week',
  });
  assert.equal(s.sessions[1].day, 2);
  assert.equal(s.recurrence?.overrides.length, 1);
  s = act(s, 'set_active_week', { weekStart: '2026-09-21' });
  assert.equal(s.sessions[1].day, 0);
  assert.notEqual(s.sessions[1].start, 900);
  s = act(s, 'set_active_week', { weekStart: '2026-09-14' });
  assert.equal(s.sessions[1].day, 2);
  assert.equal(s.sessions[1].start, 900);
});
void test('permanent timetable edits flow into future weeks', () => {
  let s = createSample();
  s = act(s, 'save_event', {
    event: s.event,
    recurrenceMode: 'weekly',
  });
  s = act(s, 'save_session', {
    session: { ...s.sessions[1], title: 'Permanent seminar', day: 3 },
    scope: 'future',
  });
  s = act(s, 'set_active_week', { weekStart: '2026-10-05' });
  assert.equal(s.sessions[1].title, 'Permanent seminar');
  assert.equal(s.sessions[1].day, 3);
});
void test('a repaired weekly exception resets next week and undo restores it', () => {
  let s = createSample();
  s = act(s, 'save_event', {
    event: s.event,
    recurrenceMode: 'weekly',
  });
  const original = structuredClone(s.sessions);
  s = act(s, 'report_disruption', {
    disruption: {
      kind: 'speaker_delay',
      targetId: 'mira',
      start: 540,
      end: 840,
      day: 0,
    },
  });
  s = act(s, 'propose_repair', { objective: 'fewest_changes' });
  const proposalId = s.proposals[0].id;
  s = confirmAll(s, proposalId);
  s = act(s, 'apply_proposal', { id: proposalId, scope: 'this_week' });
  assert.notDeepEqual(s.sessions, original);
  assert.equal(s.recurrence?.overrides.length, 1);
  const applied = structuredClone(s.sessions);
  s = act(s, 'undo');
  assert.deepEqual(s.sessions, original);
  assert.deepEqual(s.recurrence?.overrides[0].sessions, original);
  s = act(s, 'set_active_week', { weekStart: '2026-09-21' });
  assert.deepEqual(s.sessions, original);
  s = act(s, 'set_active_week', { weekStart: '2026-09-14' });
  assert.notDeepEqual(s.sessions, applied);
  assert.deepEqual(s.sessions, original);
});
void test('changing the week in event settings loads that saved week', () => {
  let s = createSample();
  s = act(s, 'save_event', {
    event: s.event,
    recurrenceMode: 'weekly',
  });
  s = act(s, 'save_session', {
    session: { ...s.sessions[1], title: 'One-week class' },
    scope: 'this_week',
  });
  s = act(s, 'save_event', {
    event: { ...s.event, date: '2026-09-21' },
    recurrenceMode: 'weekly',
  });
  assert.notEqual(s.sessions[1].title, 'One-week class');
  s = act(s, 'save_event', {
    event: { ...s.event, date: '2026-09-14' },
    recurrenceMode: 'weekly',
  });
  assert.equal(s.sessions[1].title, 'One-week class');
});
void test('sessions on different weekdays do not conflict', () => {
  const s = createSample();
  s.sessions = [
    { ...s.sessions[1], day: 0, roomId: 'auditorium', start: 600 },
    { ...s.sessions[2], day: 1, roomId: 'auditorium', start: 600 },
  ];
  assert.equal(findConflicts(s).length, 0);
});
void test('weekly disruption matching is isolated to its weekday', () => {
  let s = createSample();
  s.sessions[1] = { ...s.sessions[1], day: 1 };
  s = act(s, 'report_disruption', {
    disruption: {
      kind: 'speaker_delay',
      targetId: s.sessions[1].speakerIds[0],
      start: s.sessions[1].start,
      end: s.sessions[1].start + s.sessions[1].duration,
      day: 0,
    },
  });
  assert.equal(findConflicts(s).length, 0);
  s = act(s, 'report_disruption', {
    disruption: {
      kind: 'speaker_delay',
      targetId: s.sessions[1].speakerIds[0],
      start: s.sessions[1].start,
      end: s.sessions[1].start + s.sessions[1].duration,
      day: 1,
    },
  });
  assert.ok(
    findConflicts(s).some((conflict) => conflict.kind === 'availability'),
  );
});
void test('timetable CSV creates a reusable weekly schedule', () => {
  const csv = [
    'Mode,Date,Day,Session,Start,Duration,Room,Speakers,Attendance,Room Capacity,Locked',
    'weekly,2026-09-07,Monday,Physics,09:00,60,Room 101,Dr Rao,45,60,No',
    'weekly,2026-09-07,Tuesday,Chemistry,10:00,60,Lab 2,Dr Sen,30,40,Yes',
  ].join('\n');
  const imported = parseScheduleInput(csv, createSample());
  assert.equal(imported.recurrenceMode, 'weekly');
  const s = act(createSample(), 'import_schedule', {
    schedule: imported.schedule,
    recurrenceMode: imported.recurrenceMode,
  });
  assert.equal(s.recurrence?.mode, 'weekly');
  assert.deepEqual(
    s.sessions.map((session) => session.day),
    [0, 1],
  );
  assert.equal(findConflicts(s).length, 0);
});
void test('campus demo is a conflict-free reusable five-day timetable', () => {
  const campus = createCampusSample();
  assert.equal(campus.recurrence?.mode, 'weekly');
  assert.equal(campus.recurrence?.activeWeek, '2026-09-07');
  assert.deepEqual(
    [...new Set(campus.sessions.map((session) => session.day))],
    [0, 1, 2, 3, 4],
  );
  assert.ok(campus.rooms.some((room) => room.id === 'sports-ground'));
  assert.equal(findConflicts(campus).length, 0);
  const imported = act(createSample(), 'import_schedule', {
    schedule: portableSchedule(campus),
  });
  assert.equal(imported.event.name, 'Northstar Campus Week');
  assert.equal(imported.recurrence?.templateSessions.length, 16);
  assert.equal(findConflicts(imported).length, 0);
});
void test('duplicate disruption and invalid references are rejected', () => {
  const s = delayed();
  throws(
    () =>
      act(s, 'report_disruption', {
        disruption: {
          kind: 'speaker_delay',
          targetId: 'mira',
          start: 540,
          end: 840,
        },
      }),
    'DUPLICATE_DISRUPTION',
  );
  throws(
    () =>
      act(s, 'report_disruption', {
        disruption: {
          kind: 'speaker_delay',
          targetId: 'nobody',
          start: 540,
          end: 840,
        },
      }),
    'UNKNOWN_TARGET',
  );
});
void test('invalid imported event data is rejected', () => {
  const s = createSample();
  for (const date of ['2026-02-30', 'bad', '2026-99-99'])
    throws(
      () => parseSchedule({ ...s, event: { ...s.event, date } }),
      'INVALID_INPUT',
    );
  throws(
    () => parseSchedule({ ...s, rooms: [...s.rooms, s.rooms[0]] }),
    'INVALID_INPUT',
  );
  throws(
    () =>
      parseSchedule({ ...s, sessions: [{ ...s.sessions[0], duration: 0 }] }),
    'INVALID_INPUT',
  );
  throws(
    () =>
      parseSchedule({ ...s, event: { ...s.event, timezone: 'Mars/Olympus' } }),
    'INVALID_INPUT',
  );
});
void test('portable import/export excludes workspace credentials, proposals and audit', () => {
  const s = delayed(),
    portable = portableSchedule(s);
  assert.equal(Object.keys(portable).length, 5);
  const next = act(s, 'import_schedule', { schedule: portable });
  assert.deepEqual(next.sessions, s.sessions);
  assert.deepEqual(next.proposals, []);
  assert.equal(next.audit[0].action, 'import_schedule');
});
void test('CSV is quoted and formula injection is escaped', () => {
  const s = createSample();
  s.sessions[0].title = '=HYPERLINK("https://example.com")';
  const csv = scheduleCSV(s);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.equal(csv.split('\r\n').length, 13);
});
void test('calendar uses event timezone and escapes text and folds UTF-8 lines', () => {
  const s = createSample();
  s.sessions[0].title = 'Long, title; ' + '世界'.repeat(50);
  const ics = scheduleICS(s);
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kolkata:20260919T090000'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 12);
  assert.ok(ics.includes('Long\\, title\\;'));
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75));
});
void test('reset keeps history, restores sample and increments versions', () => {
  const s = delayed(),
    next = act(s, 'reset');
  assert.equal(next.disruptions.length, 0);
  assert.deepEqual(next.sessions, createSample().sessions);
  assert.ok(next.audit.length > s.audit.length);
  assert.equal(next.version, s.version + 1);
});
void test('calendar midnight rolls over to the following date', () => {
  const s = createSample();
  s.event.date = '2026-12-31';
  s.sessions = [{ ...s.sessions[0], start: 1380, duration: 60 }];
  const ics = scheduleICS(s);
  assert.ok(ics.includes('DTEND;TZID=Asia/Kolkata:20270101T000000'));
  assert.ok(!ics.includes('T240000'));
});
void test('CSV exports current attendance after a disruption', () => {
  const s = act(createSample(), 'report_disruption', {
    disruption: { kind: 'attendance', targetId: 'make', attendees: 140 },
  });
  const title = s.sessions.find((x) => x.id === 'make')!.title;
  assert.ok(
    scheduleCSV(s)
      .split('\r\n')
      .find((l) => l.includes(title))
      ?.includes('"140"'),
  );
});
void test('WebMCP tool chain uses actual transitions and waits for human approval', async () => {
  let s = createSample(),
    review = '';
  const tools = buildTools({
    read: async () => s,
    dispatch: async (input) => {
      s = transition(s, { ...input, version: s.version });
      return s;
    },
    review: (id) => {
      review = id;
    },
  });
  const call = async (name: string, input: unknown = {}) =>
    (await tools.find((t) => t.name === name)!.execute(input)) as {
      ok: boolean;
      data: Record<string, unknown>;
      code?: string;
    };
  assert.equal(tools.length, 10);
  assert.ok(!tools.some((t) => /apply|approve_plan|execute_plan/.test(t.name)));
  assert.equal((await call('get_event_summary')).ok, true);
  await call('report_disruption', {
    kind: 'speaker_delay',
    target_id: 'mira',
    start_time: '09:00',
    end_time: '14:00',
  });
  const p = await call('propose_repair', { objective: 'fewest_changes' });
  assert.equal(p.ok, true);
  assert.ok(review);
  await call('request_approval', { proposal_id: review });
  assert.equal(s.proposals[0].status, 'pending');
  assert.deepEqual(s.sessions, createSample().sessions);
  assert.equal((await call('list_sessions', { limit: 100 })).ok, false);
});
void test('tool registration cleans up only its own tools', async () => {
  const names: string[] = [],
    removed: string[] = [];
  const cleanup = await registerRunlineTools(
    {
      registerTool: (t) => {
        names.push(t.name);
      },
      unregisterTool: (name) => {
        removed.push(name);
      },
    },
    {
      read: async () => createSample(),
      dispatch: async () => createSample(),
      review: () => {},
    },
    () => {},
  );
  assert.equal(names.length, 10);
  await cleanup();
  assert.deepEqual(removed, names);
});
void test('partial registration failure rolls back successful registrations', async () => {
  const removed: string[] = [];
  let count = 0;
  await assert.rejects(
    registerRunlineTools(
      {
        registerTool: () => {
          if (++count === 3) throw new Error('Registration failed');
        },
        unregisterTool: (name) => {
          removed.push(name);
        },
      },
      {
        read: async () => createSample(),
        dispatch: async () => createSample(),
        review: () => {},
      },
      () => {},
    ),
  );
  assert.deepEqual(removed, ['get_event_summary', 'list_sessions']);
});
