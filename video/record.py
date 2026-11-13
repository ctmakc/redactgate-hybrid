#!/usr/bin/env python3
"""Record the RedactGate Hybrid demo from the live site, with a real Gemini Nano.

Desktop Chrome (with the on-device model already downloaded in its profile) runs in kiosk mode inside
Xvfb and is grabbed with ffmpeg x11grab. Narration is edge-tts; every line and every model wait is
logged with its wall-clock time so build.py can align audio, shorten the waits and write subtitles.

Usage: REC_PROFILE=<chrome profile with Nano> python3 video/record.py
Output: video/out/raw.mp4, video/out/events.json
"""
from __future__ import annotations

import hashlib, json, os, pathlib, subprocess, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"; TTS = OUT / "tts"
URL = os.environ.get("REC_URL", "https://redactgate-hybrid-2026.web.app/")
DISPLAY = os.environ.get("REC_DISPLAY", ":142")
PROFILE = os.environ["REC_PROFILE"]
PORT = int(os.environ.get("REC_PORT", "9463"))
EDGE_TTS = os.environ.get("EDGE_TTS", "/data/venvs/edge-tts/bin/edge-tts")
VOICE, RATE = "en-US-AndrewNeural", "+6%"
NARR = json.loads((HERE / "narration.json").read_text())
T0 = 0.0
EV: list[dict] = []


def now() -> float:
    return time.time() - T0


def dur(p: pathlib.Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)], text=True))


def tts(text: str) -> tuple[pathlib.Path, float]:
    mp3 = TTS / f"{hashlib.sha1(f'{VOICE}|{RATE}|{text}'.encode()).hexdigest()[:16]}.mp3"
    for a in range(5):
        if mp3.exists() and mp3.stat().st_size > 0:
            break
        subprocess.run([EDGE_TTS, "--voice", VOICE, f"--rate={RATE}", "--text", text, "--write-media", str(mp3)], capture_output=True)
        time.sleep(1 + a)
    return mp3, dur(mp3)


class Say:
    """Starts a narration line now; .done() waits until it has been spoken."""
    def __init__(self, key: str):
        self.mp3, self.d = tts(NARR[key])
        self.t = now()
        EV.append({"kind": "say", "key": key, "t": round(self.t, 3), "dur": round(self.d, 3), "audio": str(self.mp3), "text": NARR[key]})

    def done(self, gap: float = 0.35) -> None:
        left = self.t + self.d + gap - now()
        if left > 0:
            time.sleep(left)


def wait_model(pg, js: str, label: str, timeout: int = 240000) -> None:
    EV.append({"kind": "wait", "label": label, "t": round(now(), 3)})
    pg.wait_for_function(js, timeout=timeout)
    EV.append({"kind": "wait_end", "label": label, "t": round(now(), 3)})


def scroll(pg, sel: str, block: str = "start", pause: float = 1.0) -> None:
    pg.evaluate("([s,b]) => document.querySelector(s).scrollIntoView({behavior:'smooth', block:b})", [sel, block])
    time.sleep(pause)


