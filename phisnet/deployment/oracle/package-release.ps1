# Builds phishnet-release.tar.gz containing only what the Docker build needs.
# Never includes .env files, local uploads, database exports, logs or private demo credentials.
# Usage (PowerShell, from the phisnet folder):  .\deployment\oracle\package-release.ps1
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$dirs  = 'client/', 'server/', 'shared/', 'scripts/', 'migrations/', 'attached_assets/', 'deployment/'
$files = 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'components.json', 'drizzle.config.ts', '.dockerignore'

$list = git ls-files -co --exclude-standard . | Where-Object {
  $path = $_
  (Test-Path -LiteralPath $path -PathType Leaf) -and
  (($files -contains $path) -or ($dirs | Where-Object { $path.StartsWith($_) })) -and
  ($path -notmatch '(^|/)\.env(?!\.example$)') -and
  ($path -notmatch '\.private\.')
}
if (-not $list) { throw 'No files selected' }

$manifest = Join-Path $env:TEMP 'phishnet-release-files.txt'
[IO.File]::WriteAllText($manifest, (($list -join "`n") + "`n"))
$out = Join-Path $root 'phishnet-release.tar.gz'
& "$env:SystemRoot\System32\tar.exe" -czf $out -T $manifest
if ($LASTEXITCODE) { throw "tar failed ($LASTEXITCODE)" }
Remove-Item $manifest
Write-Host ("Packaged {0} files into {1} ({2:N1} MB)" -f $list.Count, $out, ((Get-Item $out).Length / 1MB))
