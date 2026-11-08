/**
 * requirement-v6.md FR-96..FR-99, NFR-35: serves the built dashboard (dist/web) with Node
 * built-ins, plus security headers on every answer. Paths that are not files get index.html,
 * so the page can handle its own routes; /api/... that is not a route stays a JSON 404.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import type { FastifyInstance } from 'fastify'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'
}

/** The page loads only its own files (no remote content, no framing). */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ')

export function addSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    void reply.header('X-Content-Type-Options', 'nosniff')
    void reply.header('Referrer-Policy', 'no-referrer')
    void reply.header('X-Frame-Options', 'DENY')
    void reply.header('Content-Security-Policy', CONTENT_SECURITY_POLICY)
    return payload
  })
}

export function serveDashboard(app: FastifyInstance, dir: string): void {
  const root = normalize(dir + sep)
  const index = join(root, 'index.html')

  app.get('/*', async (request, reply) => {
    const path = decodeURIComponent((request.url.split('?')[0] ?? '/').replace(/^\/+/, ''))
    if (path.startsWith('api/')) return reply.code(404).send({ error: 'Not found' })
    const file = normalize(join(root, path))
    const inside = file.startsWith(root)
    const target =
      inside && path !== '' && existsSync(file) && statSync(file).isFile() ? file : index
    if (!existsSync(target))
      return reply.code(503).type('text/plain').send('Dashboard not built (npm run build)')
    const isIndex = target === index
    // Built files have hashed names and never change; the page itself is always checked.
    void reply.header('Cache-Control', isIndex ? 'no-cache' : 'public, max-age=31536000, immutable')
    return reply
      .type(TYPES[extname(target)] ?? 'application/octet-stream')
      .send(readFileSync(target))
  })
}
