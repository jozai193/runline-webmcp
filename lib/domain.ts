export type SessionType = 'keynote' | 'talk' | 'panel' | 'workshop';
export type Objective = 'fewest_changes' | 'preserve_times' | 'preserve_rooms';
export type Actor = 'human' | 'agent';
export type ChangeScope = 'this_week' | 'future';
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export interface Room {
  id: string;
  name: string;
  capacity: number;
}
export interface Speaker {
  id: string;
  name: string;
}
export interface Session {
  id: string;
  title: string;
  speakerIds: string[];
  roomId: string;
  start: number;
  duration: number;
  attendees: number;
  type: SessionType;
  locked: boolean;
  /** Zero is Monday. Omitted legacy values are treated as Monday. */
  day?: number;
}
export interface EventInfo {
  name: string;
  date: string;
  venue: string;
  timezone: string;
  start: number;
  end: number;
  turnover: number;
  breakStart: number;
  breakEnd: number;
}
export interface Disruption {
  id: string;
  kind: 'speaker_delay' | 'room_closed' | 'attendance';
  targetId: string;
  start: number;
  end: number;
  attendees: number;
  note: string;
  /** Zero is Monday. Omitted legacy values are treated as Monday. */
  day?: number;
}
export interface Schedule {
  event: EventInfo;
  rooms: Room[];
  speakers: Speaker[];
  sessions: Session[];
  disruptions: Disruption[];
}
export interface Conflict {
  id: string;
  kind:
    | 'room_overlap'
    | 'speaker_overlap'
    | 'capacity'
    | 'availability'
    | 'hours'
    | 'break'
    | 'locked';
  sessionIds: string[];
  message: string;
}
export interface Move {
  sessionId: string;
  start: number;
  roomId: string;
}
export interface Change extends Move {
  fromStart: number;
  fromRoomId: string;
  title: string;
}
export interface SpeakerConsent {
  speakerId: string;
  sessionIds: string[];
  status: 'pending' | 'confirmed' | 'declined';
  recordedAt: string | null;
}
export interface Proposal {
  id: string;
  baseRevision: number;
  createdAt: string;
  actor: Actor;
  objective: Objective;
  note: string;
  changes: Change[];
  beforeConflicts: number;
  conflicts: Conflict[];
  speakerConsents: SpeakerConsent[];
  metrics: {
    moved: number;
    shiftedMinutes: number;
    roomChanges: number;
    lockedProtected: number;
    evaluated: number;
    elapsedMs: number;
  };
  status: 'pending' | 'applied' | 'rejected';
}
export interface AuditEntry {
  id: string;
  at: string;
  actor: Actor;
  action: string;
  detail: string;
  revision: number;
}
export interface Workspace extends Schedule {
  version: number;
  revision: number;
  proposals: Proposal[];
  audit: AuditEntry[];
  undo: {
    sessions: Session[];
    recurrence?: WeeklyRecurrence | null;
    atRevision: number;
    proposalId: string;
  } | null;
  recurrence?: WeeklyRecurrence | null;
}
export interface WeekOverride {
  weekStart: string;
  sessions: Session[];
  disruptions: Disruption[];
}
export interface WeeklyRecurrence {
  mode: 'weekly';
  activeWeek: string;
  templateSessions: Session[];
  overrides: WeekOverride[];
}
export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
export function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}
export function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function timeValue(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new DomainError(
      'INVALID_TIME',
      'Use a valid 24-hour time, such as 14:30.',
    );
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
export function sessionNames(schedule: Schedule, session: Session) {
  return session.speakerIds
    .map((id) => schedule.speakers.find((p) => p.id === id)?.name ?? id)
    .join(' & ');
}
export function roomName(schedule: Schedule, id: string) {
  return schedule.rooms.find((r) => r.id === id)?.name ?? id;
}
export function sessionDay(session: Pick<Session, 'day'>) {
  return session.day ?? 0;
}
export function weekdayLabel(day: number) {
  return WEEKDAYS[day] ?? `Day ${day + 1}`;
}
export function mondayOf(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new DomainError(
      'INVALID_INPUT',
      'Use a real date in YYYY-MM-DD format.',
    );
  const delta = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - delta);
  return value.toISOString().slice(0, 10);
}
export function dateForDay(weekStart: string, day: number) {
  const value = new Date(`${weekStart}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + day);
  return value.toISOString().slice(0, 10);
}
