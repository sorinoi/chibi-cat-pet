import { screen, type BrowserWindow, type Point, type Rectangle } from 'electron'
import { MOTION, PET_WINDOW, WALL } from './config'
import {
  allowedArea,
  clampPosition,
  fallDistance,
  isAboveFloor,
  patrolDirection,
  planWalk,
  resizeKeepingFeet,
  scaledOverflow,
  scaledSize,
  snapToGrid,
  type Area,
  type Rect,
  type Size
} from './lib/placement'
import {
  findLanding,
  followPerch,
  perchWalkArea,
  type DesktopWindow,
  type Landing
} from './lib/ledges'
import {
  arcPoint,
  atPerchEnd,
  chooseJump,
  jumpDownSpot,
  jumpDurationMs,
  jumpUpTargets,
  type JumpQuery
} from './lib/jumps'
import { climbRise, planClimb } from './lib/climbs'
import type { ClimbPhase, ClimbStarted, JumpStarted, WalkEnded, WalkRequest } from '../shared/ipc'
import type { Position } from '../shared/settings'

export interface PetMotion {
  startDrag(): void
  /** Stops following the cursor where it is (no fall). */
  endDrag(): void
  /**
   * requirement-v5.md FR-60: the user let go. Falls when Gravity is on and the cat is in
   * the air; otherwise it is standing right away. Either way onLanded follows.
   */
  drop(): void
  /**
   * FR-63: a cat at rest in the air (start, shown again, displays changed, Gravity turned
   * on) falls; onFallStart tells the pet. Otherwise onLanded (the pet ignores it unless it
   * was left falling). Does nothing while dragged, walking or falling.
   */
  settle(): void
  /**
   * Stops a fall where it is and the perch checks (the window is being hidden); settle()
   * resumes both later.
   */
  stopFall(): void
  /**
   * FR-73, FR-75: jump up onto a window in reach, or down off the perch, if one fits;
   * null otherwise (or while busy, or with Gravity or Jump and climb off). onLanded or
   * onFallStart follows when it ends; a lost target turns into a fall (FR-74).
   */
  startJump(): JumpStarted | null
  /** The pet could not show the jump after all: end it (falling if in the air). */
  stopJump(): void
  /**
   * FR-76: from the floor, walk to the nearer edge of the display, climb it, hold on, let
   * go and fall (maybe onto a perch). Null when it does not fit or while busy.
   * onClimbPhase marks the wall and the top; onFallStart (or onLanded) the end.
   */
  startClimb(): ClimbStarted | null
  /** The pet could not show the climb after all: end it (falling if in the air). */
  stopClimb(): void
  /** Returns the planned signed distance (0 = no room or currently dragging). */
  startWalk(request: WalkRequest): number
  stopWalk(): void
  /** FR-11 pet size: resizes the window around the cat's feet. */
  setScale(scale: number): void
  dispose(): void
}

export interface PetMotionEvents {
  onWalkEnded(event: WalkEnded): void
  /** The window came to rest at a new position (after a drag, walk, fall or resize). */
  onSettled(position: Position): void
  /** A fall started without a drop (settle). */
  onFallStart(): void
  /** The cat stands again after a drop or a fall (FR-60). */
  onLanded(): void
  /** FR-76: the climbing cat reached the wall (climb) or the top (hold). */
  onClimbPhase(phase: ClimbPhase): void
}

export interface PetMotionOptions {
  /** The Gravity setting (FR-64). */
  gravity(): boolean
  /** Windows the cat may land on, front-most first; empty when Sit on windows is off (FR-71). */
  windows(): readonly DesktopWindow[]
  /** Jump and climb setting on and the model has the jump clip (FR-78). */
  jumps(): boolean
  /** Jump and climb setting on and the model has climb art with a wall point (FR-76, FR-78). */
  climbs(): boolean
  /**
   * FR-69, FR-70: the perch window now (null when gone) and the windows in front of it that
   * overlap `probe`, the spot under the cat's feet (DIP).
   */
  inspectWindow(
    id: number,
    probe: Rect
  ): { target: DesktopWindow | null; front: readonly DesktopWindow[] }
}

