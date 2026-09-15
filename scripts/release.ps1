[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$EnvironmentFile = ".env.release",
    [string]$ProjectName = "notebook-release",
    [int]$WaitTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot "docker-compose.release.yml"
$localCertificateDirectory = Join-Path $projectRoot ".local\yandex-cloud"
$installedCertificatePath = Join-Path $HOME ".postgresql\root.crt"
$localCertificatePath = Join-Path $localCertificateDirectory "root.crt"
$certificateUrl = "https://storage.yandexcloud.net/cloud-certs/CA.pem"
$containerCertificatePath = "/etc/ssl/certs/yandex-cloud-root.crt"

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

function Invoke-YcJson {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = & yc @Arguments --format json
    if ($LASTEXITCODE -ne 0) {
        throw "yc завершился с кодом $LASTEXITCODE. Выполните 'yc init' и повторите релиз."
    }

    return $output | ConvertFrom-Json
}

function Read-EnvironmentFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}

function Get-RequiredSetting {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Values,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
    $value = if ([string]::IsNullOrWhiteSpace($processValue)) { $Values[$Name] } else { $processValue }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Обязательная настройка '$Name' отсутствует в '$EnvironmentFile'."
    }
    return $value
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker не найден в PATH. Установите Docker Desktop или Docker Engine."
}
if (-not (Get-Command yc -ErrorAction SilentlyContinue)) {
    throw "Yandex Cloud CLI (yc) не найден в PATH. Локальная БД как fallback запрещена."
}
if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
    throw "Файл окружения '$EnvironmentFile' не найден. Скопируйте .env.release.example в .env.release."
}
if ($WaitTimeoutSeconds -lt 1) {
    throw "WaitTimeoutSeconds должен быть больше нуля."
}

$releaseSettings = Read-EnvironmentFile -Path $EnvironmentFile
$clusterId = Get-RequiredSetting -Values $releaseSettings -Name "YC_POSTGRESQL_CLUSTER_ID"
$database = Get-RequiredSetting -Values $releaseSettings -Name "YC_POSTGRESQL_DATABASE"
$databaseUser = Get-RequiredSetting -Values $releaseSettings -Name "SPRING_DATASOURCE_USERNAME"
$lockboxSecretId = Get-RequiredSetting -Values $releaseSettings -Name "LOCKBOX_SECRET_ID"
$lockboxKey = Get-RequiredSetting -Values $releaseSettings -Name "LOCKBOX_SECRET_KEY"

Write-Host "Проверяю Yandex Cloud PostgreSQL и Lockbox..."
$cluster = Invoke-YcJson -Arguments @("managed-postgresql", "cluster", "get", "--id", $clusterId)
if ($cluster.status -ne "RUNNING" -or $cluster.health -ne "ALIVE") {
    throw "PostgreSQL-кластер $clusterId не готов: status=$($cluster.status), health=$($cluster.health)."
}

$hosts = @(Invoke-YcJson -Arguments @("managed-postgresql", "hosts", "list", "--cluster-id", $clusterId))
$healthyHosts = @($hosts | Where-Object { $_.health -eq "ALIVE" })
if ($healthyHosts.Count -eq 0) {
    throw "В Yandex Cloud PostgreSQL-кластере $clusterId нет доступных хостов."
}
foreach ($hostName in @($healthyHosts | ForEach-Object { $_.name })) {
    try {
        Resolve-DnsName -Name $hostName -ErrorAction Stop | Out-Null
    }
    catch {
        throw "PostgreSQL-хост '$hostName' не разрешается через DNS. Локальный fallback запрещён."
    }
}

$databases = @(Invoke-YcJson -Arguments @("managed-postgresql", "database", "list", "--cluster-id", $clusterId))
if ($database -notin @($databases | ForEach-Object { $_.name })) {
    throw "База '$database' не найдена в Yandex Cloud PostgreSQL-кластере $clusterId."
}

