'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  Download,
  FileJson,
  History,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Radio,
  Repeat2,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UnlockKeyhole,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleBoard } from '@/components/schedule-board';
import { useWorkspace } from '@/hooks/use-workspace';
import { findConflicts, speakerConsentsFor } from '@/lib/engine';
import { portableSchedule, scheduleCSV, scheduleICS } from '@/lib/export';
import { parseScheduleInput } from '@/lib/import';
import {
  dateForDay,
  roomName,
  sessionDay,
  timeLabel,
  timeValue,
  uid,
  WEEKDAYS,
} from '@/lib/domain';
import type {
  ChangeScope,
  Disruption,
  EventInfo,
  Objective,
  Session,
} from '@/lib/domain';

type Modal =
  | 'disruption'
  | 'session'
  | 'settings'
  | 'help'
  | 'export'
  | 'import'
  | 'history'
  | 'reset'
  | 'apply'
  | 'undo'
  | 'remove'
  | null;
const objectives: Record<Objective, string> = {
  fewest_changes: 'Move fewer sessions',
  preserve_times: 'Keep start times close',
  preserve_rooms: 'Keep the same rooms',
};
const starterPrompt =
  'In Runline, read the schedule and constraints. Mira Sen is unavailable until 14:00. Record this disruption, propose a repair with as few session moves as possible, explain the trade-offs, and request my approval. Do not apply any changes.';
