/**
 * diag_session.js — envío de sesiones de diagnóstico al receptor de la computadora (T2).
 *
 * Destino: receptor local de Claudia (tools/diag_receiver.mjs) publicado con un Cloudflare
 * Quick Tunnel. La URL del túnel cambia en cada encendido; tools/start_receiver.ps1 la anota
 * en un gist secreto, que esta app lee con la API pública de GitHub. El gist solo contiene la URL.
 *
 * Éxito = el receptor respondió 200 con ok:true y el MISMO SHA-256 de los bytes enviados.
 * Cualquier otra cosa es «pendiente» (se puede reintentar); nunca se informa éxito sin eso.
 */

export const RECEIVER_GIST_API = "https://api.github.com/gists/2b597cf390fcfde7a5c2809963806844";

/** SHA-256 hex de un texto (UTF-8). */
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { throw new Error(e && e.name === "AbortError" ? `sin respuesta en ${Math.round(ms / 1000)} s` : "sin conexión"); }
  finally { clearTimeout(to); }
}

/**
 * Busca el receptor activo: lee la URL del gist y comprueba /health.
 * Devuelve la URL o lanza un Error con un motivo legible.
 */
export async function discoverReceiver(gistApi = RECEIVER_GIST_API) {
  let url;
  try {
    // La API de GitHub responde con Cache-Control: public, max-age=60, s-maxage=60 (medido):
    // sin un parámetro único se puede recibir la dirección anterior hasta 60 s.
    const sep = gistApi.includes("?") ? "&" : "?";
    const r = await fetchWithTimeout(`${gistApi}${sep}t=${Date.now()}`,
      { cache: "no-store", headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const g = await r.json();
    const f = g.files && g.files["receiver.json"];
    url = f && JSON.parse(f.content).url;
  } catch (e) {
    throw new Error(`no se pudo leer la dirección del receptor (${e.message})`);
  }
  if (!url) throw new Error("el receptor de la computadora está apagado (si se acaba de encender, reintentá en unos segundos)");
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) {
    throw new Error("dirección de receptor no válida");
  }
  try {
    const h = await fetchWithTimeout(url + "/health", { cache: "no-store" }, 10000);
    const j = await h.json();
    if (!h.ok || !j.ok) throw new Error(`estado ${h.status}`);
  } catch (e) {
    throw new Error(`el receptor no responde (${e.message})`);
  }
  return url;
}

/**
 * Envía el cuerpo (texto JSON ya serializado) y confirma la recepción.
 * Devuelve { id, sha256, bytes, frames } o lanza Error (envío pendiente).
 */
export async function sendSession(receiverUrl, body, timeoutMs = 120000) {
  const local = await sha256Hex(body);
  let r, j;
  try {
    r = await fetchWithTimeout(receiverUrl + "/diag-session", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }, timeoutMs);
  } catch (e) {
    throw new Error(`envío fallido (${e.message})`);
  }
  try { j = await r.json(); } catch { throw new Error(`respuesta ilegible (estado ${r.status})`); }
  if (!r.ok || !j.ok) throw new Error(`el receptor rechazó la sesión (${r.status}: ${j.error || "?"})`);
  if (j.sha256 !== local) throw new Error("el receptor recibió datos distintos de los enviados");
  return { id: j.id, sha256: j.sha256, bytes: j.bytes, frames: j.frames };
}
