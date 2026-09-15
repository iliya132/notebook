import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const production = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 5173)
const apiOrigin = new URL(process.env.API_ORIGIN ?? 'http://localhost:8080')
const clientRoot = resolve(root, 'dist/client')
const templatePath = production ? resolve(clientRoot, 'index.html') : resolve(root, 'index.html')
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.map', 'application/json; charset=utf-8'],
])

let vite
let productionRender
if (production) {
  productionRender = (await import(pathToFileURL(resolve(root, 'dist/server/entry-server.js')).href)).render
} else {
  const { createServer } = await import('vite')
  vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
}

function proxyApi(req, res) {
  const target = new URL(req.url ?? '/', apiOrigin)
  const requester = target.protocol === 'https:' ? httpsRequest : httpRequest
  const headers = { ...req.headers, host: target.host }
  delete headers.connection
  const upstream = requester(target, { method: req.method, headers }, upstreamResponse => {
    res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(res)
  })
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ code: 'api_unavailable', message: 'Сервис временно недоступен' }))
  })
  req.pipe(upstream)
}

async function serveStatic(pathname, req, res) {
  let decoded
  try { decoded = decodeURIComponent(pathname) } catch { return false }
  const file = resolve(clientRoot, `.${decoded}`)
  if (file !== clientRoot && !file.startsWith(`${clientRoot}${sep}`)) return false
  const info = await stat(file).catch(() => undefined)
  if (!info?.isFile()) return false
  const body = await readFile(file)
  const immutable = decoded.startsWith('/assets/')
  res.writeHead(200, {
    'content-type': contentTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  })
  res.end(req.method === 'HEAD' ? undefined : body)
  return true
}

async function runViteMiddleware(req, res) {
  if (!vite) return false
  await new Promise((done, reject) => vite.middlewares(req, res, error => error ? reject(error) : done()))
  return res.writableEnded
}

const server = createHttpServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (requestUrl.pathname.startsWith('/api/')) return proxyApi(req, res)
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      res.writeHead(405, { allow: 'GET, HEAD' })
      return res.end()
    }
    if (production && await serveStatic(requestUrl.pathname, req, res)) return
    if (!production && await runViteMiddleware(req, res)) return

    let template = await readFile(templatePath, 'utf8')
    const render = production ? productionRender : (await vite.ssrLoadModule('/src/entry-server.tsx')).render
    if (!production) template = await vite.transformIndexHtml(requestUrl.pathname, template)
    const result = await render(requestUrl.pathname + requestUrl.search, req.headers, apiOrigin.href)
    if (result.redirect) {
      res.writeHead(result.status, { location: result.redirect, 'cache-control': 'no-store' })
      return res.end()
    }
    const html = template
      .replace('<!--app-head-->', result.head ?? '<title>Notebook</title>')
      .replace('<!--app-html-->', result.html ?? '')
      .replace('<!--app-state-->', result.state ?? '{}')
    res.writeHead(result.status, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      vary: 'Cookie',
    })
    res.end(req.method === 'HEAD' ? undefined : html)
  } catch (error) {
    vite?.ssrFixStacktrace(error)
    const message = production ? 'Internal Server Error' : error?.stack ?? String(error)
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end(message)
  }
})

server.listen(port, () => {
  console.log(`Notebook SSR listening on http://localhost:${port} (${production ? 'production' : 'development'})`)
})
