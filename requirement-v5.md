# Requirement v5: Gravity, window perches, jumping and climbing

Status: APPROVED by the user on 2026-11-07 (options A and B first, option C, section 6, added and approved the same day; open questions on their defaults). Built and accepted 2026-11-08, released as 5.0.0 (measurements in section 15). Open questions (section 14) use the defaults written here until decided. v4 (requirement-v4.md) stays the base: everything in v1 to v4 keeps working.

## 1. Overview

Today the cat only walks sideways (FR-06) and stays exactly where it is dropped (FR-04). v5 lets it move up and down in a natural way:

1. Gravity (A): a cat dropped in the air falls down and lands on the floor (the top of the taskbar).
2. Window perches (B): a cat that falls onto another app's window lands on its top edge, sits and walks there, rides along when the window moves, and falls again when the window goes away.
3. Jump and climb (C): now and then the cat jumps up onto a nearby window, jumps down from a perch, or climbs up the side of the screen and lets go.

A and B need no new art: falling uses the existing `drag` clip and landing uses `land`. C needs a new sheet from the user (section 9); without it C stays off. Still one pet, fully offline, personal use.

## 2. Decisions (user, 2026-11-07)

| Topic | Decision |
| --- | --- |
| Scope | Options A (gravity), B (window perches) and C (jump and climb) from the 2026-11-07 proposal. A and B approved first; C added and approved the same day. |
| Art | A and B: none needed. C: a new sheet `cat-move.png` from the user (section 9). Features that need art stay off until it exists, as in v3 and v4. |

## 3. Scope

In scope: the features in section 1, their settings, Thai and English text for everything new.

Out of scope for v5.0:

- Physics beyond falls and jump arcs (no throwing, bouncing or sliding).
- Climbing the sides of other windows (only the left and right edges of the screen), walking upside down, hanging from window bottoms.
- Perching on the taskbar, the desktop icons, the Start menu or other system UI.
- macOS/Linux, more pets, online features (unchanged).

## 4. Gravity (A)

| ID | Requirement |
| --- | --- |
| FR-60 | When a drag ends (FR-04) and the cat's feet are above the floor, the cat falls straight down with constant acceleration up to a top speed (config), then plays `land` when its feet touch down. While falling it plays `fall` if the model has it, otherwise `drag`. |
| FR-61 | The floor is the bottom of the work area of the display under the cat's centre (so the cat stands on the taskbar, or on the screen bottom when the taskbar auto-hides). With several monitors the cat falls on the display it is over; it never falls onto another display. |
| FR-62 | The cat can be grabbed again while falling (dragStart works in the air). Clicks, care actions and wanders wait until it has landed. A focus reaction (FR-38) is queued and plays after the landing, like during a drag. A sleeping cat that starts to fall wakes up. |
| FR-63 | The landing spot is saved as the position (FR-04). On start, and when the displays change (monitor added or removed, resolution, DPI, taskbar moved), a cat that is in the air falls once to the floor (or a perch, FR-66). |
| FR-64 | Setting "Gravity", **on by default**. When off, the cat stays where it is dropped, exactly as in v4, and window perches (section 5) and jump and climb (section 6) are off too. |
| FR-65 | Walking (FR-06) is unchanged: horizontal only, on the floor or on the perch the cat stands on. |

## 5. Window perches (B)

| ID | Requirement |
| --- | --- |
| FR-66 | While falling, the cat lands on the first visible top edge of another app's window that is below its feet and under its centre line. The part of the edge under the cat must not be covered by a window in front of it. The cat must fit above the edge inside the work area; otherwise that edge is skipped. |
| FR-67 | Windows that count as perches: visible, not minimized, not maximized, not fullscreen, not cloaked (other virtual desktops, hidden store apps), normal top-level app windows (no tool windows, no taskbar or desktop), not the app's own windows, and at least 2 x the cat's width wide (config). |
| FR-68 | On a perch, walks stay within the edge (minus a margin, config). At the end of the edge the cat turns around, or jumps down when C is available (FR-75). Idle, sleep, look, care and focus reactions work as on the floor. |
| FR-69 | The cat rides along: when the perch window moves, the cat keeps its place on the edge. When the window gets narrower, the cat is moved to stay on it. |
| FR-70 | The cat loses its perch and falls (FR-60) when the window is minimized, maximized, closed, goes fullscreen, moves to another virtual desktop or becomes too narrow, or when another window comes in front of the spot under the cat's feet. When it falls it may land on another window below (FR-66) or on the floor. |
| FR-71 | Setting "Sit on windows", **on by default**; only available while Gravity is on. When off, the cat always falls to the floor and does not jump onto windows. A perch is not remembered across restarts: on start the cat falls from its saved position (FR-63) and may land on a perch again. |
| FR-72 | The window list and window positions come from the main process through koffi (user32 / dwmapi, already a dependency for FR-16) in a new main module. No new runtime dependency. Nothing about other windows is stored or sent anywhere (NFR-07). |

