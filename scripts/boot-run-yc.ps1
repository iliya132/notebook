[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$ClusterId = "c9qrtrrook3e3umj7n4k",
    [string]$Database = "iliya132-db",
    [string]$DatabaseUser = "iliya132",
    [string]$LockboxSecretId = "e6q18smvei2glc3po3vt",
    [string]$LockboxKey = "postgresql_password",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GradleArguments
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDirectory = Join-Path $projectRoot ".local\yandex-cloud"
$installedCertificatePath = Join-Path $HOME ".postgresql\root.crt"
$localCertificatePath = Join-Path $localDirectory "root.crt"
$certificateUrl = "https://storage.yandexcloud.net/cloud-certs/CA.pem"

function Invoke-YcJson {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = & yc @Arguments --format json
    if ($LASTEXITCODE -ne 0) {
        throw "yc завершился с кодом $LASTEXITCODE. Выполните 'yc init' и повторите запуск."
    }

    return $output | ConvertFrom-Json
}

if (-not (Get-Command yc -ErrorAction SilentlyContinue)) {
    throw "Yandex Cloud CLI (yc) не найден в PATH."
}

$hosts = @(
    Invoke-YcJson -Arguments @(
        "managed-postgresql", "hosts", "list", "--cluster-id", $ClusterId
    )
)
$healthyHosts = @($hosts | Where-Object { $_.health -eq "ALIVE" })
if ($healthyHosts.Count -eq 0) {
    throw "В кластере $ClusterId нет доступных PostgreSQL-хостов."
}
foreach ($hostName in @($healthyHosts | ForEach-Object { $_.name })) {
    try {
        Resolve-DnsName -Name $hostName -ErrorAction Stop | Out-Null
    }
    catch {
        throw "PostgreSQL-хост '$hostName' не разрешается через DNS. Для прямого локального подключения включите public access у хоста."
    }
}

$databases = @(
    Invoke-YcJson -Arguments @(
        "managed-postgresql", "database", "list", "--cluster-id", $ClusterId
    )
)
if ($Database -notin @($databases | ForEach-Object { $_.name })) {
    throw "База '$Database' не найдена в кластере $ClusterId."
}

$users = @(
    Invoke-YcJson -Arguments @(
        "managed-postgresql", "user", "list", "--cluster-id", $ClusterId
    )
)
$configuredUser = $users | Where-Object { $_.name -eq $DatabaseUser } | Select-Object -First 1
if (-not $configuredUser) {
    throw "Пользователь '$DatabaseUser' не найден в кластере $ClusterId."
}
if ($Database -notin @($configuredUser.permissions | ForEach-Object { $_.database_name })) {
    throw "У пользователя '$DatabaseUser' нет доступа к базе '$Database'."
}

$secret = Invoke-YcJson -Arguments @(
    "lockbox", "secret", "get", "--id", $LockboxSecretId
)
if ($secret.status -ne "ACTIVE") {
    throw "Секрет Lockbox $LockboxSecretId не активен."
}
if ($LockboxKey -notin @($secret.current_version.payload_entry_keys)) {
    throw "В активной версии Lockbox $LockboxSecretId нет ключа '$LockboxKey'."
}

$certificatePath = $installedCertificatePath
if (-not (Test-Path -LiteralPath $certificatePath)) {
    New-Item -ItemType Directory -Force -Path $localDirectory | Out-Null
    Write-Host "Загружаю корневой сертификат Yandex Cloud..."
    Invoke-WebRequest -Uri $certificateUrl -OutFile $localCertificatePath
    $certificatePath = $localCertificatePath
}

try {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificatePath)
}
catch {
    throw "Файл '$certificatePath' не является корректным PEM-сертификатом."
}
if ($certificate.NotAfter -le [DateTime]::UtcNow) {
    throw "Сертификат '$certificatePath' просрочен."
}

$passwordOutput = & yc lockbox payload get --id $LockboxSecretId --key $LockboxKey
if ($LASTEXITCODE -ne 0) {
    throw "Не удалось получить '$LockboxKey' из Lockbox $LockboxSecretId."
}
$databasePassword = ([string]::Join([Environment]::NewLine, @($passwordOutput))).Trim()
if ([string]::IsNullOrWhiteSpace($databasePassword)) {
    throw "Lockbox вернул пустое значение для '$LockboxKey'."
}

$hostList = ($healthyHosts | ForEach-Object { "$($_.name):6432" }) -join ","
$jdbcCertificatePath = $certificatePath.Replace("\", "/")
$jdbcUrl = "jdbc:postgresql://$hostList/$Database" +
    "?targetServerType=primary&sslmode=verify-full&sslrootcert=$jdbcCertificatePath"

$previousEnvironment = @{}
$environmentUpdates = @{
    "SPRING_DATASOURCE_URL"       = $jdbcUrl
    "SPRING_DATASOURCE_USERNAME" = $DatabaseUser
    "DB_PASSWORD"                = $databasePassword
    "LOCKBOX_SECRET_ID"          = $LockboxSecretId
    "LOCKBOX_SECRET_KEY"         = $LockboxKey
    "GRADLE_USER_HOME"           = (Join-Path $projectRoot ".gradle-user")
}

try {
    foreach ($name in $environmentUpdates.Keys) {
        $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
        [Environment]::SetEnvironmentVariable($name, $environmentUpdates[$name], "Process")
    }

    $arguments = @("bootRun") + @($GradleArguments)
    Write-Host "Запускаю Notebook с PostgreSQL-кластером $ClusterId (пароль получен из Lockbox)."
    & (Join-Path $projectRoot "gradlew.bat") @arguments
    exit $LASTEXITCODE
}
finally {
    $databasePassword = $null
    $passwordOutput = $null
    foreach ($name in $environmentUpdates.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
    }
}
