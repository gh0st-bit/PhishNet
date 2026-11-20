param([switch]$Lan,[string]$HostAddress)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if ($Lan -and -not $HostAddress) {
  $HostAddress = (& node --input-type=module -e "import os from 'node:os';const pairs=Object.entries(os.networkInterfaces());const rows=pairs.flatMap(([name,list])=>(list||[]).filter(n=>n.family==='IPv4'&&!n.internal&&/^(192[.]168[.]|10[.]|172[.](1[6-9]|2[0-9]|3[01])[.])/.test(n.address)).map(n=>({name,address:n.address})));const found=rows.find(n=>/wi-?fi|wireless/i.test(n.name))||rows.find(n=>!/virtual|vethernet|vmware|virtualbox/i.test(n.name));if(!found)process.exit(1);console.log(found.address);")
  if ($LASTEXITCODE -ne 0 -or -not $HostAddress) { throw 'No private Wi-Fi address found. Pass -HostAddress with this PC local IPv4 address.' }
}
if (-not $HostAddress) { $HostAddress='localhost' }
Write-Host 'Applying additive audit migrations. Existing audit accounts/data are preserved.'
& node scripts/run-audit.mjs migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Review the output before starting the lab.' }
Write-Host "Local inbox: http://${HostAddress}:5000/local-inbox"
Write-Host 'On the second laptop, use that private IP URL, not localhost. Both laptops must use the same private network.'
Write-Host 'If Windows asks, permit Node only on Private networks. No router port forwarding is required.'
& node scripts/run-audit.mjs lab "http://${HostAddress}:5000"
exit $LASTEXITCODE
