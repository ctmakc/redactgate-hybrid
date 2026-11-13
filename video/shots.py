#!/usr/bin/env python3
"""Devpost gallery screenshots (3:2, 1800x1200) from the live site in a Chrome with Gemini Nano.

Usage: REC_PORT=9463 python3 video/shots.py   (attaches to a running Chrome over CDP)
Output: video/out/shots/*.png
"""
from __future__ import annotations

import os, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out" / "shots"
URL = os.environ.get("REC_URL", "https://redactgate-hybrid-2026.web.app/")
PORT = int(os.environ.get("REC_PORT", "9463"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}")
        pages = b.contexts[0].pages
        pg = next((x for x in pages if "web.app" in x.url), pages[0])
        emu = pg.context.new_cdp_session(pg)
        emu.send("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 960, "deviceScaleFactor": 1.25, "mobile": False})

        def shot(name: str, sel: str | None = None, block: str = "start") -> None:
            if sel:
                pg.evaluate("([s,b]) => document.querySelector(s).scrollIntoView({block:b})", [sel, block])
            else:
                pg.evaluate("() => scrollTo(0,0)")
            pg.wait_for_timeout(900)
            pg.screenshot(path=str(OUT / f"{name}.png"))
            print("shot", name)

        pg.goto(URL)
        pg.evaluate("() => { for (const k of Object.keys(localStorage)) localStorage.removeItem(k); }")
        pg.reload()
        pg.wait_for_function("document.getElementById('nano-state').textContent === 'ready'", timeout=60000)
        pg.wait_for_timeout(2500)
        shot("1-hero")
        pg.click('.demo[data-demo="client-email"]')
        pg.wait_for_timeout(500)
        pg.click("#scan")
        pg.wait_for_function("!document.getElementById('step-review').hidden", timeout=240000)
        pg.wait_for_timeout(800)
        shot("2-review", "#device")
        sin = pg.locator("#doc-view .pii", has_text="728 146 390").first
        sin.click()
        pg.wait_for_timeout(800)
        shot("3-interlock", ".hatch", "center")
        sin.click()
        pg.wait_for_timeout(500)
        shot("4-custody", "#custody")
        pg.click("#send")
        pg.wait_for_function("!document.getElementById('answer').hidden && document.getElementById('guard').dataset.state !== 'busy'", timeout=120000)
        pg.wait_for_timeout(800)
        shot("5-answer", "#answer")
        pg.evaluate("() => document.querySelector('#led-rows li')?.querySelector('details')?.setAttribute('open','')")
        shot("6-ledger", "#ledger")
        emu.send("Emulation.clearDeviceMetricsOverride")


if __name__ == "__main__":
    main()
