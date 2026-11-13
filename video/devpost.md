# Devpost submission: RedactGate Hybrid

## Name
RedactGate Hybrid

## Elevator pitch (≤200 chars)
Gemini Nano finds private details on your device and swaps them for tokens. Cloud Gemini works only with tokens. The answer is filled in locally, and a log shows exactly what left.

## Story (markdown)

## Inspiration

Accountants, clinic staff, recruiters and lawyers paste client documents into AI chat every day: a tax email with a social insurance number, a discharge note with a health card number, a résumé with a home address. The cloud model does a great job, and the private details travel with the text to a server the client never agreed to.

We built RedactGate, a server-side redaction gateway, last year. It needs a server and an admin. Firebase AI Logic hybrid inference made a better shape possible: the detection can run inside the user's own browser with Gemini Nano, so the raw document never has to leave the device at all.

## What it does

RedactGate Hybrid is a pass-through hatch for AI prompts, like the sealed box between a clean room and a corridor: one door opens at a time.

1. **Device room.** Paste a document or pick a demo (client email to an accountant, clinic discharge note, résumé) and type what the AI should do with it.
2. **Find, on the device.** Gemini Nano reads the text in Chrome and returns names, organizations, addresses and dates as JSON. Checksum-verified patterns catch structured IDs at the same time (Canadian SIN, Ontario health card, credit cards with Luhn, IBAN mod-97, US SSN/ITIN/EIN, phones, emails).
3. **Review.** Every finding is highlighted with what found it. Tap a highlight to let it through, or select any text to hide it too.
4. **Swap for tokens.** Each value becomes a stable token like `[[PERSON_1]]`; aliases share one token ("Elena" and "Elena Ricci"). The table of real values stays in tab memory.
5. **Interlocked door.** Before the cloud door opens, a leak guard re-scans the outgoing text for every real value and every pattern. One hit keeps the send button disabled.
6. **Cloud room.** The exact tokenized text that will be sent is shown. Gemini 3.5 Flash-Lite does the task in the cloud with tokens only.
7. **Fill in, on the device.** The answer comes back with tokens; the real values are put back locally. Tokens the model invented are flagged.
8. **Ledger.** Every run is logged in the browser: tier, model, `inferenceSource`, token counts by type, and for cloud runs the exact text that left. Export as JSON.
9. **Keep it here.** For documents that should not leave at all, one click answers the whole task with Gemini Nano on the device.

## How we built it

- **Firebase AI Logic, two fixed modes.** Three model handles from `getGenerativeModel` with the hybrid API: an `ONLY_ON_DEVICE` model for detection with a `responseConstraint` JSON schema, an `ONLY_ON_DEVICE` model for the local answer, and an `ONLY_IN_CLOUD` model (`gemini-3.5-flash-lite`, Gemini Developer API) for the task. We do not use `PREFER_ON_DEVICE`: a preference mode could fall back to the cloud with the raw document when Nano is missing. Here the raw text only ever meets on-device models, and the cloud model only ever receives text that passed the guard.
- **`inferenceSource` is enforced, not just displayed.** Every response is checked; a cloud answer that reports any other source is rejected, and so is a "local" answer that did not run on the device.
- **No Nano, no cloud stand-in.** If Gemini Nano is not available, the patterns still run and the page says what was not checked. The cloud never does the detection.
- **Firebase App Check** with a reCAPTCHA Enterprise key guards the AI Logic endpoint; enforcement is on.
- **Firebase Hosting** serves the app. The Firebase SDK loads lazily when the browser is idle, so the page paints first (Lighthouse 100 in all four categories on desktop).
- **Nano detection details.** Long documents are split on paragraph boundaries into chunks that keep their offsets; Nano returns entity strings, which are located back in the text verbatim (anything Nano reports that is not in the text is dropped and counted); a full Nano address beats pattern fragments inside it; other overlaps are settled by priority (manual > validated pattern > Nano > alias).
- Vite + TypeScript, no UI framework. 27 unit tests (vitest) cover validators, merge, vault, guard and tier checks.

## Challenges we ran into

- **Nano returns strings, not offsets.** We had to locate each entity in the original text robustly (case, line breaks, repeated names) without letting a short name swallow a longer match.
- **Merging two detectors.** Patterns are precise on IDs; Nano is good at names and addresses and sometimes returns a whole address that contains a postal code the pattern also found. The merge rules decide who wins.
- **Honest fallbacks.** The easy path is "if Nano fails, ask the cloud". That would defeat the point, so every failure path keeps the raw text local and says so in the UI.
- **Cold start.** The first Nano session can take a while; the scan shows progress per chunk.

## Accomplishments that we're proud of

- The raw document never meets a cloud model in any code path, and the UI shows the proof: the cloud room renders the exact outgoing text, and the ledger keeps it.
- The interlock: you can try to let a SIN through and watch the door stay shut.
- It works on real documents in seconds, with the real values filled back into a useful answer.

## What we learned

Hybrid inference is most valuable when the two tiers do different jobs. Nano is small, but it is exactly the right size for "find the private parts of this text", and that job is the one that must not leave the device. The large model in the cloud is then free to do the heavy work on text that has nothing private left in it.

## What's next for RedactGate Hybrid

- A Chrome extension that puts the hatch in front of any AI chat box.
- French and Ukrainian detection (our users in Canada write in both).
- Team policies through Remote Config (which types must always be hidden).
- Export of the ledger for privacy audits.

## Prior work

RedactGate Hybrid builds on RedactGate (https://github.com/ctmakc/redactgate), our earlier self-hosted Python redaction gateway (AGPL). Reused ideas, re-implemented in TypeScript for the browser: the token format, checksum validators and the restore step. Everything else was built during the submission period: Gemini Nano detection through Firebase AI Logic, the merge, the cloud step with the `inferenceSource` check, the leak guard, the review UI, the local-only answer, the ledger, App Check and the whole web app. The repository started from a generic Firebase AI Logic starter we prepared on 2026-11-04 (no product code).

## Built with
firebase-ai-logic, gemini-nano, gemini, firebase-hosting, firebase-app-check, recaptcha-enterprise, typescript, vite, vitest, chrome

## Links
- Live demo: https://redactgate-hybrid-2026.web.app
- Code: https://github.com/ctmakc/redactgate-hybrid
- Video: (YouTube)

## Platform
Web (Chrome)
