"""Render the Runline demo narration with Jarvis's Deepgram configuration.

The API key is read from the process environment and is never written to disk.
Each SSML paragraph is rendered separately so the editorial pauses remain
predictable, then the WAV segments are joined losslessly.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import urllib.parse
import urllib.request
import wave
import xml.etree.ElementTree as ET
from pathlib import Path


DEFAULT_MODEL = "aura-2-orion-en"
DEFAULT_SAMPLE_RATE = 24_000
SECTION_SECONDS = (18.65, 25.84, 25.83, 23.29, 20.31, 21.68)


def element_text(element: ET.Element) -> str:
    parts: list[str] = []
    if element.text:
        parts.append(element.text)
    for child in element:
        if child.tag.rsplit("}", 1)[-1] == "sub" and child.attrib.get("alias"):
            parts.append(child.attrib["alias"])
        else:
            parts.append(element_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def narration_paragraphs(path: Path) -> list[str]:
    root = ET.parse(path).getroot()
    paragraphs = [
        " ".join(element_text(node).split())
        for node in root.iter()
        if node.tag.rsplit("}", 1)[-1] == "p"
    ]
    return [paragraph for paragraph in paragraphs if paragraph]


def synthesize(text: str, *, api_key: str, model: str, sample_rate: int) -> bytes:
    query = urllib.parse.urlencode(
        {
            "model": model,
            "encoding": "linear16",
            "container": "wav",
            "sample_rate": sample_rate,
        }
    )
    request = urllib.request.Request(
        f"https://api.deepgram.com/v1/speak?{query}",
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
            "Accept": "audio/wav",
        },
        method="POST",
    )
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(
        request, timeout=90
    ) as response:
        audio = response.read()
    if not audio.startswith(b"RIFF"):
        raise RuntimeError("Deepgram returned an unexpected audio format")
    return audio


def join_wavs(parts: list[Path], target: Path, section_seconds: tuple[float, ...]) -> None:
    expected: tuple[int, int, int] | None = None
    audio_parts: list[bytes] = []
    for part in parts:
        with wave.open(str(part), "rb") as source:
            current = (source.getnchannels(), source.getsampwidth(), source.getframerate())
            if expected is None:
                expected = current
            elif current != expected:
                raise RuntimeError(f"Deepgram WAV formats differ: {expected} and {current}")
            audio_parts.append(source.readframes(source.getnframes()))
    if expected is None:
        raise RuntimeError("No narration segments were generated")
    channels, sample_width, sample_rate = expected
    with wave.open(str(target), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        for index, (audio, seconds) in enumerate(zip(audio_parts, section_seconds, strict=True)):
            section_bytes = round(sample_rate * seconds) * channels * sample_width
            if len(audio) > section_bytes:
                raise RuntimeError(
                    f"Paragraph {index + 1} is {len(audio) / (sample_rate * channels * sample_width):.2f}s, "
                    f"longer than its {seconds:.2f}s visual section"
                )
            output.writeframes(audio)
            output.writeframes(b"\0" * (section_bytes - len(audio)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.environ.get("DEEPGRAM_TTS_MODEL", DEFAULT_MODEL))
    parser.add_argument("--output", default="narration-deepgram-orion.wav")
    args = parser.parse_args()

    api_key = os.environ.get("DEEPGRAM_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("DEEPGRAM_API_KEY is not available in the process environment")
    if Path(args.output).name != args.output or not args.output.lower().endswith(".wav"):
        raise SystemExit("--output must be a simple .wav filename")

    project = Path(__file__).resolve().parent.parent
    source = project / "docs" / "narration-draft.ssml"
    output_dir = project / "outputs" / "demo"
    target = output_dir / args.output
    output_dir.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing narration: {target}")

    paragraphs = narration_paragraphs(source)
    with tempfile.TemporaryDirectory(prefix="deepgram-narration-", dir=output_dir) as work:
        parts: list[Path] = []
        for index, paragraph in enumerate(paragraphs, start=1):
            print(f"Rendering paragraph {index}/{len(paragraphs)} with {args.model}...")
            part = Path(work) / f"part-{index:02d}.wav"
            part.write_bytes(
                synthesize(
                    paragraph,
                    api_key=api_key,
                    model=args.model,
                    sample_rate=DEFAULT_SAMPLE_RATE,
                )
            )
            parts.append(part)
        if len(paragraphs) != len(SECTION_SECONDS):
            raise RuntimeError("Narration paragraphs no longer match the six-section video timeline")
        join_wavs(parts, target, SECTION_SECONDS)

    print(f"Rendered Deepgram narration: {target}")
    print("The credential remained environment-only; no public upload occurred.")


if __name__ == "__main__":
    main()
