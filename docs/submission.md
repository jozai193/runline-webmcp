# WebMCP Challenge submission pack

Prepared September 3, 2026, India time. The live demo, source repository, and narrated YouTube video are public. The Devpost entry remains a draft; no final submission has been made on the entrant's behalf.

## Submission fields

**Project name:** Runline

**Tagline:** Runline lets organizers and browser agents repair live schedules together—using real constraints while keeping every final decision human.

**Built with:** WebMCP, TypeScript, React, Vinext, Cloudflare Workers, D1, Drizzle, Tailwind CSS, shadcn/Base UI.

**Live app URL:** https://runline-control-room.advikmjevoor.chatgpt.site

**Source URL:** https://github.com/jozai193/runline-webmcp

**Video URL:** https://youtu.be/TkFAmO41OPs

**Thumbnail:** `public/og.png` (1536 x 1024, 3:2).

**Gallery order:** baseline workspace, two-session repair, affected-speaker confirmation gate, honest blocked state (`public/devpost/gallery-baseline.png`, `gallery-repair.png`, `gallery-review.png`, `gallery-blocked.png`).

## Additional information fields

**Submitter type:** Entrant must confirm Individual, Team of Individuals, or Organization.

**Country:** Entrant must confirm the legal country of residence; do not infer this from the demo location.

**App status:** New. The repository history begins September 1, 2026, within the submission period.

**Testing instructions:** Open the live URL as a top-level page in ChatGPT desktop's in-app browser. Wait for the “10 WebMCP tools are ready” status, then use the Agent quick start prompt. No account or credentials are required. The browser agent may read the schedule, record a fictional disruption, propose a repair, and request approval. In the organizer interface, open **Collect confirmations**, confirm every affected fictional speaker, then apply. Rejecting a plan or declining a speaker response produces a distinct next-best option when the bounded search finds one. To test recurrence, open Event settings, choose **Repeating weekly timetable**, save, edit a session for either this week only or all future weeks, then use the week arrows to verify temporary exceptions reset. **Import schedule** accepts Runline JSON or timetable CSV. Reset demo restores a clean fictional workspace.

**Public code repository:** https://github.com/jozai193/runline-webmcp

**Tested agent/client:** ChatGPT desktop in-app browser with native WebMCP. Do not claim the current external Chrome session as a native WebMCP test because its WebMCP testing feature was not enabled.

**AI tools used:** OpenAI Codex and ChatGPT for implementation assistance, testing, design iteration, documentation and demo scripting; OpenAI image generation for the original social card; Deepgram Aura-2 for synthetic demo narration. The running application contains no embedded LLM or simulated agent transcript.

**Learning level:** Suggested answer: Significant. Entrant must confirm.

**Career AI value:** Suggested answer: Yes. Entrant must confirm.

## Project story — draft copy

### Inspiration

Live events run on shared commitments: speakers, rooms, capacity, timing, and moments that cannot move. A delayed speaker turns a tidy schedule into a coordination problem. We wanted a browser agent that could work on those real constraints alongside the organizer, instead of offering suggestions in a disconnected chat window.

### Why WebMCP

This workflow needs more than a chatbot that describes a schedule. The agent must discover the application's domain operations, read the same saved state the organizer sees, use stable IDs, preserve hard constraints, and hand a concrete proposal back to the human interface. WebMCP makes Runline's existing web application the shared workspace: there is no duplicated agent dashboard, separate MCP server, or simulated transcript to keep in sync.

### What it does

Runline is an event scheduling control room with a shared human-agent workflow. Report a delayed speaker, unavailable room, or attendance spike. The browser agent reads the actual schedule and constraints, then requests a repair or submits its own move proposal. The organizer compares the proposed schedule with the saved one. Every speaker whose session would move must confirm before apply; a decline or organizer rejection searches for a distinct next-best plan.

Locked sessions stay protected. Every applied repair is revalidated against room and speaker availability, capacity, event hours, lunch and turnover. New edits invalidate old proposals, and undo preserves the recorded disruption so the original problem does not disappear from the history.

The demo includes persistent browser-isolated workspaces, session editing, event configuration, JSON and timetable CSV import, CSV/ICS/JSON exports and an activity trail. It supports both single events and reusable weekly templates. A one-week edit is stored as a dated exception and automatically gives way to the normal template in the next week; a permanent edit updates future weeks. All sample people and events are fictional.

The underlying model is reusable beyond conferences. A college can represent lecture halls, auditoriums, classrooms, and sports grounds as locations, then schedule classes, matches, rehearsals, ceremonies, and workshops across a repeating week. Wedding halls and other bookable venues use the same capacity, availability, conflict, protection, consent, exception, and alternative-plan workflow. Runline does not claim to be a complete booking system; alternating-week rotations, semesters, equipment, payments, authenticated roles, and notifications are future work.

### How we built it

Ten imperative WebMCP tools expose real application operations in the page. They use the same state transitions as the React interface, backed by a Cloudflare Worker and D1. Browser agents need neither a separate MCP server nor an application-owned LLM key.

