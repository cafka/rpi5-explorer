<#
  stop_receiver.ps1 — apaga el receptor y el túnel, y marca el gist como detenido.
  Uso: powershell -ExecutionPolicy Bypass -File tools/stop_receiver.ps1
#>
param([switch]$Quiet)
$GIST_ID = "2b597cf390fcfde7a5c2809963806844"
$state = Join-Path $env:LOCALAPPDATA "rpi5-explorer\receiver_state.json"
if (Test-Path $state) {
  $s = Get-Content $state -Raw | ConvertFrom-Json
  foreach ($p in @($s.tunnelPid, $s.receiverPid)) { if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }
  Remove-Item $state -Force
  if (-not $Quiet) { Write-Host "Receptor y túnel apagados." }
}
$payload = @{ url = $null; status = "detenido"; stoppedAt = (Get-Date).ToUniversalTime().ToString("o");
              note = "Solo la URL del receptor de diagnosticos de rpi5-explorer. Sin datos." } | ConvertTo-Json -Compress
$body = @{ files = @{ "receiver.json" = @{ content = $payload } } } | ConvertTo-Json -Depth 5 -Compress
$tmp = Join-Path $env:TEMP "gist_patch.json"
[IO.File]::WriteAllText($tmp, $body, (New-Object Text.UTF8Encoding $false))
$null = & gh api -X PATCH "gists/$GIST_ID" --input $tmp 2>&1
Remove-Item $tmp -ErrorAction SilentlyContinue
if (-not $Quiet) { Write-Host "Gist marcado como detenido." }
