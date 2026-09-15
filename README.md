# Notebook

Полноценное приложение личных Markdown-заметок: Java 21 / Spring Boot API,
React / TypeScript SPA и PostgreSQL. Поддерживает несколько книжек, безопасное
автосохранение, cookie-сессии и отзывные публичные ссылки только для чтения.

## Архитектура и безопасность

- REST API имеет версию `/api/v1`; JPA-сущности наружу не возвращаются.
- Все приватные выборки ограничены `owner_id`: подстановка чужого UUID даёт `404`.
- Пароли хешируются BCrypt cost 12. Сессии хранятся в PostgreSQL; cookie имеет
  `HttpOnly`, `SameSite=Lax`, а в production ещё `Secure`.
- Изменяющие запросы защищены Spring Security CSRF cookie/header. CORS разрешает
  credentials только для явно заданного `FRONTEND_ORIGIN`.
- Публичная ссылка содержит 256 случайных бит. В БД сохраняется только SHA-256;
  повторное включение ротирует токен, отзыв удаляет запись.
- `@Version` на книжках и заметках предотвращает потерянные обновления (`409`).
- Markdown отображается без raw HTML и проходит `rehype-sanitize`.
- Локальный rate limiter защищает login/register/public resolve. Для нескольких
  production-инстансов замените его общим gateway/Redis limiter.

## Требования

- JDK 21+ (сборка использует `--release 21`);
- Docker Compose для локальной PostgreSQL и интеграционных тестов;
- Node.js 20.19+ или 22.12+ и npm 10+.

## Локальный запуск

```bash
docker compose up -d postgres

cd backend
./gradlew bootRun

# в другом терминале
cd frontend
npm ci
npm run dev
```

Откройте <http://localhost:5173>. Vite проксирует `/api` на backend. Swagger UI:
<http://localhost:8080/swagger-ui.html>; health probes: `/actuator/health/liveness`
и `/actuator/health/readiness`.

Локальные defaults БД — `notebook/notebook`. Для других значений экспортируйте
переменные из локального, игнорируемого `.env`.

## Миграции

Flyway автоматически применяет `V1__initial_schema.sql`: таблицы приложения и
Spring Session, FK-каскады и индексы. Hibernate использует `ddl-auto=validate`.

## Проверки

```bash
cd backend
./gradlew clean check bootJar

cd frontend
npm ci
npm run lint
npm run typecheck
npm test -- --run
npx playwright install chromium  # один раз
npm run test:e2e                 # при запущенных backend/frontend и PostgreSQL
npm run build
```

Integration-тест по умолчанию запускает отдельный PostgreSQL Testcontainers и
явно падает, если Docker недоступен. Для Windows-среды, где приложение видит
локальную compose-БД, но Java не имеет доступа к Docker API, разрешён явный
fallback: `$env:NOTEBOOK_LOCAL_TEST_DB='true'; ./gradlew test`. Он пересоздаёт
только отдельную localhost-базу `notebook_test` и никогда не очищает `notebook`.
E2E создаёт уникального пользователя; для CI задайте отдельную БД и
`E2E_BASE_URL`.

## Yandex Cloud PostgreSQL и Lockbox

Профиль `prod` требует production-переменные без fallback:

```bash
java -jar backend/build/libs/notebook-backend-1.0.0.jar --spring.profiles.active=prod
```

Используйте JDBC URL из `.env.example`: оба хоста на `6432`,
`targetServerType=primary`, `sslmode=verify-full` и абсолютный `sslrootcert`.
Корневой сертификат скачайте только по официальной инструкции Yandex Cloud и
смонтируйте read-only. `sslmode=require` недостаточен.

Секрет `e6q18smvei2glc3po3vt` должен передавать существующий payload entry в
`DB_PASSWORD`. Имя entry не угадывается: получите его из метаданных Lockbox и
задайте `LOCKBOX_SECRET_KEY`. Для Serverless Containers используйте нативную
env-привязку; для Kubernetes — External Secrets + workload identity; для VM —
service account и metadata IAM token. Дайте `lockbox.payloadViewer` только на
этот секрет (и при customer KMS — `kms.keys.encrypterDecrypter` только на ключ).
Не логируйте payload и не публикуйте Actuator `/env`.

Для локального запуска backend с облачной PostgreSQL используйте PowerShell-скрипт:

```powershell
.\scripts\boot-run-yc.ps1
```

Скрипт проверяет через `yc` состояние хостов, наличие базы и права пользователя,
читает `postgresql_password` из активной версии Lockbox только в память процесса,
использует CA из `$HOME\.postgresql\root.crt` (или загружает его с официального
адреса Yandex Cloud в игнорируемый каталог `.local/yandex-cloud`) и запускает
`gradlew.bat bootRun` с TLS `verify-full`. Перед первым запуском выполните `yc init`.
Для прямого запуска с локального компьютера у хостов должен быть включён public
access; входящее правило TCP `6432` ограничивайте настолько узко, насколько
позволяет среда разработки.

## API

Группы: `/auth/register|login|me|logout|csrf`, `/notebooks`,
`/notebooks/{id}/notes`, `/notes/{id}`, `/notes/{id}/share` и анонимный
`/public/notes/{token}`. Ошибки имеют `code`, `message`, `fields`, `timestamp` и
`traceId` без stack trace и секретов.
