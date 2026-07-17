import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { ALL_DRILLS, audioPath } from "../data.js";

const root = new URL("../public", import.meta.url).pathname;
const expected = new Set();

for (const drill of ALL_DRILLS) {
  expected.add(audioPath("female", drill.question));
  expected.add(audioPath("male", drill.answer));
  expected.add(audioPath("male", drill.distractor));
  expected.add(audioPath("male", drill.distractor2));
}

const failures = [];
for (const relative of expected) {
  const file = `${root}${relative}`;
  if (!existsSync(file) || statSync(file).size < 1000) {
    failures.push(`${relative}: missing or empty`);
    continue;
  }
  const result = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_name,sample_rate,channels",
        "-of",
        "json",
        file
      ],
      { encoding: "utf8" }
    )
  );
  const stream = result.streams?.[0];
  const duration = Number(result.format?.duration);
  if (
    stream?.codec_name !== "mp3" ||
    stream?.sample_rate !== "48000" ||
    stream?.channels !== 1 ||
    !Number.isFinite(duration) ||
    duration < 0.35 ||
    duration > 15
  ) {
    failures.push(`${relative}: invalid audio ${JSON.stringify(result)}`);
  }

  const volumeProbe = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const report = `${volumeProbe.stdout}\n${volumeProbe.stderr}`;
  const mean = Number(report.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1]);
  const peak = Number(report.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  if (
    !Number.isFinite(mean) ||
    !Number.isFinite(peak) ||
    mean < -22.5 ||
    mean > -10 ||
    peak < -8 ||
    peak > -0.1
  ) {
    failures.push(`${relative}: loudness outside pilot range (mean ${mean}, peak ${peak})`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified ${expected.size} unique MP3 assets.`);
