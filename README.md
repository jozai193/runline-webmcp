# Runline

**Your event, in sync.** A WebMCP-powered control room where an organizer and a browser agent repair the same live event schedule together.

Runline is not an embedded chatbot. Its ten structured browser tools read the actual workspace, record disruptions, propose constraint-checked changes, and request organizer review. The organizer compares before/after, protects sessions, and records confirmation from every affected speaker before applying a proposal. A rejection searches for a distinct next-best option instead of immediately repeating the same plan.

The same constraint model can coordinate a small campus program today: lecture halls, auditoriums, classrooms, and sports grounds are locations; matches, rehearsals, ceremonies, and workshops are scheduled sessions. Multi-day bookings, equipment, authenticated campus roles, and notifications remain future product work.

**Live demo:** https://runline-control-room.advikmjevoor.chatgpt.site

## Try the story

1. Open the app. Every browser receives an isolated fictional Common Ground 2026 event: 12 sessions, 3 rooms, and two locked sessions.
2. Select **Report a disruption**. The preset says Mira Sen is unavailable from 09:00 until 14:00. Record it.
3. Select **Find a repair** with **Move fewer sessions**. Compare the proposed schedule with the current one. Nothing has moved yet.
4. Open **Collect confirmations**. Record a response from every affected speaker, then **Apply these changes**. Inspect activity history or undo the repair.
5. Alternatively, choose **Show next-best option** or decline a speaker confirmation. Runline rejects that plan and searches for a different feasible trade-off at the same schedule revision.
6. Reset the demo and try a room closure or an attendance spike. An impossible request stays visibly blocked.

For the actual agent workflow, open Runline as a top-level page in a compatible WebMCP browser. When the app says its ten tools are registered, use:

> In Runline, read the schedule and constraints. Mira Sen is unavailable until 14:00. Record this disruption, propose a repair with as few session moves as possible, explain the trade-offs, and request my approval. Do not apply any changes.

Browser support is detected, never simulated. Manual controls remain available in browsers without WebMCP. Consult the [official browser guide](https://learn.chatgpt.com/docs/webmcp) for current support.

## Run locally

Requirements: Node.js 24 LTS recommended (native TypeScript tests require at least 22.13), npm, and an ordinary terminal that permits build-tool subprocesses.

```sh
npm ci
npm run dev
```

Open the exact localhost URL printed by the development server. No API key, external AI subscription inside the app, database signup, or real event data is needed. The Cloudflare plugin emulates D1 locally and persists demo state under the ignored `.wrangler` directory. The application initializes its single table if needed; the checked-in Drizzle migration supports hosted deployment.

```sh
npm test
npm run typecheck
npm run lint
npm run test:api  # with the development server running
npm run build
npm start        # serves the built Worker with Wrangler
```

The API smoke suite creates its own isolated sample workspaces. It never touches the workspace in your browser. To test a different local server, set `RUNLINE_TEST_URL` to its exact origin. Do not point this test suite at a service you do not own.

## Architecture

The React interface and WebMCP tools share the same command/validation engine. Mutations go through a same-origin Worker route and a version-guarded D1 update; proposals cannot overwrite newer organizer edits. `revision` tracks schedule/constraint changes while `version` guards every saved action, including review requests.

- `lib/engine.ts`: conflict detection, bounded deterministic repair search, and exclusion of previously rejected plans.
- `lib/actions.ts`: authoritative state transitions, speaker-confirmation gate, lock protection, approval, stale-write guards, and undo.
- `lib/webmcp.ts`: ten tool schemas and real execute handlers; no fake agent transcript.
- `lib/storage.ts` and `app/api/workspace/route.ts`: isolated workspaces, cookie token hashing, persistence and atomic writes.
- `components/`: schedule board, proposal comparison, forms, activity, help and exports.
- `tests/`: domain, WebMCP adapter and real HTTP/D1 regression checks.

The search respects capacity, speaker and room conflicts, unavailable intervals, event hours, protected lunch, turnover, and locks. It explores at most 4,500 candidates with bounded depth/beam width. At the same schedule revision, the signatures of earlier proposals are excluded so a retry must produce a distinct option or honestly report that the bounded search found no alternative. It is not an LLM or a globally optimal solver; a search failure is not proof that no feasible schedule exists. An organizer can adjust constraints or a browser agent can submit its own validated move proposal.

## Data and security scope

This is a hackathon demonstration, not a production event-management service. Do not enter sensitive information.

- Each browser gets an opaque 256-bit workspace token in an HttpOnly, SameSite=Strict cookie, Secure on HTTPS. D1 stores its SHA-256 hash, not the token.
- Workspaces expire seven days after their last saved action. Expired rows are inaccessible and are physically cleaned up when a new workspace is created; deletion is not a scheduled exact-time guarantee.
- No third-party analytics, notifications, bookings, payments, or attendee records are implemented.
- The provided WebMCP surface deliberately has no apply, unlock, reset, consent-recording or delete tool. `request_approval` is not approval.
- Every speaker whose session would change must be marked confirmed before the server accepts apply. A decline rejects the proposal and starts a search for another distinct option.
- The demo records speaker responses in the shared workspace; it does not authenticate the respondent or send them a message. Actor labels identify the calling interface, not an authenticated person. A caller with the workspace cookie and direct API/DOM access can use organizer controls. This is a cooperative consent workflow, **not a cryptographic identity or human-presence boundary against a malicious agent**.
- CSRF checks, payload limits, input validation and atomic version guards are enforced server-side. Public production use would additionally need rate limiting, account authorization, retention jobs, abuse controls and operational monitoring.

## Deployment

The included Sites configuration declares the logical D1 binding `DB`. The platform provisions the real database; do not hardcode database credentials. Build output is a Cloudflare Worker under `dist/server` with static assets. Set trusted runtime variable `RUNLINE_PUBLIC_ORIGIN` to the deployed origin for absolute social previews. Local metadata defaults to `http://localhost:3000`; it never trusts forwarded host headers. No secret is required by this application.

The hosted demo and source repository are public and were verified from credential-free sessions on September 2, 2026. The narrated video must be refreshed for the new speaker-confirmation flow, then publicly uploaded to YouTube and verified signed out before the hackathon submission is final.

## Project materials

- [WebMCP contract](docs/webmcp.md)
- [Demo script and shot list](docs/demo-script.md)
- [Devpost draft and submission checklist](docs/submission.md)
- [Verification record and pending checks](docs/verification.md)
- [Asset provenance](docs/assets.md)

Original project source is MIT licensed. Third-party packages retain their own licenses; the repository includes all application logic, sample data, migrations and tests. AI-assisted implementation and AI-generated social artwork are disclosed in the submission materials.
