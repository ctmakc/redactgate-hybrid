import { initializeApp } from "firebase/app";
import { createModels, deviceAvailability, prepareDevice, run, assertTier } from "./hybrid";
// @ts-ignore: created locally from firebase-config.example.ts, git-ignored
import { firebaseConfig } from "./firebase-config.local";

const app = initializeApp(firebaseConfig);
const models = createModels(app);
const $ = (id: string) => document.getElementById(id)!;

async function refreshStatus() {
  $("device").textContent = `On-device model: ${await deviceAvailability()}`;
}

$("prepare").addEventListener("click", async () => {
  $("device").textContent = "Downloading on-device model...";
  try {
    await prepareDevice(models.local, (p) => ($("device").textContent = `Downloading ${Math.round(p * 100)}%`));
  } catch (e) {
    $("device").textContent = `On-device model not ready: ${(e as Error).message}`;
    return;
  }
  await refreshStatus();
});

async function ask(which: "local" | "cloud") {
  const prompt = ($("prompt") as HTMLTextAreaElement).value;
  const out = $("out");
  out.textContent = "...";
  try {
    const r = await run(models[which], prompt);
    assertTier(r, which === "local" ? "on_device" : "in_cloud");
    out.textContent = r.text;
    $("badge").textContent = `${r.source} · ${r.ms} ms`;
  } catch (e) {
    out.textContent = `Error: ${(e as Error).message}`;
    $("badge").textContent = "";
  }
}
$("local").addEventListener("click", () => ask("local"));
$("cloud").addEventListener("click", () => ask("cloud"));
refreshStatus();
