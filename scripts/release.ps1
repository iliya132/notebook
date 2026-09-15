[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$EnvironmentFile = ".env.release",
    [string]$ProjectName = "notebook-release",
    [int]$WaitTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot "docker-compose.release.yml"

if (-not [System.IO.Path]::IsPathRooted($EnvironmentFile)) {
    $EnvironmentFile = Join-Path $projectRoot $EnvironmentFile
}
$EnvironmentFile = [System.IO.Path]::GetFullPath($EnvironmentFile)

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & docker compose `
        --project-name $ProjectName `
        --env-file $EnvironmentFile `
        --file $composeFile `
        @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($Arguments -join ' ') завершился с кодом $LASTEXITCODE."
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker не найден в PATH. Установите Docker Desktop или Docker Engine."
}
if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
    throw "Файл окружения '$EnvironmentFile' не найден. Скопируйте .env.release.example в .env.release и задайте секреты."
}
if ($WaitTimeoutSeconds -lt 1) {
    throw "WaitTimeoutSeconds должен быть больше нуля."
}

& docker info --format "{{.ServerVersion}}" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker daemon недоступен. Запустите Docker и повторите релиз."
}

Write-Host "Проверяю release-конфигурацию..."
Invoke-Compose -Arguments @("config", "--quiet")

# Build first, so a compilation or image download failure does not stop the current release.
Write-Host "Собираю новые образы, не останавливая текущий релиз..."
Invoke-Compose -Arguments @("build", "--pull")

$runningContainers = @(
    & docker compose `
        --project-name $ProjectName `
        --env-file $EnvironmentFile `
        --file $composeFile `
        ps --status running --quiet
)
if ($LASTEXITCODE -ne 0) {
    throw "Не удалось определить состояние текущего релиза."
}

if ($runningContainers.Count -gt 0) {
    Write-Host "Текущий релиз запущен. Останавливаю его без удаления данных PostgreSQL..."
}
else {
    Write-Host "Запущенный релиз не найден. Удаляю оставшиеся контейнеры, если они есть..."
}
Invoke-Compose -Arguments @("down", "--remove-orphans", "--timeout", "30")

Write-Host "Запускаю новый релиз и ожидаю готовности сервисов..."
try {
    Invoke-Compose -Arguments @(
        "up", "--detach", "--wait", "--wait-timeout", $WaitTimeoutSeconds.ToString()
    )
}
catch {
    Write-Host "Новый релиз не прошёл healthcheck. Текущее состояние:"
    & docker compose `
        --project-name $ProjectName `
        --env-file $EnvironmentFile `
        --file $composeFile `
        ps
    Write-Host "Последние строки логов:"
    & docker compose `
        --project-name $ProjectName `
        --env-file $EnvironmentFile `
        --file $composeFile `
        logs --tail 100
    throw
}

$appPort = "5173"
foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
    if ($line -match '^\s*APP_PORT\s*=\s*([^#\s]+)') {
        $appPort = $Matches[1].Trim('"', "'")
    }
}

Write-Host "Релиз успешно поднят: http://localhost:$appPort"
Invoke-Compose -Arguments @("ps")
