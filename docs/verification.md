# Verification record

Date: September 2, 2026, IST. Environment: Windows, Node 24.14.1. This separates completed checks from required release gates.

## Completed automated checks

- 47 domain/adapter tests passed: baseline validation; three disruption types across three search objectives; lock preservation; impossible requests; proposal immutability; distinct same-revision alternatives; required affected-speaker confirmation and decline handling; stale version and stale proposal rejection; approval; undo; custom moves; import validation; CSV formula handling; UTF-8 calendar folding and midnight rollover; actual WebMCP handler sequence; registration cleanup and failure rollback.
- 25 HTTP integration checks passed against the local Worker/D1 runtime: creation and cookie flags, isolated workspaces, saved disruption/proposal, refusal to apply before affected-speaker confirmation, persisted speaker confirmations, approval, persistence across requests, exact-one-winner concurrent updates, origin/header checks, missing/unknown cookie handling, invalid JSON, bounded request size and content type enforcement.
- TypeScript strict checking passed.
- Source lint passed, including form-control labels and React correctness checks. This is not a formal accessibility audit.
- The public app registered all ten Runline tools in the intended in-app browser. Every tool was executed against an isolated fictional workspace. Read tools returned the saved event; `report_disruption` changed only constraints; `propose_repair` returned a two-session, zero-conflict repair; `request_approval` left the schedule pending; and the organizer interface applied it. Reload preserved the repair and `get_activity` returned the matching saved actions.
- A newer organizer lock made an existing proposal stale. Both the review UI and native `request_approval` rejected it. A separate auditorium-closure scenario covering the locked opening returned one unresolved conflict and rejected the approval request. A custom proposal was accepted for review, while a custom move of the locked opening was rejected.
- Browser interaction checks covered desktop board/agenda switching, search, session add/edit/remove confirmations, event settings, reset, undo and concurrent-change protection, malformed and valid JSON import, all three export controls, activity history, proposal comparison/review, Escape-close behavior, and a 390 x 844 phone viewport. The phone page had no document-level horizontal overflow; its schedule board remained intentionally scrollable. No browser console errors were present at the final clean sample.
- The complete MIT-licensed source is public at https://github.com/jozai193/runline-webmcp. Anonymous HTTP access and a fresh unauthenticated clone were verified. That clone passed `npm ci` with zero known vulnerabilities, all 45 tests, lint, typecheck and the production build.
- Production Worker build passed after upgrading vulnerable starter dependencies.
- The current 25 HTTP checks passed against both the local Worker/D1 runtime and the public September 2 deployment, with a healthy response afterward. A local Wrangler unread-request-body failure was reproduced and addressed by bounded body consumption before rejection; all origin, size and content-type checks remain enforced. Related upstream report: https://github.com/cloudflare/workers-sdk/issues/15203.
- `npm install` audit reported zero known vulnerabilities after the pinned dependency updates and a scoped esbuild override. This is not a full security audit and does not guarantee absence of vulnerabilities.
- Drizzle schema generation passed with the scoped override and reported no missing migrations.

## Remaining release gates

- Listen through the narrated draft and review motion/pacing before any upload. Container, duration, dimensions, audio stream/levels and an eight-frame visual contact sheet were checked; this is not an auditory or frame-by-frame review.
- Upload the approved, narrated video publicly (not unlisted), then verify playback from a signed-out session.
- Recheck the final Devpost entry, entrant/team eligibility, public URLs and required acknowledgements; submit only after explicit user approval.

The export controls were exercised and source/unit checks cover their generated formats, but the in-app browser did not expose downloaded files for byte-level browser verification. No production traffic load test, penetration test, formal accessibility audit, calendar-client compatibility matrix, unsupported-browser matrix or real-event pilot has been performed.

## Known scope limitations

- Bounded search is not globally optimal and may miss feasible schedules.
- Maximum 24 sessions, 6 rooms, 40 speakers and 12 disruptions; single-day events with a maximum twelve-hour window.
- Room/speaker collection changes and additional session speakers use JSON import; the UI edits the primary speaker.
- No collaborative accounts: browser workspaces are isolated, not a team login system.
- Interface actor labels and the absence of an apply tool do not establish authenticated human presence.
- Expiration is enforced on reads; physical cleanup is triggered by new workspace creation.
- No external notifications/bookings. Calendar files contain event-local timezone information; real calendar-client import should be tested before operational use.
