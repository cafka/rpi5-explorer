<#
  start_receiver.ps1 — enciende el receptor de diagnósticos y lo publica para la app.

  Uso (en esta computadora):
    powershell -ExecutionPolicy Bypass -File tools/start_receiver.ps1

  Pasos:
    1. Inicia tools/diag_receiver.mjs en 127.0.0.1:8787 (guarda en diagnosticos/).
    2. Abre un Cloudflare Quick Tunnel (sin cuenta) hacia ese puerto.
    3. Comprueba /health A TRAVÉS del túnel.
    4. Anota la URL del túnel en el gist secreto que lee la app (solo la URL; nunca datos).
  Para apagar: powershell -ExecutionPolicy Bypass -File tools/stop_receiver.ps1

  Requisitos: Node, gh autenticado (scope gist), cloudflared en
  %LOCALAPPDATA%\rpi5-explorer\bin\cloudflared-windows-amd64.exe (versión verificada por SHA-256).
  La computadora debe quedar encendida mientras se hacen diagnósticos.
#>
$ErrorActionPreference = "Stop"
$GIST_ID = "2b597cf390fcfde7a5c2809963806844"
$PORT    = 8787
$repo    = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA "rpi5-explorer"
$cfExe   = Join-Path $stateDir "bin\cloudflared-windows-amd64.exe"
$state   = Join-Path $stateDir "receiver_state.json"
$logRecv = Join-Path $stateDir "receiver.log"
$logCf   = Join-Path $stateDir "cloudflared.log"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
if (-not (Test-Path $cfExe)) { throw "Falta cloudflared en $cfExe" }

# Apagar una instancia anterior si quedó encendida
& (Join-Path $PSScriptRoot "stop_receiver.ps1") -Quiet

# 1. Receptor
# Sin -Redirect*: los procesos no heredan la consola y el script termina enseguida.
$recv = Start-Process -FilePath "node" -ArgumentList @("tools/diag_receiver.mjs", "$PORT", "`"$logRecv`"") -WorkingDirectory $repo `
  -WindowStyle Hidden -PassThru
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
  Start-Sleep -Milliseconds 300
  try { $ok = (Invoke-RestMethod "http://127.0.0.1:$PORT/health" -TimeoutSec 2).ok } catch {}
}
if (-not $ok) { throw "El receptor local no respondió en el puerto $PORT (ver $logRecv)" }
Write-Host "Receptor local OK (pid $($recv.Id))."

# 2. Túnel
if (Test-Path $logCf) { Remove-Item $logCf -Force }
$cf = Start-Process -FilePath $cfExe -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$PORT", "--logfile", $logCf) `
  -WindowStyle Hidden -PassThru
$url = $null
for ($i = 0; $i -lt 90 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $logCf) {
    $m = Select-String -Path $logCf -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}
if (-not $url) { Stop-Process -Id $cf.Id -Force -ErrorAction SilentlyContinue; throw "cloudflared no informó la URL del túnel (ver $logCf)" }
Write-Host "Túnel: $url"

# 3. Salud a través del túnel (la DNS del subdominio nuevo puede tardar unos segundos)
$ok = $false
for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  try { $ok = (Invoke-RestMethod "$url/health" -TimeoutSec 8).ok } catch {}
}
if (-not $ok) { throw "El túnel no respondió /health en 80 s: $url" }
Write-Host "Salud a través del túnel: OK"

# 4. Publicar la URL en el gist (solo la URL)
$payload = @{ url = $url; status = "activo"; startedAt = (Get-Date).ToUniversalTime().ToString("o");
              note = "Solo la URL del receptor de diagnosticos de rpi5-explorer. Sin datos." } | ConvertTo-Json -Compress
$body = @{ files = @{ "receiver.json" = @{ content = $payload } } } | ConvertTo-Json -Depth 5 -Compress
$tmp = Join-Path $env:TEMP "gist_patch.json"
[IO.File]::WriteAllText($tmp, $body, (New-Object Text.UTF8Encoding $false))
$null = & gh api -X PATCH "gists/$GIST_ID" --input $tmp 2>&1
if ($LASTEXITCODE -ne 0) { throw "No se pudo actualizar el gist" }
Remove-Item $tmp
$check = Invoke-RestMethod "https://api.github.com/gists/$GIST_ID" -Headers @{ "Cache-Control" = "no-cache" }
$pub = ($check.files."receiver.json".content | ConvertFrom-Json).url
if ($pub -ne $url) { throw "El gist no refleja la URL nueva ($pub)" }

@{ receiverPid = $recv.Id; tunnelPid = $cf.Id; url = $url; startedAt = (Get-Date).ToString("o") } |
  ConvertTo-Json | Set-Content -Path $state -Encoding utf8
Write-Host "Gist actualizado. Receptor listo para la app: $url"
