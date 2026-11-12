/**
 * t2_diag_session.test.mjs — envío de sesiones (app/diag_session.js) contra el receptor real
 * (tools/diag_receiver.mjs) y contra servidores que simulan fallos. Categoría: AUTOMÁTICA.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before, after } from "node:test";
import { createReceiver } from "../tools/diag_receiver.mjs";
import { discoverReceiver, sendSession, sha256Hex } from "../app/diag_session.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const body = JSON.stringify({ kind: "rpi5-explorer-sesion", sessionId: "S20261112T101010-a1b2c3", build: "t",
  frames: [{ t: 0, processedFramePng: PNG, result: { found: false, zones: [] } }] });

const listen = s => new Promise(r => s.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${s.address().port}`)));
let recv, recvUrl, outDir, liar, liarUrl, gist, gistUrl, gistContent;

before(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "rpi5sess-"));
  recv = createReceiver({ outDir, log: () => {} });
  recvUrl = await listen(recv);
  // Receptor que responde 200 pero con otro hash (no debe contarse como éxito)
  liar = createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200); return res.end('{"ok":true}'); }
    req.resume(); req.on("end", () => { res.writeHead(200); res.end('{"ok":true,"id":"X","sha256":"00","bytes":1,"frames":1}'); });
  });
  liarUrl = await listen(liar);
  // Gist simulado
  gist = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ files: { "receiver.json": { content: gistContent } } }));
  });
  gistUrl = await listen(gist);
});
after(() => { recv.close(); liar.close(); gist.close(); });

describe("diag_session.js", () => {
  it("sha256Hex coincide con el de Node", async () => {
    const { createHash } = await import("node:crypto");
    assert.equal(await sha256Hex(body), createHash("sha256").update(body).digest("hex"));
  });

  it("sendSession: recepción confirmada por el receptor real (mismo SHA-256 y archivo idéntico)", async () => {
    const ack = await sendSession(recvUrl, body);
    assert.match(ack.id, /^D\d{8}T\d{6}-[0-9a-f]{6}$/);
    assert.equal(readFileSync(path.join(outDir, ack.id + ".json"), "utf8"), body);
  });

  it("sendSession: si el receptor devuelve otro hash, NO es éxito", async () => {
    await assert.rejects(sendSession(liarUrl, body), /datos distintos/);
  });

  it("sendSession: receptor apagado → error (envío pendiente)", async () => {
    await assert.rejects(sendSession("http://127.0.0.1:9", body), /envío fallido/);
  });

  it("sendSession: sesión rechazada por validación → error con el motivo", async () => {
    await assert.rejects(sendSession(recvUrl, JSON.stringify({ kind: "otra" })), /rechazó la sesión \(400/);
  });

  it("discoverReceiver: gist con URL válida y receptor activo → devuelve la URL", async () => {
    gistContent = JSON.stringify({ url: recvUrl });
    assert.equal(await discoverReceiver(gistUrl), recvUrl);
  });

  it("discoverReceiver: gist sin URL → «apagado»", async () => {
    gistContent = JSON.stringify({ url: null, status: "detenido" });
    await assert.rejects(discoverReceiver(gistUrl), /apagado/);
  });

  it("discoverReceiver: URL ajena al túnel → rechazada", async () => {
    gistContent = JSON.stringify({ url: "https://evil.example.com" });
    await assert.rejects(discoverReceiver(gistUrl), /no válida/);
  });

  it("discoverReceiver: URL válida pero receptor que no responde → error", async () => {
    gistContent = JSON.stringify({ url: "http://127.0.0.1:9" });
    await assert.rejects(discoverReceiver(gistUrl), /no responde/);
  });
});

describe("app.js — recorrido de la sesión (código real, análisis estático)", () => {
  const app = readFileSync(path.join(ROOT, "app", "app.js"), "utf8");
  const trySend = app.slice(app.indexOf("async function trySend"), app.indexOf("btnDiag.addEventListener"));

  it("el mensaje de éxito aparece solo después de await sendSession", () => {
    const iSend = trySend.indexOf("await sendSession");
    const iOk = trySend.indexOf("✓ Recibido");
    assert.ok(iSend > 0 && iOk > iSend);
    assert.ok(!app.slice(0, app.indexOf("async function trySend")).includes("✓ Recibido"));
  });

  it("ante error el envío queda PENDIENTE con botón de reintento y sin borrar los datos", () => {
    const iCatch = trySend.indexOf("catch (e)");
    const after = trySend.slice(iCatch);
    assert.match(after, /Envío PENDIENTE/);
    assert.match(after, /retry: true/);
    assert.ok(!after.includes("_pending = null"), "un fallo no debe descartar la sesión");
  });

  it("congelar durante la grabación cancela la sesión", () => {
    assert.match(app, /cancelSession\("se congeló la imagen antes de terminar"\)/);
  });

  it("el cuadro guardado es el canvas de trabajo que analizó locate()", () => {
    assert.match(app, /processedFramePng: _work\.toDataURL\("image\/png"\)/);
    assert.match(app, /sessionCapture\(raw\);/);
  });
});
