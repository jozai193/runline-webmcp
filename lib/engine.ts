import { DomainError, roomName, timeLabel, uid } from './domain.ts';
import type {
  Actor,
  Change,
  Conflict,
  Move,
  Objective,
  Proposal,
  Schedule,
  Session,
  Workspace,
} from './domain.ts';

const overlap = (a: number, b: number, c: number, d: number) => a < d && c < b;
export function expectedAttendance(schedule: Schedule, s: Session) {
  return schedule.disruptions
    .filter((d) => d.kind === 'attendance' && d.targetId === s.id)
    .reduce((count, d) => Math.max(count, d.attendees), s.attendees);
}

/** Pure hard-constraint validator, shared by the UI, search, and final server commit. */
export function findConflicts(schedule: Schedule): Conflict[] {
  const conflicts: Conflict[] = [];
  const add = (
    kind: Conflict['kind'],
    sessionIds: string[],
    message: string,
    suffix = '',
  ) =>
    conflicts.push({
      id: `${kind}:${sessionIds.join(':')}:${suffix}`,
      kind,
      sessionIds,
      message,
    });
  for (const s of schedule.sessions) {
    const room = schedule.rooms.find((r) => r.id === s.roomId);
    if (!room) {
      add(
        'availability',
        [s.id],
        `${s.title}: the assigned room no longer exists.`,
      );
      continue;
    }
    if (
      s.start < schedule.event.start ||
      s.start + s.duration > schedule.event.end
    )
      add('hours', [s.id], `${s.title} falls outside event hours.`);
    if (
      overlap(
        s.start,
        s.start + s.duration,
        schedule.event.breakStart,
        schedule.event.breakEnd,
      )
    )
      add('break', [s.id], `${s.title} overlaps the protected lunch break.`);
    const attendance = expectedAttendance(schedule, s);
    if (attendance > room.capacity)
      add(
        'capacity',
        [s.id],
        `${s.title}: ${attendance} attendees exceed ${room.name}'s ${room.capacity} seats.`,
      );
    for (const d of schedule.disruptions) {
      if (
        d.kind === 'speaker_delay' &&
        s.speakerIds.includes(d.targetId) &&
        overlap(s.start, s.start + s.duration, d.start, d.end)
      )
        add(
          'availability',
          [s.id],
          `${s.title}: ${schedule.speakers.find((p) => p.id === d.targetId)?.name} is unavailable ${timeLabel(d.start)}–${timeLabel(d.end)}.`,
          d.id,
        );
      if (
        d.kind === 'room_closed' &&
        d.targetId === s.roomId &&
        overlap(s.start, s.start + s.duration, d.start, d.end)
      )
        add(
          'availability',
          [s.id],
          `${s.title}: ${room.name} is closed ${timeLabel(d.start)}–${timeLabel(d.end)}.`,
          d.id,
        );
    }
  }
  for (let i = 0; i < schedule.sessions.length; i++)
    for (let j = i + 1; j < schedule.sessions.length; j++) {
      const a = schedule.sessions[i],
        b = schedule.sessions[j];
      if (
        !overlap(
          a.start,
          a.start + a.duration + schedule.event.turnover,
          b.start,
          b.start + b.duration + schedule.event.turnover,
        )
      )
        continue;
      if (a.roomId === b.roomId)
        add(
          'room_overlap',
          [a.id, b.id],
          `${a.title} and ${b.title} need more space in ${roomName(schedule, a.roomId)} (including ${schedule.event.turnover}-minute turnover).`,
        );
      if (a.speakerIds.some((id) => b.speakerIds.includes(id)))
        add(
          'speaker_overlap',
          [a.id, b.id],
          `${a.title} and ${b.title} share a speaker without enough transition time.`,
        );
    }
  return conflicts;
}

export function getChanges(before: Session[], after: Session[]): Change[] {
  return after.flatMap((s) => {
    const old = before.find((x) => x.id === s.id);
    return old && (old.start !== s.start || old.roomId !== s.roomId)
      ? [
          {
            sessionId: s.id,
            title: s.title,
            fromStart: old.start,
            fromRoomId: old.roomId,
            start: s.start,
            roomId: s.roomId,
          },
        ]
      : [];
  });
}

export function applyMoves(schedule: Schedule, moves: Move[]): Session[] {
  if (new Set(moves.map((m) => m.sessionId)).size !== moves.length)
    throw new DomainError(
      'DUPLICATE_MOVE',
      'Each session can appear only once in a proposal.',
    );
  for (const m of moves) {
    const s = schedule.sessions.find((s) => s.id === m.sessionId);
    if (!s || !schedule.rooms.some((r) => r.id === m.roomId))
      throw new DomainError(
        'UNKNOWN_TARGET',
        'Choose a known session and room.',
      );
    if (s.locked && (m.start !== s.start || m.roomId !== s.roomId))
      throw new DomainError(
        'LOCKED_SESSION',
        `${s.title} is locked. Only the organizer can unlock it.`,
      );
    if (
      !Number.isInteger(m.start) ||
      m.start % 15 !== 0 ||
      m.start < 0 ||
      m.start > 1425
    )
      throw new DomainError(
        'INVALID_TIME',
        'Start times must be on a 15-minute boundary.',
      );
  }
  return schedule.sessions.map((s) => {
    const m = moves.find((m) => m.sessionId === s.id);
    return m ? { ...s, start: m.start, roomId: m.roomId } : { ...s };
  });
}

