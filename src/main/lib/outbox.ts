/**
 * requirement-v6.md FR-89, FR-90, NFR-33: events waiting to be sent, kept in a file (one JSON
 * per line), not in memory. Only the count stays in memory; a batch is read when it is sent.
 * No Electron imports, unit tested with a temp folder.
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { parseActivityEvent, type ActivityEvent } from '../../shared/activity'

export interface Outbox {
  /** Events waiting. */
  count(): number
  /** Events dropped by the limits since the app started (FR-89). */
  dropped(): number
  append(event: ActivityEvent): void
  /** The oldest `n` events, after dropping any that are too old. */
  peek(n: number): ActivityEvent[]
  /** Removes the events with these ids (sent). */
  remove(ids: ReadonlySet<string>): void
  /** FR-88: empties the outbox. */
  clear(): void
}

export interface OutboxOptions {
  path: string
  maxEvents: number
  maxAgeMs: number
  now?: () => number
}

const DAMAGED_SUFFIX = '.bad'

/** Reads every good event; `damaged` when any line could not be used. */
function readAll(path: string): { events: ActivityEvent[]; damaged: boolean } {
  if (!existsSync(path)) return { events: [], damaged: false }
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return { events: [], damaged: true }
  }
  const events: ActivityEvent[] = []
  let damaged = false
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let event: ActivityEvent | null = null
    try {
      event = parseActivityEvent(JSON.parse(line) as unknown)
    } catch {
      event = null
    }
    if (event) events.push(event)
    else damaged = true
  }
  return { events, damaged }
}

const toLines = (events: readonly ActivityEvent[]): string =>
  events.map((e) => JSON.stringify(e) + '\n').join('')

export function createOutbox({
  path,
  maxEvents,
  maxAgeMs,
  now = () => Date.now()
}: OutboxOptions): Outbox {
  let count = 0
  let dropped = 0

  /** Atomic rewrite, like the other data files. */
  function write(events: readonly ActivityEvent[]): void {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    writeFileSync(tmp, toLines(events), 'utf8')
    renameSync(tmp, path)
    count = events.length
  }

  /** FR-89: drops events that are too old, then the oldest beyond the limit. */
  function limit(events: ActivityEvent[]): ActivityEvent[] {
    const oldest = now() - maxAgeMs
    let kept = events.filter((e) => e.at >= oldest)
    if (kept.length > maxEvents) kept = kept.slice(kept.length - maxEvents)
    dropped += events.length - kept.length
    return kept
  }

  /** Reads, applies the limits and rewrites the file when anything changed. */
  function load(): ActivityEvent[] {
    const { events, damaged } = readAll(path)
    if (damaged) {
      // FR-90: keep the original for a look, carry on with the good lines.
      try {
        copyFileSync(path, path + DAMAGED_SUFFIX)
      } catch {
        // nothing to keep
      }
      console.warn(`${path} had damaged lines; kept a copy as ${path}${DAMAGED_SUFFIX}`)
    }
    const kept = limit(events)
    if (damaged || kept.length !== events.length) write(kept)
    else count = kept.length
    return kept
  }

  load()

  return {
    count: () => count,
    dropped: () => dropped,

    append(event) {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, JSON.stringify(event) + '\n', 'utf8')
      count += 1
      // Over the limit: trim back to 90 % in one rewrite, not one rewrite per new event.
      if (count > maxEvents) {
        const { events } = readAll(path)
        const keep = Math.floor(maxEvents * 0.9)
        dropped += Math.max(0, events.length - keep)
        write(events.slice(Math.max(0, events.length - keep)))
      }
    },

    peek(n) {
      if (count === 0) return []
      return load().slice(0, n)
    },

    remove(ids) {
      if (ids.size === 0 || count === 0) return
      const { events } = readAll(path)
      write(events.filter((e) => !ids.has(e.id)))
    },

    clear() {
      rmSync(path, { force: true })
      rmSync(`${path}.tmp`, { force: true })
      count = 0
    }
  }
}
