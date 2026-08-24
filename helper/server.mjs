import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prepareAmuseRelease } from "./amuse-automation.mjs";

const execFileAsync = promisify(execFile);
const PORT = 47831;
const HOST = "127.0.0.1";
const origins = new Set(["https://release.hiccastudios.my.id", "https://release-pilot.pages.dev"]);
let job = { state: "idle", message: "Helper siap.", updatedAt: new Date().toISOString() };
let active = null;
let pending = null;

const headers = origin => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origins.has(origin) ? origin : "https://release.hiccastudios.my.id",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
});

function send(response, status, data, origin) { response.writeHead(status, headers(origin)); response.end(JSON.stringify(data)); }
function update(state, message) { job = { state, message, updatedAt: new Date().toISOString() }; }
async function body(request) { const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>2_000_000)throw new Error("Payload terlalu besar");chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString("utf8")) }

async function chooseFolder() {
  const script = 'POSIX path of (choose folder with prompt "Pilih folder rilis berisi audio dan cover")';
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script]);
  return stdout.trim().replace(/\/$/, "");
}

function resolveFiles(folder, payload) {
  const entries = fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name);
  const exact = name => name ? path.join(folder, entries.find(entry => entry.toLocaleLowerCase("id") === String(name).toLocaleLowerCase("id")) || name) : "";
  const artworkName = payload.artworkFile || payload.artworkName || entries.find(name => /^(cover|artwork|front).+\.(?:jpe?g|png)$/i.test(name)) || entries.find(name => /\.(?:jpe?g|png)$/i.test(name));
  const tracks = (payload.tracks || []).map(track => exact(track.audioFile));
  const missing = tracks.map((file, index) => !file || !fs.existsSync(file) ? payload.tracks[index]?.audioFile || `track ${index + 1}` : null).filter(Boolean);
  const artwork = exact(artworkName);
  if (missing.length) throw new Error(`File audio tidak ditemukan: ${missing.join(", ")}`);
  if (!artwork || !fs.existsSync(artwork)) throw new Error("Cover artwork tidak ditemukan di folder utama.");
  return { tracks, artwork };
}

async function run(payload) {
  try {
    update("folder", "Pilih folder rilis pada dialog macOS…");
    const folder = await chooseFolder();
    const files = resolveFiles(folder, payload);
    pending = { payload, files };
    active = await prepareAmuseRelease({ payload, files, update });
  } catch (error) {
    update("error", error?.message || "Helper gagal menjalankan upload.");
  }
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "null";
  if (!origins.has(origin)) return send(response, 403, { error: "Origin ditolak." }, origin);
  if (request.method === "OPTIONS") { response.writeHead(204, headers(origin)); return response.end(); }
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { ok: true, job }, origin);
  if (request.method === "GET" && url.pathname === "/status") return send(response, 200, job, origin);
  if (request.method === "POST" && url.pathname === "/prepare") {
    if (!["idle", "review", "error", "needs_login"].includes(job.state)) return send(response, 409, { error: "Helper sedang bekerja.", job }, origin);
    try { const payload = await body(request); update("starting", "Memulai persiapan Amuse…"); void run(payload); return send(response, 202, job, origin); }
    catch (error) { return send(response, 400, { error: error?.message || "Payload tidak valid." }, origin); }
  }
  if (request.method === "POST" && url.pathname === "/continue") {
    if (!active?.needsLogin || !pending) return send(response, 409, { error: "Tidak ada sesi login yang menunggu." }, origin);
    void (async()=>{try{active=await prepareAmuseRelease({...pending,update,session:active})}catch(error){update("error",error?.message||"Gagal melanjutkan.")}})();
    return send(response, 202, job, origin);
  }
  return send(response, 404, { error: "Not found" }, origin);
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") console.error("Helper sudah aktif di jendela lain.");
  else console.error(`Helper gagal dimulai: ${error.message}`);
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => console.log(`Hicca Upload Helper aktif di http://${HOST}:${PORT}`));
