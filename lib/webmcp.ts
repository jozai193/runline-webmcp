import {
  DomainError,
  roomName,
  sessionNames,
  timeLabel,
  timeValue,
} from './domain.ts';
import type { Proposal, Workspace } from './domain.ts';
import { expectedAttendance, findConflicts } from './engine.ts';
import { id, integer, record, text } from './validation.ts';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
}
export interface ToolAdapter {
  read: () => Promise<Workspace>;
  dispatch: (input: Record<string, unknown>) => Promise<Workspace>;
  review: (id: string) => void;
}
const schema = (
  properties: Record<string, unknown> = {},
  required: string[] = [],
) => ({ type: 'object', properties, required, additionalProperties: false });
const string = (description: string) => ({ type: 'string', description });
const proposalSummary = (p: Proposal) => ({
  id: p.id,
  baseRevision: p.baseRevision,
  status: p.status,
  changes: p.changes.map((c) => ({
    session_id: c.sessionId,
    from: timeLabel(c.fromStart),
    to: timeLabel(c.start),
    room_id: c.roomId,
  })),
  remainingConflicts: p.conflicts.length,
  speakerConsents: (p.speakerConsents ?? []).map((consent) => ({
    speaker_id: consent.speakerId,
    session_ids: consent.sessionIds,
    status: consent.status,
  })),
  metrics: p.metrics,
  note: p.note,
  applied: p.status === 'applied',
});