A bounded deterministic search generates repair candidates; the browser agent supplies intent, chooses trade-offs, and can author custom proposals. Proposal signatures are remembered per schedule revision, so a rejected retry cannot simply return the same set of moves. The server performs the final validation, verifies every affected speaker is confirmed, and makes an atomic version-guarded write. The tool surface intentionally stops at requesting approval and contains no apply, consent-recording or unlock tool.

### Challenges

The difficult part was making human and agent edits coexist safely. A proposal can become obsolete between generation and approval, and “try again” is useless if a deterministic solver repeats the same answer. Runline separates workspace versions from schedule revisions, makes stale proposals visible, rejects conflicting concurrent writes, and excludes prior same-revision plan signatures. Another challenge was translating shared impact into a clear consent rule without overstating identity: the demo records responses, while authenticated speaker approval remains future work.

### Accomplishments

The project implements an end-to-end persisted repair workflow, with regression checks for disruptions, hard constraints, locks, distinct alternatives, affected-speaker consent, undo, stale writes, workspace isolation, exports and the real WebMCP handler chain. A delayed-speaker fixture produces a two-session repair without moving either locked session. The interface shows every proposed change and its trade-offs, blocks apply until all affected speakers confirm, and turns a decline into another plan search.

### What we learned

WebMCP is most useful when tools are designed around the application’s domain, not around arbitrary clicks. Small structured reads, stable IDs, explicit errors and carefully separated proposal, consent and apply steps make the agent’s work inspectable by the people it affects. The browser context becomes shared working state rather than another data copy to synchronize.

### What's next

Authenticated participant accounts or signed confirmation links, outbound notifications, production role authorization, stricter human-presence approval, rate limiting, scheduled retention cleanup, alternating-week and semester calendars, equipment and payment workflows, external calendar synchronization and broader solver evaluations are future work, not claims about this demo.

### AI assistance

The implementation, documentation and test suite were built with OpenAI Codex and ChatGPT assistance. The social preview artwork was AI-generated, and the public demo video uses Deepgram Aura-2 Orion synthetic narration with an on-screen disclosure. The running application does not contain an embedded LLM or simulated AI conversation: it exposes actual WebMCP tools to a compatible browser agent.

## Strategy against the rubric

| Criterion (equal weight) | Evidence to show                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage          | Native discovery and execution on the same visible workspace; the agent hands a concrete plan to the organizer and affected-speaker consent gate.    |
| Execution                | Persisted workflow, distinct retries, real constraint and consent validation, stale-write rejection, isolated workspaces and accessible controls.    |
| Potential Impact         | Live-event repair plus working weekly templates and dated exceptions for campuses, wedding halls and other shared venues—without inventing traction. |
| Creativity & Ambition    | A shared decision surface, custom agent proposals, affected-party consent, hard constraints, human locks and honest blocked states.                  |

WebMCP leverage is the first tie-breaker in the published rules. Prioritize a short, convincing native-browser collaboration sequence over adding unrelated features. No strategy guarantees a win.

## Rules and timing verified during research

- Submission deadline: September 3, 2026, 1:00 p.m. PDT — **September 4, 2026, 1:30 a.m. IST**. Aim to finalize the previous day, with time for public-access checks.
- Published judging criteria: WebMCP Leverage, Execution, Potential Impact, and Creativity & Ambition, equally weighted.
- Ten winning projects receive $3,000 from OpenAI plus the sponsor benefits listed in the official rules. Recheck the official prize details before relying on individual sponsor terms.
- Required materials include a working live app, a public source repository with license and complete source/run instructions, and a public narrated YouTube demonstration strictly under three minutes.
- Treat the formal rules and latest organizer update as authoritative over the older FAQ text suggesting video was not required.
- Complete required team acceptance and finalize the entry; a saved Devpost draft is not a submission.
- Preserve the submitted app, source, team and video through judging as required by the rules. Do not keep silently deploying after the deadline.

Sources: [overview](https://webmcp.devpost.com/), [official rules](https://webmcp.devpost.com/rules), [resources](https://webmcp.devpost.com/resources), [organizer update](https://webmcp.devpost.com/updates/46123-halfway-there-where-are-you).

## Release checklist — must complete before finalization

- [ ] Entrant confirms eligibility, team members and the public project name/license.
- [x] Explicit permission for browser testing and capture; native WebMCP path verified in the target browser.
- [x] Keyboard, narrow-screen, modal, export and reload checks completed within the documented scope.
- [x] Owner approves public source publication. Public app access is already approved.
- [x] Public app loads without owner-only access restrictions; each judge gets a fresh sample.
- [x] Public repository includes all application source, migration, tests, README and license; no secrets or private test records. Anonymous clone, install, tests, lint, typecheck and build passed.
- [x] Public narrated YouTube demo exists, is under three minutes, and plays on its public watch page.
- [x] Draft prose and gallery assets match the demonstrated consent and blocked-state behavior.
- [x] Final app, source and video URLs are entered into Devpost.
- [ ] Team invitations accepted and required questions answered accurately by the entrant.
- [ ] User approves final Devpost submission; submit and verify confirmation.
- [ ] Record the submitted source revision and freeze required materials through judging.

The source repository and narrated YouTube video are public and verified. No eligibility attestation or final Devpost submission has been performed.
