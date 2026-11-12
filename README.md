# RedactGate Hybrid

Private details stay on your device. Only tokens reach the cloud.

**Live demo:** https://redactgate-hybrid-2026.web.app (desktop Chrome with Gemini Nano for the full flow)

RedactGate Hybrid is a pass-through hatch for AI prompts. You paste a document (a client email, a
clinic note, a résumé) and ask for help with it. Gemini Nano, running in the browser through
Firebase AI Logic, finds the names, organizations, addresses and numbers and swaps each one for a
token such as `[[PERSON_1]]`. Cloud Gemini receives only the tokenized copy. Its answer comes back
and the real values are filled in on the device. A log in the browser records exactly what left.

Built for the #BuildHybridAI hackathon (Firebase AI Logic hybrid inference).

## How the hybrid split works

| Step | Where it runs | Firebase AI Logic mode |
|---|---|---|
| 1. Find private details (names, orgs, addresses, dates) | Gemini Nano, on device | `ONLY_ON_DEVICE` + `responseConstraint` JSON schema |
| 1b. Find structured IDs (SIN, OHIP, cards, IBAN, SSN, phones…) | Checksum-verified patterns, on device | none (plain TypeScript) |
| 2. Swap values for stable tokens, keep the table in tab memory | On device | none |
| 3. Leak guard re-scans the outgoing text for every real value and pattern | On device | none |
| 4. Do the task (summarize, draft a reply, review) on the tokenized text | Cloud Gemini (`gemini-3.5-flash-lite`) | `ONLY_IN_CLOUD` |
| 5. Fill the real values back into the answer, flag made-up tokens | On device | none |
| Alt. Keep everything local: the whole task answered by Nano | Gemini Nano, on device | `ONLY_ON_DEVICE` |

Design choices:

- **Two fixed modes, no `PREFER_*`.** A preference mode could silently send raw text to the cloud
  when Nano is missing. Here the raw document only ever meets `ONLY_ON_DEVICE` models; the cloud
  model only ever receives text that passed the guard.
- **`inferenceSource` is checked, not just shown.** Each answer carries a badge from
  `response.inferenceSource`, and a cloud answer that reports any other source is rejected.
- **No Nano, no cloud stand-in.** If Gemini Nano is unavailable, the patterns still run and the
  page says what was not checked. The cloud never does the detection.
- **The door is interlocked.** One leak (a real value or a pattern hit in the outgoing text)
  keeps the send button disabled until the user hides it again.
- **Human in the loop.** Every highlight can be let through or hidden; any selected text can be
  hidden as a new value.
- **Local ledger.** Each run is written to `localStorage` with the tier, model, token counts by
  type, `inferenceSource`, time, and for cloud runs the exact text that was sent. Export as JSON.

## Prior work and what is new

This project builds on **[RedactGate](https://github.com/ctmakc/redactgate)**, our earlier
self-hosted redaction gateway (Python server, OpenAI-compatible proxy, AGPL), by the same author.

Reused ideas, re-implemented in TypeScript for the browser: the token format, the checksum
validators (Luhn, SIN, IBAN mod-97, SSN/ITIN/EIN ranges, OHIP) and the restore step.

New in this project, written during the hackathon:

- detection of names, organizations and addresses by **Gemini Nano on the device**, through
  Firebase AI Logic `ONLY_ON_DEVICE` with a JSON schema constraint, chunking and span location;
- the merge of Nano and pattern findings (a full Nano address beats the pattern pieces inside it,
  name aliases are linked so "Elena" and "Elena Ricci" share one token);
- the cloud step through Firebase AI Logic `ONLY_IN_CLOUD`, with the `inferenceSource` check;
- the outgoing leak guard, the review UI, the local-only Nano answer path, and the ledger;
- the whole web app and its design (Vite + TypeScript, no framework).

The repository started from a generic Firebase AI Logic starter we prepared on 2026-11-04 (model
handles, `run()`, `assertTier()`, four unit tests, no product code).

## Run it locally

Requirements: Node 20+, desktop Chrome with the Prompt API (Gemini Nano). In Chrome, open
`chrome://on-device-internals` to check the model state.

```bash
npm install
cp src/firebase-config.example.ts src/firebase-config.local.ts   # paste your Firebase web config
npm test          # 27 unit tests, no network
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build into dist/
```

Firebase setup: a Firebase project with **AI Logic** enabled on the **Gemini Developer API**
(free tier, Spark plan), and a web app registered for its config. `firebase-config.local.ts` is
git-ignored.

Demo documents in the app are fictional.

## Layout

```
src/tier.ts           Nano availability check, result types (no Firebase import)
src/hybrid.ts         Firebase AI Logic model handles: ner + local (ONLY_ON_DEVICE), cloud (ONLY_IN_CLOUD)
src/core/regex.ts     pattern rules; validators.ts holds the checksums
src/core/nano.ts      Nano prompt, JSON schema, chunking, span location
src/core/merge.ts     merge of Nano and pattern spans
src/core/vault.ts     tokens, redact, restore
src/core/guard.ts     outgoing leak guard
src/core/ledger.ts    local log of what left the device
src/main.ts           the app
test/                 vitest suites
```

## Limits

- Gemini Nano runs in desktop Chrome only for now; on other browsers the patterns still run.
- Detection is English-first. Nano can miss a value; the review step is there for that.
- The token table lives in tab memory and is gone on reload, by design.

## License

MIT, see [LICENSE](LICENSE).