export function createProposal(
  state: Workspace,
  sessions: Session[],
  objective: Objective,
  actor: Actor,
  note: string,
  evaluated = 1,
  elapsedMs = 0,
): Proposal {
  const changes = getChanges(state.sessions, sessions);
  return {
    id: uid('plan'),
    baseRevision: state.revision,
    createdAt: new Date().toISOString(),
    actor,
    objective,
    note,
    changes,
    beforeConflicts: findConflicts(state).length,
    conflicts: findConflicts({ ...state, sessions }),
    status: 'pending',
    metrics: {
      moved: changes.length,
      shiftedMinutes: changes.reduce(
        (n, c) => n + Math.abs(c.start - c.fromStart),
        0,
      ),
      roomChanges: changes.filter((c) => c.roomId !== c.fromRoomId).length,
      lockedProtected: state.sessions.filter((s) => s.locked).length,
      evaluated,
      elapsedMs: Math.round(elapsedMs),
    },
  };
}

function score(
  state: Workspace,
  sessions: Session[],
  conflicts: Conflict[],
  objective: Objective,
) {
  const changes = getChanges(state.sessions, sessions);
  const shift = changes.reduce(
    (n, c) => n + Math.abs(c.start - c.fromStart),
    0,
  );
  const rooms = changes.filter((c) => c.roomId !== c.fromRoomId).length;
  const penalty =
    objective === 'preserve_times'
      ? shift * 300 + rooms * 10 + changes.length
      : objective === 'preserve_rooms'
        ? rooms * 100000 + shift + changes.length * 100
        : changes.length * 100000 + shift + rooms * 50;
  return conflicts.length * 10000000 + penalty;
}

/** Bounded deterministic beam search, not an LLM or proof of global optimality. */
export function repairSchedule(
  state: Workspace,
  objective: Objective = 'fewest_changes',
  actor: Actor = 'human',
): Proposal {
  const started = performance.now();
  const initialConflicts = findConflicts(state);
  if (initialConflicts.length === 0)
    return createProposal(
      state,
      state.sessions,
      objective,
      actor,
      'The schedule already satisfies every hard constraint. No changes needed.',
      1,
      performance.now() - started,
    );
  type Node = { sessions: Session[]; conflicts: Conflict[]; score: number };
  let best: Node = {
    sessions: state.sessions,
    conflicts: initialConflicts,
    score: score(state, state.sessions, initialConflicts, objective),
  };
  let beam = [best],
    evaluated = 1;
  const signature = (sessions: Session[]) =>
    sessions.map((s) => `${s.id}/${s.start}/${s.roomId}`).join('|');
  const visited = new Set([signature(state.sessions)]);
  const candidates = new Map<string, Move[]>();
  for (const s of state.sessions.filter((s) => !s.locked)) {
    const options: Move[] = [];
    for (const room of state.rooms)
      for (
        let start = state.event.start;
        start + s.duration <= state.event.end;
        start += 15
      ) {
        const single = {
          ...state,
          sessions: [{ ...s, roomId: room.id, start }],
        };
        if (findConflicts(single).length === 0)
          options.push({ sessionId: s.id, start, roomId: room.id });
      }
    candidates.set(s.id, options);
  }
  outer: for (let depth = 0; depth < 8; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const affected = new Set(node.conflicts.flatMap((c) => c.sessionIds));
      for (const s of node.sessions.filter(
        (s) => affected.has(s.id) && !s.locked,
      ))
        for (const m of candidates.get(s.id) ?? []) {
          const sessions = node.sessions.map((x) =>
            x.id === s.id ? { ...x, start: m.start, roomId: m.roomId } : x,
          );
          const key = signature(sessions);
          if (visited.has(key)) continue;
          visited.add(key);
          const conflicts = findConflicts({ ...state, sessions });
          evaluated++;
          const candidate = {
            sessions,
            conflicts,
            score: score(state, sessions, conflicts, objective),
          };
          next.push(candidate);
          if (candidate.score < best.score) best = candidate;
          if (evaluated >= 4500) break outer;
        }
    }
    next.sort((a, b) => a.score - b.score);
    if (best.conflicts.length === 0 || next.length === 0) break;
    beam = next.slice(0, 12);
  }
  const note =
    best.conflicts.length === 0
      ? 'A feasible repair found by bounded search. Review the trade-offs before applying; this is not a guarantee of global optimality.'
      : 'No complete repair found within the search budget. No changes will be applied. Review the remaining conflicts, room limits, or locked sessions.';
  return createProposal(
    state,
    best.sessions,
    objective,
    actor,
    note,
    evaluated,
    performance.now() - started,
  );
}
