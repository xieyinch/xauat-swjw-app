param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$source = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\src\vendor\aora')).Path '*'
$destination = Join-Path $ProjectRoot 'android\app\src\main\assets\aora'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -Force $source -Destination $destination
