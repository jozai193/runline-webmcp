# Runline demo — final draft 2 minutes 15.60 seconds

Status: reviewed local video draft, not publicly uploaded. `outputs/demo/runline-demo-final.mp4` is 135.60 seconds, 1920 x 1080 H.264 with AAC narration. Its app footage and screenshots came from the real public browser session, and its response excerpts came from saved native WebMCP results. Editorial overlays explicitly identify held frames, edited pacing, fictional data, synthetic narration and the automated organizer-interface test. The final public YouTube upload must stay public, include audio, and remain under three minutes.

## Prepared narration draft

A local synthetic narration draft has been rendered from `docs/narration-draft.ssml` using the installed Microsoft Zira Desktop voice. It is 133.60 seconds long, leaving room for short pauses and a closing card within the planned 160-second video. WAV and MP3 drafts are under the ignored `outputs/demo` directory. The voice is a generic installed system voice, not an imitation of the entrant.

The narration was matched to genuine browser footage and the synthetic voice is disclosed throughout the video. The video container, duration, streams, dimensions, audio levels and representative frames were checked. An auditory listen-through and frame-by-frame playback review remain required before publication. The provided `scripts/render-narration.ps1` can render a new take in Windows PowerShell; it refuses to overwrite an existing draft. `scripts/assemble-demo.mjs` rebuilds the edit from saved evidence and also refuses to overwrite. No public upload has occurred.

## Before recording

Use a compatible WebMCP browser. Open the public app directly, not an iframe. Reset the fictional sample. Confirm ten registered tools, no conflicts and two locked sessions. Hide personal browser tabs and account menus. Capture real tool execution once, then trim only waiting time; label time compression if material. Keep the readable schedule and agent alongside each other.

## 0:00–0:20 — the problem

Show the intact event board.

“An event schedule is a network of promises. When one speaker is late, moving one box can break three others. Runline lets an organizer and their browser agent repair the same schedule together, with the human keeping the final say.”

## 0:20–0:50 — native WebMCP, not a chatbot mock

Show the browser's actual tool discovery and submit the app's starter prompt. Show reads of sessions and constraints, then `report_disruption` for Mira until 14:00.

“There is no chatbot embedded here. Runline exposes ten WebMCP tools to the browser agent. It reads the real room capacities, speaker availability, lunch break and protected sessions. Mira is delayed until two. The agent records that fact; the live schedule has not changed.”

## 0:50–1:25 — a real proposal and its cost

Show `propose_repair`, inspect the returned proposal, compare Current and Proposal. For the baseline delay, the tested engine finds a two-session repair while preserving the locks; use the actual visible times if the algorithm changes.

“The agent asks for a repair that favors fewer changes. Runline searches valid placements and exposes the cost: which sessions move, how far their times shift, and whether rooms change. This is a bounded search, not a claim of global optimality. Before and after are visible, and every hard constraint is checked.”

## 1:25–1:55 — human agency is the point

Show `request_approval`, pending status, then manually review and apply. Show zero conflicts and the saved activity entry.

“The agent requests approval. That does not apply the plan. I review these specific changes and accept them here. The server checks the latest version again before saving, so an older proposal cannot overwrite a newer edit. Now the board and the history agree.”

## 1:55–2:20 — prove a limit instead of hiding it

Reset; report an auditorium closure covering the locked opening. Find a repair and show the blocked state. Optionally use a separate concise clip if the full agent turn is too long. Do not imply this scenario was repaired.

“Some changes should not be automated away. If the opening is protected and its room is unavailable, Runline shows the blocker. It does not silently move the keynote or pretend the task succeeded. The organizer must change the constraint or make a new decision.”

## 2:20–2:40 — close with what is real

Show CSV/ICS/JSON exports and return to the board. End on the app's title/social card for two seconds.

“This working demo includes persistent isolated workspaces, custom events, exports, undo, and regression tests. WebMCP makes the agent part of the tool the organizer already uses. Runline: your event, in sync.”

## Required footage evidence

- Actual browser tool names and at least one successful tool response.
- A proposal appearing in the same app the human edits.
- Pending state before a real organizer approval.
- Applied state and persisted activity afterward.
- One blocked constraint or stale-proposal case.

Do not claim performance percentages, saved staff hours, real customers or browser compatibility not demonstrated. Do not call interface actor labels identity verification. Check the uploaded public video from a signed-out session before submission.
