// Assemble genuine browser captures. This script does not synthesize UI or tool calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'outputs/demo');
const captures = path.join(output, 'captures');
const targetName = process.argv[2] || 'runline-demo-draft.mp4';
const audioName = process.argv[3] || 'narration-draft.wav';
const defaultSectionSeconds = [18.65, 25.84, 25.83, 23.29, 20.31, 21.68];
const sectionSeconds = process.argv[4]
  ? process.argv[4].split(',').map(Number)
  : defaultSectionSeconds;
if (
  sectionSeconds.length !== 6 ||
  sectionSeconds.some((seconds) => !Number.isFinite(seconds) || seconds <= 0)
) {
  throw new Error(
    'Section timing must be six positive comma-separated durations.',
  );
}
if (path.basename(targetName) !== targetName || !targetName.endsWith('.mp4')) {
  throw new Error('The output must be a simple .mp4 filename.');
}
if (path.basename(audioName) !== audioName || !audioName.endsWith('.wav')) {
  throw new Error('The narration must be a simple .wav filename.');
}
const target = path.join(output, targetName);
const narrationProvider = audioName.includes('deepgram')
  ? 'Deepgram Aura-2 Orion synthetic narration'
  : 'Microsoft Zira synthetic narration';
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

function scaledBudgets(total, original) {
  const originalTotal = original.reduce((sum, seconds) => sum + seconds, 0);
  return original.map((seconds) => (seconds / originalTotal) * total);
}

const [section1, section2, section3, section4, section5, section6] =
  sectionSeconds;
const section2Parts = scaledBudgets(section2, [12, 13.84]);
const section3Parts = scaledBudgets(section3, [11, 4, 2, 8.83]);
const section4Parts = scaledBudgets(section4, [6, 4, 5, 8.29]);
const section5Parts = scaledBudgets(section5, [13, 7.31]);
const section6Parts = scaledBudgets(section6, [10, 11.68]);

hold('demo-10-clean-baseline.png', section1);
hold('demo-10-clean-baseline.png', section2Parts[0]);
clip('demo-02-disruption', section2Parts[1]);
clip('demo-03-repair', section3Parts[0]);
hold('demo-04-current.png', section3Parts[1]);
clip('demo-04-compare', section3Parts[2]);
hold('demo-03-repair.png', section3Parts[3]);
clip('demo-05-request', section4Parts[0]);
hold('demo-05-consent-pending.png', section4Parts[1]);
hold('demo-05-consent-confirmed.png', section4Parts[2]);
hold('demo-06-consent-applied.png', section4Parts[3]);
clip('demo-08-blocked', section5Parts[0]);
hold('demo-08-blocked.png', section5Parts[1]);
hold('demo-09-export.png', section6Parts[0]);
hold('demo-10-clean-baseline.png', section6Parts[1]);
const total = timeline.reduce((sum, f) => sum + f.duration, 0);
if (total >= 180) throw new Error('Video must be shorter than three minutes.');