## 6. Jump and climb (C)

All of section 6 needs the `cat-move.png` clips (section 9). Without a clip, the feature that needs it is off and the A/B behavior stays.

| ID | Requirement |
| --- | --- |
| FR-73 | Jump up: now and then, instead of a wander (chance in config), an idle cat on the floor or on a perch jumps up onto a perch (FR-66, FR-67) whose top edge is above its feet, within a maximum jump height and sideways distance (config, in cat units so it scales with the pet). It plays `jump` (take-off, then the air pose) along an arc, then `land` on the edge. With no edge in reach it wanders as usual. Needs "Sit on windows" on. |
| FR-74 | The jump target is checked once when the jump is chosen and again at the top of the arc. If the target edge moved, got covered or went away, the cat does not land there: it falls (FR-60) from where it is and may land on something else. |
| FR-75 | Jump down: at the end of a perch edge, or now and then instead of a wander on a perch (chance in config), the cat jumps down: `jump` take-off sideways, then it falls (FR-60) to the floor or a lower perch. Without the clip it turns around (FR-68). |
| FR-76 | Climb: now and then, instead of a wander on the floor (chance in config), the cat walks to the left or right edge of the screen's work area and climbs up it, playing `climb` (mirrored for the left edge, like `walk`). It stops at a random height (config range, below the top of the work area), holds on for a moment (`hang`, or the first `climb` frame without it), then lets go and falls (FR-60), possibly onto a perch. Only on the outer edges of the display it is on: never across to another monitor. |
| FR-77 | The cat can be grabbed while jumping or climbing (dragStart). Clicks, care actions and wanders wait until it has landed, like during a fall (FR-62); a care request from a menu is kept until then. Sleep never starts mid-jump or mid-climb. |
| FR-78 | Setting "Jump and climb", **on by default**; only available while Gravity is on (and only shown once the model has the clips). A sad cat (v2 mood) jumps and climbs less often, like it wanders less. Not while the user is away or the cat is hidden. |

## 7. Non-functional requirements (additions)

| ID | Topic | Target |
| --- | --- | --- |
| NFR-25 | Cost | The window list is read only when a fall or jump starts (and once at the top of a jump arc). On the floor nothing polls. On a perch, the perch window is checked at most 4 times per second while it is still, and up to 30 times per second only while it is moving (for a short time after a change). No checks while the cat is hidden, paused for fullscreen (FR-16) or dragged. Idle CPU and RAM stay within NFR-01, on the floor and on a perch. |
| NFR-26 | Smoothness | The window moves at most 30 times per second during falls, jumps and climbs (NFR-02). A fall from the top of a 1080p screen takes about 1 second (config). Riding a dragged window may trail by one check, never more than about 33 ms while it moves. |
| NFR-27 | Click-through | Transparent areas never block the mouse, also while falling, jumping, climbing and on a perch (FR-05). The cat stands above the edge, so it never covers the perch window's own title bar buttons. |
| NFR-28 | Config | Gravity, top speed, poll rates, minimum perch width, edge margin, jump height and distance, jump and climb chances, climb heights and hold time live in a config module (main MOTION config or a new movement config), not in components. |
| NFR-29 | Language | All new text in both language tables (NFR-20). |
| NFR-30 | Gentle | Jumps and climbs are occasional (at most a few per hour by default) so the cat stays calm on the desktop; never more often than wanders. |

## 8. Window size while climbing

