// Assemble genuine browser captures. This script does not synthesize UI or tool calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'outputs/demo');
const captures = path.join(output, 'captures');
const targetName = process.argv[2] || 'runline-demo-draft.mp4';
if (path.basename(targetName) !== targetName || !targetName.endsWith('.mp4')) {
  throw new Error('The output must be a simple .mp4 filename.');
}
const target = path.join(output, targetName);
if (fs.existsSync(target))
  throw new Error('Preserve the existing video before making another take.');
const evidence = JSON.parse(
  fs.readFileSync(path.join(output, 'native-webmcp-evidence.json'), 'utf8'),
);
const repair = evidence.findLast(
  (e) => e.name === 'propose_repair' && e.result.data?.changes?.length === 2,
);
const approval = evidence.findLast(
  (e) => e.name === 'request_approval' && e.result.ok,
);
const blocked = evidence.findLast(
  (e) => e.name === 'request_approval' && e.result.code === 'UNSAFE_PROPOSAL',
);
if (!repair || !approval || !blocked)
  throw new Error(
    'Required successful and blocked native execution evidence is missing.',
  );

const timeline = [];
const hold = (file, duration) => timeline.push({ file, duration });
function clip(name, budget) {
  const recording = JSON.parse(
    fs.readFileSync(path.join(captures, `${name}.json`), 'utf8'),
  );
  if (recording.error || !recording.frames.length)
    throw new Error(`Invalid recording: ${name}`);
  const frames = recording.frames;
  const duration = frames.map((f, i) =>
    Math.max(
      1 / 30,
      Math.min(
        3,
        (frames[i + 1]?.metadata.timestamp ??
          Date.parse(recording.end) / 1000) - f.metadata.timestamp,
      ),
    ),
  );
  const actual = duration.reduce((a, b) => a + b, 0);
  const speed = Math.min(1, budget / actual);
  frames.forEach((frame, i) => hold(frame.file, duration[i] * speed));
  if (actual < budget) hold(frames.at(-1).file, budget - actual);
}

hold('demo-10-clean-baseline.png', 18.65);
hold('demo-10-clean-baseline.png', 12);
clip('demo-02-disruption', 13.84);
clip('demo-03-repair', 11);
hold('demo-04-current.png', 4);
clip('demo-04-compare', 2);
hold('demo-03-repair.png', 8.83);
clip('demo-05-request', 6);
hold('demo-05-review.png', 4);
clip('demo-06-apply', 5);
hold('demo-07-history.png', 8.29);
clip('demo-08-blocked', 13);
hold('demo-08-blocked.png', 7.31);
hold('demo-09-export.png', 10);
hold('demo-10-clean-baseline.png', 11.68);
const total = timeline.reduce((sum, f) => sum + f.duration, 0);
if (total >= 180) throw new Error('Video must be shorter than three minutes.');
const concat = timeline.flatMap((f) => [
  `file '${path.join(captures, f.file).replaceAll('\\', '/')}'`,
  `duration ${f.duration.toFixed(6)}`,
]);
concat.push(
  `file '${path.join(captures, timeline.at(-1).file).replaceAll('\\', '/')}'`,
);
fs.writeFileSync(
  path.join(output, 'demo-frames.ffconcat'),
  `ffconcat version 1.0\n${concat.join('\n')}\n`,
);

