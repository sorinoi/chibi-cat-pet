# Requirement v8: A livelier cat — more walking and hopping

Status: DONE. Approved by the user on 2026-11-08 as written (open questions on their defaults); done and accepted 2026-11-10, released as 8.0.0. Open questions (section 12) use the defaults written here until decided. v7 (requirement-v7.md, released as 7.0.0) stays the base: everything in v1 to v7 keeps working. V6-M4 (server deploy) still waits for the user's VPS and is not part of v8.

## 1. Overview

The user feels the cat stays in the same place too much. Today it sits 20 to 60 seconds between walks, walks only 80 to 300 DIP (at pet size 1; 56 to 210 at 70 %), and picks a random direction each time, so it mostly paces around one spot.

v8:

1. Walks more often and farther, and prefers the side with more room, so it roams the whole floor (or the whole window edge it sits on).
2. Hops: now and then the cat hops along the floor in a short run of little jumps, using the user's new art `cat-jump.png`.
3. An "Activity" setting (Calm / Normal / Lively) so the user can choose how busy the cat is.

## 2. Decisions (user, 2026-11-08)

| Topic | Decision |
| --- | --- |
| Walking | More, and around the whole screen instead of one spot. |
| Hopping | Yes, with the user's `cat-jump.png` (8 frames: sit, crouch, push off, rise, top, fall, land, sit). |
| Hop height | The app lifts the cat in an arc (like the v5 window jumps); the ground shadows drawn in the art are removed and every frame stands on the feet line, so the frames fit the normal 224 px cell and nothing pops in or out. |

## 3. Scope

In scope: wander timing, distance and direction; the hop clip, hop runs on the floor and on a perch; the Activity setting; the shadow removal step in `sprite:regrid`; the hop sheet for all four looks; Thai and English text.

Out of scope for v8.0: new clips other than `hop`, chasing the mouse, hopping onto or between windows (the v5 jumps do that), physics such as bouncing off screen edges.

## 4. Walking more

