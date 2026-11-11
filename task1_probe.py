"""
Task 1 — Prueba mínima: Prompt A (observación) y Prompt B (revisión + identidad).
Modelo: Qwen/Qwen3.5-9B via Together AI.
Uso: python task1_probe.py <ruta_imagen>

Requisitos:
  - API key de Together AI cargada en TOGETHER_API_KEY.
  - Together AI no ofrece prueba gratuita; requiere una carga mínima de
    USD 5 en créditos antes de poder hacer llamadas a la API.
  - pip install requests
"""

import sys
import base64
import json
import mimetypes
import os
import time
from datetime import datetime

import requests

# ── Configuración ─────────────────────────────────────────────────────────────

API_KEY    = os.environ.get("TOGETHER_API_KEY", "")
API_URL    = "https://api.together.ai/v1/chat/completions"
MODEL      = "Qwen/Qwen3.5-9B"
MAX_TOKENS = 1024

# MIME types reconocidos explícitamente como respaldo si mimetypes falla
_EXTENSION_MIME = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".bmp":  "image/bmp",
}

# ── Prompts ───────────────────────────────────────────────────────────────────

PROMPT_A_SYSTEM = """
Sos un agente de observación visual. Tu única tarea es describir lo que ves
en la imagen, sin inferir identidades ni proponer nombres de componentes.

Reglas estrictas:
- Describí forma, color, número de terminales o contactos visibles, posición
  en la imagen (zona: superior-izquierda, centro, etc.).
- Si hay texto o inscripciones legibles, transcribílas literalmente entre
  comillas. Si no son legibles con certeza, decilo explícitamente.
- No asignes dimensiones en milímetros ni en ninguna unidad si no hay una
  referencia de escala visible en la imagen.
- No uses nombres de componentes electrónicos (resistencia, condensador,
  LED, potenciómetro, etc.). Describí solo las características físicas.
- Si algo no es visible con claridad, decí que no es distinguible en lugar
  de inferirlo.
""".strip()

PROMPT_A_USER = "Describí todos los elementos visibles en esta imagen."

PROMPT_B_SYSTEM = """
Sos un agente de revisión e identificación. Recibís una imagen y un borrador
de descripción generado por otro agente. Tu tarea tiene dos partes:

PARTE 1 — REVISIÓN DEL BORRADOR:
Contrastá la descripción con la imagen directamente. Identificá:
- Afirmaciones del borrador que no podés confirmar desde la imagen.
- Errores u omisiones en la descripción.
- Elementos visibles en la imagen que el borrador no mencionó.
Tratá el borrador como un punto de partida a cuestionar, no como evidencia
comprobada.

PARTE 2 — IDENTIDAD PROPUESTA:
Para cada elemento del borrador que hayas confirmado o corregido, proponé
una identidad con estas reglas:
- Declarar explícitamente la evidencia de la imagen que sostiene la propuesta.
- Asignar un grado de confianza: alta / media / baja / no determinable.
  - alta: inscripción legible que coincide con una denominación conocida.
  - media: inscripción parcialmente legible o forma muy característica.
  - baja: solo forma genérica, sin inscripción.
  - no determinable: evidencia insuficiente.
- Si la inscripción no es legible con certeza, no propongas identidad basada
  en ella.
- No atribuyas un fabricante ni un número de parte sin inscripción que lo
  respalde.
""".strip()

# ── Funciones ─────────────────────────────────────────────────────────────────

def detect_mime(path: str) -> str:
    """
    Detecta el MIME type a partir de la extensión del archivo.
    Primero consulta el diccionario explícito; si no hay coincidencia,
    usa mimetypes de la biblioteca estándar. Si tampoco resuelve, lanza
    un error descriptivo en lugar de asumir image/jpeg.
    """
    ext = os.path.splitext(path)[1].lower()
    if ext in _EXTENSION_MIME:
        return _EXTENSION_MIME[ext]

    mime, _ = mimetypes.guess_type(path)
    if mime and mime.startswith("image/"):
        return mime

    raise ValueError(
        f"No se pudo determinar el MIME type de '{path}' "
        f"(extensión '{ext}' no reconocida). "
        "Renombrá el archivo con extensión .jpg, .png, .webp o .gif."
    )


def encode_image(path: str) -> tuple[str, str]:
    """Devuelve (base64_string, mime_type)."""
    mime = detect_mime(path)
    with open(path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode("utf-8")
    return b64, mime


def build_image_content(b64: str, mime: str) -> dict:
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime};base64,{b64}"},
    }


