# WebMCP contract

Runline registers imperative JavaScript tools on `document.modelContext`, with `navigator.modelContext` as a compatibility fallback. It must be opened as a top-level page. It does not inject a polyfill that falsely reports native browser support. Registration errors are surfaced and successfully registered tools are cleaned up on partial failure or unmount.

## Tool surface

| Tool                | Effect                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `get_event_summary` | Read event, versions, conflict count, locked IDs and pending proposals.                |
| `list_sessions`     | Read stable IDs and schedule information, at most six sessions per call.               |
| `get_constraints`   | Read rooms, capacities, speakers, hours, lunch, turnover and disruptions.              |
| `list_conflicts`    | Read current violations, six per page.                                                 |
| `report_disruption` | Save a user-requested availability/capacity constraint; do not move sessions.          |
| `propose_repair`    | Save a bounded-search proposal using a chosen objective.                               |
| `propose_moves`     | Save an agent-authored move proposal and evaluate its hard constraints.                |
| `inspect_proposal`  | Read changes, remaining conflicts, status and staleness.                               |
| `request_approval`  | Record a review request and select the proposal in the organizer UI. Never applies it. |
| `get_activity`      | Read the latest five saved actions to verify actual outcomes.                          |

Every handler returns `{ ok: true, data }` or `{ ok: false, code, error }`. Schemas use stable IDs, explicit enums, bounded arrays and event-local `HH:mm` strings. Tool errors are not disguised as success. Read-only annotations are hints, not access-control mechanisms.

## Intended sequence

Read summary → read relevant sessions and constraints → record the requested disruption → propose repair or moves → inspect proposal → request approval → stop for organizer action → read activity to verify the result.

After a human edit, the agent must inspect/re-read rather than assume its previous proposal is still valid. The server checks the current version, proposal revision, locks and all hard constraints before applying. Approval requires a pending proposal with at least one change and zero remaining conflicts. An impossible request remains a visible blocker.

## Why browser-native matters

The tools operate inside the same page context and cookie-isolated workspace the organizer is viewing. No separate MCP server, account connection, agent-specific API key, copied schedule, or screen-coordinate parser is required. A manual lock changes the data used by the agent's next proposal, and a tool-created proposal immediately appears in the visual comparison panel.

The agent supplies intent and can reason about trade-offs or author moves; deterministic server-side validation protects scheduling invariants. This separation makes the collaboration auditable without pretending that a numerical search is itself an AI model.

## Safety boundary

No WebMCP tool is provided to apply a proposal or unlock a session. The organizer's explicit review flow is the intended control boundary. It does not authenticate human presence: direct API callers with the cookie can label requests as organizer actions, and general browser agents may have access to the DOM. A hardened multi-user product needs stronger authorization and consent mechanisms.

## References

- [OpenAI WebMCP browser documentation](https://learn.chatgpt.com/docs/webmcp)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Hackathon resources](https://webmcp.devpost.com/resources)

Browser API support is evolving. Unit tests verify the real handler chain and registration adapter. A successful native-browser tool-discovery/execute trace must be captured before claiming end-to-end browser compatibility.