| ID | Requirement |
| --- | --- |
| FR-110 | Normal activity: the cat waits 8 to 25 s between wanders (was 20 to 60) and walks 150 to 500 DIP at pet size 1 (was 80 to 300). The walk speed stays the same (it matches the walk frames). |
| FR-111 | Direction, patrol (changed by the user on 2026-11-08 after the first app check: "toward the room" alone kept the cat in the middle): the cat keeps walking the way its last walk went in 3 of 4 walks, and turns when the room ahead is shorter than the walk; the first walk heads toward the side with more room. So it sweeps from end to end of the floor or the perch. A walk never goes past the area it may walk in (floor, or the perch's walk area, unchanged from v5). |
| FR-112 | Unchanged rules keep their meaning: a sad cat waits twice as long (FR-21), the cat sleeps after the user is away (FR-07), jumps and climbs keep their chance and 10 min cooldown (v5). |

## 5. Hopping

| ID | Requirement |
| --- | --- |
| FR-113 | New optional clip `hop` (sheet `hop`, one row of 8 frames). Without it the cat does not hop. Frames: 0 sit, 1 crouch, 2 push off, 3 rise, 4 top, 5 fall, 6 land, 7 sit. |
| FR-114 | A wander becomes a hop run with some chance (Normal: 1 in 4 wanders): 2 to 5 hops in one direction (chosen like FR-111). Each hop moves 40 to 80 DIP sideways at pet size 1 and rises in an arc up to 0.3 of the pet's height; the window is still during frames 0 to 1 (crouch), flies during frames 2 to 5, and is back on the ground line for frames 6 to 7. The run ends early at the edge of the walk area. |
| FR-115 | Main owns the hop motion, like walks and jumps (pet:hop-start, answered with the planned hops; pet:hop-stop); the pet plays the clip once per hop and stays in a new state `hop`. A catch during a hop becomes a drag (then the usual drop and fall); a perch that goes away during a hop makes the cat fall (v5 rules). Menu care waits until the run ends, like during walks. |
| FR-116 | The hop sheet is made from `assets/sprites-inbox/cat-jump.png` with `sprite:regrid -- <in> <out> 0.72 8 1 --painted-background --drop-shadows`: the painted checkerboard is cleared (as for cat-move.png), flat light-grey ground shadows are removed (new `--drop-shadows` step), each frame stands on the feet line at y = 210 in 224 px cells. The gray, black and white looks get their hop sheets with `sprite:recolor` (the layout test of v7 then covers them). |

## 6. Activity setting

| ID | Requirement |
| --- | --- |
| FR-117 | Settings > General: "Activity" with Calm, Normal (default) and Lively. Calm = the v7 behavior (wait 20 to 60 s, walk 80 to 300, no hops). Normal = section 4 and 5. Lively = wait 4 to 12 s, walk 200 to 700, hop runs 1 in 3 wanders. The values live in the renderer behavior config (NFR-28 rule). |
| FR-118 | The setting applies from the next wander; it is saved in settings.json (`activity`, default "normal"; older files read as normal). |

## 7. Non-functional requirements (additions)

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-45 | Cost | No new timers while the cat sits; walks and hops move the window at most 30 times per second (NFR-02) only while moving. Idle CPU and RAM stay within NFR-01 at every activity level; a minute of Lively stays under 0.5 % of the machine on average (changed by the user on 2026-11-10 from "2 % of one core": a moving cat costs about 9 % of one core and a Lively cat moves over half of the time; walks keep 30 Hz). |
| NFR-46 | Click-through | Clicks pass through empty areas during hops, as during walks and jumps (FR-05). |
| NFR-47 | Language | All new text in both language tables (NFR-20). |
| NFR-48 | Gentle | Calm keeps the cat as quiet as in v7; even Lively never hops more than once in 20 s. |

## 8. Architecture notes

- Renderer: BEHAVIOR gets the three activity levels (wait, distance, hop chance); `usePetBehavior` picks walk or hop run on each wander; petMachine gets state `hop` (events hopRun, hopLanded, plus dragStart, fallStart, landed).
- Main: `petMotion.startHops(plan)` flies each hop on the existing ~30 Hz motion timer (arc like `arcPoint` in lib/jumps.ts with a small lift), pure planning in `src/main/lib/hops.ts` (count, distances inside the walk area, timing from the clip's frameMs), tested.
- Tools: `scripts/lib/spriteRegrid.mts` gets `dropShadows` (remove pieces that are light, low-chroma and much wider than tall, below the cat).

## 9. Testing notes

- Unit: wander direction and distance rules, activity levels, hop planning (inside the area, edges, timing per frame), shadow detection in the regrid tool, settings parsing.
- App checks (isolated data, CDP): a hop run on the floor and on a test window (Perch A), catching mid-hop, the perch vanishing mid-hop, each activity level's timing, CPU during a Lively minute.

## 10. Milestones (v8)

Same phase approval rule as before.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V8-M1 | Walking more: timing, distance, direction toward room; Activity setting (TH/EN) | Unit tests; in the app the cat roams the whole floor; Calm behaves like v7 | Done 2026-11-08, approved |
| V8-M2 | Hop art: `--drop-shadows`, hop sheet for all four looks (previews approved by the user) | Hop frames fit the cell with feet on one line, no shadows; layout test passes | Done 2026-11-08, approved |
| V8-M3 | Hop runs: hop state, main motion, planning, interruptions | Hops on the floor and on a perch; catch and lost perch handled; click-through | Done 2026-11-08, approved |
| V8-M4 | Polish: tuning, NFR-01/45 measurement, README, installer 8.0.0, upgrade from 7.0.x | Acceptance criteria below pass | Done 2026-11-10, accepted (released as 8.0.0; upgrade checked over 7.0.0 on this PC) |

## 11. Acceptance criteria (v8)

- [x] At Normal the cat walks noticeably more and reaches both ends of the floor within a few minutes (V8-M1: 1391 -> 106 DIP in 4 min, then back; V8-M4: 5 walks in a minute).
- [x] Now and then it hops along in a short run, in every look, on the floor and on a window edge (V8-M3 floor and Perch A; V8-M4 all four looks, frames 0-7, lift 48 DIP at size 0.7).
- [x] Calm behaves like v7; Lively is busier but never hops more than once in 20 s (Calm uses the v7 timings and no hops; the 20 s gap is in BEHAVIOR.hop and unit tested).
- [x] A catch during a hop works like a catch during a walk; a lost perch during a hop makes it fall (V8-M3).
- [x] Idle CPU and RAM still meet NFR-01 at every level (section 13).

## 12. Open questions

Defaults are used until the user decides:

- The Activity setting with three levels (default: yes, Normal by default).
- How often hops come at Normal (default: 1 in 4 wanders) and how high (default: up to 0.3 of the pet's height).
- Should hops also need the "Jump and climb now and then" switch? (default: no; hops follow the Activity setting only, Calm has none.)

## 13. Measurements (V8-M4, 2026-11-10)

Production build, isolated data, pet size 0.7, 2560 x 1600 at 125 %, 16 logical processors. CPU is the app's four processes together; RAM is private bytes.

| Check | Result | Target |
| --- | --- | --- |
| NFR-01 Calm, 60 s | CPU 0.11 % of the machine, 191 MB | Pass |
| NFR-01 Normal, 60 s (5 walks, 1 hop run) | CPU 0.31 % of the machine, 215 MB | Pass |
| NFR-01 / NFR-45 Lively, 60 s (moving 41 s: 2 walks, a climb) | CPU 0.44 % of the machine (7.1 % of one core), 213 MB | Pass (under 0.5 % of the machine) |
| Cost per second | moving (walk or hop) about 9.4 % of one core, sitting about 0.9 % | - |

Notes:

- The first target in NFR-45 (2 % of one core) could not be met: a Lively cat moves more than half of the time and moving the window 30 times a second costs about 9 % of one core (main 46 %, GPU 30 %, renderer 22 %). A trial at 20 Hz walks cut moving to 7.2 % (Lively about 4 %); the user chose to keep 30 Hz and change the target (2026-11-10).
- A cat that stops next to a parked mouse looks at it and does not wander until the mouse moves (v4 FR-56, unchanged). With more walking this happens more often.
