export type SessionType = 'keynote' | 'talk' | 'panel' | 'workshop';
export type Objective = 'fewest_changes' | 'preserve_times' | 'preserve_rooms';
export type Actor = 'human' | 'agent';
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
  undo: { sessions: Session[]; atRevision: number; proposalId: string } | null;
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
