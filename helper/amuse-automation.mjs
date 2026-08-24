import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const AMUSE_URL = "https://artist.amuse.io/";
const profileDir = path.join(os.homedir(), "Library", "Application Support", "Hicca Upload Helper", "chrome-profile");

async function visible(locator) {
  try { return await locator.first().isVisible({ timeout: 900 }); } catch { return false; }
}

async function clickAny(page, names) {
  for (const name of names) {
    const candidates = [page.getByRole("button", { name, exact: false }), page.getByRole("link", { name, exact: false }), page.getByText(name, { exact: false })];
    for (const candidate of candidates) if (await visible(candidate)) { await candidate.first().click(); return true; }
  }
  return false;
}

async function fillAny(page, labels, value) {
  if (value == null || value === "") return true;
  for (const label of labels) {
    const candidates = [page.getByLabel(label, { exact: false }), page.getByPlaceholder(label, { exact: false })];
    if (typeof label === "string") candidates.push(page.locator(`input[name*="${label.toLowerCase().replace(/\W+/g, "")}" i]`));
    for (const candidate of candidates) if (await visible(candidate)) { await candidate.first().fill(String(value)); return true; }
  }
  return false;
}

async function uploadByKind(page, filePath, kind) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const inputs = page.locator(`input[type="file"]${kind === "cover" ? "[accept*=image]" : ""}`);
  const count = await inputs.count();
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const accept = (await input.getAttribute("accept") || "").toLowerCase();
    if (kind === "cover" ? accept.includes("image") : !accept.includes("image")) { await input.setInputFiles(filePath); return true; }
  }
  return false;
}

function releaseFields(payload) {
  return payload.release || payload.form || {};
}

export async function prepareAmuseRelease({ payload, files, update, session = null }) {
  let context=session?.context, page=session?.page;
  if (!context || !page) {
    fs.mkdirSync(profileDir, { recursive: true });
    update("browser", "Membuka browser Amuse lokal…");
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: false,
      viewport: null,
      args: ["--start-maximized"],
    });
    page = context.pages()[0] || await context.newPage();
    await page.goto(AMUSE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
  }

  if (/login|sign-in|signin|auth/i.test(page.url()) || await visible(page.getByText(/sign in|log in|masuk/i))) {
    update("needs_login", "Silakan login ke Amuse di browser yang terbuka, lalu klik ‘Lanjutkan helper’ di Release Pilot.");
    return { context, page, needsLogin: true };
  }

  update("release", "Membuka Release Builder…");
  await clickAny(page, [/create.*release/i, /new.*release/i, /upload.*music/i, /release.*music/i]);
  await page.waitForTimeout(1500);
  const fields = releaseFields(payload);
  const titleFilled = await fillAny(page, [/release.*name/i, /release.*title/i, /judul.*rilis/i], fields.title);
  await fillAny(page, [/record label/i, /^label$/i], fields.primaryArtist || fields.label);
  const coverUploaded = await uploadByKind(page, files.artwork, "cover");

  const tracks = payload.tracks || [];
  let audioUploaded = 0;
  for (let index = 0; index < tracks.length; index += 1) {
    if (index > 0) { await clickAny(page, [/add.*track/i, /another.*track/i]); await page.waitForTimeout(600); }
    const track = tracks[index];
    if (await uploadByKind(page, files.tracks[index], "audio")) audioUploaded += 1;
    await fillAny(page, [/track.*title/i, /^title$/i], track.trackTitle);
    await fillAny(page, [/isrc/i], track.isrc);
    await fillAny(page, [/writer/i, /songwriter/i, /composer/i], track.songwriters);
  }

  const incomplete = [];
  if (!titleFilled) incomplete.push("judul rilis");
  if (!coverUploaded) incomplete.push("cover");
  if (audioUploaded < tracks.length) incomplete.push(`${tracks.length - audioUploaded} audio`);
  update("review", incomplete.length
    ? `Browser Amuse dibuka. Bagian yang perlu dilengkapi manual: ${incomplete.join(", ")}. Helper tidak menekan Submit Release.`
    : "Metadata dan aset dasar telah dimasukkan. Periksa semua halaman Amuse; helper berhenti sebelum Submit Release.");
  return { context, page, needsLogin: false };
}
