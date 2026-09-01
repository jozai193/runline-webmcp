param(
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$')]
  [string]$InputName = 'narration-deepgram-orion.wav',
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$')]
  [string]$OutputName = 'narration-deepgram-orion-smooth.wav'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $project 'outputs\demo'
$inputPath = Join-Path $outputDirectory $InputName
$outputPath = Join-Path $outputDirectory $OutputName

if (-not (Test-Path -LiteralPath $inputPath)) {
  throw "Narration source does not exist: $inputPath"
}
if (Test-Path -LiteralPath $outputPath) {
  throw "Refusing to overwrite existing narration: $outputPath"
}

# Keep normal breaths while shortening only the pauses that make the edit stall.
# With the current Orion take, this caps detected gaps at roughly 0.6 seconds.
& ffmpeg -hide_banner -n -i $inputPath `
  -af 'silenceremove=start_periods=0:stop_periods=-1:stop_duration=0.45:stop_threshold=-42dB:stop_silence=0.12' `
  -c:a pcm_s16le $outputPath
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed with exit code $LASTEXITCODE"
}

Write-Output "Created smooth narration: $outputPath"
Write-Output 'No public upload occurred.'
