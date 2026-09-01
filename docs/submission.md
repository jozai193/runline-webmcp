# WebMCP Challenge submission pack

Prepared September 1, 2026, India time. The live demo and source repository are public. The video and Devpost entry remain unpublished drafts; no final submission has been made on the entrant's behalf.

## Submission fields

**Project name:** Runline

**Tagline:** Runline lets organizers and browser agents repair live schedules together—using real constraints while keeping every final decision human.

**Built with:** WebMCP, TypeScript, React, Vinext, Cloudflare Workers, D1, Drizzle, Tailwind CSS, shadcn/Base UI.

**Live app URL:** https://runline-control-room.advikmjevoor.chatgpt.site

**Source URL:** https://github.com/jozai193/runline-webmcp

**Video URL:** Use the verified public narrated YouTube video under three minutes. Do not submit this script as a video.

**Thumbnail:** `public/og.png` (1536 x 1024, 3:2).

**Gallery order:** baseline workspace, two-session repair, organizer review, honest blocked state (`public/devpost/gallery-baseline.png`, `gallery-repair.png`, `gallery-review.png`, `gallery-blocked.png`).

## Additional information fields

**Submitter type:** Entrant must confirm Individual, Team of Individuals, or Organization.

**Country:** Entrant must confirm the legal country of residence; do not infer this from the demo location.

**App status:** New. The repository history begins September 1, 2026, within the submission period.

**Testing instructions:** Open the live URL as a top-level page in ChatGPT desktop's in-app browser. Wait for the “10 WebMCP tools are ready” status, then use the Agent quick start prompt. No account or credentials are required. The browser agent may read the schedule, record a fictional disruption, propose a repair, and request approval. Only the organizer interface can apply a proposal. Reset demo restores a clean fictional workspace.

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

Runline is an event scheduling control room with a shared human-agent workflow. Report a delayed speaker, unavailable room, or attendance spike. The browser agent reads the actual schedule and constraints, then requests a repair or submits its own move proposal. The organizer compares the proposed schedule with the saved one and explicitly approves or rejects it.

Locked sessions stay protected. Every applied repair is revalidated against room and speaker availability, capacity, event hours, lunch and turnover. New edits invalidate old proposals, and undo preserves the recorded disruption so the original problem does not disappear from the history.

The demo includes persistent browser-isolated workspaces, session editing, event configuration, custom JSON import, CSV/ICS/JSON exports and an activity trail. All sample people and events are fictional.

### How we built it

Ten imperative WebMCP tools expose real application operations in the page. They use the same state transitions as the React interface, backed by a Cloudflare Worker and D1. Browser agents need neither a separate MCP server nor an application-owned LLM key.

A bounded deterministic search generates repair candidates; the browser agent supplies intent, chooses trade-offs, and can author custom proposals. The server performs the final validation and atomic version-guarded write. The tool surface intentionally stops at requesting approval and contains no apply or unlock tool.

### Challenges

The difficult part was making human and agent edits coexist safely. A proposal can become obsolete between generation and approval. Runline separates workspace versions from schedule revisions, makes stale proposals visible, and rejects conflicting concurrent writes. Another challenge was being honest about optimization: bounded search can fail to find a solution, so the UI exposes remaining blockers rather than describing every result as a success.

### Accomplishments

The project implements an end-to-end persisted repair workflow, with regression checks for disruptions, hard constraints, locks, approval, undo, stale writes, workspace isolation, exports and the real WebMCP handler chain. A delayed-speaker fixture produces a two-session repair without moving either locked session. The interface shows every proposed change and its trade-offs before applying anything.

### What we learned

WebMCP is most useful when tools are designed around the application’s domain, not around arbitrary clicks. Small structured reads, stable IDs, explicit errors and carefully separated proposal/approval steps make the agent’s work inspectable by a person. The browser context becomes shared working state rather than another data copy to synchronize.

### What's next

Production account/role authorization, stricter human-presence approval, rate limiting, scheduled retention cleanup, multi-day events, external calendar synchronization and broader solver evaluations are future work, not claims about this demo.

### AI assistance

The implementation, documentation and test suite were built with OpenAI Codex and ChatGPT assistance. The social preview artwork was AI-generated, and the local video draft uses Deepgram Aura-2 Orion synthetic narration with an on-screen disclosure. The running application does not contain an embedded LLM or simulated AI conversation: it exposes actual WebMCP tools to a compatible browser agent.

## Strategy against the rubric

| Criterion (equal weight) | Evidence to show                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage          | Native discovery and execution on the same visible workspace; an agent-created proposal followed by a human edit or approval.                            |
| Execution                | Reliable persisted workflow, real constraint validation, stale-write rejection, isolated workspaces, useful errors, accessible controls, and clear demo. |
| Potential Impact         | A specific operational problem in events; explain the cost of cascading schedule changes without inventing customer traction.                            |
| Creativity & Ambition    | A shared decision surface, custom agent proposals, hard constraints, human locks and honest blocked states.                                              |

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
- [ ] Public narrated YouTube demo exists, is under three minutes, and plays signed out.
- [ ] Final app, source and video URLs are entered into Devpost; draft prose updated to match demonstrated behavior.
- [ ] Team invitations accepted and required questions answered accurately by the entrant.
- [ ] User approves final Devpost submission; submit and verify confirmation.
- [ ] Record the submitted source revision and freeze required materials through judging.

The source repository is public and verified. No YouTube upload, eligibility attestation or final Devpost submission has been performed.