The pet window is sized for the standing cat (`modelFrame()`). A climbing cat stands on its side against the screen edge, so the model config gets a second anchor for wall clips: where the paws touch the wall in the cell (for example x = 210 for a wall on the right). Main keeps the window inside the work area and snaps that anchor to the screen edge while climbing. The window size does not change between clips (no resize during play).

## 9. Art needed from the user (option C)

A new sheet `cat-move.png`, made like the care sheet: 8 columns, one clip per row from column 0, 224 x 224 px cells, **real transparent background**, the cat the same size and style as before, no frame crossing its cell. Floor clips keep the feet at about y = 210; the wall clips keep the paws on the wall at about x = 210 (wall on the right). An off-spec sheet can still go through `npm run sprite:regrid`, but a clean sheet looks better.

| Row | Clip | Priority | Idea (free to change) | Playback |
| --- | --- | --- | --- | --- |
| 1 | `jump` | Must for FR-73, FR-75 | Crouch, push off, then stretched out in the air, facing **right** | intro then hold (loop from the last 2 frames) |
| 2 | `fall` | Should | Legs spread, ears up, a little surprised | loop |
| 3 | `climb` | Must for FR-76 | Side view, body upright against a wall on the **right**, paws reaching up, climbing | loop |
| 4 | `hang` | Could | Holding on to the wall, looking around or down | loop |

Without the sheet: FR-73 to FR-78 are off, falling plays `drag`, a cat at the end of a perch turns around.

## 10. Behavior state machine additions

New states `fall`, `jump`, `climb`, `hang`. Main runs the motion (it moves the window) and tells the pet when a fall, jump or climb starts, when it reaches its hold point and when it lands, over new IPC channels (for example `pet:fall-start`, `pet:jump-start`, `pet:climb-hold`, `pet:landed`).

| From | Event | To |
| --- | --- | --- |
| drag | dragEnd, feet above the floor or a perch (Gravity on) | fall |
| drag | dragEnd, already standing (or Gravity off) | land (as in v4) |
| idle, walk, sleep, look, sad, stretch, yawn | perchLost | fall |
| idle | jumpUp / jumpDown (chosen instead of a wander) | jump |
| walk | edge reached during a climb wander | climb |
| climb | holdPoint | hang |
| hang | letGo | fall |
| jump | landed | land |
| jump | targetLost | fall |
| fall | landed | land |
| fall, jump, climb, hang | dragStart | drag |

## 11. Testing notes

- The ledge search (which edge is hit, covered parts, too narrow, no room above), the jump target search (height, distance) and the arc and climb paths are pure logic in `src/shared` or `src/main/lib` with unit tests, like placement.ts.
- In-app checks use test windows the test itself opens and moves (for example a plain window from a test script, moved with SetWindowPos), not the user's own apps, and no system-wide mouse or keyboard input (testing rule from 2026-11-06). Dev hooks can trigger a jump or climb on demand, like `wanderNow()`.
- Real apps (Explorer, a browser) and dragging a window by hand are hand checks for the user.

## 12. Milestones (v5)

Same phase approval rule as before. v5 starts only after the user accepts v4.0 (V4-M5). V5-M1 to V5-M3 need no art.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V5-M1 | Gravity: fall state, fall motion in main, floor per display, catch in the air, Gravity setting, settle on start and display change | Falls and lands on the floor; can be caught mid-air; setting off behaves like v4; click-through during the fall; fall rules unit tested | Done 2026-11-08, approved |
| V5-M2 | Window perches: native window list (koffi), ledge search, landing on an edge, Sit on windows setting | Lands on the right window; skips minimized, maximized, cloaked, too narrow, covered and own windows; ledge search unit tested | Done 2026-11-08, approved |
| V5-M3 | Riding and losing the perch: follow moves, walk within the edge, fall on every loss case, poll tiers | Rides a moving test window; falls on minimize, close, maximize, cover; no polling on the floor (measured) | Done 2026-11-08, approved |
| V5-M4 | Art import (`cat-move.png`), jump up and jump down, Jump and climb setting | Jumps onto a test window in reach and not out of reach; lost target falls; jumps down at an edge; feet steady; jump rules unit tested | Done 2026-11-08, approved |
| V5-M5 | Climb: wall anchor, climb wander, hold and let go | Climbs both screen edges, holds, falls (onto a perch when one is below); never crosses to another monitor; click-through while climbing | Done 2026-11-08, approved |
| V5-M6 | Polish: tuning, NFR-01/25 measurement, installer 5.0.0, upgrade from 4.0.0 | Acceptance criteria below pass | Done 2026-11-08, accepted |