def main() -> None:
    global T0
    TTS.mkdir(parents=True, exist_ok=True)
    for k in NARR:
        tts(NARR[k])  # synthesize everything before recording
    xvfb = chrome = None
    if os.environ.get("REC_LAUNCH", "1") == "1":
        xvfb = subprocess.Popen(["Xvfb", DISPLAY, "-screen", "0", "1920x1080x24", "-nolisten", "tcp"])
        time.sleep(1)
        chrome = subprocess.Popen(["/opt/google/chrome/chrome", f"--user-data-dir={PROFILE}", f"--remote-debugging-port={PORT}",
            "--no-first-run", "--no-default-browser-check", "--disable-sync", "--kiosk", "--window-position=0,0",
            "--window-size=1920,1080", "--force-device-scale-factor=1.25", "--lang=en-US", "--hide-scrollbars",
            "--enable-features=OptimizationGuideOnDeviceModel:BypassPerfRequirement/true,PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput",
            "--disable-features=Translate,TranslateUI", "--enable-gpu", "--ignore-gpu-blocklist", "about:blank"],
            env={**os.environ, "DISPLAY": DISPLAY}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(4)
    ff = None
    try:
        with sync_playwright() as p:
            b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}")
            pages = b.contexts[0].pages
            pg = next((x for x in pages if 'web.app' in x.url), pages[0])
            pg.bring_to_front()
            pg.goto(URL)
            pg.evaluate("() => { for (const k of Object.keys(localStorage)) localStorage.removeItem(k); }")
            pg.reload()
            pg.wait_for_function("document.getElementById('nano-state').textContent === 'ready'", timeout=60000)
            pg.evaluate("() => scrollTo(0,0)")
            time.sleep(2.5)  # hero entrance finishes before the take starts
            pg.reload(); pg.wait_for_function("document.getElementById('nano-state').textContent !== 'checking'"); time.sleep(0.2)
            T0 = time.time()
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "x11grab", "-draw_mouse", "0", "-framerate", "30",
                                   "-video_size", "1920x1080", "-i", f"{DISPLAY}.0", "-c:v", "libx264", "-preset", "veryfast",
                                   "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / "raw.mp4")], stdin=subprocess.PIPE)
            EV.append({"kind": "rec", "t": round(now(), 3)})
            time.sleep(1.5)
            pg.evaluate("() => { const d = document.createElement('div'); d.id = 'sync'; d.style.cssText = 'position:fixed;inset:0;background:#00E040;z-index:2147483647'; document.body.append(d); }")
            EV.append({"kind": "flash", "t": round(now(), 3)})
            time.sleep(0.5)
            pg.evaluate("() => document.getElementById('sync').remove()")
            time.sleep(0.8)

            s = Say("hero"); s.done()
            s = Say("demo")
            pg.click('.demo[data-demo="client-email"]'); time.sleep(0.3)
            scroll(pg, "#device", pause=1.2)
            pg.evaluate("() => { const t = document.getElementById('doc'); t.scrollTop = 0; }")
            s.done()
            s = Say("scan")
            time.sleep(1.0)
            pg.click("#scan")
            wait_model(pg, "!document.getElementById('step-review').hidden", "nano-scan")
            s.done()
            time.sleep(0.6)
            s = Say("review")
            scroll(pg, "#step-review", pause=1.5)
            time.sleep(max(0, s.d * 0.55 - 1.5))
            scroll(pg, "#device", "start", pause=0.5)
            s.done()
            s = Say("interlock")
            scroll(pg, "#step-review", pause=1.0)
            time.sleep(2.2)
            sin = pg.locator("#doc-view .pii", has_text="728 146 390").first
            sin.click(); EV.append({"kind": "mark", "label": "sin-off", "t": round(now(), 3)})
            time.sleep(4.0)
            sin.click(); EV.append({"kind": "mark", "label": "sin-on", "t": round(now(), 3)})
            s.done(0.8)
            s = Say("custody")
            scroll(pg, "#custody", pause=1.0)
            s.done()
            s = Say("send")
            scroll(pg, ".hatch", "center", pause=1.2)
            pg.click("#send")
            wait_model(pg, "!document.getElementById('answer').hidden && document.getElementById('guard').dataset.state !== 'busy'", "cloud", 120000)
            time.sleep(0.5)
            scroll(pg, "#answer", pause=1.0)
            s.done(0.8)
            s = Say("ledger")
            scroll(pg, "#ledger", pause=1.0)
            pg.evaluate("() => document.querySelector('#led-rows li')?.querySelector('details')?.setAttribute('open','')")
            s.done(0.6)
            s = Say("local")
            scroll(pg, ".hatch", "center", pause=1.2)
            pg.click("#run-local")
            wait_model(pg, "document.getElementById('guard').dataset.state !== 'busy'", "nano-local")
            time.sleep(0.4)
            scroll(pg, "#answer", pause=1.0)
            s.done(0.8)
            s = Say("outro")
            scroll(pg, "#how", pause=1.0)
            time.sleep(max(0, s.d * 0.5))
            pg.evaluate("() => scrollTo({top:0, behavior:'smooth'})")
            s.done(2.0)
            EV.append({"kind": "end", "t": round(now(), 3)})
    finally:
        if ff:
            ff.communicate(b"q", timeout=30)
        (OUT / "events.json").write_text(json.dumps(EV, indent=1))
        if chrome:
            chrome.terminate(); chrome.wait(timeout=20)
        if xvfb:
            xvfb.terminate()


if __name__ == "__main__":
    main()
