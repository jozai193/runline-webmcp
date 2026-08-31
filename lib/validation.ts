import { DomainError } from './domain.ts';
import type {
  Disruption,
  EventInfo,
  Move,
  Objective,
  Room,
  Schedule,
  Session,
  Speaker,
} from './domain.ts';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DomainError('INVALID_INPUT', 'Expected an object.');
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  label: string,
  max = 160,
  min = 1,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max
  )
    throw new DomainError(
      'INVALID_INPUT',
      `${label} must contain ${min}–${max} characters.`,
    );
  return value.trim();
}
export function integer(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new DomainError(
      'INVALID_INPUT',
      `${label} must be an integer from ${min} to ${max}.`,
    );
  return value;
}
export function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean')
    throw new DomainError('INVALID_INPUT', `${label} must be true or false.`);
  return value;
}
export function id(value: unknown): string {
  const result = text(value, 'ID', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(result))
    throw new DomainError(
      'INVALID_INPUT',
      'IDs may contain letters, numbers, underscores, and hyphens only.',
    );
  return result;
}
function list<T>(
  value: unknown,
  label: string,
  max: number,
  parser: (v: unknown) => T,
  min = 0,
): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new DomainError(
      'INVALID_INPUT',
      `${label} must have ${min}–${max} items.`,
    );
  return value.map(parser);
}
function minute(value: unknown, label: string): number {
  const m = integer(value, label, 0, 1440);
  if (m % 15)
    throw new DomainError(
      'INVALID_INPUT',
      `${label} must use a 15-minute boundary.`,
    );
  return m;
}
function unique(items: { id: string }[], label: string) {
  if (new Set(items.map((x) => x.id)).size !== items.length)
    throw new DomainError('INVALID_INPUT', `${label} IDs must be unique.`);
}
export function parseSession(
  value: unknown,
  schedule: Pick<Schedule, 'rooms' | 'speakers'>,
): Session {
  const v = record(value),
    speakerIds = list(v.speakerIds, 'Speakers', 4, id, 1);
  if (
    new Set(speakerIds).size !== speakerIds.length ||
    speakerIds.some((id) => !schedule.speakers.some((s) => s.id === id))
  )
    throw new DomainError(
      'UNKNOWN_TARGET',
      'Choose known speakers without duplicates.',
    );
  const roomId = id(v.roomId);
  if (!schedule.rooms.some((r) => r.id === roomId))
    throw new DomainError('UNKNOWN_TARGET', 'Choose a known room.');
  if (!['keynote', 'talk', 'panel', 'workshop'].includes(String(v.type)))
    throw new DomainError('INVALID_INPUT', 'Choose a valid session type.');
  const duration = minute(v.duration, 'Duration');
  if (duration < 30 || duration > 180)
    throw new DomainError(
      'INVALID_INPUT',
      'Session duration must be between 30 and 180 minutes.',
    );
  return {
    id: id(v.id),
    title: text(v.title, 'Session title'),
    speakerIds,
    roomId,
    start: minute(v.start, 'Start time'),
    duration,
    attendees: integer(v.attendees, 'Attendance', 1, 10000),
    type: v.type as Session['type'],
    locked: bool(v.locked, 'Locked'),
  };
}
export function parseDisruption(
  value: unknown,
  schedule: Schedule,
): Disruption {
  const v = record(value),
    targetId = id(v.targetId),
    kind = v.kind;
  if (
    kind !== 'speaker_delay' &&
    kind !== 'room_closed' &&
    kind !== 'attendance'
  )
    throw new DomainError('INVALID_INPUT', 'Choose a supported disruption.');
  const targets =
    kind === 'speaker_delay'
      ? schedule.speakers
      : kind === 'room_closed'
        ? schedule.rooms
        : schedule.sessions;
  if (!targets.some((x) => x.id === targetId))
    throw new DomainError(
      'UNKNOWN_TARGET',
      'The disruption target does not exist.',
    );
  const start =
    kind === 'attendance'
      ? schedule.event.start
      : minute(v.start, 'Unavailable from');
  const end =
    kind === 'attendance'
      ? schedule.event.end
      : minute(v.end, 'Unavailable until');
  if (end <= start || start < schedule.event.start || end > schedule.event.end)
    throw new DomainError(
      'INVALID_INPUT',
      'The disruption window must be within event hours and end after it starts.',
    );
  return {
    id: id(v.id),
    kind,
    targetId,
    start,
    end,
    attendees:
      kind === 'attendance'
        ? integer(v.attendees, 'Expected attendance', 1, 10000)
        : 0,
    note: v.note ? text(v.note, 'Note', 280) : '',
  };
}
export function parseEvent(value: unknown): EventInfo {
  const v = record(value),
    date = text(v.date, 'Date', 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new DomainError(
      'INVALID_INPUT',
      'Use a real date in YYYY-MM-DD format.',
    );
  const timezone = text(v.timezone, 'Timezone', 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new DomainError(
      'INVALID_INPUT',
      'Use a recognized timezone such as Asia/Kolkata.',
    );
  }
  const start = minute(v.start, 'Event start'),
    end = minute(v.end, 'Event end'),
    breakStart = minute(v.breakStart, 'Break start'),
    breakEnd = minute(v.breakEnd, 'Break end'),
    turnover = minute(v.turnover, 'Turnover');
  if (
    end <= start ||
    end - start > 720 ||
    breakStart < start ||
    breakEnd < breakStart ||
    breakEnd > end ||
    turnover > 60
  )
    throw new DomainError(
      'INVALID_INPUT',
      'Use a same-day event up to 12 hours, a break within it, and turnover up to 60 minutes.',
    );
  return {
    name: text(v.name, 'Event name', 90),
    date,
    venue: text(v.venue, 'Venue', 90),
    timezone,
    start,
    end,
    breakStart,
    breakEnd,
    turnover,
  };
}
export function parseSchedule(value: unknown): Schedule {
  const v = record(value),
    event = parseEvent(v.event);
  const rooms = list<Room>(
    v.rooms,
    'Rooms',
    6,
    (item) => {
      const r = record(item);
      return {
        id: id(r.id),
        name: text(r.name, 'Room name', 60),
        capacity: integer(r.capacity, 'Capacity', 1, 10000),
      };
    },
    1,
  );
  const speakers = list<Speaker>(
    v.speakers,
    'Speakers',
    40,
    (item) => {
      const s = record(item);
      return { id: id(s.id), name: text(s.name, 'Speaker name', 80) };
    },
    1,
  );
  unique(rooms, 'Room');
  unique(speakers, 'Speaker');
  const sessions = list(v.sessions, 'Sessions', 24, (item) =>
    parseSession(item, { rooms, speakers }),
  );
  unique(sessions, 'Session');
  const schedule = {
    event,
    rooms,
    speakers,
    sessions,
    disruptions: [] as Disruption[],
  };
  schedule.disruptions = list(v.disruptions ?? [], 'Disruptions', 12, (item) =>
    parseDisruption(item, schedule),
  );
  unique(schedule.disruptions, 'Disruption');
  return schedule;
}
export function parseMoves(value: unknown): Move[] {
  return list(
    value,
    'Moves',
    24,
    (item) => {
      const v = record(item);
      return {
        sessionId: id(v.sessionId),
        roomId: id(v.roomId),
        start: minute(v.start, 'Start time'),
      };
    },
    1,
  );
}
export function parseObjective(value: unknown): Objective {
  if (
    !['fewest_changes', 'preserve_times', 'preserve_rooms'].includes(
      String(value),
    )
  )
    throw new DomainError(
      'INVALID_INPUT',
      'Choose a supported repair objective.',
    );
  return value as Objective;
}
