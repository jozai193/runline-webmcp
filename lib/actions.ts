import { DomainError, uid } from './domain.ts';
import type { Actor, Workspace } from './domain.ts';
import {
  applyMoves,
  createProposal,
  findConflicts,
  repairSchedule,
  speakerConsentsFor,
} from './engine.ts';
import { createSample } from './sample.ts';
import {
  bool,
  id,
  integer,
  parseDisruption,
  parseEvent,
  parseMoves,
  parseObjective,
  parseSchedule,
  parseSession,
  record,
  text,
} from './validation.ts';

export const AGENT_ACTIONS = new Set([
  'report_disruption',
  'propose_repair',
  'propose_moves',
  'request_approval',
]);
export function transition(previous: Workspace, input: unknown): Workspace {
  const command = record(input),
    action = text(command.action, 'Action', 32);
  const actor: Actor = command.actor === 'agent' ? 'agent' : 'human';
  if (
    integer(command.version, 'Version', 0, Number.MAX_SAFE_INTEGER) !==
    previous.version
  )
    throw new DomainError(
      'STALE_VERSION',
      'This workspace changed in another tab or tool call. Refresh and try again.',
    );
  if (actor === 'agent' && !AGENT_ACTIONS.has(action))
    throw new DomainError(
      'HUMAN_REVIEW_REQUIRED',
      'This action is reserved for the organizer interface. Agents can propose changes, not approve them.',
    );
  const state = structuredClone(previous);
  for (const proposal of state.proposals)
    proposal.speakerConsents ??= speakerConsentsFor(state, proposal.changes);
  let detail = '',
    changesSchedule = false;
  switch (action) {
    case 'report_disruption': {
      if (state.disruptions.length >= 12)
        throw new DomainError(
          'LIMIT_REACHED',
          'Resolve an existing disruption before adding another.',
        );
      const d = parseDisruption(
        { ...record(command.disruption), id: uid('incident') },
        state,
      );
      if (
        state.disruptions.some(
          (x) =>
            x.kind === d.kind &&
            x.targetId === d.targetId &&
            x.start === d.start &&
            x.end === d.end &&
            x.attendees === d.attendees,
        )
      )
        throw new DomainError(
          'DUPLICATE_DISRUPTION',
          'This disruption is already recorded.',
        );
      state.disruptions.push(d);
      changesSchedule = true;
      detail =
        d.note || `Recorded ${d.kind.replaceAll('_', ' ')} for ${d.targetId}.`;
      break;
    }
    case 'resolve_disruption': {
      const target = id(command.id);
      if (!state.disruptions.some((d) => d.id === target))
        throw new DomainError(
          'NOT_FOUND',
          'This disruption is no longer active.',
        );
      state.disruptions = state.disruptions.filter((d) => d.id !== target);
      changesSchedule = true;
      detail = 'Organizer removed a disruption constraint.';
      break;
    }
    case 'set_lock': {
      const s = state.sessions.find((s) => s.id === id(command.id));
      if (!s) throw new DomainError('NOT_FOUND', 'Session not found.');
      s.locked = bool(command.locked, 'Locked');
      changesSchedule = true;
      detail = `${s.locked ? 'Protected' : 'Unlocked'} “${s.title}”.`;
      break;
    }
    case 'save_session': {
      const s = parseSession(command.session, state),
        existing = state.sessions.find((x) => x.id === s.id);
      if (existing?.locked)
        throw new DomainError(
          'LOCKED_SESSION',
          'Unlock this session before editing it.',
        );
      if (existing)
        state.sessions = state.sessions.map((x) => (x.id === s.id ? s : x));
      else {
        if (state.sessions.length >= 24)
          throw new DomainError(
            'LIMIT_REACHED',
            'This workspace supports up to 24 sessions.',
          );
        state.sessions.push(s);
      }
      changesSchedule = true;
      detail = `${existing ? 'Edited' : 'Added'} “${s.title}”.`;
      break;
    }
    case 'remove_session': {
      const target = id(command.id),
        s = state.sessions.find((s) => s.id === target);
      if (!s) throw new DomainError('NOT_FOUND', 'Session not found.');
      if (s.locked)
        throw new DomainError(
          'LOCKED_SESSION',
          'Unlock the session before removing it.',
        );
      state.sessions = state.sessions.filter((s) => s.id !== target);
      state.disruptions = state.disruptions.filter(
        (d) => !(d.kind === 'attendance' && d.targetId === target),
      );
      changesSchedule = true;
      detail = `Removed “${s.title}”.`;
      break;
    }
    case 'save_event':
      state.event = parseEvent(command.event);
      changesSchedule = true;
      detail = 'Updated event details and constraints.';
      break;
    case 'propose_repair': {
      const p = repairSchedule(state, parseObjective(command.objective), actor);
      state.proposals = [p, ...state.proposals].slice(0, 12);
      detail = `Proposed ${p.metrics.moved} changes; ${p.conflicts.length} remaining conflicts.`;
      break;
    }
    case 'propose_moves': {
      const sessions = applyMoves(state, parseMoves(command.moves));
      const p = createProposal(
        state,
        sessions,
        'fewest_changes',
        actor,
        text(command.note ?? 'Custom schedule proposal.', 'Proposal note', 400),
      );
      state.proposals = [p, ...state.proposals].slice(0, 12);
      detail = `Proposed ${p.changes.length} specific schedule changes.`;
      break;
    }
    case 'request_approval': {
      const p = state.proposals.find((p) => p.id === id(command.id));
      if (!p || p.status !== 'pending')
        throw new DomainError('NOT_FOUND', 'Choose a pending proposal.');
      if (p.baseRevision !== state.revision)
        throw new DomainError(
          'STALE_PROPOSAL',
          'This proposal predates a schedule edit. Generate a fresh proposal.',
        );
      if (p.conflicts.length > 0 || p.changes.length === 0)
        throw new DomainError(
          'UNSAFE_PROPOSAL',
          'Only a non-empty, conflict-free proposal can be sent for approval.',
        );
      state.proposals = [p, ...state.proposals.filter((x) => x.id !== p.id)];
      detail =
        'Agent requested organizer review. No schedule changes were applied.';
      break;
    }
    case 'reject_proposal': {
      const p = state.proposals.find((p) => p.id === id(command.id));
      if (!p || p.status !== 'pending')
        throw new DomainError('NOT_FOUND', 'Pending proposal not found.');
      p.status = 'rejected';
      detail = 'Organizer dismissed the proposal. Schedule unchanged.';
      break;
    }
    case 'record_speaker_consent': {
      const p = state.proposals.find((p) => p.id === id(command.id));
      if (!p || p.status !== 'pending')
        throw new DomainError('NOT_FOUND', 'Pending proposal not found.');
      if (p.baseRevision !== state.revision)
        throw new DomainError(
          'STALE_PROPOSAL',
          'The schedule changed before confirmation. Generate a fresh repair.',
        );
      const speakerId = id(command.speakerId),
        consent = p.speakerConsents.find(
          (item) => item.speakerId === speakerId,
        ),
        decision = text(command.decision, 'Decision', 16);
      if (!consent)
        throw new DomainError(
          'UNKNOWN_TARGET',
          'This speaker is not affected by the proposal.',
        );
      if (decision !== 'confirmed' && decision !== 'declined')
        throw new DomainError('INVALID_INPUT', 'Choose confirmed or declined.');
      consent.status = decision;
      consent.recordedAt = new Date().toISOString();
      const speaker = state.speakers.find((item) => item.id === speakerId);
      if (decision === 'declined') {
        p.status = 'rejected';
        detail = `${speaker?.name ?? speakerId} declined the proposed session change. The proposal was rejected.`;
      } else
        detail = `${speaker?.name ?? speakerId} confirmation was recorded for the proposal.`;
      break;
    }
    case 'apply_proposal': {
      const p = state.proposals.find((p) => p.id === id(command.id));
      if (!p || p.status !== 'pending')
        throw new DomainError(
          'NOT_FOUND',
          'This proposal was already handled or no longer exists.',
        );
      if (p.baseRevision !== state.revision)
        throw new DomainError(
          'STALE_PROPOSAL',
          'The schedule or constraints changed after this proposal. Generate a fresh repair.',
        );
      if (!p.changes.length)
        throw new DomainError(
          'EMPTY_PROPOSAL',
          'There are no changes to apply.',
        );
      const sessions = applyMoves(state, p.changes);
      if (findConflicts({ ...state, sessions }).length > 0)
        throw new DomainError(
          'UNSAFE_PROPOSAL',
          'The proposal still violates constraints and cannot be applied.',
        );
      if (p.speakerConsents.some((consent) => consent.status !== 'confirmed'))
        throw new DomainError(
          'SPEAKER_CONSENT_REQUIRED',
          'Every affected speaker must confirm before the organizer can apply this proposal.',
        );
      state.undo = {
        sessions: structuredClone(state.sessions),
        atRevision: state.revision + 1,
        proposalId: p.id,
      };
      state.sessions = sessions;
      p.status = 'applied';
      for (const old of state.proposals)
        if (old.id !== p.id && old.status === 'pending')
          old.status = 'rejected';
      changesSchedule = true;
      detail = `Organizer approved ${p.changes.length} changes. All hard constraints satisfied.`;
      break;
    }
    case 'undo': {
      if (!state.undo || state.undo.atRevision !== state.revision)
        throw new DomainError(
          'STALE_UNDO',
          'Undo is available only until the next schedule or constraint edit.',
        );
      state.sessions = state.undo.sessions;
      state.undo = null;
      changesSchedule = true;
      detail =
        'Organizer restored the previous schedule. Active disruptions remain and may cause conflicts again.';
      break;
    }
    case 'import_schedule': {
      const schedule = parseSchedule(command.schedule);
      Object.assign(state, schedule);
      state.proposals = [];
      state.undo = null;
      changesSchedule = true;
      detail = 'Imported a validated event schedule.';
      break;
    }
    case 'reset': {
      const sample = createSample();
      Object.assign(state, sample, {
        version: previous.version,
        revision: previous.revision,
        audit: previous.audit,
      });
      changesSchedule = true;
      detail = 'Organizer reset the workspace to the fictional sample event.';
      break;
    }
    default:
      throw new DomainError('UNKNOWN_ACTION', 'Unsupported action.');
  }
  state.version++;
  if (changesSchedule) {
    state.revision++;
    if (action !== 'apply_proposal') state.undo = null;
  }
  state.audit = [
    {
      id: uid('log'),
      at: new Date().toISOString(),
      actor,
      action,
      detail,
      revision: state.revision,
    },
    ...state.audit,
  ].slice(0, 100);
  return state;
}