## 13. Acceptance criteria (v5)

- [x] A cat dropped in the air falls and lands on the floor of the display it is over; the landing spot is remembered.
- [x] The cat can be caught while falling, jumping or climbing; nothing else interrupts those.
- [x] With Gravity off the cat behaves exactly as in v4.
- [x] A cat that falls onto a suitable window lands on its top edge and walks only along it.
- [x] The cat rides along when its window moves and falls when the window is minimized, maximized, closed, goes fullscreen or gets covered. (Fullscreen: a fullscreen window in front also hides the cat, FR-16; not hand-checked.)
- [x] With the move clips, the cat now and then jumps up onto a window in reach, jumps down from a perch, and climbs a screen edge and lets go; with the setting off or without the clips it does none of that.
- [x] Clicks pass through empty areas while falling, jumping, climbing and on a perch.
- [x] Idle CPU and RAM still meet NFR-01 on the floor and on a perch; nothing polls on the floor (NFR-25).
- [x] Upgrading from 4.0.0 keeps settings, pet and focus data; the new settings appear with their defaults. (Installed over 4.0.0; the data seen from the Claude session is the sandboxed copy, see section 15.)

## 14. Open questions

Defaults are used until the user decides:

- Gravity, Sit on windows, and Jump and climb on by default? (default: all on).
- When another window covers the spot under the cat: fall (default) or stay put?
- Fall speed: about 1 second from the top of the screen. Too fast or too slow?
- Minimum perch width 2 x the cat's width. Should small windows (dialogs) count?
- Jump reach: up to 3 x the cat's height up and 4 x its width sideways? How often: about 1 in 6 wanders for a jump, 1 in 10 for a climb?
- Climb height: anywhere from a quarter to three quarters of the screen height, holding 2 to 5 seconds?
- v4.0 acceptance: accept 4.0 with the 8-hour run (NFR-22) still open, or finish it before V5-M1?

## 15. Measurements and release checks (V5-M6, 2026-11-08)

Production build, isolated `--user-data-dir` with v4-shaped data (settings.json without the v5 keys, a test cat, focus.json version 2), pet size 0.7, cat awake (sleep after 120 min), settings window closed, 60 s, all processes of the run (main, renderer, GPU, network):

| Where | CPU (machine) | CPU (one core) | Main process | Private RAM | NFR-01 |
| --- | --- | --- | --- | --- | --- |
| Floor (default settings, cat wandering) | 0.085 % | 1.35 % | 0.16 % of one core | 204.4 MB | pass |
| Perch (test window, Jump and climb off so it stays) | 0.119 % | 1.90 % | 0.47 % of one core | 215.8 MB | pass |

- v4.0 for comparison: 0.041 % of the machine, 201.2 MB (requirement-v4.md). The perch checks add about 0.3 % of one core in main (NFR-25: 4 checks per second while the perch is still).
- Tuning: no changes. A fall from the top of a 1080p screen takes about 1.04 s (NFR-26). Jumps and climbs share a 10 min cooldown, so at most 6 per hour while the cat is awake, usually fewer (NFR-30).
- Upgrade data (isolated run): a v4 settings.json gets gravity, sitOnWindows and jumpAndClimb on, the other settings unchanged; the cat and today's focus count load; a cat saved in the air falls at start.
- Installer: `dist/desktop-pet-setup-5.0.0.exe` (112 MB). The packaged app (win-unpacked, isolated data) landed on a test window at start (koffi in the package works), rode along when it moved and fell when it was minimized; no debug hook in the build.
- Install over 4.0.0 (2026-11-08, with the user's OK): `desktop-pet-setup-5.0.0.exe /S` exit 0, Uninstall entry 5.0.0; settings.json and pet.json byte-identical to the backup after install (no focus.json yet); Run key unchanged; launched: only the pet window, the cat sOrinOi is back (no adoption, no .bad file). The session sees a sandboxed %APPDATA% (WORK-LOG 2026-11-07), so the real data is a hand check for the user.

