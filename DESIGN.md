# RedactGate Hybrid — DESIGN.md (locked 2026-11-12)

## Subject & audience
People who paste private documents into AI assistants: an accountant's client email, a clinic note, a résumé.
Judges of #BuildHybridAI who must see in five seconds which part ran on the device and which part ran in the cloud.

## Page job
One working tool on one page: load a document → Gemini Nano marks private data on this device → review → only tokens pass to cloud Gemini → the answer comes back and is restored here → a log shows exactly what left the device.

## Direction — "PASS-THROUGH HATCH"
Grounded in the clean-room pass box: a stainless hatch in a wall between two rooms. Two doors, an interlock that never lets both open at once, a lamp over each door, and a cycle that runs before the far door unlocks. Here the left room is the device, the right room is the cloud, and the hatch is the leak guard. The document never crosses; tokens do.

## Unexpected pairing
Clean-room equipment vernacular (stainless panels, door lamps, interlock placards) used for a language-model privacy tool.

## Palette (cool, committed)
- `--steel` `#D6DCDE` — wall panel, page background
- `--panel` `#EEF1F1` — chamber inner surface
- `--ink` `#111518` — text, door frames
- `--lamp-go` `#137A43` — green lamp: on-device, guard passed, door open
- `--lamp-stop` `#C8321F` — red lamp: sealed, blocked, leak found
- `--cobalt` `#2A4FC2` — the cloud chamber and anything that crossed to it
Accent rule: lamps are functional only (state), cobalt only marks cloud-side things.

## Type
- Display / labels: **Oxanium** 600/700 — squared instrument-panel letterforms, as on equipment placards. Caps for chamber labels, letter-spacing .06em.
- Body / UI: **Inclusive Sans** 400/500 — plain, legible, unbranded.
- Tokens / values: **Fragment Mono** 400 — `[[PERSON_1]]` chips, ledger rows.

## Layout primitive
Two chambers and a hatch. Desktop: device chamber (7 cols) | hatch rail (1 col) | cloud chamber (4 cols). Mobile: chambers stacked, the hatch becomes a horizontal band between them. Every section repeats it: input → hatch → cloud task; restored answer; ledger rows with a device column and a cloud column.

## Motion personality
Mechanical, stepped. Hatch doors slide with `steps(6)`; lamps switch instantly (no glow fades); tokens pass through the hatch one by one on a 40 ms stagger. The hero entrance is a single interlock cycle: left door closes, lamp red → cycle bar → right lamp green. No fade-up anywhere. `prefers-reduced-motion`: states change without travel.

## Signature element
The hatch: a drawn stainless pass box (SVG illustration, also the hero image) with two door lamps. In the app, the hatch rail between chambers shows the guard's state and is the only place where text crosses sides.

## Ledger check
Differs from REDACTION FIELD (RedactGate 2026): background (steel, not vellum/vault-night), display (Oxanium, not Geist), accent (lamps + cobalt, not seal-cyan), signature (hatch, not token-chip carbon bar), motion (stepped door cycle, not sweep bar) — 5/5.
Closest cool-steel rows (TrayMath, nevod-video, IXIA gate rail): differ on display face, accent, signature, motion — ≥4/5.
Carbonless-form family (Ottawa Local Leads, 613 Pros, OriginProof, Gopniya) rejected on purpose.

## Forbidden
Geist, seal-cyan, vellum, cream + serif, purple gradients, glass, glow, uniform fade-up, card grid of features, stat banner.
