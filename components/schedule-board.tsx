'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The schedule scroll region needs keyboard focus for arrow-key panning. */

import { LockKeyhole, TriangleAlert, Users, ArrowUpRight } from 'lucide-react';
import type { Conflict, Proposal, Session, Workspace } from '@/lib/domain';
import { roomName, sessionDay, sessionNames, timeLabel } from '@/lib/domain';
import { applyMoves, expectedAttendance } from '@/lib/engine';

export function ScheduleBoard({
  state,
  conflicts,
  proposal,
  preview,
  query,
  agenda,
  activeDay,
  onSession,
}: {
  state: Workspace;
  conflicts: Conflict[];
  proposal?: Proposal;
  preview: boolean;
  query: string;
  agenda: boolean;
  activeDay: number;
  onSession: (session: Session) => void;
}) {
  const canPreview =
    preview &&
    proposal?.status === 'pending' &&
    proposal.baseRevision === state.revision;
  const sessions = canPreview
    ? applyMoves(state, proposal.changes)
    : state.sessions;
  const shown = sessions.filter(
    (s) =>
      (!state.recurrence || sessionDay(s) === activeDay) &&
      `${s.title} ${sessionNames(state, s)} ${roomName(state, s.roomId)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const affected = new Set(
    (canPreview ? proposal.conflicts : conflicts).flatMap((c) => c.sessionIds),
  );
  const changed = new Set(
    canPreview ? proposal.changes.map((c) => c.sessionId) : [],
  );
  const hours = Array.from(
    { length: Math.ceil((state.event.end - state.event.start) / 60) },
    (_, i) => state.event.start + i * 60,
  );
  const scale = 1.9,
    height = (state.event.end - state.event.start) * scale;
  if (agenda)
    return (
      <div className="agenda-list">
        {shown.length === 0 && (
          <p className="empty-message">No sessions match your search.</p>
        )}
        {[...shown]
          .sort((a, b) => a.start - b.start)
          .map((s) => (
            <button
              key={s.id}
              className={
                'agenda-session ' +
                (affected.has(s.id) ? 'needs-attention' : '')
              }
              onClick={() =>
                onSession(state.sessions.find((x) => x.id === s.id)!)
              }
            >
              <span className="agenda-time">
                {timeLabel(s.start)}
                <small>{timeLabel(s.start + s.duration)}</small>
              </span>
              <span className={'agenda-type-dot ' + s.type} />
              <div>
                <strong>{s.title}</strong>
                <p>
                  {sessionNames(state, s)} · {roomName(state, s.roomId)}
                </p>
              </div>
              {s.locked && <LockKeyhole size={14} aria-label="Locked" />}
              {changed.has(s.id) && (
                <span className="change-tag">Proposed</span>
              )}
              {affected.has(s.id) && (
                <TriangleAlert size={15} aria-label="Conflict" />
              )}
            </button>
          ))}
      </div>
    );
  // A scrollable region must be keyboard-focusable so arrow keys can pan it.
  return (
    <section
      className="board-scroll"
      tabIndex={0}
      aria-label="Event schedule. Scroll to see all times and rooms."
    >
      <div
        className="schedule-board"
        style={{
          gridTemplateColumns: `60px repeat(${state.rooms.length}, minmax(175px, 1fr))`,
          minWidth: 60 + state.rooms.length * 185,
        }}
      >
        <div className="time-corner">LOCAL</div>
        {state.rooms.map((room, i) => (
          <div className="room-heading" key={room.id}>
            <span className={'room-dot room-dot-' + i} />
            <div>
              <strong>{room.name}</strong>
              <span>
                <Users size={11} /> {room.capacity} capacity
              </span>
            </div>
          </div>
        ))}
        <div className="time-ruler" style={{ height }}>
          {hours.map((time) => (
            <span
              style={{ top: (time - state.event.start) * scale }}
              key={time}
            >
              {timeLabel(time)}
            </span>
          ))}
        </div>
        {state.rooms.map((room) => (
          <div
            className="room-lane"
            key={room.id}
            style={{ height, backgroundSize: `100% ${scale * 60}px` }}
          >
            {state.event.breakEnd > state.event.breakStart && (
              <div
                className="lunch-block"
                style={{
                  top: (state.event.breakStart - state.event.start) * scale,
                  height:
                    (state.event.breakEnd - state.event.breakStart) * scale,
                }}
              >
                <span>Lunch & connections</span>
                <small>
                  {timeLabel(state.event.breakStart)}—
                  {timeLabel(state.event.breakEnd)}
                </small>
              </div>
            )}
            {state.disruptions
              .filter(
                (d) =>
                  d.kind === 'room_closed' &&
                  d.targetId === room.id &&
                  (!state.recurrence || (d.day ?? 0) === activeDay),
              )
              .map((d) => (
                <div
                  key={d.id}
                  className="room-closure"
                  style={{
                    top: (d.start - state.event.start) * scale,
                    height: (d.end - d.start) * scale,
                  }}
                >
                  <span>Room unavailable</span>
                </div>
              ))}
            {shown
              .filter((s) => s.roomId === room.id)
              .map((s) => (
                <button
                  key={s.id}
                  data-testid={'session-' + s.id}
                  className={
                    'session-card ' +
                    s.type +
                    (affected.has(s.id) ? ' conflicted' : '') +
                    (changed.has(s.id) ? ' proposed' : '')
                  }
                  style={{
                    top: Math.max(0, s.start - state.event.start) * scale + 6,
                    height: Math.max(76, s.duration * scale - 12),
                  }}
                  aria-label={`${s.title}, ${timeLabel(s.start)} to ${timeLabel(s.start + s.duration)}, ${room.name}${s.locked ? ', locked' : ''}${affected.has(s.id) ? ', conflict' : ''}${changed.has(s.id) ? ', proposed move' : ''}`}
                  onClick={() =>
                    onSession(state.sessions.find((x) => x.id === s.id)!)
                  }
                >
                  <span className="session-time">
                    {timeLabel(s.start)} — {timeLabel(s.start + s.duration)}
                    <span>
                      {s.locked && <LockKeyhole size={11} />}
                      {affected.has(s.id) && <TriangleAlert size={12} />}
                    </span>
                  </span>
                  <strong>{s.title}</strong>
                  <span className="session-speaker">
                    {sessionNames(state, s)}
                  </span>
                  {s.duration >= 60 && (
                    <span className="session-card-bottom">
                      <span className="session-type">{s.type}</span>
                      {changed.has(s.id) ? (
                        <span className="change-tag">
                          <ArrowUpRight size={10} /> Proposed
                        </span>
                      ) : (
                        <span className="attendee-count">
                          <Users size={10} />
                          {expectedAttendance(state, s)}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
          </div>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="empty-message">No sessions match your search.</p>
      )}
    </section>
  );
}
