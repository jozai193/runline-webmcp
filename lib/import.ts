import { DomainError, mondayOf, timeValue, WEEKDAYS } from './domain.ts';
import type { Schedule } from './domain.ts';

function csvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted)
    throw new DomainError('INVALID_INPUT', 'The CSV has an unclosed quote.');
  return rows;
}

const slug = (value: string, fallback: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52) || fallback;

function yes(value: string) {
  return /^(1|true|yes|y|locked)$/i.test(value);
}
function dayValue(value: string) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  const index = WEEKDAYS.findIndex((day) =>
    day.toLowerCase().startsWith(value.trim().toLowerCase().slice(0, 3)),
  );
  if (index < 0)
    throw new DomainError(
      'INVALID_INPUT',
      `Unknown weekday “${value}”. Use Monday through Sunday.`,
    );
  return index;
}

export function timetableFromCSV(source: string, current: Schedule) {
  const rows = csvRows(source);
  if (rows.length < 2)
    throw new DomainError(
      'INVALID_INPUT',
      'Include a header row and at least one timetable row.',
    );
  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const at = (row: string[], ...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index < 0 ? '' : (row[index] ?? '').trim();
  };
  for (const required of ['start', 'room'])
    if (!headers.includes(required))
      throw new DomainError(
        'INVALID_INPUT',
        `The CSV needs a ${required[0].toUpperCase() + required.slice(1)} column.`,
      );
  if (!headers.some((header) => header === 'session' || header === 'title'))
    throw new DomainError(
      'INVALID_INPUT',
      'The CSV needs a Session or Title column.',
    );

  const roomByName = new Map<
    string,
    { id: string; name: string; capacity: number }
  >();
  const speakerByName = new Map<string, { id: string; name: string }>();
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base,
      suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return id;
  };
  const sessions = rows.slice(1).map((row, index) => {
    const title = at(row, 'session', 'title');
    if (!title)
      throw new DomainError(
        'INVALID_INPUT',
        `Timetable row ${index + 2} is missing a session title.`,
      );
    const start = timeValue(at(row, 'start'));
    const endText = at(row, 'end');
    const durationText = at(row, 'duration', 'duration minutes');
    const duration = durationText
      ? Number(durationText)
      : endText
        ? timeValue(endText) - start
        : 60;
    if (
      !Number.isSafeInteger(duration) ||
      duration < 30 ||
      duration > 180 ||
      duration % 15
    )
      throw new DomainError(
        'INVALID_INPUT',
        `Timetable row ${index + 2} needs a 30–180 minute duration on a 15-minute boundary.`,
      );
    const attendees = Number(at(row, 'attendance', 'attendees') || 50);
    if (!Number.isSafeInteger(attendees) || attendees < 1 || attendees > 10000)
      throw new DomainError(
        'INVALID_INPUT',
        `Timetable row ${index + 2} has invalid attendance.`,
      );
    const roomName = at(row, 'room', 'location');
    const capacity = Number(at(row, 'room capacity', 'capacity') || attendees);
    const roomKey = roomName.toLowerCase();
    const existingRoom = roomByName.get(roomKey);
    if (existingRoom)
      existingRoom.capacity = Math.max(existingRoom.capacity, capacity);
    else
      roomByName.set(roomKey, {
        id: uniqueId(slug(roomName, `room-${index + 1}`)),
        name: roomName,
        capacity,
      });
    const speakerNames = (
      at(row, 'speakers', 'speaker', 'teacher', 'owner') || 'Unassigned'
    )
      .split(';')
      .map((name) => name.trim())
      .filter(Boolean);
    for (const name of speakerNames)
      if (!speakerByName.has(name.toLowerCase()))
        speakerByName.set(name.toLowerCase(), {
          id: uniqueId(slug(name, `person-${speakerByName.size + 1}`)),
          name,
        });
    const type = at(row, 'type').toLowerCase();
    return {
      id: uniqueId(slug(title, `session-${index + 1}`)),
      title,
      speakerIds: speakerNames.map(
        (name) => speakerByName.get(name.toLowerCase())!.id,
      ),
      roomId: roomByName.get(roomKey)!.id,
      start,
      duration,
      attendees,
      type: ['keynote', 'talk', 'panel', 'workshop'].includes(type)
        ? (type as 'keynote' | 'talk' | 'panel' | 'workshop')
        : 'talk',
      locked: yes(at(row, 'locked', 'protected')),
      day: dayValue(at(row, 'day', 'weekday')),
    };
  });
  if (sessions.length > 24 || roomByName.size > 6 || speakerByName.size > 40)
    throw new DomainError(
      'LIMIT_REACHED',
      'The demo supports up to 24 sessions, 6 locations, and 40 people.',
    );
  const first = rows[1];
  const mode =
    at(first, 'mode').toLowerCase() === 'weekly' ||
    rows.slice(1).some((row) => Boolean(at(row, 'day', 'weekday')))
      ? 'weekly'
      : 'single';
  const date = at(first, 'date') || current.event.date;
  const start = Math.min(...sessions.map((session) => session.start));
  const end = Math.max(
    ...sessions.map((session) => session.start + session.duration),
  );
  const schedule: Schedule = {
    event: {
      ...current.event,
      name: at(first, 'event', 'event name') || current.event.name,
      venue: at(first, 'venue') || current.event.venue,
      timezone: at(first, 'timezone') || current.event.timezone,
      date: mode === 'weekly' ? mondayOf(date) : date,
      start,
      end,
      breakStart: start,
      breakEnd: start,
    },
    rooms: [...roomByName.values()],
    speakers: [...speakerByName.values()],
    sessions,
    disruptions: [],
  };
  return { schedule, recurrenceMode: mode as 'single' | 'weekly' };
}

export function parseScheduleInput(source: string, current: Schedule) {
  const trimmed = source.trim();
  if (!trimmed)
    throw new DomainError('INVALID_INPUT', 'Paste JSON or CSV first.');
  if (trimmed.startsWith('{')) {
    let schedule: unknown;
    try {
      schedule = JSON.parse(trimmed);
    } catch {
      throw new DomainError(
        'INVALID_INPUT',
        'This is not valid JSON. Check commas and quotation marks.',
      );
    }
    const recurrenceMode =
      schedule &&
      typeof schedule === 'object' &&
      'recurrence' in schedule &&
      schedule.recurrence
        ? 'weekly'
        : 'single';
    return { schedule, recurrenceMode } as const;
  }
  return timetableFromCSV(trimmed, current);
}
