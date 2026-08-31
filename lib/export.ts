import { roomName, sessionNames, timeLabel } from './domain.ts';
import type { Schedule } from './domain.ts';
import { expectedAttendance } from './engine.ts';

const safeCSV = (value: string | number) => {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};
export function scheduleCSV(schedule: Schedule) {
  return [
    ['Session', 'Start', 'End', 'Room', 'Speakers', 'Attendance', 'Locked'],
    ...[...schedule.sessions]
      .sort((a, b) => a.start - b.start)
      .map((s) => [
        s.title,
        timeLabel(s.start),
        timeLabel(s.start + s.duration),
        roomName(schedule, s.roomId),
        sessionNames(schedule, s),
        expectedAttendance(schedule, s),
        s.locked ? 'Yes' : 'No',
      ]),
  ]
    .map((row) => row.map(safeCSV).join(','))
    .join('\r\n');
}
const escapeICS = (v: string) =>
  v
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
function foldICS(line: string) {
  const lines: string[] = [];
  let chunk = '',
    bytes = 0;
  for (const c of line) {
    const size = new TextEncoder().encode(c).length;
    if (bytes + size > 73) {
      lines.push(chunk);
      chunk = ' ';
      bytes = 1;
    }
    chunk += c;
    bytes += size;
  }
  lines.push(chunk);
  return lines.join('\r\n');
}
export function scheduleICS(schedule: Schedule) {
  const date = schedule.event.date.replaceAll('-', '');
  const stamp = (minutes: number) => {
    const day = new Date(`${schedule.event.date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + Math.floor(minutes / 1440));
    return `${day.toISOString().slice(0, 10).replaceAll('-', '')}T${timeLabel(minutes % 1440).replace(':', '')}00`;
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Runline//Event Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${escapeICS(schedule.event.timezone)}`,
    `X-WR-CALNAME:${escapeICS(schedule.event.name)}`,
  ];
  for (const s of schedule.sessions)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}-${date}@runline.local`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z/, 'Z')}`,
      `DTSTART;TZID=${schedule.event.timezone}:${stamp(s.start)}`,
      `DTEND;TZID=${schedule.event.timezone}:${stamp(s.start + s.duration)}`,
      `SUMMARY:${escapeICS(s.title)}`,
      `LOCATION:${escapeICS(`${roomName(schedule, s.roomId)}, ${schedule.event.venue}`)}`,
      `DESCRIPTION:${escapeICS(`${sessionNames(schedule, s)}. ${s.locked ? 'Protected session.' : ''}`)}`,
      'END:VEVENT',
    );
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}
export function portableSchedule(s: Schedule): Schedule {
  return {
    event: s.event,
    rooms: s.rooms,
    speakers: s.speakers,
    sessions: s.sessions,
    disruptions: s.disruptions,
  };
}
