/**
 * t2_receiver.test.mjs — receptor real (tools/diag_receiver.mjs) en un puerto libre.
 * Categoría: AUTOMÁTICA (escritorio). No usa el túnel.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { createReceiver, LIMITS } from "../tools/diag_receiver.mjs";

const PNG1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const session = (extra = {}) => ({
  kind: "rpi5-explorer-sesion", sessionId: "S20261112-abc123", build: "test",
  frames: [{ t: 0, processedFramePng: PNG1x1, result: { found: false, zones: [] } }], ...extra,
});

let server, base, outDir, clock = 1_800_000_000_000;
before(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "rpi5recv-"));
  server = createReceiver({ outDir, now: () => clock, log: () => {} });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (body, headers = {}) => fetch(`${base}/diag-session`, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

describe("receptor de diagnóstico", () => {
  it("GET /health responde ok", async () => {
    const r = await fetch(`${base}/health`);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
  });

  it("guarda una sesión válida y devuelve id y SHA-256 de los bytes recibidos", async () => {
    const body = JSON.stringify(session());
    const r = await post(body);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.match(j.id, /^D\d{8}T\d{6}-[0-9a-f]{6}$/);
    assert.equal(j.sha256, createHash("sha256").update(body).digest("hex"));
    assert.equal(j.frames, 1);
    const saved = readFileSync(path.join(outDir, `${j.id}.json`), "utf8");
    assert.equal(saved, body, "lo guardado es exactamente lo recibido");
    assert.ok(!readdirSync(outDir).some(f => f.endsWith(".tmp")), "no quedan temporales");
  });

  it("no existe ruta para leer lo guardado", async () => {
    const r = await post(session());
    const { id } = await r.json();
    for (const u of [`/diag-session`, `/${id}.json`, `/diagnosticos/${id}.json`, `/`]) {
      const g = await fetch(base + u);
      assert.equal(g.status, 404, `GET ${u}`);
    }
  });

  it("rechaza JSON inválido, kind ajeno, sin cuadros y PNG ausente", async () => {
    assert.equal((await post("{no es json")).status, 400);
    assert.equal((await post(session({ kind: "otra-cosa" }))).status, 400);
    assert.equal((await post(session({ frames: [] }))).status, 400);
    assert.equal((await post(session({ frames: [{ result: {}, processedFramePng: "data:text/plain,x" }] }))).status, 400);
    assert.equal((await post(session({ sessionId: "../../etc" }))).status, 400);
  });

  it("rechaza demasiados cuadros", async () => {
    const frames = Array.from({ length: LIMITS.MAX_FRAMES + 1 }, () => session().frames[0]);
    assert.equal((await post(session({ frames }))).status, 400);
  });

  it("rechaza cuerpos mayores al límite (413)", async () => {
    const big = JSON.stringify(session({ pad: "x".repeat(LIMITS.MAX_BYTES + 10) }));
    let status;
    try { status = (await post(big)).status; } catch { status = "conexión cortada"; }
    assert.ok(status === 413 || status === "conexión cortada", `estado ${status}`);
  });

  it("CORS: permite el origen de la app y no otros", async () => {
    const ok = await fetch(`${base}/health`, { headers: { Origin: "https://cafka.github.io" } });
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://cafka.github.io");
    const no = await fetch(`${base}/health`, { headers: { Origin: "https://ejemplo.invalid" } });
    assert.equal(no.headers.get("access-control-allow-origin"), null);
  });

  it("limita la cantidad de sesiones por hora (429) y se libera al pasar la hora", async () => {
    let got429 = false;
    for (let i = 0; i < LIMITS.MAX_PER_HOUR + 2; i++) {
      if ((await post(session())).status === 429) { got429 = true; break; }
    }
    assert.ok(got429);
    clock += 3600_001;
    assert.equal((await post(session())).status, 200);
  });
});
