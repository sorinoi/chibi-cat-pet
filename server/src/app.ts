/**
 * requirement-v6.md FR-91, FR-92, NFR-35: the HTTP API. Built as a function so tests can call
 * it with fastify.inject, without a port.
 */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import {
  ACTIVITY_MAX_BATCH,
  ACTIVITY_PATHS,
  parseActivityEvent,
  type ActivityEvent
} from '../../src/shared/activity.ts'
import type { Db } from './db.ts'
import { bearerKey } from './keys.ts'
import { createRateLimiter } from './rateLimit.ts'
import { checkApiKey, storeEvents } from './store.ts'

export interface AppOptions {
  db: Db
  version: string
  rateLimitPerMinute: number
  bodyLimitBytes: number
  /** Fastify logging (off in tests). */
  logger?: boolean
}

type BatchCheck = { ok: true; events: ActivityEvent[] } | { ok: false; reason: string }

/** FR-91: the body must be `{ events: [...] }` with 1..100 good events; one bad event fails all. */
export function checkBatch(body: unknown): BatchCheck {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { events?: unknown }).events)
  )
    return { ok: false, reason: 'Body must be { "events": [...] }' }
  const raw = (body as { events: unknown[] }).events
  if (raw.length === 0 || raw.length > ACTIVITY_MAX_BATCH)
    return { ok: false, reason: `Send 1 to ${ACTIVITY_MAX_BATCH} events` }
  const events: ActivityEvent[] = []
  for (const [index, item] of raw.entries()) {
    const event = parseActivityEvent(item)
    if (!event) return { ok: false, reason: `Event ${index} is not valid` }
    events.push(event)
  }
  return { ok: true, events }
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyId: number | null
  }
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: options.bodyLimitBytes,
    trustProxy: true, // behind nginx on the VPS
    logger: options.logger ? { redact: ['req.headers.authorization'], level: 'info' } : false
  })
  const limiter = createRateLimiter(options.rateLimitPerMinute)
  app.decorateRequest('apiKeyId', null)

  /** NFR-35: every API call needs a good key and stays under the rate limit. */
  async function requireKey(
    request: FastifyRequest
  ): Promise<{ status: number; error: string } | null> {
    const key = bearerKey(request.headers.authorization)
    const id = key ? await checkApiKey(options.db, key) : null
    if (id === null) return { status: 401, error: 'A valid API key is needed' }
    if (!limiter.allow(String(id))) return { status: 429, error: 'Too many requests; try later' }
    request.apiKeyId = id
    return null
  }

  app.get(ACTIVITY_PATHS.health, async (request, reply) => {
    const denied = await requireKey(request)
    if (denied) return reply.code(denied.status).send({ error: denied.error })
    return { ok: true, version: options.version }
  })

  app.post(ACTIVITY_PATHS.events, async (request, reply) => {
    const denied = await requireKey(request)
    if (denied) return reply.code(denied.status).send({ error: denied.error })
    const checked = checkBatch(request.body)
    if (!checked.ok) return reply.code(400).send({ error: checked.reason })
    return storeEvents(options.db, checked.events, request.apiKeyId ?? 0)
  })

  return app
}
