<#
  deploy_gh_pages.ps1 — publica app/ de la rama main en la raíz de gh-pages y verifica.

  Uso (desde la raíz del repo, con main limpio y empujado):
    powershell -ExecutionPolicy Bypass -File tools/deploy_gh_pages.ps1

  Pasos:
    1. Crea un worktree temporal de gh-pages (no toca el directorio de trabajo).
    2. Reemplaza su contenido por una copia exacta de app/ (main).
    3. Commit + push.
    4. Verifica que cada archivo de app/ es idéntico al blob publicado en origin/gh-pages
       y que no quedan archivos sobrantes.
#>
# git escribe progreso en stderr; se juzga el resultado por el código de salida.
# La función no se llama "Git": PowerShell no distingue mayúsculas y se llamaría a sí misma.
$ErrorActionPreference = "Continue"
function Invoke-Git {
  $out = & git.exe @args 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falló ($LASTEXITCODE): $out" }
  return $out
}

$repo = (Invoke-Git rev-parse --show-toplevel | Select-Object -Last 1).ToString().Trim()
Set-Location $repo

if (Invoke-Git status --porcelain app) { throw "app/ tiene cambios sin commit. Commit antes de publicar." }
$mainSha = (Invoke-Git rev-parse --short HEAD | Select-Object -Last 1).ToString().Trim()

$wt = Join-Path $env:TEMP ("rpi5-ghpages-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
Invoke-Git fetch origin gh-pages | Out-Null
Invoke-Git worktree add $wt gh-pages | Out-Null
try {
  Get-ChildItem -Force $wt | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Copy-Item -Recurse -Force (Join-Path $repo "app\*") $wt
  Push-Location $wt
  Invoke-Git add -A | Out-Null
  if (Invoke-Git status --porcelain) {
    Invoke-Git commit -m "gh-pages: publicar app/ desde main $mainSha" | Out-Null
    Invoke-Git push origin gh-pages | Out-Null
    Write-Host "Publicado main $mainSha en gh-pages."
  } else {
    Write-Host "gh-pages ya coincidía con app/ ($mainSha)."
  }
  Pop-Location
} finally {
  & git.exe worktree remove --force $wt 2>&1 | Out-Null
}

# ── Verificación ──────────────────────────────────────────────────────────────
Invoke-Git fetch origin gh-pages | Out-Null
$errors = 0
$local = Invoke-Git ls-files app | ForEach-Object { $_.ToString().Substring(4) }
foreach ($f in $local) {
  $want = (Invoke-Git rev-parse "HEAD:app/$f" | Select-Object -Last 1).ToString().Trim()
  $got  = (& git.exe rev-parse "origin/gh-pages:$f" 2>$null)
  if (-not $got -or $got.ToString().Trim() -ne $want) { Write-Host "DIFERENTE o FALTA: $f"; $errors++ }
}
$published = Invoke-Git ls-tree -r --name-only origin/gh-pages | ForEach-Object { $_.ToString() }
foreach ($f in $published) { if ($local -notcontains $f) { Write-Host "SOBRANTE en gh-pages: $f"; $errors++ } }
if ($errors) { throw "Verificación fallida: $errors diferencias." }
Write-Host "Verificado: $($local.Count) archivos idénticos entre main:app/ y origin/gh-pages."
