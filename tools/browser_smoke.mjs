/**
 * browser_smoke.mjs — prueba simulada de la app en Chrome sin interfaz.
 *
 * Uso: node tools/browser_smoke.mjs <clip.y4m> <url> [segundos]
 *
 * Chrome usa el clip como cámara falsa. Se lee la línea de diagnóstico, se
 * pulsa «Congelar imagen» y «Volver a cámara» con los botones reales, y se
 * informa el estado. Categoría: SIMULADA (escritorio). No sustituye al teléfono.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [clip, url = "http://localhost:3000/", secs = "40"] = process.argv.slice(2);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(path.join(tmpdir(), "rpi5prof-"));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${clip}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result && r.result.result ? r.result.result.value : r;
}

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      target = list.find(t => t.type === "page");
    } catch {}
  }
  if (!target) throw new Error("Chrome no expuso un target de depuración");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await send("Page.enable");
  await send("Page.navigate", { url });

  const diag = () => evalJs(`(document.getElementById('diag-line')||{}).textContent`);
  let last = "";
  const deadline = Date.now() + Number(secs) * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    last = await diag();
    console.log("[diag]", last);
    if (/ETIQUETADA/.test(last) && /loc\/s/.test(last)) break;
    if (/ERROR/.test(last)) break;
  }

  // Opcional: comprobar que tocar la línea DIAGNÓSTICO activa el modo diagnóstico
  if (process.env.TOGGLE_TEST) {
    await evalJs(`document.getElementById('diag-line').click()`);
    let txt = "";
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      txt = await evalJs(`location.search + ' | ' + (document.getElementById('diag-line')||{}).textContent`);
      if (/MODO DEBUG/.test(txt || "") && /activo/.test(txt || "")) break;
    }
    console.log("[toque en la línea]", txt);
  }

  const stats = await evalJs(`JSON.stringify(window.getPerfStats ? window.getPerfStats() : null)`);
  console.log("[perf]", stats);

  // Congelar con el botón real
  await evalJs(`document.getElementById('btn-freeze').click()`);
  await sleep(800);
  const fr = await evalJs(`JSON.stringify({
    badge: document.getElementById('status-badge').textContent,
    resumeVisible: getComputedStyle(document.getElementById('btn-resume')).display !== 'none',
    freezeVisible: getComputedStyle(document.getElementById('btn-freeze')).display !== 'none',
    overlayPainted: (() => { const c = document.getElementById('canvas-overlay'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]) n++; return n; })(),
    debugPanel: [...document.querySelectorAll('#viewer div')].map(d => d.textContent).filter(t => t.startsWith('DEBUG · ')),
    debugCanvases: [...document.querySelectorAll('#viewer div canvas')].map(c => c.width + 'x' + c.height)
  })`);
  console.log("[congelado]", fr);

  // Opcional: guardar el diagnóstico exportable (mismo objeto que baja el botón del panel)
  if (process.env.SAVE_DIAG) {
    const diag = await evalJs(`JSON.stringify(window.buildDiagnostic ? window.buildDiagnostic() : null)`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.SAVE_DIAG, diag || "null");
    console.log("[diagnóstico guardado]", process.env.SAVE_DIAG, diag ? `${diag.length} bytes` : "null");
  }

  await evalJs(`document.getElementById('btn-resume').click()`);
  await sleep(4000);
  const rs = await evalJs(`JSON.stringify({
    badge: document.getElementById('status-badge').textContent,
    resumeVisible: getComputedStyle(document.getElementById('btn-resume')).display !== 'none',
    diag: document.getElementById('diag-line').textContent
  })`);
  console.log("[reanudado]", rs);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  setTimeout(() => process.exit(), 300);
}
