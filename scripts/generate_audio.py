#!/usr/bin/env python3
import asyncio
import json
import re
import subprocess
import unicodedata
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "audio"
RAW = ROOT / ".audio-raw"

FEMALE_VOICE = "en-GB-SoniaNeural"
MALE_VOICE = "en-GB-RyanNeural"


def slug(text: str) -> str:
    value = unicodedata.normalize("NFKD", text).lower()
    value = value.replace("’", "").replace("'", "").replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return re.sub(r"-{2,}", "-", value)


def spoken_text(text: str) -> str:
    value = re.sub(r"\.{2,}", " ", text).replace("CO2", "C O 2")
    if value == "STEM disciplines":
        return "stem disciplines"
    return value


def is_valid_audio(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 1000:
        return False
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
    )
    try:
        return probe.returncode == 0 and float(json.loads(probe.stdout)["format"]["duration"]) > 0.2
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False


def course_texts() -> tuple[list[str], list[str]]:
    command = [
        "node",
        "--input-type=module",
        "-e",
        (
            'import { ALL_DRILLS } from "./data.js"; '
            'console.log(JSON.stringify({'
            'female:[...new Set(ALL_DRILLS.map(d=>d.question))],'
            'male:[...new Set(ALL_DRILLS.flatMap(d=>[d.answer,d.distractor,d.distractor2]))]'
            '}));'
        ),
    ]
    output = subprocess.check_output(command, cwd=ROOT, text=True)
    payload = json.loads(output)
    return payload["female"], payload["male"]


async def transcode(raw: Path, output: Path):
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(raw),
        "-af",
        (
            "silenceremove=start_periods=1:start_duration=0.02:"
            "start_threshold=-55dB:stop_periods=1:stop_duration=0.28:"
            "stop_threshold=-55dB,apad=pad_dur=0.12,"
            "loudnorm=I=-15:TP=-1.0:LRA=7"
        ),
        "-ar",
        "48000",
        "-ac",
        "1",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "96k",
        str(output),
    ]
    await asyncio.to_thread(subprocess.run, command, check=True)


async def generate_one(kind: str, text: str, voice: str, semaphore: asyncio.Semaphore):
    output = PUBLIC / kind / f"{slug(text)}.mp3"
    raw = RAW / f"{kind}-{slug(text)}.mp3"
    if is_valid_audio(output):
        return "skipped", text
    output.unlink(missing_ok=True)

    async with semaphore:
        for attempt in range(4):
            try:
                communicate = edge_tts.Communicate(
                    spoken_text(text),
                    voice,
                    rate="-5%",
                    volume="+8%",
                    pitch="+0Hz",
                )
                await communicate.save(str(raw))
                await transcode(raw, output)
                return "generated", text
            except Exception as error:
                raw.unlink(missing_ok=True)
                if attempt == 3:
                    return "failed", f"{text} ({type(error).__name__})"
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    female_texts, male_texts = course_texts()
    (PUBLIC / "female").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "male").mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)

    semaphore = asyncio.Semaphore(8)
    jobs = [
        generate_one("female", text, FEMALE_VOICE, semaphore) for text in female_texts
    ]
    jobs += [generate_one("male", text, MALE_VOICE, semaphore) for text in male_texts]

    generated = 0
    skipped = 0
    failed = []
    for task in asyncio.as_completed(jobs):
        status, text = await task
        if status == "generated":
            generated += 1
            if generated % 50 == 0:
                print(f"generated {generated}/{len(jobs)} — {text}", flush=True)
        elif status == "skipped":
            skipped += 1
        else:
            failed.append(text)
    print(
        f"complete: {len(female_texts)} female + {len(male_texts)} male = {len(jobs)} assets "
        f"({generated} generated, {skipped} already present)",
        flush=True,
    )
    if failed:
        raise RuntimeError(f"Audio generation failed for {len(failed)} assets: {failed[:8]}")


if __name__ == "__main__":
    asyncio.run(main())