$users = @(Invoke-YcJson -Arguments @("managed-postgresql", "user", "list", "--cluster-id", $clusterId))
$configuredUser = $users | Where-Object { $_.name -eq $databaseUser } | Select-Object -First 1
if (-not $configuredUser) {
    throw "Пользователь '$databaseUser' не найден в Yandex Cloud PostgreSQL-кластере $clusterId."
}
if ($database -notin @($configuredUser.permissions | ForEach-Object { $_.database_name })) {
    throw "У пользователя '$databaseUser' нет доступа к Yandex Cloud PostgreSQL-базе '$database'."
}

$secret = Invoke-YcJson -Arguments @("lockbox", "secret", "get", "--id", $lockboxSecretId)
if ($secret.status -ne "ACTIVE") {
    throw "Секрет Lockbox $lockboxSecretId не активен."
}
if ($lockboxKey -notin @($secret.current_version.payload_entry_keys)) {
    throw "В активной версии Lockbox $lockboxSecretId нет ключа '$lockboxKey'."
}

$certificatePath = $localCertificatePath
New-Item -ItemType Directory -Force -Path $localCertificateDirectory | Out-Null
if (Test-Path -LiteralPath $installedCertificatePath -PathType Leaf) {
    Copy-Item -LiteralPath $installedCertificatePath -Destination $localCertificatePath -Force
}
elseif (-not (Test-Path -LiteralPath $localCertificatePath -PathType Leaf)) {
    Write-Host "Загружаю корневой сертификат Yandex Cloud..."
    Invoke-WebRequest -Uri $certificateUrl -OutFile $localCertificatePath
}
$certificatePath = [System.IO.Path]::GetFullPath($certificatePath)

try {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificatePath)
}
catch {
    throw "Файл '$certificatePath' не является корректным PEM-сертификатом."
}
if ($certificate.NotAfter -le [DateTime]::UtcNow) {
    throw "Сертификат '$certificatePath' просрочен."
}

$passwordOutput = & yc lockbox payload get --id $lockboxSecretId --key $lockboxKey
if ($LASTEXITCODE -ne 0) {
    throw "Не удалось получить '$lockboxKey' из Lockbox $lockboxSecretId."
}
$databasePassword = ([string]::Join([Environment]::NewLine, @($passwordOutput))).Trim()
if ([string]::IsNullOrWhiteSpace($databasePassword)) {
    throw "Lockbox вернул пустое значение для '$lockboxKey'."
}

$hostList = ($healthyHosts | ForEach-Object { "$($_.name):6432" }) -join ","
$jdbcUrl = "jdbc:postgresql://$hostList/$database" +
    "?targetServerType=primary&sslmode=verify-full&sslrootcert=$containerCertificatePath"

$previousEnvironment = @{}
$environmentUpdates = @{
    "SPRING_DATASOURCE_URL"       = $jdbcUrl
    "SPRING_DATASOURCE_USERNAME" = $databaseUser
    "DB_PASSWORD"                = $databasePassword
}

try {
    foreach ($name in $environmentUpdates.Keys) {
        $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
        [Environment]::SetEnvironmentVariable($name, $environmentUpdates[$name], "Process")
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
        Write-Host "Текущий релиз запущен. Останавливаю контейнеры приложения..."
    }
    else {
        Write-Host "Запущенный релиз не найден. Удаляю оставшиеся контейнеры, если они есть..."
    }
    Invoke-Compose -Arguments @("down", "--remove-orphans", "--timeout", "30")

    Write-Host "Запускаю новый релиз с Yandex Cloud PostgreSQL и ожидаю готовности сервисов..."
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

    $appPort = if ($releaseSettings["APP_PORT"]) { $releaseSettings["APP_PORT"] } else { "5173" }
    Write-Host "Релиз успешно поднят с Yandex Cloud PostgreSQL: http://localhost:$appPort"
    Invoke-Compose -Arguments @("ps")
}
finally {
    $databasePassword = $null
    $passwordOutput = $null
    $environmentUpdates["DB_PASSWORD"] = $null
    foreach ($name in $environmentUpdates.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
    }
}
