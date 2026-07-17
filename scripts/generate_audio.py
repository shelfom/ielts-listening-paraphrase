#!/usr/bin/env python3
import asyncio
import re
import subprocess
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "audio"
RAW = ROOT / ".audio-raw"

FEMALE_VOICE = "en-GB-SoniaNeural"
MALE_VOICE = "en-GB-RyanNeural"

FEMALE_TEXTS = [
    "required",
    "will need",
    "in advance",
    "to arrange",
    "don't touch",
    "contact",
    "need to know",
    "placed",
    "piled up",
    "advice",
    "harm",
    "exceptions",
    "science, technology, engineering or mathematics",
    "way to improving",
    "investigate",
    "do badly",
    "important",
    "aim",
    "surprised",
    "had no effect on",
    "contain",
    "many different",
    "sufficient",
    "where meet",
    "under",
    "near",
    "establish",
    "reduce",
    "purpose",
]

MALE_TEXTS = [
    "we do insist",
    "have to see about getting",
    "before",
    "to make the arrangements",
    "no one fiddles about with",
    "let know",
    "you'll be informed of",
    "collected up",
    "stacked up",
    "tips",
    "injure",
    "unless",
    "STEM disciplines",
    "solution",
    "find out",
    "get poor results",
    "significant",
    "the idea of",
    "hadn't expected",
    "got same results",
    "have",
    "the greatest mixture of",
    "enough",
    "boundaries",
    "below",
    "around",
    "create",
    "lower",
    "so that",
]


def slug(text: str) -> str:
    value = text.lower().replace("’", "").replace("'", "").replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return re.sub(r"-{2,}", "-", value)


def spoken_text(text: str) -> str:
    if text == "STEM disciplines":
        return "stem disciplines"
    return text


async def generate_one(kind: str, text: str, voice: str, semaphore: asyncio.Semaphore):
    output = PUBLIC / kind / f"{slug(text)}.mp3"
    raw = RAW / f"{kind}-{slug(text)}.mp3"
    if output.exists() and output.stat().st_size > 1000:
        print(f"skip {kind}: {text}")
        return

    async with semaphore:
        print(f"generate {kind}: {text}")
        communicate = edge_tts.Communicate(
            spoken_text(text),
            voice,
            rate="-5%",
            volume="+8%",
            pitch="+0Hz",
        )
        await communicate.save(str(raw))

    subprocess.run(
        [
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
            "128k",
            str(output),
        ],
        check=True,
    )


async def main():
    (PUBLIC / "female").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "male").mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(3)
    jobs = [
        generate_one("female", text, FEMALE_VOICE, semaphore) for text in FEMALE_TEXTS
    ]
    jobs += [generate_one("male", text, MALE_VOICE, semaphore) for text in MALE_TEXTS]
    await asyncio.gather(*jobs)
    print(f"complete: {len(FEMALE_TEXTS) + len(MALE_TEXTS)} audio files")


if __name__ == "__main__":
    asyncio.run(main())