const blankDisruption = {
  kind: 'speaker_delay' as Disruption['kind'],
  targetId: 'mira',
  start: '09:00',
  end: '14:00',
  attendees: 140,
  note: '',
  day: 0,
};

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RunlineApp() {
  const {
    state,
    ready,
    busy,
    error,
    setError,
    dispatch,
    refresh,
    toolStatus,
    calls,
    reviewId,
    setReviewId,
  } = useWorkspace();
  const [modal, setModal] = useState<Modal>(null),
    [formError, setFormError] = useState(''),
    [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''),
    [view, setView] = useState('board'),
    [activeDay, setActiveDay] = useState(0),
    [preview, setPreview] = useState(false),
    [objective, setObjective] = useState<Objective>('fewest_changes');
  const [disruption, setDisruption] = useState(blankDisruption),
    [editing, setEditing] = useState<Session | null>(null),
    [editingEvent, setEditingEvent] = useState<EventInfo>(state.event),
    [recurrenceMode, setRecurrenceMode] = useState<'single' | 'weekly'>(
      'single',
    ),
    [changeScope, setChangeScope] = useState<ChangeScope>('this_week'),
    [editVersion, setEditVersion] = useState(0);
  const [importText, setImportText] = useState('');
  const conflicts = findConflicts(state),
    affected = new Set(conflicts.flatMap((c) => c.sessionIds));
  const pending =
    state.proposals.find((p) => p.id === reviewId && p.status === 'pending') ??
    state.proposals.find((p) => p.status === 'pending');
  const stale = Boolean(pending && pending.baseRevision !== state.revision);
  const pendingSpeakerConsents = pending
    ? (pending.speakerConsents ?? speakerConsentsFor(state, pending.changes))
    : [];
  const canReview = Boolean(
    pending &&
    !stale &&
    pending.changes.length &&
    pending.conflicts.length === 0,
  );
  const canApply = Boolean(
    canReview &&
    pendingSpeakerConsents.length &&
    pendingSpeakerConsents.every((consent) => consent.status === 'confirmed'),
  );
  const [hiddenProposal, setHiddenProposal] = useState<string | null>(null);
  const activePreview =
    (preview || Boolean(reviewId && reviewId !== hiddenProposal)) &&
    !stale &&
    Boolean(pending);
  const busyOrLoading = busy || !ready;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const open = (next: Modal) => {
    setFormError('');
    setEditVersion(state.version);
    setModal(next);
  };
  const run = async (
    input: Record<string, unknown>,
    message?: string,
    version?: number,
  ) => {
    setFormError('');
    try {
      const next = await dispatch({ ...input, actor: 'human' }, version);
      if (message) setNotice(message);
      return next;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong.');
      return null;
    }
  };
  const showSession = (session: Session) => {
    setEditing(structuredClone(session));
    setChangeScope('this_week');
    open('session');
  };
  const newSession = () => {
    setEditing({
      id: uid('session'),
      title: '',
      speakerIds: [state.speakers[0].id],
      roomId: state.rooms[0].id,
      start: state.event.start,
      duration: 60,
      attendees: 50,
      type: 'talk',
      locked: false,
      day: state.recurrence ? activeDay : 0,
    });
    setChangeScope('this_week');
    open('session');
  };
  const propose = async () => {
    const next = await run({ action: 'propose_repair', objective });
    if (next) {
      setReviewId(next.proposals[0].id);
      setPreview(true);
      setNotice(
        next.proposals[0].conflicts.length
          ? 'No complete repair found. Review the blockers.'
          : 'Proposal ready. Your live schedule is unchanged.',
      );
    }
  };
  const nextAfterRejection = async (proposalId: string, message: string) => {
    const rejected = await run(
      { action: 'reject_proposal', id: proposalId },
      message,
    );
    if (!rejected) return;
    const alternative = await run(
      { action: 'propose_repair', objective },
      'A distinct next option is ready. The rejected plan stays excluded.',
      rejected.version,
    );
    if (alternative) {
      setReviewId(alternative.proposals[0].id);
      setPreview(true);
      setModal(null);
    }
  };
  const recordSpeakerConsent = async (
    proposalId: string,
    speakerId: string,
    decision: 'confirmed' | 'declined',
  ) => {
    const speaker = state.speakers.find((item) => item.id === speakerId);
    const next = await run(
      {
        action: 'record_speaker_consent',
        id: proposalId,
        speakerId,
        decision,
      },
      decision === 'confirmed'
        ? `${speaker?.name ?? speakerId} confirmation recorded.`
        : `${speaker?.name ?? speakerId} declined. Looking for a different plan.`,
      editVersion,
    );
    if (!next) return;
    if (decision === 'confirmed') {
      setEditVersion(next.version);
      return;
    }
    const alternative = await run(
      { action: 'propose_repair', objective },
      'A distinct next option is ready. The declined plan stays excluded.',
      next.version,
    );
    if (alternative) {
      setReviewId(alternative.proposals[0].id);
      setPreview(true);
      setModal(null);
    }
  };
  const preset = (kind: Disruption['kind']) => {
    const target =
      kind === 'speaker_delay'
        ? (state.speakers.find((s) => s.id === 'mira')?.id ??
          state.speakers[0].id)
        : kind === 'room_closed'
          ? (state.rooms.find((r) => r.id === 'studio')?.id ??
            state.rooms[0].id)
          : (state.sessions.find((s) => s.id === 'make')?.id ??
            state.sessions[0]?.id ??
            '');
    setDisruption({
      kind,
      targetId: target,
      start: timeLabel(
        kind === 'room_closed'
          ? Math.min(state.event.start + 60, state.event.end - 15)
          : state.event.start,
      ),
      end: timeLabel(
        Math.min(
          kind === 'room_closed'
            ? state.event.start + 180
            : state.event.start + 300,
          state.event.end,
        ),
      ),
      attendees: 140,
      note: '',
      day: state.recurrence ? activeDay : 0,
    });
    open('disruption');
  };
  const date = new Date(state.event.date + 'T12:00:00Z');
  const readableDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const dateLong = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const weekEnd = state.recurrence
    ? new Date(`${dateForDay(state.recurrence.activeWeek, 6)}T12:00:00Z`)
    : null;
  const weekLabel = weekEnd
    ? `${readableDate} – ${weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })}`
    : readableDate;
  const timeZoneLabel =
    state.event.timezone === 'Asia/Kolkata' ? 'IST' : state.event.timezone;
  const lastApplied = state.proposals.find((p) => p.status === 'applied');
  const moveWeek = async (offset: number) => {
    if (!state.recurrence) return;
    const next = new Date(`${state.recurrence.activeWeek}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + offset * 7);
    const weekStart = next.toISOString().slice(0, 10);
    if (
      await run(
        { action: 'set_active_week', weekStart },
        `Opened the week of ${weekStart}.`,
      )
    ) {
      setActiveDay(0);
      setPreview(false);
      setReviewId(null);
    }
  };

  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        Skip to schedule
      </a>
      <aside className="rail">
        <Link className="brand-mark" href="/" aria-label="Runline home">
          <Command size={24} />
        </Link>
        <div className="rail-links">
          <Button
            variant="ghost"
            className="rail-link active"
            title="Schedule"
            aria-label="Schedule"
            onClick={() => {
              setModal(null);
              setView('board');
            }}
          >
            <LayoutGrid size={21} />
          </Button>
          <Button
            variant="ghost"
            className="rail-link"
            title="Activity history"
            aria-label="Activity history"
            onClick={() => open('history')}
          >
            <History size={21} />
          </Button>
          <Button
            variant="ghost"
            className="rail-link"
            title="Event settings"
            aria-label="Event settings"
            onClick={() => {
              setEditingEvent({ ...state.event });
              setRecurrenceMode(state.recurrence ? 'weekly' : 'single');
              open('settings');
            }}
          >
            <Settings2 size={21} />
          </Button>
        </div>
        <Button
          variant="ghost"
          className="rail-link rail-help"
          title="How Runline works"
          aria-label="How Runline works"
          onClick={() => open('help')}
        >
          <CircleHelp size={21} />
        </Button>
        <div className="avatar" title="Your isolated sample workspace">
          CG
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="wordmark">
            runline<span>/</span>
            <span className="topbar-label">Your event, in sync.</span>
          </div>
          <div className="topbar-right">
            <span className={'save-indicator ' + (!ready ? 'connecting' : '')}>
              {busy ? (
                <LoaderCircle size={12} className="spin" />
              ) : ready ? (
                <CheckCheck size={13} />
              ) : (
                <LoaderCircle size={12} className="spin" />
              )}
              {busy ? 'Saving…' : ready ? 'Workspace saved' : 'Connecting…'}
            </span>
            <span className="sample-label">DEMO WORKSPACE</span>
          </div>
        </header>
        <main className="workspace" id="workspace">
          <section className="event-heading">
            <div>
              <div className="eyebrow">
                EVENT CONTROL ROOM <span className="edition">/ 01</span>
              </div>
              <h1>
                {state.event.name.replace(/\s\d{4}$/, '')}{' '}
                <span>{state.event.name.match(/\s(\d{4})$/)?.[1]}</span>
              </h1>
              <p className="event-meta">
                <CalendarDays size={15} />
                {weekLabel}
                <span>·</span>
                {state.event.venue}
                <span>·</span>All times {timeZoneLabel}
              </p>
              {state.recurrence && (
                <div
                  className="week-switcher"
                  aria-label="Weekly timetable navigation"
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous week"
                    disabled={busyOrLoading}
                    onClick={() => void moveWeek(-1)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span>
                    <Repeat2 size={13} /> Week of {state.recurrence.activeWeek}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next week"
                    disabled={busyOrLoading}
                    onClick={() => void moveWeek(1)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}
            </div>
            <div className="header-actions">
              <Button variant="ghost" size="lg" onClick={() => open('help')}>
                <BookOpen size={15} />
                <span>Quick start</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={busyOrLoading}
                onClick={() => open('export')}
              >
                <Download size={15} /> Export schedule <ChevronDown size={12} />
              </Button>
            </div>
          </section>
          {error && (
            <div className="error-banner" role="alert">
              <TriangleAlert size={16} />
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError('');
                  refresh().catch((e) => setError(e.message));
                }}
              >
                Retry
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={14} />
              </Button>
            </div>
          )}
          <div
            className={
              'workspace-summary ' +
              (conflicts.length ? 'attention-summary' : '')
            }
          >
            <div>
              <span
                className={'status-dot ' + (conflicts.length ? 'warning' : '')}
              />
              {conflicts.length ? (
                <>
                  <b>
                    {affected.size}{' '}
                    {affected.size === 1 ? 'session needs' : 'sessions need'}{' '}
                    attention
                  </b>
                  <span className="summary-muted">
                    Let’s get the day back on track.
                  </span>
                </>
              ) : (
                <>
                  Everything in its place
                  <span className="summary-muted">
                    Ready for what comes next.
                  </span>
                </>
              )}
            </div>
            <div className="summary-numbers">
              <span>
                <b>{state.sessions.length}</b> sessions
              </span>
              <span>
                <b>{state.rooms.length}</b> rooms
              </span>
              <span>
                <LockKeyhole size={13} />
                <b>{state.sessions.filter((s) => s.locked).length}</b> locked
              </span>
            </div>
          </div>
          <div className="control-layout">
            <section className="schedule-panel" aria-label="Schedule workspace">
              <div className="panel-toolbar">
                <div>
                  <span className="active-tab">
                    {state.recurrence ? 'Weekly timetable' : 'Run of show'}
                  </span>
                  <span className="quiet-tab">
                    {state.recurrence ? WEEKDAYS[activeDay] : dateLong}
                  </span>
                </div>
                <div className="board-controls">
                  {state.recurrence && (
                    <NativeSelect
                      aria-label="Day of week"
                      value={activeDay}
                      onChange={(event) =>
                        setActiveDay(Number(event.target.value))
                      }
                    >
                      {WEEKDAYS.map((day, index) => (
                        <NativeSelectOption value={index} key={day}>
                          {day.slice(0, 3)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                  <Tabs value={view} onValueChange={(v) => setView(String(v))}>
                    <TabsList>
                      <TabsTrigger value="board" aria-label="Board view">
                        <LayoutGrid size={13} />
                      </TabsTrigger>
                      <TabsTrigger value="agenda" aria-label="Agenda view">
                        <List size={14} />
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Add session"
                    title="Add session"
                    disabled={busyOrLoading}
                    onClick={newSession}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
              <div className="filter-row">
                <div className="search-field">
                  <Search size={13} />
                  <Input
                    aria-label="Search sessions, speakers or rooms"
                    placeholder="Find a session or speaker…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <span className="small-muted">
                  {timeLabel(state.event.start)} — {timeLabel(state.event.end)}
                </span>
              </div>
              {pending && !stale && pending.changes.length > 0 && (
                <div className="preview-bar">
                  <div>
                    <span
                      className={'status-dot ' + (activePreview ? 'blue' : '')}
                    />
                    {activePreview
                      ? 'Previewing proposed changes'
                      : 'Showing current schedule'}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHiddenProposal(activePreview ? reviewId : null);
                      setPreview(!activePreview);
                    }}
                  >
                    {activePreview ? 'See current' : 'See proposal'}
                    <ArrowRight size={12} />
                  </Button>
                </div>
              )}
              <ScheduleBoard
                state={state}
                conflicts={conflicts}
                proposal={pending}
                preview={activePreview}
                query={query}
                agenda={view === 'agenda'}
                activeDay={activeDay}
                onSession={showSession}
              />
              <div className="board-footer">
                <div>
                  <span className="legend-dot talk" /> Talks{' '}
                  <span className="legend-dot workshop" /> Workshops{' '}
                  <span className="legend-dot panel" /> Panels
                </div>
                <span>
                  <LockKeyhole size={12} /> Locked means protected
                </span>
              </div>
            </section>
            <aside className="desk" id="change-desk" aria-label="Change desk">
              <div className="desk-heading">
                <span className="desk-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2>Change desk</h2>
                  <p>A calm plan for the unexpected.</p>
                </div>
                <span className="revision-tag">r{state.revision}</span>
              </div>
              {state.disruptions.length > 0 && (
                <div className="incident-list">
                  {state.disruptions.map((d) => (
                    <div className="incident" key={d.id}>
                      <TriangleAlert size={14} />
                      <div>
                        <strong>
                          {d.kind === 'speaker_delay'
                            ? 'Speaker unavailable'
                            : d.kind === 'room_closed'
                              ? 'Room unavailable'
                              : 'Attendance changed'}
                        </strong>
                        <p>
                          {d.kind === 'speaker_delay'
                            ? state.speakers.find((p) => p.id === d.targetId)
                                ?.name
                            : d.kind === 'room_closed'
                              ? roomName(state, d.targetId)
                              : state.sessions.find((s) => s.id === d.targetId)
                                  ?.title}
                        </p>
                        <span>
                          {d.kind === 'attendance'
                            ? `${d.attendees} expected attendees`
                            : `${timeLabel(d.start)} — ${timeLabel(d.end)}`}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busyOrLoading}
                        aria-label={`Remove disruption for ${d.targetId}`}
                        title="Remove this constraint"
                        onClick={() =>
                          void run(
                            { action: 'resolve_disruption', id: d.id },
                            'Disruption removed. Any older proposal is now stale.',
                          )
                        }
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {pending ? (
                <div className="proposal-card" aria-live="polite">
                  <div className="proposal-title">
                    <span className="eyebrow">
                      {stale
                        ? 'REVIEW NEEDED'
                        : pending.conflicts.length
                          ? 'REPAIR BLOCKED'
                          : pending.changes.length
                            ? 'A WAY FORWARD'
                            : 'ALL CLEAR'}
                    </span>
                    <span className="proposal-source">
                      {pending.actor === 'agent'
                        ? 'Via agent'
                        : 'Repair engine'}
                    </span>
                  </div>
                  <h3>
                    {stale
                      ? 'The plan has changed.'
                      : pending.conflicts.length
                        ? 'A decision is needed.'
                        : pending.changes.length
                          ? `${pending.changes.length} ${pending.changes.length === 1 ? 'move' : 'moves'}. The day is back.`
                          : 'Nothing needs moving.'}
                  </h3>
                  {stale ? (
                    <p className="desk-copy">
                      You or your agent edited the schedule after this proposal.
                      Recalculate to protect the newer decisions.
                    </p>
                  ) : (
                    <>
                      <div className="proposal-metrics">
                        <span>
                          <b>
                            {pending.beforeConflicts}
                            <ArrowRight size={11} />
                            {pending.conflicts.length}
                          </b>{' '}
                          conflicts
                        </span>
                        <span>
                          <b>
                            {pending.metrics.lockedProtected}
                            <ShieldCheck size={12} />
                          </b>{' '}
                          locks kept
                        </span>
                        <span>
                          <b>
                            {pending.metrics.shiftedMinutes}
                            <small>m</small>
                          </b>{' '}
                          total time shift
                        </span>
                        <span>
                          <b>
                            {
                              pendingSpeakerConsents.filter(
                                (consent) => consent.status === 'confirmed',
                              ).length
                            }
                            <small>/{pendingSpeakerConsents.length}</small>
                          </b>{' '}
                          speakers confirmed
                        </span>
                      </div>
                      <div className="change-list">
                        {pending.changes.map((c) => (
                          <div className="change-item" key={c.sessionId}>
                            <span className="change-index">
                              {pending.changes.indexOf(c) + 1}
                            </span>
                            <div>
                              <strong>{c.title}</strong>
                              <p>
                                <span>{timeLabel(c.fromStart)}</span>
                                <ArrowRight size={11} />
                                <b>{timeLabel(c.start)}</b>
                              </p>
                              <small>
                                {c.fromRoomId !== c.roomId
                                  ? `${roomName(state, c.fromRoomId)} → ${roomName(state, c.roomId)}`
                                  : roomName(state, c.roomId)}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                      {pending.conflicts.length > 0 && (
                        <div className="blockers">
                          <strong>Still unresolved</strong>
                          {pending.conflicts.slice(0, 4).map((c) => (
                            <p key={c.id}>
                              <TriangleAlert size={12} />
                              {c.message}
                            </p>
                          ))}
                          <small>
                            No changes can be applied with hard conflicts.
                          </small>
                        </div>
                      )}
                    </>
                  )}
                  <div className="proposal-actions">
                    {canReview && (
                      <Button
                        className="wide-button"
                        size="lg"
                        disabled={busyOrLoading}
                        onClick={() => {
                          setChangeScope('this_week');
                          open('apply');
                        }}
                      >
                        <UserCheck size={16} />{' '}
                        {canApply ? 'Review & apply' : 'Collect confirmations'}{' '}
                        <ArrowUpRight size={14} />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="wide-button"
                      disabled={busyOrLoading}
                      onClick={() => void propose()}
                    >
                      {busy ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}{' '}
                      {stale ? 'Recalculate proposal' : 'Show next-best option'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyOrLoading}
                      onClick={() =>
                        void nextAfterRejection(
                          pending.id,
                          'Proposal rejected. The schedule is unchanged.',
                        )
                      }
                    >
                      Reject & find next
                    </Button>
                  </div>
                  {!stale && pending.changes.length > 0 && (
                    <p className="search-disclosure">
                      {pending.metrics.evaluated.toLocaleString()} candidates
                      checked · bounded search, not a guaranteed optimum.
                    </p>
                  )}
                </div>
              ) : conflicts.length ? (
                <div className="attention-card">
                  <span className="eyebrow">LET’S REWORK THE PLAN</span>
                  <h3>Keep the important bits.</h3>
                  <p className="desk-copy">
                    We’ll check capacities, availability, overlaps, lunch, and
                    turnover. Your locked sessions stay exactly where they are.
                  </p>
                  <div className="conflict-list">
                    {conflicts.slice(0, 3).map((c) => (
                      <p key={c.id}>
                        <TriangleAlert size={13} />
                        {c.message}
                      </p>
                    ))}
                    {conflicts.length > 3 && (
                      <small>
                        + {conflicts.length - 3} more in the schedule
                      </small>
                    )}
                  </div>
                  <Button
                    className="wide-button"
                    size="lg"
                    disabled={busyOrLoading}
                    onClick={() => void propose()}
                  >
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}{' '}
                    Find a repair <ArrowUpRight size={14} />
                  </Button>
                </div>
              ) : (
                <div className="desk-empty">
                  <div className="desk-illustration" aria-hidden="true">
                    <div className="route-line" />
                    <span className="route-stop">A</span>
                    <span className="route-stop">B</span>
                    <span className="route-stop final-stop">
                      <ShieldCheck size={16} />
                    </span>
                  </div>
                  <h3>
                    {lastApplied && state.undo
                      ? 'Back in sync.'
                      : 'The show goes on.'}
                  </h3>
                  <p className="desk-copy">
                    {lastApplied && state.undo
                      ? 'Your reviewed changes are saved. Every session fits, and your protected decisions are still intact.'
                      : 'A speaker runs late. A room goes offline. Find a new plan without losing the decisions you’ve already made.'}
                  </p>
                  <Button
                    className="wide-button"
                    size="lg"
                    disabled={busyOrLoading}
                    onClick={() => preset('speaker_delay')}
                  >
                    <TriangleAlert size={15} /> Report a disruption{' '}
                    <ArrowUpRight size={14} />
                  </Button>
                  <button
                    className="text-action"
                    disabled={busyOrLoading}
                    onClick={() => preset('room_closed')}
                  >
                    Try a room closure instead <ArrowRight size={12} />
                  </button>
                </div>
              )}
              {(conflicts.length > 0 || pending) && (
                <div className="objective-control">
                  <label htmlFor="objective">When there’s a trade-off</label>
                  <NativeSelect
                    id="objective"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value as Objective)}
                  >
                    {Object.entries(objectives).map(([key, label]) => (
                      <NativeSelectOption key={key} value={key}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="add-disruption"
                    disabled={busyOrLoading}
                    onClick={() => preset('speaker_delay')}
                  >
                    <Plus size={13} /> Another disruption
                  </Button>
                </div>
              )}
              {state.undo?.atRevision === state.revision && (
                <Button
                  variant="outline"
                  size="sm"
                  className="undo-button"
                  disabled={busyOrLoading}
                  onClick={() => open('undo')}
                >
                  <RotateCcw size={13} /> Undo last applied repair
                </Button>
              )}
              <div className="desk-note">
                <ShieldCheck size={17} />
                <p>
                  <strong>You keep the final say.</strong> Every repair is a
                  proposal. Nothing moves until you approve it.
                </p>
              </div>
              <div className="agent-card">
                <div>
                  <Radio size={17} />
                  <strong>You + your agent</strong>
                  <span
                    className={
                      'agent-light ' + (toolStatus === 'ready' ? 'ready' : '')
                    }
                  />
                </div>
                <p>
                  {toolStatus === 'ready'
                    ? '10 WebMCP tools are ready. Ask your browser agent to help with this event.'
                    : toolStatus === 'error'
                      ? 'Tool registration failed. Reload in a compatible browser; all manual controls still work.'
                      : 'Open in ChatGPT’s built-in browser, or Chrome with WebMCP enabled. All manual controls work here too.'}
                </p>
                {calls.length > 0 ? (
                  <div className="last-tool">
                    <span className="status-dot" /> Last call:{' '}
                    <code>{calls[0].name}</code>
                    {!calls[0].ok && <span>needs attention</span>}
                  </div>
                ) : (
                  <span>No agent calls yet. No simulated AI.</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="agent-guide"
                  onClick={() => open('help')}
                >
                  Agent quick start <ArrowUpRight size={12} />
                </Button>
              </div>
            </aside>
          </div>
        </main>
        <footer className="app-footer">
          <span>
            RUNLINE <span className="footer-divider">/</span> More room for the
            human moments.
          </span>
          <div>
            <button onClick={() => open('help')}>7-day demo storage</button>
            <span>·</span>
            <button disabled={busyOrLoading} onClick={() => open('import')}>
              Import schedule
            </button>
            <span>·</span>
            <button disabled={busyOrLoading} onClick={() => open('reset')}>
              Reset demo
            </button>
          </div>
        </footer>
      </div>
      {notice && (
        <output className="notice-toast">
          <Check size={15} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={13} />
          </button>
        </output>
      )}

      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent
          className={
            'runline-dialog ' +
            (modal === 'help' || modal === 'history' ? 'wide-dialog' : '')
          }
        >
          <DialogHeader>
            <DialogTitle>
              {modal === 'disruption'
                ? 'What changed?'
                : modal === 'session'
                  ? state.sessions.some((s) => s.id === editing?.id)
                    ? 'Session details'
                    : 'Add a session'
                  : modal === 'settings'
                    ? 'Your event, your constraints'
                    : modal === 'help'
                      ? 'A shared plan. A human final say.'
                      : modal === 'export'
                        ? 'Take the schedule with you'
                        : modal === 'import'
                          ? 'Bring your own schedule'
                          : modal === 'history'
                            ? 'Every decision, accounted for'
                            : modal === 'apply'
                              ? 'Confirm every person affected'
                              : modal === 'undo'
                                ? 'Restore the previous schedule?'
                                : modal === 'remove'
                                  ? 'Remove this session?'
                                  : 'Start fresh with the demo?'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'disruption'
                ? 'Record the facts. We’ll find the options together.'
                : modal === 'session'
                  ? 'Times are event-local. Edits are validated and any conflicts stay visible.'
                  : modal === 'settings'
                    ? 'These boundaries are checked on every repair and approval.'
                    : modal === 'help'
                      ? 'Runline is a real WebMCP workspace, not a chatbot simulation.'
                      : modal === 'export'
                        ? 'Exports contain the current saved schedule, never an unapproved preview.'
                        : modal === 'import'
                          ? 'Paste a Runline JSON export or a timetable CSV. Import replaces the schedule after validation.'
                          : modal === 'history'
                            ? 'Saved actions are shown newest first. Interface labels are not identity verification.'
                            : modal === 'apply'
                              ? 'Every moved session needs recorded speaker confirmation before the organizer can apply it.'
                              : modal === 'undo'
                                ? 'Active disruptions remain. Restoring the old times may bring back conflicts.'
                                : modal === 'remove'
                                  ? 'This removes the session and its attendance constraints. Other sessions stay unchanged.'
                                  : 'The current schedule and proposals will be replaced. The decision history stays available.'}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="form-error" role="alert">
              <TriangleAlert size={14} />
              {formError}
            </div>
          )}
          {modal === 'disruption' && (
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const next = await run(
                    {
                      action: 'report_disruption',
                      disruption: {
                        ...disruption,
                        start: timeValue(disruption.start),
                        end: timeValue(disruption.end),
                      },
                    },
                    'Disruption recorded. Your session times have not changed.',
                    editVersion,
                  );
                  if (next) {
                    setModal(null);
                    setPreview(false);
                  }
                } catch (e) {
                  setFormError(
                    e instanceof Error ? e.message : 'Check the times.',
                  );
                }
              }}
            >
              <div className="disruption-options">
                {(
                  [
                    ['speaker_delay', 'Speaker delay', Clock3],
                    ['room_closed', 'Room closure', LayoutGrid],
                    ['attendance', 'More attendees', Radio],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={disruption.kind === key ? 'default' : 'outline'}
                    onClick={() => {
                      const target =
                        key === 'speaker_delay'
                          ? state.speakers[0].id
                          : key === 'room_closed'
                            ? state.rooms[0].id
                            : state.sessions[0]?.id;
                      setDisruption((d) => ({
                        ...d,
                        kind: key,
                        targetId: target ?? '',
                      }));
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </Button>
                ))}
              </div>
              <label>
                {disruption.kind === 'speaker_delay'
                  ? 'Speaker'
                  : disruption.kind === 'room_closed'
                    ? 'Room'
                    : 'Session'}
                <NativeSelect
                  value={disruption.targetId}
                  onChange={(e) =>
                    setDisruption((d) => ({ ...d, targetId: e.target.value }))
                  }
                >
                  {(disruption.kind === 'speaker_delay'
                    ? state.speakers
                    : disruption.kind === 'room_closed'
                      ? state.rooms
                      : state.sessions.map((s) => ({ id: s.id, name: s.title }))
                  ).map((x) => (
                    <NativeSelectOption key={x.id} value={x.id}>
                      {x.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              {state.recurrence && (
                <label>
                  Affected day
                  <NativeSelect
                    value={disruption.day ?? activeDay}
                    onChange={(e) =>
                      setDisruption((d) => ({
                        ...d,
                        day: Number(e.target.value),
                      }))
                    }
                  >
                    {WEEKDAYS.map((day, index) => (
                      <NativeSelectOption value={index} key={day}>
                        {day}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
              {disruption.kind === 'attendance' ? (
                <label>
                  Expected attendees
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={disruption.attendees}
                    onChange={(e) =>
                      setDisruption((d) => ({
                        ...d,
                        attendees: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ) : (
                <div className="form-grid">
                  <label>
                    Unavailable from
                    <Input
                      type="time"
                      step={900}
                      required
                      value={disruption.start}
                      onChange={(e) =>
                        setDisruption((d) => ({ ...d, start: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Available again at
                    <Input
                      type="time"
                      step={900}
                      required
                      value={disruption.end}
                      onChange={(e) =>
                        setDisruption((d) => ({ ...d, end: e.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
              <label>
                Context <span className="optional">optional</span>
                <Textarea
                  maxLength={280}
                  placeholder="What should the organizer know?"
                  value={disruption.note}
                  onChange={(e) =>
                    setDisruption((d) => ({ ...d, note: e.target.value }))
                  }
                />
              </label>
              <div className="form-hint">
                <ShieldCheck size={15} /> Recording a disruption doesn’t move
                any session.
              </div>
              <Button type="submit" size="lg" disabled={busyOrLoading}>
                {busy ? <LoaderCircle className="spin" /> : <Check />} Record
                disruption
              </Button>
            </form>
          )}
          {modal === 'session' && editing && (
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const next = await run(
                  {
                    action: 'save_session',
                    session: editing,
                    scope: changeScope,
                  },
                  state.recurrence && changeScope === 'future'
                    ? 'Permanent timetable change saved for this and future weeks.'
                    : 'Session saved. Any older proposal needs recalculating.',
                  editVersion,
                );
                if (next) {
                  setModal(null);
                  setPreview(false);
                }
              }}
            >
              {editing.locked && (
                <div className="protected-banner">
                  <LockKeyhole size={16} />
                  <span>
                    This session is protected. Unlock it before editing.
                  </span>
                </div>
              )}
              <label>
                Session title
                <Input
                  required
                  maxLength={160}
                  disabled={editing.locked}
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              {state.recurrence && (
                <label>
                  Weekday
                  <NativeSelect
                    disabled={editing.locked}
                    value={sessionDay(editing)}
                    onChange={(e) =>
                      setEditing({ ...editing, day: Number(e.target.value) })
                    }
                  >
                    {WEEKDAYS.map((day, index) => (
                      <NativeSelectOption value={index} key={day}>
                        {day}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
              <div className="form-grid">
                <label>
                  Room
                  <NativeSelect
                    disabled={editing.locked}
                    value={editing.roomId}
                    onChange={(e) =>
                      setEditing({ ...editing, roomId: e.target.value })
                    }
                  >
                    {state.rooms.map((r) => (
                      <NativeSelectOption key={r.id} value={r.id}>
                        {r.name} · {r.capacity} seats
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  Session type
                  <NativeSelect
                    disabled={editing.locked}
                    value={editing.type}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        type: e.target.value as Session['type'],
                      })
                    }
                  >
                    {['talk', 'panel', 'workshop', 'keynote'].map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {t}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Start time
                  <Input
                    required
                    type="time"
                    step={900}
                    disabled={editing.locked}
                    value={timeLabel(editing.start)}
                    onChange={(e) => {
                      try {
                        setEditing({
                          ...editing,
                          start: timeValue(e.target.value),
                        });
                      } catch {}
                    }}
                  />
                </label>
                <label>
                  Duration, minutes
                  <NativeSelect
                    disabled={editing.locked}
                    value={editing.duration}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        duration: Number(e.target.value),
                      })
                    }
                  >
                    {[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map(
                      (n) => (
                        <NativeSelectOption key={n} value={n}>
                          {n} minutes
                        </NativeSelectOption>
                      ),
                    )}
                  </NativeSelect>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Primary speaker
                  <NativeSelect
                    disabled={editing.locked}
                    value={editing.speakerIds[0]}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        speakerIds: [
                          e.target.value,
                          ...editing.speakerIds
                            .slice(1)
                            .filter((id) => id !== e.target.value),
                        ],
                      })
                    }
                  >
                    {state.speakers.map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  Expected attendees
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    disabled={editing.locked}
                    value={editing.attendees}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        attendees: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              {editing.speakerIds.length > 1 && (
                <p className="form-hint">
                  Additional speakers:{' '}
                  {editing.speakerIds
                    .slice(1)
                    .map((id) => state.speakers.find((s) => s.id === id)?.name)
                    .join(', ')}
                  . Manage additional speakers in a JSON import.
                </p>
              )}
              {state.recurrence && (
                <label>
                  Change applies to
                  <NativeSelect
                    value={changeScope}
                    onChange={(e) =>
                      setChangeScope(e.target.value as ChangeScope)
                    }
                  >
                    <NativeSelectOption value="this_week">
                      This week only — resets next week
                    </NativeSelectOption>
                    <NativeSelectOption value="future">
                      This and all future weeks
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              )}
              <div className="editor-actions">
                {state.sessions.some((s) => s.id === editing.id) && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyOrLoading}
                    onClick={async () => {
                      const next = await run(
                        {
                          action: 'set_lock',
                          id: editing.id,
                          locked: !editing.locked,
                          scope: changeScope,
                        },
                        editing.locked
                          ? 'Session unlocked.'
                          : 'Session protected.',
                        editVersion,
                      );
                      if (next) {
                        setEditing(
                          next.sessions.find((s) => s.id === editing.id)!,
                        );
                        setEditVersion(next.version);
                      }
                    }}
                  >
                    {editing.locked ? (
                      <UnlockKeyhole size={14} />
                    ) : (
                      <LockKeyhole size={14} />
                    )}{' '}
                    {editing.locked ? 'Unlock' : 'Protect session'}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={busyOrLoading || editing.locked}
                >
                  <Check size={14} /> Save session
                </Button>
              </div>
              {state.sessions.some((s) => s.id === editing.id) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="danger-link"
                  disabled={busyOrLoading || editing.locked}
                  onClick={() => open('remove')}
                >
                  <Trash2 size={13} /> Remove session
                </Button>
              )}
            </form>
          )}
          {modal === 'settings' && (
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run(
                    {
                      action: 'save_event',
                      event: editingEvent,
                      recurrenceMode,
                    },
                    'Event settings saved.',
                    editVersion,
                  )
                )
                  setModal(null);
              }}
            >
              <label>
                Event name
                <Input
                  required
                  maxLength={90}
                  value={editingEvent.name}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, name: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  {recurrenceMode === 'weekly' ? 'Week beginning' : 'Date'}
                  <Input
                    type="date"
                    required
                    value={editingEvent.date}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Venue
                  <Input
                    required
                    maxLength={90}
                    value={editingEvent.venue}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        venue: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Schedule pattern
                <NativeSelect
                  value={recurrenceMode}
                  onChange={(e) =>
                    setRecurrenceMode(e.target.value as 'single' | 'weekly')
                  }
                >
                  <NativeSelectOption value="single">
                    Single event
                  </NativeSelectOption>
                  <NativeSelectOption value="weekly">
                    Repeating weekly timetable
                  </NativeSelectOption>
                </NativeSelect>
              </label>
              <label>
                Timezone
                <Input
                  required
                  value={editingEvent.timezone}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      timezone: e.target.value,
                    })
                  }
                />
              </label>
              <div className="form-grid">
                {(
                  [
                    ['start', 'Event starts'],
                    ['end', 'Event ends'],
                    ['breakStart', 'Lunch starts'],
                    ['breakEnd', 'Lunch ends'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <Input
                      type="time"
                      step={900}
                      required
                      value={timeLabel(editingEvent[key])}
                      onChange={(e) => {
                        try {
                          setEditingEvent({
                            ...editingEvent,
                            [key]: timeValue(e.target.value),
                          });
                        } catch {}
                      }}
                    />
                  </label>
                ))}
              </div>
              <label>
                Room and speaker turnover
                <NativeSelect
                  value={editingEvent.turnover}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      turnover: Number(e.target.value),
                    })
                  }
                >
                  {[0, 15, 30, 45, 60].map((n) => (
                    <NativeSelectOption key={n} value={n}>
                      {n} minutes
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <p className="form-hint">
                Weekly mode stores a reusable template. Edit a class for this
                week only to create an exception, or apply it permanently to
                this and future weeks. Full schedules can be imported from JSON
                or timetable CSV.
              </p>
              <Button type="submit" disabled={busyOrLoading}>
                Save event settings
              </Button>
            </form>
          )}
          {modal === 'apply' && pending && (
            <div className="editor-form">
              <div className="approval-summary">
                <ShieldCheck size={24} />
                <div>
                  <strong>
                    {pending.changes.length} changes ·{' '}
                    {pending.conflicts.length} conflicts
                  </strong>
                  <p>
                    {pending.metrics.lockedProtected} locked sessions stay
                    protected ·{' '}
                    {
                      pendingSpeakerConsents.filter(
                        (consent) => consent.status === 'confirmed',
                      ).length
                    }
                    /{pendingSpeakerConsents.length} speakers confirmed.
                  </p>
                </div>
              </div>
              <div className="approval-changes">
                {pending.changes.map((c) => (
                  <div key={c.sessionId}>
                    <strong>{c.title}</strong>
                    <span>
                      {timeLabel(c.fromStart)} · {roomName(state, c.fromRoomId)}
                    </span>
                    <span>
                      <ArrowRight size={12} /> {timeLabel(c.start)} ·{' '}
                      {roomName(state, c.roomId)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="consent-gate">
                <div className="consent-heading">
                  <UserCheck size={18} />
                  <div>
                    <strong>Speaker confirmation gate</strong>
                    <p>
                      Record each affected speaker’s answer. A decline rejects
                      this plan and asks the solver for a distinct alternative.
                    </p>
                  </div>
                </div>
                {pendingSpeakerConsents.map((consent) => {
                  const speaker = state.speakers.find(
                      (item) => item.id === consent.speakerId,
                    ),
                    sessions = consent.sessionIds
                      .map(
                        (sessionId) =>
                          state.sessions.find((item) => item.id === sessionId)
                            ?.title ?? sessionId,
                      )
                      .join(', ');
                  return (
                    <div
                      className={`consent-row ${consent.status}`}
                      key={consent.speakerId}
                    >
                      <div>
                        <strong>{speaker?.name ?? consent.speakerId}</strong>
                        <small>{sessions}</small>
                      </div>
                      {consent.status === 'pending' ? (
                        <div className="consent-actions">
                          <Button
                            size="sm"
                            disabled={busyOrLoading}
                            onClick={() =>
                              void recordSpeakerConsent(
                                pending.id,
                                consent.speakerId,
                                'confirmed',
                              )
                            }
                          >
                            Confirmed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyOrLoading}
                            onClick={() =>
                              void recordSpeakerConsent(
                                pending.id,
                                consent.speakerId,
                                'declined',
                              )
                            }
                          >
                            Declined
                          </Button>
                        </div>
                      ) : (
                        <span>{consent.status}</span>
                      )}
                    </div>
                  );
                })}
                <p className="consent-disclosure">
                  Demo limitation: Runline records the response in this shared
                  workspace; it does not authenticate the speaker’s identity or
                  send external notifications.
                </p>
              </div>
              {state.recurrence && (
                <label>
                  Apply repaired times to
                  <NativeSelect
                    value={changeScope}
                    onChange={(e) =>
                      setChangeScope(e.target.value as ChangeScope)
                    }
                  >
                    <NativeSelectOption value="this_week">
                      This week only — template returns next week
                    </NativeSelectOption>
                    <NativeSelectOption value="future">
                      This and all future weeks
                    </NativeSelectOption>
                  </NativeSelect>
                </label>
              )}
              <p className="form-hint">
                This updates your saved schedule only. Runline does not send
                notifications or make external bookings.
              </p>
              <Button
                size="lg"
                disabled={busyOrLoading || !canApply}
                onClick={async () => {
                  const next = await run(
                    {
                      action: 'apply_proposal',
                      id: pending.id,
                      scope: changeScope,
                    },
                    'Changes approved. Your event is back in sync.',
                    editVersion,
                  );
                  if (next) {
                    setModal(null);
                    setPreview(false);
                    setReviewId(null);
                  }
                }}
              >
                <CheckCheck size={16} /> Apply these changes
              </Button>
            </div>
          )}
          {modal === 'export' && (
            <div className="export-options">
              <Button
                variant="outline"
                onClick={() => {
                  download(
                    'runline-schedule.csv',
                    scheduleCSV(state),
                    'text/csv;charset=utf-8',
                  );
                  setNotice('Current schedule exported as CSV.');
                }}
              >
                <Download />
                <span>
                  <strong>Spreadsheet · CSV</strong>
                  <small>Open in Excel, Sheets, or your runbook.</small>
                </span>
                <ArrowDownToLine size={15} />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  download(
                    'runline-schedule.ics',
                    scheduleICS(state),
                    'text/calendar;charset=utf-8',
                  );
                  setNotice('Calendar file exported.');
                }}
              >
                <CalendarDays />
                <span>
                  <strong>Calendar · ICS</strong>
                  <small>Event-local times, rooms, and speakers.</small>
                </span>
                <ArrowDownToLine size={15} />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  download(
                    'runline-event.json',
                    JSON.stringify(portableSchedule(state), null, 2),
                    'application/json',
                  );
                  setNotice('Portable event JSON exported.');
                }}
              >
                <FileJson />
                <span>
                  <strong>Full event · JSON</strong>
                  <small>Back up or customize rooms and speakers.</small>
                </span>
                <ArrowDownToLine size={15} />
              </Button>
              <p className="form-hint">
                Draft proposals, activity history, and workspace credentials are
                excluded.
              </p>
            </div>
          )}
          {modal === 'import' && (
            <div className="editor-form">
              <p className="form-hint">
                Paste a Runline JSON export or timetable CSV. CSV columns can
                include Mode, Date, Day, Session, Start, Duration, Room,
                Speakers, Attendance, Room Capacity, and Locked. Weekly rows
                become a reusable timetable template. Supports up to 24
                sessions, 6 locations, and 40 people. Avoid personal or
                sensitive data.
              </p>
              <label>
                Schedule JSON or CSV
                <Textarea
                  className="json-editor"
                  placeholder={
                    'Mode,Date,Day,Session,Start,Duration,Room,Speakers,Attendance\nweekly,2026-09-07,Monday,Physics,09:00,60,Room 101,Dr Rao,45'
                  }
                  value={importText}
                  maxLength={55000}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </label>
              <Button
                disabled={busyOrLoading || !importText.trim()}
                onClick={async () => {
                  try {
                    const imported = parseScheduleInput(importText, state);
                    if (
                      await run(
                        {
                          action: 'import_schedule',
                          schedule: imported.schedule,
                          recurrenceMode: imported.recurrenceMode,
                        },
                        imported.recurrenceMode === 'weekly'
                          ? 'Weekly timetable imported. Temporary changes can now expire automatically.'
                          : 'Event imported. Review any conflicts before proposing changes.',
                        editVersion,
                      )
                    ) {
                      setModal(null);
                      setImportText('');
                      setActiveDay(0);
                      setPreview(false);
                      setReviewId(null);
                    }
                  } catch (error) {
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : 'The schedule could not be imported.',
                    );
                  }
                }}
              >
                <Upload size={14} /> Validate & import schedule
              </Button>
            </div>
          )}
          {modal === 'history' && (
            <div className="history-list">
              {calls.length > 0 && (
                <section>
                  <div className="eyebrow">
                    WEBMCP CALLS · THIS PAGE SESSION
                  </div>
                  {calls.map((c, i) => (
                    <div className="tool-history" key={c.time + i}>
                      <Radio size={13} />
                      <code>{c.name}</code>
                      <span>{c.ok ? 'Completed' : 'Needs attention'}</span>
                    </div>
                  ))}
                </section>
              )}
              {state.audit.length === 0 ? (
                <div className="empty-history">
                  <History size={28} />
                  <h3>A clean slate.</h3>
                  <p>
                    Report a disruption or edit a session. Each saved decision
                    will appear here.
                  </p>
                </div>
              ) : (
                state.audit.map((a) => (
                  <div className="history-item" key={a.id}>
                    <span className={'history-icon ' + a.actor}>
                      {a.actor === 'agent' ? (
                        <Radio size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                    </span>
                    <div>
                      <p>{a.detail}</p>
                      <span>
                        {a.actor === 'agent'
                          ? 'Agent tool'
                          : 'Organizer interface'}{' '}
                        · revision {a.revision} ·{' '}
                        {new Date(a.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {modal === 'help' && (
            <div className="help-content">
              <div className="help-steps">
                <div>
                  <span>01</span>
                  <strong>Report what changed</strong>
                  <p>
                    Try a delayed speaker, unavailable room, or increased
                    attendance.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <strong>Find a way forward</strong>
                  <p>
                    Ask your agent or use the repair engine. Compare the
                    proposal against your current schedule.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <strong>Confirm with everyone affected</strong>
                  <p>
                    Record each moved session’s speaker response. A decline
                    searches for a distinct alternative; apply unlocks only
                    after everyone confirms.
                  </p>
                </div>
              </div>
              <section>
                <h3>Bring your browser agent</h3>
                <p>
                  Open this page in ChatGPT’s built-in browser or in Chrome with
                  WebMCP enabled. Runline exposes ten structured tools; it does
                  not run an embedded LLM and needs no API key.
                </p>
                <div className="prompt-box">{starterPrompt}</div>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(starterPrompt)
                      .then(() => setNotice('Starter prompt copied.'))
                      .catch(() =>
                        setFormError(
                          'Clipboard unavailable. Select and copy the prompt above.',
                        ),
                      )
                  }
                >
                  <Copy size={14} /> Copy starter prompt
                </Button>
                <p className="help-status">
                  <span
                    className={
                      'status-dot ' + (toolStatus === 'ready' ? '' : 'warning')
                    }
                  />
                  {toolStatus === 'ready'
                    ? '10 tools registered in this browser.'
                    : toolStatus === 'checking'
                      ? 'Checking browser support…'
                      : 'This browser does not currently have the Runline tools available.'}
                </p>
              </section>
              <section>
                <h3>Real constraints. Honest limits.</h3>
                <p>
                  The engine checks capacity, speaker and room overlaps,
                  availability, event hours, lunch, and turnover. Search is
                  bounded; it may not find every feasible solution or the global
                  optimum. It never applies a blocked proposal. Human edits can
                  introduce conflicts, which stay visible until resolved.
                </p>
                <p>
                  The same model can coordinate a campus program: lecture halls,
                  auditoriums, classrooms, and sports grounds become rooms;
                  matches, rehearsals, ceremonies, and workshops become
                  sessions. Weekly mode separates the reusable timetable from
                  dated exceptions, so a one-week change expires automatically
                  while a permanent change updates future weeks.
                </p>
              </section>
              <section>
                <h3>Your demo workspace</h3>
                <p>
                  The sample event and people are fictional. Each browser gets a
                  separate server-backed workspace, linked by a secure session
                  cookie. Your workspace expires seven days after the last saved
                  action. Expired records are removed when a new workspace is
                  created. There are no external notifications, bookings,
                  payments, or real attendee records. Export JSON to keep a
                  backup. This is a hackathon demo, not a production
                  event-management service.
                </p>
              </section>
              <div className="help-links">
                <a
                  href="https://learn.chatgpt.com/docs/webmcp"
                  target="_blank"
                  rel="noreferrer"
                >
                  WebMCP browser guide <ArrowUpRight size={12} />
                </a>
                <a
                  href="https://webmcp.devpost.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  The WebMCP Challenge <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          )}
          {(modal === 'reset' || modal === 'undo' || modal === 'remove') && (
            <div className="confirm-actions">
              <Button variant="outline" onClick={() => setModal(null)}>
                Keep current schedule
              </Button>
              <Button
                variant={modal === 'remove' ? 'destructive' : 'default'}
                disabled={busyOrLoading}
                onClick={async () => {
                  const action =
                    modal === 'remove'
                      ? 'remove_session'
                      : modal === 'undo'
                        ? 'undo'
                        : 'reset';
                  const next = await run(
                    {
                      action,
                      ...(action === 'remove_session'
                        ? { id: editing?.id, scope: changeScope }
                        : {}),
                    },
                    modal === 'undo'
                      ? 'Previous schedule restored. Review any returning conflicts.'
                      : modal === 'reset'
                        ? 'Sample schedule restored.'
                        : 'Session removed.',
                    editVersion,
                  );
                  if (next) {
                    setModal(null);
                    setPreview(false);
                    setReviewId(null);
                  }
                }}
              >
                {modal === 'remove' ? (
                  <Trash2 size={14} />
                ) : (
                  <RotateCcw size={14} />
                )}{' '}
                {modal === 'reset'
                  ? 'Reset sample schedule'
                  : modal === 'undo'
                    ? 'Restore previous schedule'
                    : 'Remove session'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