const stamp = (seconds) => {
  const centiseconds = Math.round(seconds * 100);
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
};
const lines = [];
function caption(start, end, style, text) {
  lines.push(
    `Dialogue: 0,${stamp(start)},${stamp(end)},${style},,0,0,0,,${text.replaceAll('\n', '\\N')}`,
  );
}
caption(0, total, 'Brand', 'RUNLINE   /   WEBMCP CHALLENGE');
caption(
  0,
  total,
  'Footer',
  'Genuine browser capture | Edited pacing and held frames | Fictional data | Generic synthetic narration | Organizer clicks automated for this test',
);
caption(0, 18.65, 'Heading', 'Your event,\nin sync.');
caption(
  0,
  18.65,
  'Body',
  'One late speaker.\nA network of promises.\n\nRepair the whole day\nwithout losing the\ndecisions that matter.\n\n12 sessions\n3 rooms\n2 protected sessions',
);
caption(18.65, 44.49, 'Heading', 'Native tools.\nReal state.');
caption(
  18.65,
  31,
  'Body',
  'No embedded chatbot.\n\nThe browser agent reads:\n\nget_event_summary\nget_constraints\nlist_sessions\n\nRoom limits, lunch,\nturnover and stable IDs.',
);
caption(
  31,
  44.49,
  'Body',
  'ACTUAL RESPONSE EXCERPT\nreport_disruption\n\nconflicts: 1\nscheduleTimesChanged:\n  false\n\nMira is unavailable\nuntil 14:00.\n\nNothing has moved.',
);
caption(44.49, 70.32, 'Heading', 'A proposal,\nwith trade-offs.');
caption(
  44.49,
  70.32,
  'Body',
  `ACTUAL RESPONSE EXCERPT\npropose_repair\n\nstatus: ${repair.result.data.status}\napplied: ${repair.result.data.applied}\nremainingConflicts: 0\n\n${repair.result.data.metrics.moved} sessions moved\n${repair.result.data.metrics.roomChanges} room changes\n${repair.result.data.metrics.shiftedMinutes} minutes total shift\n${repair.result.data.metrics.lockedProtected} locks protected\n\nBounded search.\nNot a global optimum.`,
);
caption(70.32, 93.61, 'Heading', 'Approval is\na separate step.');
caption(
  70.32,
  80.32,
  'Body',
  `ACTUAL RESPONSE EXCERPT\nrequest_approval\n\nstatus:\n awaiting_human_approval\nscheduleChanged: false\n\nReview specific changes.\nNothing is applied\nby this tool.`,
);
caption(
  80.32,
  93.61,
  'Body',
  'ORGANIZER-INTERFACE TEST\n\nApply these changes\n\nServer revalidates\nthe latest workspace.\n\nThe saved activity\nand board agree.\n\nLabels identify the\ninterface, not a person.',
);
caption(93.61, 113.92, 'Heading', 'Know when\nto stop.');
caption(
  93.61,
  113.92,
  'Body',
  `Separate sample scenario:\nroom closed during\nthe locked opening.\n\nACTUAL RESPONSE EXCERPT\nrequest_approval\n\nok: ${blocked.result.ok}\ncode: ${blocked.result.code}\n\nThe opening stays put.\nNo unsafe approval.`,
);
caption(113.92, total, 'Heading', 'Ready for\nthe real workflow.');
caption(
  113.92,
  total,
  'Body',
  'Persistent demo workspaces\nCustom event import\nCSV / ICS / JSON exports\nUndo and activity history\n\n45 domain tests\n22 HTTP checks\nNative browser QA\n\nYour agent proposes.\nYou keep the final say.',
);
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Brand,Segoe UI,26,&H00DEECD4,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,7,25,20,20,1\nStyle: Heading,Segoe UI,38,&H00DEECD4,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,1490,20,115,1\nStyle: Body,Consolas,23,&H00F5F5F0,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,1490,12,270,1\nStyle: Footer,Segoe UI,16,&H00CDD8C6,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,20,20,4,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join('\n')}\n`;
fs.writeFileSync(path.join(output, 'demo-overlays.ass'), ass);
fs.writeFileSync(
  path.join(output, 'demo-edit-manifest.json'),
  JSON.stringify(
    {
      duration: total,
      originalFootage:
        'Browser CDP screencast and screenshots; not synthesized UI',
      nativeEvidence: 'native-webmcp-evidence.json',
      disclosure:
        'Generic Microsoft Zira narration. Agent operated organizer UI for a fictional test. Tool response excerpts are editorial overlays, not a simulated chat interface.',
      timeline,
    },
    null,
    2,
  ),
);
const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-n',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'demo-frames.ffconcat',
    '-i',
    'narration-draft.wav',
    '-vf',
    'scale=1440:970:force_original_aspect_ratio=decrease,pad=1920:1080:20:90:color=0x193B30,setsar=1,subtitles=demo-overlays.ass',
    '-af',
    'apad',
    '-t',
    total.toFixed(2),
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-crf',
    '19',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    path.basename(target),
  ],
  { cwd: output, stdio: 'inherit' },
);
if (result.status !== 0)
  throw new Error(`ffmpeg failed: ${result.error ?? result.status}`);
console.log(
  `Created ${target} (${total.toFixed(2)} seconds). Review before any public upload.`,
);
