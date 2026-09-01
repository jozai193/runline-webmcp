param(
  [string]$Voice = 'Microsoft Zira Desktop',
  [ValidateRange(-10, 10)][int]$Rate = -1,
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$')][string]$OutputName = 'narration-draft.wav'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$project = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $project 'docs\narration-draft.ssml'
$outputDirectory = Join-Path $project 'outputs\demo'
$outputPath = Join-Path $outputDirectory $OutputName
if (Test-Path -LiteralPath $outputPath) {
  throw 'A narration draft already exists. Preserve or rename it before rendering another take.'
}
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$narrator = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $narrator.SelectVoice($Voice)
  $narrator.Rate = $Rate
  $narrator.Volume = 100
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $narrator.SetOutputToWaveFile($outputPath, $format)
  $narrator.SpeakSsml((Get-Content -LiteralPath $scriptPath -Raw))
  $narrator.SetOutputToNull()
} finally {
  $narrator.Dispose()
}
Write-Output "Rendered local synthetic narration draft: $outputPath"
Write-Output 'This is not a finished video. Match it to genuine recorded browser footage before publication.'
