# Verification record

Date: September 1, 2026, IST. Environment: Windows, Node 24.14.1. This separates completed checks from required release gates.

## Completed automated checks

- 45 domain/adapter tests passed: baseline validation; three disruption types across three search objectives; lock preservation; impossible requests; proposal immutability; stale version and stale proposal rejection; approval; undo; custom moves; import validation; CSV formula handling; UTF-8 calendar folding and midnight rollover; actual WebMCP handler sequence; registration cleanup and failure rollback.
- 22 HTTP integration checks passed against the local Worker/D1 runtime: creation and cookie flags, isolated workspaces, saved disruption/proposal/approval, persistence across requests, exact-one-winner concurrent updates, origin/header checks, missing/unknown cookie handling, invalid JSON, bounded request size and content type enforcement.
- TypeScript strict checking passed.
- Source lint passed, including form-control labels and React correctness checks. This is not a formal accessibility audit.
- The browser's native tool-availability notification listed all ten Runline tools on the local preview. No native tool was executed during this discovery observation.
- Production Worker build passed after upgrading vulnerable starter dependencies.
- The same 22 HTTP checks passed against the built production Worker, with a healthy response afterward. A local Wrangler unread-request-body failure was reproduced and addressed by bounded body consumption before rejection; all origin, size and content-type checks remain enforced. Related upstream report: https://github.com/cloudflare/workers-sdk/issues/15203.
- `npm install` audit reported zero known vulnerabilities after the pinned dependency updates and a scoped esbuild override. This is not a full security audit and does not guarantee absence of vulnerabilities.
- Drizzle schema generation passed with the scoped override and reported no missing migrations.

## Remaining release gates

Native browser tool **execution** and visual/interactive browser QA have **not** been performed. The handler tests use the real command engine, and native registration was observed, but neither proves the complete browser workflow. Browser testing was requested as a permission question and remains awaiting an explicit user response.

Before public submission, run the following in an isolated sample workspace:

1. Confirm ten native tools are discoverable and can execute in the intended browser.
2. Drive the delayed-speaker workflow through the actual agent and confirm review remains pending until organizer approval.
3. Change a lock while a proposal is pending; verify the UI and native tool both expose staleness.
4. Confirm unsupported-browser messaging is accurate and manual controls work.
5. Check keyboard focus, dialog escape/return focus, all input labels, narrow-screen layout and scrollable board.
6. Exercise session creation/edit/removal, settings, reset, import validation, each download, undo and reload.
7. Verify the deployed app uses the configured D1 binding and trusted social-preview origin.
8. Confirm public access and a fresh isolated sample without owner login after public-release approval.

No production traffic load test, penetration test, formal accessibility audit, calendar-client compatibility matrix or real-event pilot has been performed.

## Known scope limitations

- Bounded search is not globally optimal and may miss feasible schedules.
- Maximum 24 sessions, 6 rooms, 40 speakers and 12 disruptions; single-day events with a maximum twelve-hour window.
- Room/speaker collection changes and additional session speakers use JSON import; the UI edits the primary speaker.
- No collaborative accounts: browser workspaces are isolated, not a team login system.
- Interface actor labels and the absence of an apply tool do not establish authenticated human presence.
- Expiration is enforced on reads; physical cleanup is triggered by new workspace creation.
- No external notifications/bookings. Calendar files contain event-local timezone information; real calendar-client import should be tested before operational use.
