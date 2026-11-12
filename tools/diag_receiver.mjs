/**
 * diag_receiver.mjs — receptor local de sesiones de diagnóstico de la app (T2).
 *
 * Uso: node tools/diag_receiver.mjs [puerto]        (por defecto 8787, solo 127.0.0.1)
 * Normalmente se inicia con tools/start_receiver.ps1, que además abre el Quick Tunnel.
 *
 * Rutas:
 *   GET  /health        → { ok, service, version }    (para que la app compruebe el receptor)
 *   POST /diag-session  → guarda la sesión y responde { ok, id, sha256, bytes, frames }
 * No existe ninguna ruta que DEVUELVA lo guardado: quien conozca la URL puede enviar,
 * pero no leer. Los archivos quedan en diagnosticos/ (excluida de Git).
 *
 * Límites (acotan el abuso mientras el túnel está abierto):
 *   - cuerpo ≤ MAX_BYTES, JSON válido, kind = "rpi5-explorer-sesion"
 *   - 1 a MAX_FRAMES cuadros, cada uno PNG en data URL y ≤ MAX_FRAME_BYTES
 *   - como máximo MAX_PER_HOUR sesiones por hora
 * CORS: solo el origen de la app publicada y localhost.
 */
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LIMITS = Object.freeze({
  MAX_BYTES: 25 * 1024 * 1024,
  MAX_FRAMES: 12,
  MAX_FRAME_BYTES: 3 * 1024 * 1024,
  MAX_PER_HOUR: 20,
});
const VERSION = "receptor-1";
const ALLOWED_ORIGINS = ["https://cafka.github.io", "http://localhost:3000", "http://127.0.0.1:3000"];

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Valida la sesión. Devuelve null si es válida o un texto con el motivo del rechazo. */
export function validateSession(s) {
  if (!s || typeof s !== "object") return "cuerpo no es un objeto JSON";
  if (s.kind !== "rpi5-explorer-sesion") return "kind inesperado";
  if (typeof s.sessionId !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(s.sessionId)) return "sessionId inválido";
  if (!Array.isArray(s.frames) || s.frames.length < 1 || s.frames.length > LIMITS.MAX_FRAMES) return "cantidad de cuadros fuera de rango";
  for (const [i, f] of s.frames.entries()) {
    if (!f || typeof f.processedFramePng !== "string" || !f.processedFramePng.startsWith("data:image/png;base64,")) {
      return `cuadro ${i}: falta PNG`;
    }
    if (f.processedFramePng.length * 0.75 > LIMITS.MAX_FRAME_BYTES) return `cuadro ${i}: PNG demasiado grande`;
    if (!f.result || typeof f.result !== "object") return `cuadro ${i}: falta resultado`;
  }
  return null;
}

/** Crea el servidor. outDir y now son inyectables para las pruebas. */
export function createReceiver({ outDir = path.join(ROOT, "diagnosticos"), now = () => Date.now(), log = console.log } = {}) {
  mkdirSync(outDir, { recursive: true });
  const recent = [];

  const cors = (req, res) => {
    const o = req.headers.origin;
    if (o && ALLOWED_ORIGINS.includes(o)) {
      res.setHeader("Access-Control-Allow-Origin", o);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
  };
  const send = (res, code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  };

  return createServer((req, res) => {
    cors(req, res);
    const url = (req.url || "").split("?")[0];
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    if (req.method === "GET" && url === "/health") return send(res, 200, { ok: true, service: "rpi5-diag-receiver", version: VERSION });
    if (req.method !== "POST" || url !== "/diag-session") return send(res, 404, { ok: false, error: "no encontrado" });

    const t = now();
    while (recent.length && t - recent[0] > 3600_000) recent.shift();
    if (recent.length >= LIMITS.MAX_PER_HOUR) return send(res, 429, { ok: false, error: "demasiadas sesiones en la última hora" });

    const chunks = [];
    let size = 0, aborted = false;
    req.on("data", c => {
      if (aborted) return;
      size += c.length;
      if (size > LIMITS.MAX_BYTES) { aborted = true; send(res, 413, { ok: false, error: "sesión demasiado grande" }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (aborted) return;
      const body = Buffer.concat(chunks);
      let s;
      try { s = JSON.parse(body.toString("utf8")); } catch { return send(res, 400, { ok: false, error: "JSON inválido" }); }
      const bad = validateSession(s);
      if (bad) return send(res, 400, { ok: false, error: bad });

      const sha256 = createHash("sha256").update(body).digest("hex");
      const stamp = new Date(t).toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
      const id = `D${stamp}-${randomBytes(3).toString("hex")}`;
      const file = path.join(outDir, `${id}.json`);
      try {
        writeFileSync(file + ".tmp", body);
        renameSync(file + ".tmp", file);          // escritura atómica
      } catch (e) {
        return send(res, 500, { ok: false, error: "no se pudo guardar" });
      }
      recent.push(t);
      log(`[receptor] recibido ${id} · ${s.frames.length} cuadros · ${body.length} bytes · sha256 ${sha256.slice(0, 12)} · build ${s.build}`);
      send(res, 200, { ok: true, id, sha256, bytes: body.length, frames: s.frames.length });
    });
  });
}

// Ejecución directa
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8787);
  const logFile = process.argv[3];              // opcional: registro en archivo (lo usa start_receiver.ps1)
  const { appendFileSync } = await import("node:fs");
  const log = logFile ? (m => appendFileSync(logFile, `${new Date().toISOString()} ${m}\n`)) : console.log;
  createReceiver({ log }).listen(port, "127.0.0.1", () => {
    log(`[receptor] escuchando en http://127.0.0.1:${port} · guardando en diagnosticos/`);
  });
}
