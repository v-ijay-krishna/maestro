$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

if (-not (Test-Path $docker) -or -not (Test-Path $dockerDesktop)) {
  throw 'Docker Desktop is not installed. Install and open Docker Desktop first.'
}

function Test-DockerReady {
  $null = & $docker version --format '{{.Server.Version}}' 2>$null
  return $LASTEXITCODE -eq 0
}

if (-not (Test-DockerReady)) {
  Start-Process -FilePath $dockerDesktop
  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep -Seconds 4
  } until ((Test-DockerReady) -or (Get-Date) -ge $deadline)

  if (-not (Test-DockerReady)) {
    throw 'Docker Desktop did not become ready in two minutes. Open Docker Desktop and finish any first-time setup prompt, then run this command again.'
  }
}

$existingContainer = & $docker ps -a --filter 'name=^/maestro-mongo$' --format '{{.Names}}'
if ($existingContainer -eq 'maestro-mongo') {
  & $docker start maestro-mongo | Out-Null
} else {
  & $docker run -d -p 127.0.0.1:27017:27017 --name maestro-mongo mongo:7 | Out-Null
}

$serverDir = Join-Path $projectRoot 'server'
Start-Process cmd.exe -ArgumentList '/k', "cd /d `"$serverDir`" && node.exe dist\server.js"
Start-Process cmd.exe -ArgumentList '/k', "cd /d `"$projectRoot`" && npm.cmd run dev:client"

Start-Sleep -Seconds 3
Start-Process 'http://localhost:5173'
