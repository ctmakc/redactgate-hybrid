import "./styles.css";
import { CLOUD_MODEL, deviceAvailability, type HybridResult } from "./tier";
import type { HybridModels } from "./hybrid";
import { DEMOS } from "./demos";
import { detectAll, type DetectReport } from "./core/detect";
import { NANO_SCHEMA } from "./core/nano";
import { findAll, mergeSpans } from "./core/merge";
import { Vault, redact, TOKEN_RE } from "./core/vault";
import { checkOutgoing, type Leak } from "./core/guard";
import { appendLedger, clearLedger, loadLedger, type LedgerEntry } from "./core/ledger";
import type { EntityType, Span } from "./core/types";

document.documentElement.classList.add("js");

// Firebase loads on first use (or when the browser is idle), so the page paints without waiting for the SDK.
type Hybrid = typeof import("./hybrid");
let hybridP: Promise<{ h: Hybrid; models: HybridModels }> | null = null;
function hybrid() {
  return (hybridP ??= Promise.all([
    import("firebase/app"),
    import("./hybrid"),
    // Created locally from firebase-config.example.ts; git-ignored.
    import("./firebase-config.local"),
  ]).then(([{ initializeApp }, h, { firebaseConfig }]) => ({
    h,
    models: h.createModels(initializeApp(firebaseConfig), { jsonSchema: NANO_SCHEMA }),
  })));
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const docEl = $<HTMLTextAreaElement>("doc");
const taskEl = $<HTMLInputElement>("task");

// ---------------- state ----------------
type NanoState = "checking" | "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";
let nanoState: NanoState = "checking";
let scannedText = "";
let report: DetectReport | null = null;
let manual: Span[] = [];
let spans: Span[] = [];
const off = new Set<string>();
let vault = new Vault();
let outgoing = "";
let guardOk = false;

const keyOf = (s: Span) => `${s.type}:${(s.canonical ?? s.text).trim().toLowerCase()}`;

// ---------------- Gemini Nano status ----------------
function setNano(state: NanoState, detail?: string) {
  nanoState = state;
  const lamp = $("lamp-device");
  const label: Record<NanoState, string> = {
    checking: "checking",
    available: "ready",
    downloadable: "not downloaded",
    downloading: detail ?? "downloading",
    unavailable: "unavailable here",
    unsupported: "not in this browser",
  };
  $("nano-state").textContent = label[state];
  lamp.dataset.state = state === "available" ? "go" : state === "downloading" || state === "checking" ? "busy" : state === "downloadable" ? "off" : "stop";
  $("nano-get").hidden = state !== "downloadable" && state !== "downloading";
  ($("nano-get") as HTMLButtonElement).disabled = state === "downloading";
  $("nano-get").textContent = state === "downloading" ? `Downloading Gemini Nano ${detail ?? ""}` : "Download Gemini Nano";
}

async function refreshNano() {
  const a = await deviceAvailability();
  setNano((["available", "downloadable", "downloading", "unavailable", "unsupported"].includes(a) ? a : "unavailable") as NanoState);
}

$("nano-get").addEventListener("click", async () => {
  setNano("downloading", "0%");
  try {
    const { h, models } = await hybrid();
    await h.prepareDevice(models.ner, (p) => setNano("downloading", `${Math.round(p * 100)}%`));
  } catch (e) {
    $("scan-meta").textContent = `Gemini Nano did not start: ${(e as Error).message}`;
  }
  await refreshNano();
});

// ---------------- demos and input ----------------
const demoBox = document.querySelector(".demos")!;
for (const d of DEMOS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "demo";
  b.dataset.demo = d.id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<b>${esc(d.title)}</b><span>${esc(d.hint)}</span>`;
  demoBox.append(b);
}
function loadDemo(id: string) {
  const d = DEMOS.find((x) => x.id === id);
  if (!d) return;
  docEl.value = d.text;
  taskEl.value = d.task;
  for (const b of demoBox.querySelectorAll<HTMLButtonElement>(".demo")) b.setAttribute("aria-pressed", String(b.dataset.demo === id));
  resetReview();
}
demoBox.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".demo");
  if (b?.dataset.demo) loadDemo(b.dataset.demo);
});
document.querySelector<HTMLAnchorElement>(".hero [data-demo]")?.addEventListener("click", (e) => {
  loadDemo((e.currentTarget as HTMLElement).dataset.demo!);
});

docEl.addEventListener("input", () => {
  if (report && docEl.value !== scannedText) resetReview();
});
taskEl.addEventListener("input", () => report && rebuild());
docEl.addEventListener("dragover", (e) => e.preventDefault());
docEl.addEventListener("drop", async (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  e.preventDefault();
  if (!/text|json|csv|markdown/.test(f.type) && !/\.(txt|md|csv|json|eml)$/i.test(f.name)) {
    $("scan-meta").textContent = "Only plain-text files for now (.txt, .md, .eml, .csv).";
    return;
  }
  docEl.value = await f.text();
  resetReview();
});

$("edit-doc").addEventListener("click", () => {
  resetReview();
  docEl.focus();
});

function resetReview() {
  $("doc-fld").hidden = false;
  $("edit-doc").hidden = true;
  report = null;
  manual = [];
  spans = [];
  off.clear();
  vault = new Vault();
  outgoing = "";
  $("step-review").hidden = true;
  $("custody").hidden = true;
  $("outgoing").innerHTML = `<span class="empty">The tokenized copy appears here after the scan.</span>`;
  $("out-meta").textContent = "";
  setGuard("idle", "Waiting for a document");
  ($("send") as HTMLButtonElement).disabled = true;
  ($("run-local") as HTMLButtonElement).disabled = true;
}

// ---------------- scan (on device only) ----------------
$("scan").addEventListener("click", async () => {
  const text = docEl.value;
  if (!text.trim()) {
    $("scan-meta").textContent = "Paste a document or pick a demo first.";
    docEl.focus();
    return;
  }
  const btn = $("scan") as HTMLButtonElement;
  btn.disabled = true;
  setGuard("busy", "Scanning on this device…");
  const useNano = nanoState === "available";
  $("scan-meta").textContent = useNano ? "Gemini Nano is reading on this device…" : "Running local patterns…";
  const t0 = performance.now();
  try {
    report = await detectAll(text, {
      nano: useNano ? async (prompt) => { const { h, models } = await hybrid(); return h.run(models.ner, prompt); } : undefined,
      onProgress: (d, t) => ($("scan-meta").textContent = `Gemini Nano: part ${d} of ${t} on this device…`),
    });
  } finally {
    btn.disabled = false;
  }
  if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __report: unknown }).__report = report;
  scannedText = text;
  manual = [];
  off.clear();
  const ms = Math.round(performance.now() - t0);
  const n = report.nano;
  $("scan-meta").innerHTML =
    n.status === "ok"
      ? `<span class="tier tier-dev">on_device</span> Gemini Nano found ${n.found} in ${(n.ms / 1000).toFixed(1)} s · patterns ${report.regexHits}`
      : n.status === "error"
        ? `Gemini Nano stopped (${esc(n.error ?? "error")}). Patterns only: ${report.regexHits} found. Nothing was sent anywhere.`
        : `Patterns only (${report.regexHits} found in ${ms} ms). ${nanoState === "downloadable" ? "Download Gemini Nano to also catch names and addresses." : "Gemini Nano is not available in this browser, so names may be missed: select them to hide."}`;
  rebuild();
  $("step-review").hidden = false;
  $("custody").hidden = false;
  $("doc-fld").hidden = true;
  $("edit-doc").hidden = false;
  $("step-review").scrollIntoView({ block: "start" });
});

// ---------------- review ----------------
function rebuild() {
  if (!report) return;
  const text = scannedText;
  const manualSpread: Span[] = [];
  for (const m of manual) for (const h of findAll(text, m.text)) manualSpread.push({ ...m, start: h, end: h + m.text.length });
  spans = mergeSpans([...report.spans, ...manualSpread]);
  renderDoc(text);

  const active = spans.filter((s) => !off.has(keyOf(s)));
  vault = new Vault();
  const docR = redact(text, active, vault);
  // The task is typed by the user: hide any known value in it as well.
  const task = taskEl.value.trim() || "Summarize this document in three bullet points.";
  const taskSpans: Span[] = [];
  for (const e of vault.entries()) for (const h of findAll(task, e.value)) taskSpans.push({ start: h, end: h + e.value.length, type: e.type, text: e.value, source: "manual" });
  const taskR = redact(task, mergeSpans(taskSpans), vault);
  outgoing = `Task: ${taskR.text}\n\nDocument:\n${docR.text}`;
  const g = checkOutgoing(outgoing, vault);
  guardOk = g.ok;
  renderOutgoing();
  renderCustody(active);
  if (g.ok) setGuard("ok", `Guard passed: ${vault.size} values stay here`);
  else setGuard("blocked", `Door stays shut: ${g.leaks.length} private value${g.leaks.length > 1 ? "s" : ""} would leave`, g.leaks);
  ($("send") as HTMLButtonElement).disabled = !g.ok;
  ($("run-local") as HTMLButtonElement).disabled = nanoState !== "available";
}

function renderDoc(text: string) {
  let html = "";
  let pos = 0;
  const legend = new Map<string, number>();
  for (const s of spans) {
    html += esc(text.slice(pos, s.start));
    const k = keyOf(s);
    const on = !off.has(k);
    if (on) legend.set(s.type, (legend.get(s.type) ?? 0) + 1);
    html += `<button type="button" class="pii" data-k="${esc(k)}" data-t="${s.type}" data-src="${s.source}" aria-pressed="${on}" title="${s.type} · found by ${s.source === "nano" ? "Gemini Nano" : s.source === "alias" ? "name match" : s.source}">${esc(text.slice(s.start, s.end))}</button>`;
    pos = s.end;
  }
  html += esc(text.slice(pos));
  $("doc-view").innerHTML = html;
  $("legend").innerHTML = [...legend].map(([t, n]) => `<span>${t}<b>×${n}</b></span>`).join("");
}

$("doc-view").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".pii");
  if (!b) return;
  const k = b.dataset.k!;
  if (off.has(k)) off.delete(k);
  else off.add(k);
  rebuild();
});

let selText = "";
function onSelect() {
  const sel = window.getSelection();
  const t = sel?.toString().trim() ?? "";
  if (t.length >= 2 && t.length <= 80 && !t.includes("\n") && sel?.anchorNode && $("doc-view").contains(sel.anchorNode)) {
    selText = t;
    $("sel-text").textContent = t;
    $("selbar").hidden = false;
  }
}
$("doc-view").addEventListener("mouseup", onSelect);
$("doc-view").addEventListener("keyup", onSelect);
$("doc-view").addEventListener("touchend", () => setTimeout(onSelect, 50));
$("sel-add").addEventListener("click", () => {
  if (!selText) return;
  manual.push({ start: 0, end: 0, type: ($("sel-type") as HTMLSelectElement).value as EntityType, text: selText, source: "manual" });
  selText = "";
  $("selbar").hidden = true;
  window.getSelection()?.removeAllRanges();
  rebuild();
});

function tokHtml(text: string, cls = "tok") {
  let i = 0;
  return esc(text).replace(new RegExp(TOKEN_RE.source, "g"), (w) => `<span class="${cls}" style="--i:${i++}">${w}</span>`);
}

function renderOutgoing() {
  $("outgoing").innerHTML = tokHtml(outgoing);
  $("out-meta").textContent = `${outgoing.length.toLocaleString()} characters · ${vault.size} tokens · model ${CLOUD_MODEL}`;
}

function renderCustody(active: Span[]) {
  const src = new Map<string, string>();
  for (const s of active) {
    const k = keyOf(s);
    if (!src.has(k) || s.source === "nano" || s.source === "manual") src.set(k, s.source);
  }
  const CHECKED = new Set(["SIN", "SSN", "EIN", "ITIN", "CREDIT_CARD", "IBAN", "HEALTH_CARD"]);
  const name = (s: string | undefined, type: string) =>
    s === "nano" ? "Gemini Nano" : s === "regex" ? (CHECKED.has(type) ? "pattern + checksum" : "pattern") : s === "manual" ? "you" : s === "alias" ? "name match" : "—";
  $("vault-rows").innerHTML = vault
    .entries()
    .map((e) => `<tr><td>[[${e.token}]]</td><td>${esc(e.value)}</td><td>${name(src.get(`${e.type}:${e.value.trim().toLowerCase()}`), e.type)}</td></tr>`)
    .join("");
  $("tok-list").innerHTML = vault.entries().map((e) => `<li class="tok">[[${e.token}]]</li>`).join("");
  $("goes-meta").textContent = `${outgoing.length.toLocaleString()} characters of tokenized text and the task. No real values.`;
}

function setGuard(state: "idle" | "busy" | "ok" | "blocked", text: string, leaks: Leak[] = []) {
  $("guard").dataset.state = state;
  $("guard-text").textContent = text;
  const ul = $("leaks");
  ul.hidden = leaks.length === 0;
  ul.innerHTML = leaks.map((l) => `<li>${l.type}${l.reason === "regex" ? " pattern" : ""} in outgoing text</li>`).join("") + (leaks.length ? "<li>Hide it again to open the door.</li>" : "");
}

// ---------------- send / run ----------------
function cycleDoors() {
  const rig = document.querySelector<HTMLElement>(".rig")!;
  rig.dataset.cycle = "on";
  setTimeout(() => (rig.dataset.cycle = "off"), 1400);
}

$("send").addEventListener("click", async () => {
  if (!guardOk || !report) return;
  const sent = outgoing;
  const used = vault;
  const g = checkOutgoing(sent, used);
  if (!g.ok) return setGuard("blocked", "Door stays shut", g.leaks);
  const btn = $("send") as HTMLButtonElement;
  btn.disabled = true;
  cycleDoors();
  setGuard("busy", "Cloud Gemini is working on the tokens…");
  let r: HybridResult;
  try {
    const { h, models } = await hybrid();
    r = await h.run(models.cloud, sent);
    if (r.source !== "in_cloud") throw new Error(`expected in_cloud, got ${r.source}`);
  } catch (e) {
    setGuard("blocked", `Cloud call failed: ${(e as Error).message.slice(0, 160)}`);
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  setGuard("ok", `Answer back in ${(r.ms / 1000).toFixed(1)} s, filled in here`);
  showAnswer(r, used);
  const counts: Record<string, number> = {};
  for (const e of used.entries()) counts[e.type] = (counts[e.type] ?? 0) + 1;
  log({ tier: "in_cloud", model: CLOUD_MODEL, sent, tokensByType: counts, inferenceSource: r.source, ms: r.ms });
});

$("run-local").addEventListener("click", async () => {
  if (!report) return;
  const btn = $("run-local") as HTMLButtonElement;
  btn.disabled = true;
  setGuard("busy", "Gemini Nano is answering on this device…");
  const task = taskEl.value.trim() || "Summarize this document in three bullet points.";
  try {
    const { h, models } = await hybrid();
    const r = await h.run(models.local, `${task}\n\nDocument:\n${scannedText}`);
    if (r.source !== "on_device") throw new Error(`expected on_device, got ${r.source}`);
    showAnswer(r, null);
    setGuard(guardOk ? "ok" : "blocked", `Answered on this device in ${(r.ms / 1000).toFixed(1)} s. Nothing left.`);
    log({ tier: "on_device", model: "gemini-nano", sent: "", tokensByType: {}, inferenceSource: r.source, ms: r.ms });
  } catch (e) {
    setGuard("blocked", `Gemini Nano failed: ${(e as Error).message.slice(0, 160)}`);
  } finally {
    btn.disabled = nanoState !== "available";
  }
});

let finalText = "";
/** Light, safe touch-up of already-escaped answer HTML: **bold** and "* " bullets. */
function tidy(html: string): string {
  return html
    .replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>")
    .replace(/^[ \t]*[*•][ \t]+/gm, "– ")
    .replace(/^#{1,4}[ \t]+/gm, "");
}

function showAnswer(r: HybridResult, used: Vault | null) {
  $("answer").hidden = false;
  const raw = $("raw-tier");
  raw.textContent = r.source;
  raw.className = r.source === "on_device" ? "tier tier-dev" : "tier";
  $("ans-raw").innerHTML = tokHtml(r.text);
  let html = "";
  let plain = "";
  let pos = 0;
  let restored = 0;
  const unknown = new Set<string>();
  for (const m of r.text.matchAll(new RegExp(TOKEN_RE.source, "g"))) {
    html += esc(r.text.slice(pos, m.index));
    plain += r.text.slice(pos, m.index);
    const e = used?.lookup(m[1]);
    if (e) {
      html += `<mark title="${m[1]}">${esc(e.value)}</mark>`;
      plain += e.value;
      restored++;
    } else {
      unknown.add(m[1]);
      html += esc(m[0]);
      plain += m[0];
    }
    pos = m.index! + m[0].length;
  }
  html += esc(r.text.slice(pos));
  plain += r.text.slice(pos);
  finalText = plain.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  $("ans-final").innerHTML = tidy(html);
  const w = $("ans-warn");
  w.hidden = unknown.size === 0;
  w.textContent = unknown.size ? `The model wrote ${[...unknown].map((t) => `[[${t}]]`).join(", ")}, which this device never issued. Left as is.` : "";
  $("ans-meta").textContent = used ? `${restored} token${restored === 1 ? "" : "s"} filled in on this device` : "Computed on this device; nothing was sent.";
  $("answer").scrollIntoView({ block: "start" });
}

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(finalText);
  $("ans-meta").textContent = "Copied.";
});

// ---------------- ledger ----------------
function log(p: Pick<LedgerEntry, "tier" | "model" | "sent" | "tokensByType" | "inferenceSource" | "ms">) {
  appendLedger({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    task: taskEl.value.trim().slice(0, 140),
    sentChars: p.sent.length,
    guard: "passed",
    ...p,
  });
  renderLedger();
}

function renderLedger() {
  const rows = loadLedger();
  const ol = $("led-rows");
  if (!rows.length) {
    ol.innerHTML = `<li class="led-empty">Nothing has left this device yet.</li>`;
    return;
  }
  ol.innerHTML = rows
    .slice()
    .reverse()
    .map((e) => {
      const when = new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const counts = Object.entries(e.tokensByType).map(([t, n]) => `${t} ${n}`).join(" · ");
      const what = e.tier === "in_cloud"
        ? `<details><summary>Sent ${e.sentChars.toLocaleString()} characters: ${esc(e.task || "task")}</summary><pre>${tokHtml(e.sent)}</pre></details>`
        : `<span>Nothing sent: ${esc(e.task || "task")} ran on Gemini Nano</span>`;
      return `<li><span class="when">${when}</span><span><span class="tier ${e.tier === "on_device" ? "tier-dev" : ""}">${esc(e.inferenceSource)}</span></span><div>${what}</div><span class="counts">${counts || "0 tokens"}<br>${e.ms} ms</span></li>`;
    })
    .join("");
}

$("led-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadLedger(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `redactgate-hybrid-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("led-clear").addEventListener("click", () => {
  clearLedger();
  renderLedger();
});

// ---------------- page motion ----------------
const io = new IntersectionObserver(
  (es) => es.forEach((x) => x.isIntersecting && (x.target.classList.add("in"), io.unobserve(x.target))),
  { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".custody, .answer, .ledger, .how").forEach((el) => {
  el.classList.add("reveal");
  io.observe(el);
});
const sticky = $("sticky");
const onScroll = () => {
  sticky.classList.toggle("show", window.scrollY > window.innerHeight * 0.8);
  const ready = !($("send") as HTMLButtonElement).disabled;
  sticky.textContent = ready ? "Demo: go to the hatch" : "Run the demo";
  sticky.setAttribute("href", ready ? "#guard" : "#device");
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

renderLedger();
refreshNano();
// Warm the SDK once the page is idle, so the first click does not wait for it.
(window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2500)))(() => void hybrid(), { timeout: 6000 });
