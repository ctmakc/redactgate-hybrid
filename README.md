# Firebase AI Logic hybrid starter (#BuildHybridAI prep)

Generic boilerplate prepared on 2026-11-04, before the official rules (due 2026-11-09). It holds
no product feature code. RedactGate Hybrid features (regex packs, on-device entity extraction,
tokenization, re-inflation, benchmark) are to be written after the rules are read, in a new
repository if the rules require a new project. If the rules ask for disclosure of pre-existing
code, disclose this starter.

## What it does

- `src/hybrid.ts`: two model handles on Firebase AI Logic with the Gemini Developer API backend.
  - `local`: `ONLY_ON_DEVICE` (Chrome Prompt API, Gemini Nano). No cloud fallback. Optional
    JSON schema through `onDeviceParams.promptOptions.responseConstraint`.
  - `cloud`: `ONLY_IN_CLOUD`, model `gemini-3.5-flash-lite`.
  - `PREFER_*` modes are left out on purpose, because they can switch tiers silently.
  - `run()` returns text, `inferenceSource` and elapsed time; `assertTier()` stops when the
    answer came from the wrong tier.
  - `prepareDevice()` starts the Gemini Nano download and must be called from a click.
- `index.html` + `src/main.ts`: a page with a model-status line, a download button, and
  "run on device only" / "run in cloud only" buttons with a tier badge.
- `test/hybrid.test.ts`: unit tests for the wrapper with a fake model (no network).

## Firebase project

`redactgate-hybrid-2026` on ctmakc@gmail.com: Spark plan, billing disabled, AI Logic enabled
with the Gemini Developer API (setup notes in GrantOps card bf9494a1). Do not link a billing
account. Firebase Hosting on Spark is enough for a demo URL.

## Run

```bash
npm install
cp src/firebase-config.example.ts src/firebase-config.local.ts   # paste the web apiKey
npm test
npm run dev            # Chrome desktop; Gemini Nano downloads after "Prepare on-device model"
```