/** The same real application commands power the UI and these agent tools. No fake chat responses. */
export function buildTools(adapter: ToolAdapter): ToolDefinition[] {
  function tool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    readOnly: boolean,
    execute: ToolDefinition['execute'],
  ): ToolDefinition {
    return {
      name,
      description,
      inputSchema,
      annotations: { readOnlyHint: readOnly },
      execute: async (input) => {
        try {
          return { ok: true, data: await execute(input ?? {}) };
        } catch (error) {
          return {
            ok: false,
            code: error instanceof DomainError ? error.code : 'TOOL_ERROR',
            error:
              error instanceof Error
                ? error.message
                : 'The tool could not complete. Refresh and try again.',
          };
        }
      },
    };
  }
  return [
    tool(
      'get_event_summary',
      'Read the current event, version, conflict count, and pending proposal IDs. Start here. All times are event-local; this never changes the schedule.',
      schema(),
      true,
      async () => {
        const s = await adapter.read();
        return {
          event: s.event,
          version: s.version,
          revision: s.revision,
          sessions: s.sessions.length,
          conflicts: findConflicts(s).length,
          lockedSessionIds: s.sessions.filter((x) => x.locked).map((x) => x.id),
          pendingProposals: s.proposals
            .filter((p) => p.status === 'pending')
            .map((p) => ({ id: p.id, stale: p.baseRevision !== s.revision })),
          approvalPolicy:
            'Only the organizer can apply a proposal through the review interface, and every affected speaker must be confirmed first.',
        };
      },
    ),
    tool(
      'list_sessions',
      'List sessions with stable IDs, speakers, room IDs, locks, and times. Paginated, at most 6 per call. Use query for a title or speaker; use IDs for later calls.',
      schema({
        query: string('Optional title or speaker search.'),
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 6 },
      }),
      true,
      async (input) => {
        const v = record(input),
          s = await adapter.read(),
          query = v.query ? text(v.query, 'Query', 100).toLowerCase() : '';
        const offset = integer(v.offset ?? 0, 'Offset', 0, 100),
          limit = integer(v.limit ?? 4, 'Limit', 1, 6);
        const matches = s.sessions
          .filter((x) =>
            `${x.title} ${sessionNames(s, x)}`.toLowerCase().includes(query),
          )
          .sort((a, b) => a.start - b.start);
        return {
          total: matches.length,
          nextOffset: offset + limit < matches.length ? offset + limit : null,
          sessions: matches.slice(offset, offset + limit).map((x) => ({
            id: x.id,
            title: x.title,
            speaker_ids: x.speakerIds,
            speakers: sessionNames(s, x),
            room_id: x.roomId,
            start: timeLabel(x.start),
            duration: x.duration,
            attendance: expectedAttendance(s, x),
            locked: x.locked,
          })),
        };
      },
    ),
    tool(
      'get_constraints',
      'Read room capacities, speaker IDs, event boundaries, turnover, lunch break, and active disruptions. Respect all constraints and locks; never invent room or speaker IDs.',
      schema(),
      true,
      async () => {
        const s = await adapter.read();
        return {
          rooms: s.rooms,
          speakers: s.speakers,
          hours: [timeLabel(s.event.start), timeLabel(s.event.end)],
          lunch: [timeLabel(s.event.breakStart), timeLabel(s.event.breakEnd)],
          turnoverMinutes: s.event.turnover,
          disruptions: s.disruptions,
        };
      },
    ),
    tool(
      'list_conflicts',
      'Read current hard-constraint failures, including involved session IDs. Does not change or repair anything. Paginated, at most 6 conflicts per call.',
      schema({ offset: { type: 'integer', minimum: 0 } }),
      true,
      async (input) => {
        const offset = integer(record(input).offset ?? 0, 'Offset', 0, 500),
          conflicts = findConflicts(await adapter.read());
        return {
          total: conflicts.length,
          conflicts: conflicts.slice(offset, offset + 6),
          nextOffset: offset + 6 < conflicts.length ? offset + 6 : null,
        };
      },
    ),
    tool(
      'report_disruption',
      'Record a user-requested speaker unavailability, room closure, or attendance increase. This changes constraints, not session times, and makes older proposals stale. Use existing IDs and HH:mm event-local times.',
      schema(
        {
          kind: {
            type: 'string',
            enum: ['speaker_delay', 'room_closed', 'attendance'],
          },
          target_id: string(
            'Speaker ID for delay; room ID for closure; session ID for attendance.',
          ),
          start_time: string('HH:mm. Required for delay or closure.'),
          end_time: string('HH:mm. Required for delay or closure.'),
          attendees: { type: 'integer', minimum: 1, maximum: 10000 },
          note: string('Brief factual description, up to 280 characters.'),
        },
        ['kind', 'target_id'],
      ),
      false,
      async (input) => {
        const v = record(input);
        const next = await adapter.dispatch({
          action: 'report_disruption',
          actor: 'agent',
          disruption: {
            kind: v.kind,
            targetId: v.target_id,
            start:
              v.kind === 'attendance'
                ? 0
                : timeValue(text(v.start_time, 'Start time', 5)),
            end:
              v.kind === 'attendance'
                ? 0
                : timeValue(text(v.end_time, 'End time', 5)),
            attendees: v.attendees ?? 0,
            note: v.note ?? '',
          },
        });
        return {
          disruption: next.disruptions.at(-1),
          conflicts: findConflicts(next).length,
          revision: next.revision,
          scheduleTimesChanged: false,
        };
      },
    ),
    tool(
      'propose_repair',
      'Run bounded constraint search and save a repair proposal for the current schedule. Earlier plans for this revision are excluded, so repeated calls can return a distinct next-best option. Never applies changes. Inspect the result; a blocked proposal must not be approved.',
      schema(
        {
          objective: {
            type: 'string',
            enum: ['fewest_changes', 'preserve_times', 'preserve_rooms'],
          },
        },
        ['objective'],
      ),
      false,
      async (input) => {
        const next = await adapter.dispatch({
          action: 'propose_repair',
          actor: 'agent',
          objective: record(input).objective,
        });
        adapter.review(next.proposals[0].id);
        return proposalSummary(next.proposals[0]);
      },
    ),
    tool(
      'propose_moves',
      'Save your own multi-session proposal using existing IDs and 15-minute start times. Locked sessions cannot move. This validates conflicts but does not apply changes; the human must review it.',
      schema(
        {
          moves: {
            type: 'array',
            minItems: 1,
            maxItems: 24,
            items: schema(
              {
                session_id: string('Existing session ID.'),
                room_id: string('Existing room ID.'),
                start_time: string(
                  'Proposed HH:mm start time on a 15-minute boundary.',
                ),
              },
              ['session_id', 'room_id', 'start_time'],
            ),
          },
          note: string('Explain the trade-off in at most 400 characters.'),
        },
        ['moves', 'note'],
      ),
      false,
      async (input) => {
        const v = record(input);
        if (!Array.isArray(v.moves) || v.moves.length > 24)
          throw new DomainError('INVALID_INPUT', 'Provide up to 24 moves.');
        const next = await adapter.dispatch({
          action: 'propose_moves',
          actor: 'agent',
          note: v.note,
          moves: v.moves.map((item) => {
            const m = record(item);
            return {
              sessionId: m.session_id,
              roomId: m.room_id,
              start: timeValue(text(m.start_time, 'Start time', 5)),
            };
          }),
        });
        adapter.review(next.proposals[0].id);
        return proposalSummary(next.proposals[0]);
      },
    ),
    tool(
      'inspect_proposal',
      'Read a saved proposal, current validity, changes, speaker-confirmation status, and remaining conflicts. A stale proposal must be regenerated. Applying also requires every affected speaker to be confirmed in the organizer interface.',
      schema(
        {
          proposal_id: string('Exact proposal ID returned by a proposal tool.'),
        },
        ['proposal_id'],
      ),
      true,
      async (input) => {
        const s = await adapter.read(),
          p = s.proposals.find((x) => x.id === id(record(input).proposal_id));
        if (!p) throw new DomainError('NOT_FOUND', 'Proposal not found.');
        return {
          ...proposalSummary(p),
          stale: p.baseRevision !== s.revision,
          conflicts: p.conflicts.slice(0, 4),
          roomLabels: s.rooms.map((r) => ({
            id: r.id,
            name: roomName(s, r.id),
          })),
        };
      },
    ),
    tool(
      'request_approval',
      'Bring a feasible proposal to the organizer review panel. This requests review; it NEVER applies a proposal or records speaker consent. Tell the user which changes and confirmations await action, then stop before claiming completion.',
      schema(
        {
          proposal_id: string('A pending, current, conflict-free proposal ID.'),
        },
        ['proposal_id'],
      ),
      false,
      async (input) => {
        const proposalId = id(record(input).proposal_id);
        await adapter.dispatch({
          action: 'request_approval',
          actor: 'agent',
          id: proposalId,
        });
        adapter.review(proposalId);
        return {
          status: 'awaiting_human_approval',
          proposalId,
          scheduleChanged: false,
          nextStep:
            'Organizer records confirmation from every affected speaker, then reviews and selects Apply these changes in the app.',
        };
      },
    ),
    tool(
      'get_activity',
      'Read the latest 5 workspace actions to verify whether a proposal was actually approved. Actor labels record the calling interface; they are not proof of a person’s identity.',
      schema(),
      true,
      async () => {
        const s = await adapter.read();
        return {
          revision: s.revision,
          actions: s.audit.slice(0, 5).map((a) => ({
            at: a.at,
            actor: a.actor,
            action: a.action,
            detail: a.detail,
          })),
        };
      },
    ),
  ];
}

export interface ModelContext {
  registerTool: (tool: ToolDefinition) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
}
export async function registerRunlineTools(
  context: ModelContext,
  adapter: ToolAdapter,
  onCall: (name: string, ok: boolean) => void,
) {
  const tools = buildTools(adapter),
    registered: string[] = [];
  try {
    for (const tool of tools) {
      const execute = tool.execute;
      await context.registerTool({
        ...tool,
        execute: async (input) => {
          const result = await execute(input);
          onCall(tool.name, Boolean((result as { ok: boolean }).ok));
          return result;
        },
      });
      registered.push(tool.name);
    }
  } catch (error) {
    for (const name of registered) await context.unregisterTool?.(name);
    throw error;
  }
  return async () => {
    for (const name of registered) await context.unregisterTool?.(name);
  };
}
