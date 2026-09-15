# Notebook

Полноценное приложение личных Markdown-заметок: Java 21 / Spring Boot API,
React / TypeScript с SSR и PostgreSQL. Поддерживает несколько книжек, безопасное
автосохранение, cookie-сессии и отзывные публичные ссылки только для чтения.

## Архитектура и безопасность

- REST API имеет версию `/api/v1`; JPA-сущности наружу не возвращаются.
- Actuator/Micrometer экспортирует обезличенные HTTP, repository, Hibernate,
  HikariCP и JVM-метрики в локальный Prometheus; Grafana настраивается из файлов.
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
- Node/Vite SSR заранее получает данные текущего маршрута, передавая backend только
  входящую cookie, и безопасно гидратирует TanStack Query без повторного запроса.
  Персонализированный HTML имеет `Cache-Control: private, no-store`, а хешированные
  клиентские assets кешируются неизменно на год.

## Диагностика скорости

HTML-ответы и JSON API публикуют стандартный заголовок `Server-Timing`. В Chrome
или Edge откройте DevTools → Network, выберите запрос страницы заметки и вкладку
Timing. Для SSR там видны `total`, этапы Vite/шаблона, `route_data`, конкретный
API-запрос (`api_note`) и `react`. Метрика `api_note_app` приходит из Spring и
показывает время контроллера вместе с JPA-запросом; разница между `api_note` и
`api_note_app` приходится на сеть, чтение сессии и остальной HTTP pipeline.

Клиентские переходы записываются в браузерный Performance API без UUID и публичных
токенов в названиях. Последние измерения можно вывести в консоли DevTools:

```js
performance.getEntriesByType('measure')
  .filter(({ name }) => name.startsWith('notebook:api:'))
  .map(({ name, duration }) => ({ name, milliseconds: duration.toFixed(1) }))
```

Первый SSR заметки делает один критический запрос вместо прежней цепочки
`auth/me → (note + share)`: защищённый ответ заметки уже подтверждает сессию, а
статус публичной ссылки догружается после показа редактора. При переходе из списка
запрос заметки также начинается при наведении мышью или фокусе с клавиатуры.

## Накопительные метрики и Grafana

Prometheus опрашивает `GET /actuator/prometheus` раз в 5 секунд и хранит временные
ряды 15 дней в Docker volume. Готовый дашборд **Notebook — performance** содержит:

- throughput, 5xx rate и p50/p95/p99 полного времени API-запросов;
- среднее и максимальное время Hibernate SELECT по шаблону запроса;
- p95 методов Spring Data Repository, включая операции записи;
- активные, свободные и ожидающие соединения HikariCP;
- JVM heap и доступность backend.

HTTP-маршруты представлены нормализованными шаблонами (`/notes/{noteId}`), поэтому
UUID и публичные токены не создают высокую cardinality. DB label содержит только
шаблон SQL с `?`, без bind-параметров и данных пользователя. Метрика repository
покрывает полный метод репозитория, а `notebook_database_query_*` — непосредственно
время SELECT, измеренное Hibernate.

## Требования

- JDK 21+ (сборка использует `--release 21`);
- Docker Compose для локальной PostgreSQL и интеграционных тестов;
- Node.js 20.19+ или 22.12+ и npm 10+.

## Локальный запуск

```bash
docker compose up -d postgres prometheus grafana

cd backend
./gradlew bootRun

# в другом терминале: SSR dev-сервер + HMR + proxy /api
cd frontend
npm ci
npm run dev
```

Откройте <http://localhost:5173>. Vite проксирует `/api` на backend. Swagger UI:
<http://localhost:8080/swagger-ui.html>; health probes: `/actuator/health/liveness`
и `/actuator/health/readiness`.

Grafana доступна на <http://localhost:3000>, готовый дашборд находится в папке
`Notebook`. Локальные credentials по умолчанию — `admin` / `admin`; задайте
`GRAFANA_ADMIN_USER` и `GRAFANA_ADMIN_PASSWORD` в игнорируемом `.env`, чтобы их
изменить. Prometheus UI доступен на <http://localhost:9090>. Оба порта привязаны
только к `127.0.0.1`. Backend должен работать на `localhost:8080`, как в команде
выше; при его остановке история сохраняется, а новые точки временно не поступают.

Остановить локальную инфраструктуру без удаления истории можно командой:

```bash
docker compose stop postgres prometheus grafana
```

Production-сборка создаёт отдельные client и server bundles. `API_ORIGIN` —
внутренний адрес Spring API, недоступный браузеру напрямую:

```bash
cd frontend
npm ci
npm run build
API_ORIGIN=http://localhost:8080 PORT=5173 npm run start
```

На Windows задайте те же переменные через `$env:API_ORIGIN` и `$env:PORT`.
Публичный reverse proxy должен направлять трафик на SSR-сервер; тот сам проксирует
`/api` в Spring, сохраняя единый origin для cookie и CSRF.

## Docker-релиз

Release Compose поднимает PostgreSQL, Spring Boot backend и production SSR
frontend. Скопируйте пример окружения и обязательно замените пароль:

```powershell
Copy-Item .env.release.example .env.release
notepad .env.release
.\scripts\release.ps1
```

Скрипт сначала проверяет конфигурацию и собирает новые образы, затем определяет,
запущен ли текущий release-стек. Существующий стек останавливается командой
`docker compose down` без флага `--volumes`, после чего новая версия запускается
с ожиданием healthcheck всех сервисов. Поэтому именованный volume PostgreSQL и
данные между релизами сохраняются. По умолчанию приложение доступно по адресу
<http://localhost:5173>; порт задаётся через `APP_PORT`.

При публикации через HTTPS укажите реальные `FRONTEND_ORIGIN` и `PUBLIC_BASE_URL`,
а также `SESSION_COOKIE_SECURE=true`. Для другого env-файла используйте
`.\scripts\release.ps1 -EnvironmentFile C:\path\to\release.env`.

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
