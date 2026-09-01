# Publication handoff

Nothing described here has been uploaded yet. Use these exact local artifacts only after approval.

## Public source repository

- Suggested repository name: `runline-webmcp`
- Description: `A human-agent event schedule control room powered by native WebMCP tools.`
- Visibility: public
- License: MIT, already included
- Source: `outputs/runline-public-source.zip`, produced from the recorded commit with `git archive`
- Topics: `webmcp`, `hackathon`, `event-scheduling`, `human-in-the-loop`, `cloudflare-workers`, `react`

After publication, clone or download the repository without authentication. Confirm `README.md`, `LICENSE`, all application source, Drizzle migration, tests and lockfile are available. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. Do not upload `outputs`, `.wrangler`, environment files or browser evidence.

## Public YouTube video

- File: `outputs/demo/runline-demo-final.mp4`
- Title: `Runline — A Human-Agent Event Control Room with WebMCP`
- Visibility: public, not unlisted
- Audience: the account owner must choose the accurate YouTube audience declaration

Suggested description:

> Runline repairs live event schedules through a shared organizer and browser-agent workflow. Ten native WebMCP tools read the real schedule, record disruptions, propose constraint-checked changes and request approval. The organizer compares the plan and applies it through a separate interface step.
>
> Live demo: https://runline-control-room.advikmjevoor.chatgpt.site
>
> Source: [insert verified public repository URL]
>
> Built for the WebMCP Challenge. The event and people shown are fictional. The demonstration uses genuine browser captures and native tool results, edited for pacing. The generic Microsoft synthetic narration and automated organizer-interface test are disclosed on screen. Interface actor labels are not identity verification.

Suggested chapters:

```text
00:00 One disruption, cascading consequences
00:19 Native WebMCP tools read real state
00:44 A two-session repair with visible trade-offs
01:10 Approval is a separate organizer step
01:34 An impossible change stays blocked
01:54 Persistence, exports, and closing
```

After upload, open the public URL in a signed-out session. Confirm 1080p playback, audible narration, readable response excerpts, exact 2:15.60 duration and public visibility. Do not use an unlisted link for the challenge.

## Devpost

Use the exact live, repository and video URLs after all three pass signed-out checks. Keep final submission as a separate approval step because it includes eligibility, team and rules acknowledgements only the entrant can attest to.