/** FR-69: the window the cat sits on, where on its edge, and its frame at the last check. */
interface Perch {
  id: number
  offsetX: number
  rect: Rect
}

const sameRect = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

export function petWindowSize(scale: number): Size {
  return scaledSize(PET_WINDOW, scale)
}

/** Top-left for the window: `preferred` if given, else lower right; always kept on screen. */
export function initialPosition(scale: number, preferred: Position | null): Position {
  const size = petWindowSize(scale)
  const overflow = scaledOverflow(MOTION.overflow, scale)
  if (preferred) {
    // getDisplayMatching picks the nearest display, so a position on a monitor that
    // was unplugged lands on a connected one.
    const { workArea } = screen.getDisplayMatching({ ...preferred, ...size })
    return snapToGrid(preferred.x, preferred.y, allowedArea(workArea, size, overflow))
  }
  const { workArea } = screen.getPrimaryDisplay()
  return snapToGrid(
    workArea.x + workArea.width - size.width - PET_WINDOW.edgeMargin,
    workArea.y + workArea.height - size.height - PET_WINDOW.edgeMargin,
    allowedArea(workArea, size, overflow)
  )
}

/**
 * Moves the pet window: follows the cursor while dragging (FR-04), walks it
 * horizontally (FR-06) and lets it fall to the floor or onto another window's top edge
 * (requirement-v5.md FR-60, FR-66), where it rides along and walks only on that edge
 * (FR-68, FR-69) until the window goes away (FR-70). Positions are clamped to the work area
 * of the display under the cursor (drag) or under the window (walk, fall), so multi-monitor
 * works and a fall never crosses to another display (FR-61).
 */