// Earlier CDP captures contain JPEG bytes despite their `.png` filenames,
// while Playwright writes real PNGs. The concat demuxer selects one decoder
// for the whole image sequence, so normalize non-JPEG inputs before encoding.
const normalizedCaptures = path.join(output, 'normalized-captures');
fs.mkdirSync(normalizedCaptures, { recursive: true });
const normalizedFiles = new Map();
for (const file of new Set(timeline.map((frame) => frame.file))) {
  const source = path.join(captures, file);
  const magic = fs.readFileSync(source).subarray(0, 3);
  const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
  if (isJpeg) {
    normalizedFiles.set(file, source);
    continue;
  }
  const normalized = path.join(
    normalizedCaptures,
    `${String(normalizedFiles.size).padStart(3, '0')}-${path.parse(file).name}.jpg`,
  );
  const conversion = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      source,
      '-q:v',
      '2',
      normalized,
    ],
    { stdio: 'inherit' },
  );
  if (conversion.status !== 0)
    throw new Error(
      `Could not normalize ${file}: ${conversion.error ?? conversion.status}`,
    );
  normalizedFiles.set(file, normalized);
}
const concat = timeline.flatMap((f) => [
  `file '${normalizedFiles.get(f.file).replaceAll('\\', '/')}'`,
  `duration ${f.duration.toFixed(6)}`,
]);
concat.push(
  `file '${normalizedFiles.get(timeline.at(-1).file).replaceAll('\\', '/')}'`,
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
const boundaries = sectionSeconds.reduce(
  (points, seconds) => [...points, points.at(-1) + seconds],
  [0],
);
const [, end1, end2, end3, end4, end5, end6] = boundaries;
const section2CopySplit = end1 + section2 * (12.35 / 25.84);
const section4CopySplit = end3 + section4 * (10 / 23.29);

caption(0, total, 'Brand', 'RUNLINE   /   WEBMCP CHALLENGE');
caption(
  0,
  total,
  'Footer',
  `Genuine browser capture | Edited pacing and held frames | Fictional data | ${narrationProvider} | Organizer clicks automated for this test`,
);
caption(0, end1, 'Heading', 'Your event,\nin sync.');
caption(
  0,
  end1,
  'Body',
  'One late speaker.\nA network of promises.\n\nRepair the whole day\nwithout losing the\ndecisions that matter.\n\n12 sessions\n3 rooms\n2 protected sessions',
);
caption(end1, end2, 'Heading', 'Native tools.\nReal state.');
caption(
  end1,
  section2CopySplit,
  'Body',
  'No embedded chatbot.\n\nThe browser agent reads:\n\nget_event_summary\nget_constraints\nlist_sessions\n\nRoom limits, lunch,\nturnover and stable IDs.',
);
caption(
  section2CopySplit,
  end2,
  'Body',
  'ACTUAL RESPONSE EXCERPT\nreport_disruption\n\nconflicts: 1\nscheduleTimesChanged:\n  false\n\nMira is unavailable\nuntil 14:00.\n\nNothing has moved.',
);
caption(end2, end3, 'Heading', 'A proposal,\nwith trade-offs.');
caption(
  end2,
  end3,
  'Body',
  `ACTUAL RESPONSE EXCERPT\npropose_repair\n\nstatus: ${repair.result.data.status}\napplied: ${repair.result.data.applied}\nremainingConflicts: 0\n\n${repair.result.data.metrics.moved} sessions moved\n${repair.result.data.metrics.roomChanges} room changes\n${repair.result.data.metrics.shiftedMinutes} minutes total shift\n${repair.result.data.metrics.lockedProtected} locks protected\n\nBounded search.\nNot a global optimum.`,
);
caption(end3, end4, 'Heading', 'Consent before\nthe schedule changes.');
caption(
  end3,
  section4CopySplit,
  'Body',
  `ACTUAL RESPONSE EXCERPT\nrequest_approval\n\nstatus:\n awaiting_human_approval\nscheduleChanged: false\n\nReview specific changes.\nNothing is applied\nby this tool.`,
);
caption(
  section4CopySplit,
  end4,
  'Body',
  'AFFECTED-SPEAKER GATE\n\nEvery moved session’s\nspeaker must confirm.\n\nA decline searches for\na distinct alternative.\n\nApply unlocks only\nafter everyone agrees.\n\nResponses are recorded,\nnot identity-verified.',
);
caption(end4, end5, 'Heading', 'Know when\nto stop.');
caption(
  end4,
  end5,
  'Body',
  `Separate sample scenario:\nroom closed during\nthe locked opening.\n\nACTUAL RESPONSE EXCERPT\nrequest_approval\n\nok: ${blocked.result.ok}\ncode: ${blocked.result.code}\n\nThe opening stays put.\nNo unsafe approval.`,
);
caption(end5, end6, 'Heading', 'Ready for\nthe real workflow.');
caption(
  end5,
  end6,
  'Body',
  'Persistent demo workspaces\nCustom event import\nCSV / ICS / JSON exports\nUndo and activity history\n\n47 domain tests\n25 HTTP checks\nNative browser QA\n\nYour agent proposes.\nPeople affected confirm.\nYou keep the final say.',
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
      disclosure: `${narrationProvider}. Agent operated organizer UI for a fictional test. Tool response excerpts are editorial overlays, not a simulated chat interface.`,
      sectionSeconds,
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
    audioName,
    '-vf',
    'scale=1440:970:force_original_aspect_ratio=decrease,pad=1920:1080:20:90:color=0x193B30,setsar=1,subtitles=demo-overlays.ass',
    '-af',
    'apad,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000',
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
