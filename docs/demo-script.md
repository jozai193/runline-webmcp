# Runline demo — consent-focused final candidate, 1 minute 49.30 seconds

Status: technically reviewed local video candidate, not publicly uploaded. `outputs/demo/runline-demo-consent-final.mp4` is 109.30 seconds, 1920 x 1080 H.264 with normalized 48 kHz AAC narration. Its app footage and screenshots came from real public-browser sessions, including the disabled apply state, both affected-speaker confirmations, the applied schedule and an honest blocked repair. Its response excerpts came from saved native WebMCP results. Editorial overlays explicitly identify held frames, edited pacing, fictional data, Deepgram synthetic narration and the automated organizer-interface test. The final public YouTube upload must stay public, include audio and remain under three minutes.

## Prepared narration draft

A synthetic narration draft has been rendered from `docs/narration-draft.ssml` using Deepgram Aura-2 Orion, a calm informative voice selected for the demo. The original fixed-section edit introduced artificial gaps of up to 5.65 seconds. `scripts/smooth-demo-narration.ps1` now shortens those editorial gaps while preserving natural breaths; the final video has no detected silent interval of 0.7 seconds or longer. `scripts/assemble-demo.mjs` accepts six comma-separated section durations so the visuals and disclosure overlays follow the actual narration instead of padding the audio. Generated media remains under the ignored `outputs/demo` directory. The renderer reads `DEEPGRAM_API_KEY` from the process environment and never writes the credential to the project.

The narration was matched to genuine browser footage and the synthetic voice is disclosed throughout the video. The video container, duration, streams, dimensions, silence profile, a nine-frame contact sheet and full-resolution consent/applied frames were checked. An auditory listen-through and frame-by-frame playback review remain required before publication. `scripts/render-deepgram-narration.py` renders a Deepgram take and refuses to overwrite an existing draft; `scripts/render-narration.ps1` remains as the local system-voice fallback. `scripts/assemble-demo.mjs` normalizes mixed browser screenshot formats, rebuilds the edit from saved evidence and refuses to overwrite. No public upload has occurred.

## Before recording

Use a compatible WebMCP browser. Open the public app directly, not an iframe. Reset the fictional sample. Confirm ten registered tools, no conflicts and two locked sessions. Hide personal browser tabs and account menus. Capture real tool execution once, then trim only waiting time; label time compression if material. Keep the readable schedule and agent alongside each other.

## 0:00–0:15 — the problem

Show the intact event board.

“An event schedule is a network of promises. When one speaker is late, moving one box can break three others. Runline lets an organizer and their browser agent repair the same schedule together, with the human keeping the final say.”

## 0:15–0:36 — native WebMCP, not a chatbot mock

Show the browser's actual tool discovery and submit the app's starter prompt. Show reads of sessions and constraints, then `report_disruption` for Mira until 14:00.

“There is no chatbot embedded here. Runline exposes ten WebMCP tools to the browser agent. It reads the real room capacities, speaker availability, lunch break and protected sessions. Mira is delayed until two. The agent records that fact; the live schedule has not changed.”

## 0:36–0:58 — a real proposal and its cost

Show `propose_repair`, inspect the returned proposal, compare Current and Proposal. For the baseline delay, the tested engine finds a two-session repair while preserving the locks; use the actual visible times if the algorithm changes.

“The agent asks for a repair that favors fewer changes. Runline searches valid placements and exposes the cost: which sessions move, how far their times shift, and whether rooms change. This is a bounded search, not a claim of global optimality. Before and after are visible, and every hard constraint is checked.”

## 0:58–1:18 — human agency is the point

Show `request_approval`, pending status, then open **Collect confirmations**. Confirm each affected fictional speaker before manually applying. Optionally decline once to show Runline produce a distinct next-best option, then confirm the replacement plan. Show zero conflicts and the saved activity entry.

“The agent requests review. That does not apply the plan. Each speaker whose session changes must confirm, and a decline sends Runline to the next distinct option. Once every affected speaker agrees, I apply it here. The server checks the latest version, constraints and confirmations again before saving. Now the board and the history agree.”

## 1:18–1:34 — prove a limit instead of hiding it

Reset; report an auditorium closure covering the locked opening. Find a repair and show the blocked state. Optionally use a separate concise clip if the full agent turn is too long. Do not imply this scenario was repaired.

“Some changes should not be automated away. If the opening is protected and its room is unavailable, Runline shows the blocker. It does not silently move the keynote or pretend the task succeeded. The organizer must change the constraint or make a new decision.”

## 1:34–1:49 — close with what is real

Show CSV/ICS/JSON exports and return to the board. End on the app's title/social card for two seconds.

“This working demo includes persistent isolated workspaces, custom events, exports, undo, and regression tests. WebMCP makes the agent part of the tool the organizer already uses. Runline: your event, in sync.”

## Required footage evidence

- Actual browser tool names and at least one successful tool response.
- A proposal appearing in the same app the human edits.
- Pending state, affected-speaker confirmations, and the disabled apply state before every confirmation is recorded.
- Applied state and persisted activity afterward.
- One blocked constraint or stale-proposal case.

Do not claim performance percentages, saved staff hours, real customers or browser compatibility not demonstrated. Do not call interface actor labels identity verification. Check the uploaded public video from a signed-out session before submission.