def call_model(messages: list, label: str) -> dict:
    if not API_KEY:
        raise ValueError(
            "TOGETHER_API_KEY no está configurada.\n"
            "  PowerShell: $env:TOGETHER_API_KEY='tu_clave'\n"
            "  CMD:        set TOGETHER_API_KEY=tu_clave\n\n"
            "Nota: Together AI no ofrece prueba gratuita. Es necesario cargar\n"
            "al menos USD 5 en créditos antes de poder usar la API."
        )

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "messages": messages,
    }

    print(f"\n[{label}] Enviando consulta al modelo...")
    t_start = time.time()
    response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
    t_elapsed = time.time() - t_start

    response.raise_for_status()
    data = response.json()

    usage   = data.get("usage", {})
    content = data["choices"][0]["message"]["content"]

    return {
        "label":              label,
        "model":              data.get("model", MODEL),
        "content":            content,
        "elapsed_seconds":    round(t_elapsed, 2),
        "prompt_tokens":      usage.get("prompt_tokens"),
        "completion_tokens":  usage.get("completion_tokens"),
        "total_tokens":       usage.get("total_tokens"),
        "raw_response":       data,
    }


def validate_prompt_a(result: dict) -> None:
    """
    Verifica que Prompt A devolvió contenido usable antes de pasarlo a B.
    Lanza RuntimeError con un mensaje descriptivo si falla.
    """
    content = result.get("content", "")
    if not content or not content.strip():
        raise RuntimeError(
            "Prompt A devolvió contenido vacío. "
            "No se puede continuar con Prompt B. "
            "Revisá los archivos JSON guardados para más detalles."
        )
    # Detectar respuestas de error conocidas de la API embebidas en el texto
    lower = content.lower()
    error_phrases = ["error", "i'm sorry", "lo siento", "cannot process"]
    for phrase in error_phrases:
        if phrase in lower and len(content.strip()) < 200:
            raise RuntimeError(
                f"Prompt A parece haber devuelto un mensaje de error "
                f"('{phrase}' encontrado en respuesta corta). "
                f"Contenido recibido:\n{content}\n"
                "No se puede continuar con Prompt B."
            )


def save_json(obj: dict, filename: str) -> None:
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print(f"  → Guardado: {filename}")


def print_result(result: dict) -> None:
    print(f"\n{'='*60}")
    print(f"  {result['label']}")
    print(f"  Modelo:   {result['model']}")
    print(f"  Tiempo:   {result['elapsed_seconds']} s")
    print(f"  Tokens:   prompt={result['prompt_tokens']}  "
          f"completion={result['completion_tokens']}  "
          f"total={result['total_tokens']}")
    print(f"{'='*60}")
    print(result["content"])


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python task1_probe.py <ruta_imagen>")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"No se encontró la imagen: {image_path}")
        sys.exit(1)

    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    b64, mime   = encode_image(image_path)
    img_content = build_image_content(b64, mime)
    print(f"Imagen: {image_path}  |  MIME detectado: {mime}")

    # ── Prompt A ──────────────────────────────────────────────────────────────
    messages_a = [
        {"role": "system", "content": PROMPT_A_SYSTEM},
        {"role": "user",   "content": [
            {"type": "text", "text": PROMPT_A_USER},
            img_content,
        ]},
    ]
    result_a = call_model(messages_a, "PROMPT A — Observación")
    print_result(result_a)
    save_json(result_a, f"task1_prompt_a_{timestamp}.json")

    # ── Validar Prompt A antes de continuar ───────────────────────────────────
    try:
        validate_prompt_a(result_a)
    except RuntimeError as e:
        print(f"\n[DETENIDO] {e}")
        sys.exit(1)

    print("\n[OK] Prompt A validado. Continuando con Prompt B...")

    # ── Prompt B ──────────────────────────────────────────────────────────────
    prompt_b_user = (
        "A continuación encontrás el borrador de descripción generado por "
        "otro agente. Contrastalo con la imagen adjunta y completá las dos "
        "partes indicadas en tus instrucciones.\n\n"
        "BORRADOR:\n"
        f"{result_a['content']}"
    )
    messages_b = [
        {"role": "system", "content": PROMPT_B_SYSTEM},
        {"role": "user",   "content": [
            {"type": "text", "text": prompt_b_user},
            img_content,
        ]},
    ]
    result_b = call_model(messages_b, "PROMPT B — Revisión e identidad")
    print_result(result_b)
    save_json(result_b, f"task1_prompt_b_{timestamp}.json")

    # ── Resumen de consumo ────────────────────────────────────────────────────
    total_tokens = (result_a["total_tokens"] or 0) + (result_b["total_tokens"] or 0)
    print(f"\n{'='*60}")
    print("  RESUMEN DE CONSUMO")
    print(f"{'='*60}")
    print(f"  Prompt A: {result_a['total_tokens']} tokens  "
          f"({result_a['elapsed_seconds']} s)")
    print(f"  Prompt B: {result_b['total_tokens']} tokens  "
          f"({result_b['elapsed_seconds']} s)")
    print(f"  Total:    {total_tokens} tokens")
    print(f"\n  Archivos guardados con timestamp: {timestamp}")
    print("  task1_prompt_a_<ts>.json — respuesta cruda de Prompt A")
    print("  task1_prompt_b_<ts>.json — respuesta cruda de Prompt B")


if __name__ == "__main__":
    main()
