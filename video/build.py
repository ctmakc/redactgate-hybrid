#!/usr/bin/env python3
"""Build the final demo from video/out/raw.mp4 + events.json.

- finds the green sync flash to align the event clock with the video clock;
- trims the head and tail;
- model waits that run past the narration are played faster, with an on-screen "sped up" note;
- each narration line is placed at its new time; subtitles are burned in and written as SRT.
"""
from __future__ import annotations

import json, pathlib, re, subprocess

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"
RAW, FINAL = OUT / "raw.mp4", OUT / "redactgate-hybrid-demo.mp4"
FPS = 30
MIN_FAST = 3.0   # a silent model wait longer than this is sped up
FAST_TO = 2.5    # ... to about this many seconds


def duration(p: pathlib.Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)], text=True))


def flash_time() -> float:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-t", "12", "-i", str(RAW), "-vf", "crop=200:200:860:440,scale=1:1",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    for i in range(0, len(raw), 3):
        r, g, b = raw[i:i + 3]
        if g > 180 and r < 90 and b < 120:
            return i // 3 / FPS
    raise SystemExit("sync flash not found")


def chunks(text: str, limit: int = 78) -> list[str]:
    out = []
    for sent in re.split(r"(?<=[.!?:])\s+", text.strip()):
        words, cur = sent.split(), ""
        for w in words:
            if cur and len(cur) + 1 + len(w) > limit:
                out.append(cur); cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            out.append(cur)
    return out


def ts_ass(t: float) -> str:
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ts_srt(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main() -> int:
    ev = json.loads((OUT / "events.json").read_text())
    off = flash_time() - next(e["t"] for e in ev if e["kind"] == "flash")
    for e in ev:
        e["vt"] = e["t"] + off
    says = [e for e in ev if e["kind"] == "say"]
    start = next(e["vt"] for e in ev if e["kind"] == "flash") + 0.6
    end = min(duration(RAW), next(e["vt"] for e in ev if e["kind"] == "end"))

    # fast ranges: the part of each model wait with nobody speaking
    fast = []
    for w in (e for e in ev if e["kind"] == "wait"):
        we = next(e["vt"] for e in ev if e["kind"] == "wait_end" and e["label"] == w["label"] and e["t"] >= w["t"])
        a = w["vt"] + 0.8
        for s in says:
            if s["vt"] < we and s["vt"] + s["dur"] > a:
                a = s["vt"] + s["dur"] + 0.3
        b = we - 0.4
        if b - a > MIN_FAST:
            fast.append((a, b, (b - a) / FAST_TO, w["label"]))
    segs, cur = [], start
    for a, b, sp, lab in fast:
        segs.append((cur, a, 1.0, None)); segs.append((a, b, sp, lab)); cur = b
    segs.append((cur, end, 1.0, None))

    def nt(t: float) -> float:
        acc = 0.0
        for a, b, sp, _ in segs:
            if t < a:
                return acc
            if t <= b:
                return acc + (t - a) / sp
            acc += (b - a) / sp
        return acc
    total = nt(end)
    print(f"offset {off:+.3f}  final {total:.1f}s  fast {[(round(a,1), round(b,1), round(sp,1), l) for a,b,sp,l in fast]}")

    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 0", "",
           "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           "Style: Sub,DejaVu Sans,36,&H00F1EFEE,&H00F1EFEE,&H00181511,&H00181511,0,0,0,0,100,100,0,0,3,14,0,2,160,160,40,1",
           "Style: Fast,DejaVu Sans,30,&H00181511,&H00181511,&H0030C2F2,&H0030C2F2,1,0,0,0,100,100,1,0,3,12,0,9,40,40,96,1",
           "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    srt, n = [], 0
    for e in says:
        parts = chunks(e["text"]); w = [max(14, len(p)) for p in parts]; t = nt(e["vt"])
        for p, k in zip(parts, w):
            d = e["dur"] * k / sum(w)
            ass.append(f"Dialogue: 0,{ts_ass(t)},{ts_ass(t + d)},Sub,,0,0,0,,{p}")
            n += 1; srt.append(f"{n}\n{ts_srt(t)} --> {ts_srt(t + d)}\n{p}\n"); t += d
    for a, b, sp, lab in fast:
        what = "Gemini Nano on this device" if lab.startswith("nano") else "Cloud Gemini"
        ass.append(f"Dialogue: 1,{ts_ass(nt(a))},{ts_ass(nt(b))},Fast,,0,0,0,,{what}  ▸▸ {sp:.0f}× speed")
    (OUT / "subs.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")
    FINAL.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")

    vparts, filt = [], []
    for i, (a, b, sp, _) in enumerate(segs):
        filt.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=(PTS-STARTPTS)/{sp:.4f}[v{i}]"); vparts.append(f"[v{i}]")
    filt.append(f"{''.join(vparts)}concat=n={len(segs)}:v=1:a=0,fps={FPS},ass={OUT / 'subs.ass'}[v]")
    inputs, labels = ["-i", str(RAW)], []
    for i, e in enumerate(says, 1):
        inputs += ["-i", e["audio"]]; ms = int(round(nt(e["vt"]) * 1000))
        filt.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms},apad[a{i}]"); labels.append(f"[a{i}]")
    filt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                    "-ar", "48000", "-t", f"{total:.3f}", "-movflags", "+faststart", str(FINAL)], check=True)
    print(FINAL, f"{duration(FINAL):.1f}s")
    for s in says:
        print(f"  {int(nt(s['vt'])//60)}:{int(nt(s['vt'])%60):02d} {s['key']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