export function createPetMotion(
  win: BrowserWindow,
  initialScale: number,
  events: PetMotionEvents,
  options: PetMotionOptions
): PetMotion {
  let scale = initialScale
  let dragTimer: NodeJS.Timeout | null = null
  let dragOffset: Point = { x: 0, y: 0 }
  let walkTimer: NodeJS.Timeout | null = null
  /** requirement-v8.md FR-111: the way the last walk went (0 before the first). */
  let lastWalkDirection: 1 | -1 | 0 = 0
  let fallTimer: NodeJS.Timeout | null = null
  let perch: Perch | null = null
  let perchTimer: NodeJS.Timeout | null = null
  /** Fast perch checks until then (the perch window moved recently). */
  let perchFastUntil = 0
  let jumpTimer: NodeJS.Timeout | null = null
  let climbTimer: NodeJS.Timeout | null = null

  function areaAt(point: Point): Area {
    const { workArea } = screen.getDisplayNearestPoint(point)
    return allowedArea(workArea, petWindowSize(scale), scaledOverflow(MOTION.overflow, scale))
  }

  function centerOf(b: Rectangle): Point {
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
  }

  function moveTo(x: number, y: number): void {
    if (win.isDestroyed()) return
    // setBounds with a fixed size: setPosition alone can resize the window when it
    // crosses monitors with different DPI scaling.
    win.setBounds({ x: Math.round(x), y: Math.round(y), ...petWindowSize(scale) })
  }

  function settled(): void {
    if (win.isDestroyed()) return
    const { x, y } = win.getBounds()
    events.onSettled({ x, y })
  }

  function finishWalk(completed: boolean): void {
    if (!walkTimer) return
    clearInterval(walkTimer)
    walkTimer = null
    settled()
    events.onWalkEnded({ completed })
  }

  function endDrag(): void {
    if (!dragTimer) return
    clearInterval(dragTimer)
    dragTimer = null
    settled()
  }

  /** Returns true if a jump was running (the cat may be in the air). */
  function cancelJump(): boolean {
    if (!jumpTimer) return false
    clearInterval(jumpTimer)
    jumpTimer = null
    settled()
    return true
  }

  /** Returns true if a climb was running (the cat may be on the wall). */
  function cancelClimb(): boolean {
    if (!climbTimer) return false
    clearInterval(climbTimer)
    climbTimer = null
    settled()
    return true
  }

  /** Falls from where the cat is, or tells the pet it stands. */
  function fallOrLand(): void {
    if (startFall()) events.onFallStart()
    else events.onLanded()
  }

  /** Returns true if a fall was running. */
  function stopFall(): boolean {
    if (!fallTimer) return false
    clearInterval(fallTimer)
    fallTimer = null
    settled()
    return true
  }

  /** Pet window size and the perch distances that grow with it. */
  function geometry(): {
    size: Size
    feetOffset: number
    footHalfWidth: number
    minPerchWidth: number
    edgeMargin: number
  } {
    const size = petWindowSize(scale)
    const { minWidthFactor, footHalfWidthFactor, edgeMarginFactor } = MOTION.perch
    return {
      size,
      // The window hangs its empty bottom margin below the feet (see allowedArea).
      feetOffset: size.height - scaledOverflow(MOTION.overflow, scale).bottom,
      footHalfWidth: size.width * footHalfWidthFactor,
      minPerchWidth: size.width * minWidthFactor,
      edgeMargin: size.width * edgeMarginFactor
    }
  }

  const displays = (): Rect[] => screen.getAllDisplays().map((d) => d.bounds)

  /**
   * FR-66: where the cat comes to rest falling straight down from `bounds`: the first free
   * window edge below its feet, or the floor of the display under it. The window list is
   * read here, once per fall (NFR-25).
   */
  function landingFor(bounds: Rectangle): Landing {
    return findLanding(
      {
        ...geometry(),
        x: bounds.x,
        y: bounds.y,
        area: areaAt(centerOf(bounds)),
        tolerance: MOTION.fall.restTolerance
      },
      options.windows(),
      displays()
    )
  }

  function clearPerch(): void {
    if (perchTimer) clearTimeout(perchTimer)
    perchTimer = null
    perch = null
  }

  function schedulePerchCheck(): void {
    const { pollMs, fastPollMs } = MOTION.perch
    perchTimer = setTimeout(checkPerch, Date.now() < perchFastUntil ? fastPollMs : pollMs)
  }

  /** The cat stands on a perch (just landed, or found standing there): start checking it. */
  function sitOn(landing: Landing, x: number): void {
    if (landing.perchId === null || !landing.perchRect) return
    perch = { id: landing.perchId, rect: landing.perchRect, offsetX: x - landing.perchRect.x }
    perchFastUntil = 0
    schedulePerchCheck()
  }

  /**
   * FR-69, FR-70 / NFR-25: one look at the perch window (and the windows in front of it):
   * ride along, move inward, or fall when it is gone. Runs only while the cat sits on a
   * perch and is visible; 4 Hz while the window is still, ~30 Hz for a moment after it moved.
   */
  function checkPerch(): void {
    perchTimer = null
    const current = perch
    if (!current || win.isDestroyed() || !win.isVisible()) return
    const bounds = win.getBounds()
    // The spot under the feet on the edge as last seen; a moved window is re-checked next time.
    const { footHalfWidth } = geometry()
    const probe = {
      x: bounds.x + bounds.width / 2 - footHalfWidth,
      y: current.rect.y - 1,
      width: footHalfWidth * 2,
      height: 2
    }
    const { target, front } = options.inspectWindow(current.id, probe)
    const moved = !target || !sameRect(target.rect, current.rect)
    // The cat may have walked along a still edge; a moved window carries it from its place.
    const offsetX = moved ? current.offsetX : bounds.x - current.rect.x
    const result = followPerch({ ...geometry(), offsetX, areaAt }, target, front, displays())
    if (result.lost || !target) {
      finishWalk(false)
      if (startFall()) events.onFallStart()
      else events.onLanded()
      return
    }
    if (moved) perchFastUntil = Date.now() + MOTION.perch.fastForMs
    if (result.x !== bounds.x || result.y !== bounds.y) {
      finishWalk(false) // riding beats walking
      moveTo(result.x, result.y)
      settled()
    }
    perch = { id: current.id, rect: target.rect, offsetX: result.x - target.rect.x }
    schedulePerchCheck()
  }

  /** Starts falling from where the window is if it is in the air; true when it falls. */
  function startFall(): boolean {
    clearPerch()
    if (win.isDestroyed() || !options.gravity()) return false
    const bounds = win.getBounds()
    const { restTolerance, gravity, maxSpeed, intervalMs } = MOTION.fall
    const landing = landingFor(bounds)
    const target = landing.y
    // Already standing on the floor or an edge (or within the tolerance of it).
    if (target - bounds.y <= restTolerance) {
      sitOn(landing, bounds.x)
      return false
    }

    const { x, y: startY } = bounds
    const startedAt = Date.now()
    fallTimer = setInterval(() => {
      const y = Math.min(target, startY + fallDistance(Date.now() - startedAt, gravity, maxSpeed))
      moveTo(x, y)
      if (y < target) return
      stopFall()
      sitOn(landing, x)
      events.onLanded()
    }, intervalMs)
    return true
  }

  /** Anything moving the window right now. */
  const busy = (): boolean =>
    dragTimer !== null ||
    walkTimer !== null ||
    fallTimer !== null ||
    jumpTimer !== null ||
    climbTimer !== null

  /** FR-76: plans and starts a climb; see PetMotion.startClimb. */
  function startClimb(): ClimbStarted | null {
    if (busy() || win.isDestroyed() || perch) return null
    if (!options.gravity() || !options.climbs() || WALL.climb === null) return null
    const bounds = win.getBounds()
    const area = areaAt(centerOf(bounds))
    // Only from the floor (FR-76: instead of a wander on the floor).
    if (isAboveFloor(bounds.y, area, MOTION.fall.restTolerance)) return null
    const { workArea } = screen.getDisplayNearestPoint(centerOf(bounds))
    const g = geometry()
    const c = MOTION.climb
    const plan = planClimb({
      x: bounds.x,
      y: bounds.y,
      size: g.size,
      area,
      work: workArea,
      wallOffset: {
        climb: WALL.climb * g.size.width,
        hang: (WALL.hang ?? WALL.climb) * g.size.width
      },
      rise: climbRise(workArea.height, c.riseShare, Math.random()),
      minRise: g.size.height * c.minRiseFactor
    })
    if (!plan) return null

    const startX = bounds.x
    const floorY = bounds.y
    const walkDistance = Math.abs(plan.walkToX - startX)
    const direction = Math.sign(plan.walkToX - startX)
    const walkPerMs = (c.walkSpeed * scale) / 1000
    const climbPerMs = (c.climbSpeed * scale) / 1000
    const holdMs = c.holdMs.min + Math.random() * (c.holdMs.max - c.holdMs.min)
    let phase: 'toWall' | 'intro' | 'climb' | 'hold' = 'toWall'
    let phaseAt = Date.now()
    climbTimer = setInterval(() => {
      const now = Date.now()
      const elapsed = now - phaseAt
      if (phase === 'toWall') {
        const travelled = Math.min(walkDistance, elapsed * walkPerMs)
        moveTo(startX + direction * travelled, floorY)
        if (travelled < walkDistance) return
        // Paws on the wall (the window may hang past the area here, section 8).
        moveTo(plan.climbX, floorY)
        phase = 'intro'
        phaseAt = now
        events.onClimbPhase('climb')
      } else if (phase === 'intro') {
        if (elapsed < c.startDelayMs) return
        phase = 'climb'
        phaseAt = now
      } else if (phase === 'climb') {
        const y = Math.max(plan.topY, floorY - elapsed * climbPerMs)
        moveTo(plan.climbX, y)
        if (y > plan.topY) return
        moveTo(plan.holdX, plan.topY)
        phase = 'hold'
        phaseAt = now
        events.onClimbPhase('hold')
      } else if (elapsed >= holdMs) {
        // Let go: back inside the area (a little away from the wall), then fall.
        cancelClimb()
        const away = clampPosition(plan.holdX, plan.topY, area)
        moveTo(away.x, away.y)
        fallOrLand()
      }
    }, c.intervalMs)
    return { side: plan.side }
  }

  /** FR-73..75: plans and starts a jump; see PetMotion.startJump. */
  function startJump(): JumpStarted | null {
    if (busy() || win.isDestroyed()) return null
    if (!options.gravity() || !options.jumps()) return null
    const bounds = win.getBounds()
    const g = geometry()
    const j = MOTION.jump
    const q: JumpQuery = {
      ...g,
      x: bounds.x,
      y: bounds.y,
      area: areaAt(centerOf(bounds)),
      minRise: g.size.height * j.minRiseFactor,
      maxRise: g.size.height * j.maxRiseFactor,
      maxSide: g.size.width * j.maxSideFactor
    }
    const up = jumpUpTargets(q, options.windows(), displays())
    const down = perch ? jumpDownSpot(q, perch.rect, g.size.width * j.downClearanceFactor) : null
    const atEnd = perch ? atPerchEnd(q, perch.rect, j.endSlack) : false
    const plan = chooseJump(up, down, atEnd, Math.random)
    if (!plan) return null

    clearPerch()
    const from = { x: bounds.x, y: bounds.y }
    let to = plan.to
    let rect = plan.kind === 'up' ? plan.perchRect : null
    const lift = g.size.height * j.liftFactor
    const flightMs = jumpDurationMs(from, to, j)
    const startedAt = Date.now()
    let checked = plan.kind !== 'up'
    jumpTimer = setInterval(() => {
      const t = (Date.now() - startedAt - j.takeoffMs) / flightMs
      if (t < 0) return // crouch and push off first
      if (!checked && rect && plan.kind === 'up' && t >= 0.5) {
        checked = true
        // FR-74: at the top of the arc, is the edge still there and free?
        const probe = {
          x: to.x + g.size.width / 2 - g.footHalfWidth,
          y: rect.y - 1,
          width: g.footHalfWidth * 2,
          height: 2
        }
        const { target, front } = options.inspectWindow(plan.perchId, probe)
        const result = followPerch(
          { ...g, offsetX: to.x - rect.x, areaAt },
          target,
          front,
          displays()
        )
        if (result.lost || !target) {
          cancelJump()
          fallOrLand()
          return
        }
        to = { x: result.x, y: result.y }
        rect = target.rect
      }
      const p = arcPoint(from, to, lift, t)
      moveTo(p.x, p.y)
      if (t < 1) return
      cancelJump()
      if (plan.kind === 'up' && rect) {
        sitOn({ y: to.y, perchId: plan.perchId, perchRect: rect }, to.x)
        events.onLanded()
      } else {
        fallOrLand() // FR-75: off the end of the perch, then down
      }
    }, j.intervalMs)
    return { dx: to.x - from.x }
  }

  return {
    startJump,

    stopJump() {
      if (cancelJump()) fallOrLand()
    },

    startClimb,

    stopClimb() {
      if (cancelClimb()) fallOrLand()
    },

    startDrag() {
      finishWalk(false)
      cancelJump() // caught mid-jump
      cancelClimb() // picked off the wall
      stopFall() // FR-62: caught in the air
      clearPerch() // picked up off a perch
      endDrag()
      const cursor = screen.getCursorScreenPoint()
      const bounds = win.getBounds()
      dragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
      dragTimer = setInterval(() => {
        const c = screen.getCursorScreenPoint()
        const target = clampPosition(c.x - dragOffset.x, c.y - dragOffset.y, areaAt(c))
        const now = win.getBounds()
        if (target.x !== now.x || target.y !== now.y) moveTo(target.x, target.y)
      }, MOTION.dragIntervalMs)
    },

    endDrag,

    drop() {
      endDrag()
      stopFall()
      if (!startFall()) events.onLanded()
    },

    settle() {
      if (busy()) return
      if (startFall()) events.onFallStart()
      // A fall stopped by hiding may have nothing left to do: the pet must not stay falling.
      else events.onLanded()
    },

    stopFall() {
      stopFall()
      cancelJump() // settle() picks it up again when shown
      cancelClimb()
      clearPerch()
    },

    startWalk({ dx, speed, roll }) {
      if (dragTimer || fallTimer || jumpTimer || climbTimer) return 0
      if (!Number.isFinite(dx) || !Number.isFinite(speed) || speed <= 0) return 0
      finishWalk(false)
      const bounds = win.getBounds()
      const area = areaAt(centerOf(bounds))
      // FR-68: on a perch, only along its edge; the cat turns around at the ends.
      const { size, edgeMargin } = geometry()
      const walkArea = perch ? perchWalkArea(area, perch.rect, size, edgeMargin) : area
      // Walk distance and speed are in "cat units", so they scale with the pet.
      // requirement-v8.md FR-111: when the pet leaves the direction to main, patrol: keep going
      // the same way until the room ahead runs out, then turn.
      const wantedDistance = Math.abs(dx) * scale
      const wanted =
        roll === undefined
          ? dx * scale
          : wantedDistance *
            patrolDirection(
              bounds.x,
              walkArea,
              wantedDistance,
              lastWalkDirection,
              roll,
              MOTION.patrolKeepChance
            )
      const planned = planWalk(bounds.x, wanted, walkArea, MOTION.minWalkDistance)
      if (planned !== 0) lastWalkDirection = planned > 0 ? 1 : -1
      if (planned === 0) return 0

      const startX = bounds.x
      const y = bounds.y
      const distance = Math.abs(planned)
      const direction = Math.sign(planned)
      const pxPerMs = (Math.min(speed, MOTION.maxWalkSpeed) * scale) / 1000
      const startedAt = Date.now()

      walkTimer = setInterval(() => {
        const travelled = Math.min(distance, (Date.now() - startedAt) * pxPerMs)
        moveTo(startX + direction * travelled, y)
        if (travelled >= distance) finishWalk(true)
      }, MOTION.walkIntervalMs)
      return planned
    },

    stopWalk() {
      finishWalk(false)
    },

    setScale(next) {
      if (next === scale || win.isDestroyed()) return
      finishWalk(false)
      const wasFalling = stopFall()
      const wasJumping = cancelJump() || cancelClimb()
      const resized = resizeKeepingFeet(win.getBounds(), petWindowSize(next))
      scale = next
      const pos = clampPosition(resized.x, resized.y, areaAt(centerOf(resized)))
      moveTo(pos.x, pos.y)
      settled()
      // The pet is still falling or jumping: carry on falling from the new size, or land.
      if (wasFalling || wasJumping) fallOrLand()
    },

    dispose() {
      if (dragTimer) clearInterval(dragTimer)
      dragTimer = null
      if (walkTimer) clearInterval(walkTimer)
      walkTimer = null
      if (fallTimer) clearInterval(fallTimer)
      fallTimer = null
      if (jumpTimer) clearInterval(jumpTimer)
      jumpTimer = null
      if (climbTimer) clearInterval(climbTimer)
      climbTimer = null
      clearPerch()
    }
  }
}
