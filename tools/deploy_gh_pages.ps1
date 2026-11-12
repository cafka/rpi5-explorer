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
$ErrorActionPreference = "Stop"
$repo = (git rev-parse --show-toplevel).Trim()
Set-Location $repo

if (git status --porcelain app) { throw "app/ tiene cambios sin commit. Commit antes de publicar." }
$mainSha = (git rev-parse --short HEAD).Trim()

$wt = Join-Path $env:TEMP ("rpi5-ghpages-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
git fetch origin gh-pages 2>&1 | Out-Null
git worktree add $wt gh-pages 2>&1 | Out-Null
try {
  Get-ChildItem -Force $wt | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Copy-Item -Recurse -Force (Join-Path $repo "app\*") $wt
  Push-Location $wt
  git add -A 2>&1 | Out-Null
  if (git status --porcelain) {
    git commit -m "gh-pages: publicar app/ desde main $mainSha" 2>&1 | Out-Null
    git push origin gh-pages 2>&1 | Out-Null
    Write-Host "Publicado main $mainSha en gh-pages."
  } else {
    Write-Host "gh-pages ya coincidía con app/ ($mainSha)."
  }
  Pop-Location
} finally {
  git worktree remove --force $wt 2>&1 | Out-Null
}

# ── Verificación ──────────────────────────────────────────────────────────────
git fetch origin gh-pages 2>&1 | Out-Null
$errors = 0
$local = git ls-files app | ForEach-Object { $_.Substring(4) }
foreach ($f in $local) {
  $want = (git rev-parse "HEAD:app/$f").Trim()
  $got  = (git rev-parse "origin/gh-pages:$f" 2>$null)
  if (-not $got -or $got.Trim() -ne $want) { Write-Host "DIFERENTE o FALTA: $f"; $errors++ }
}
$published = git ls-tree -r --name-only origin/gh-pages
foreach ($f in $published) { if ($local -notcontains $f) { Write-Host "SOBRANTE en gh-pages: $f"; $errors++ } }
if ($errors) { throw "Verificación fallida: $errors diferencias." }
Write-Host "Verificado: $($local.Count) archivos idénticos entre main:app/ y origin/gh-pages."
