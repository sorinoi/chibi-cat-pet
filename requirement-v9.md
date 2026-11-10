# Requirement v9: Quick buttons around the cat

Status: DONE. Approved by the user on 2026-11-10 as written (open questions on their defaults); done and accepted 2026-11-10, released as 9.0.0. v8 (requirement-v8.md, released as 8.0.0) stays the base: everything in v1 to v8 keeps working. V6-M4 (server deploy) still waits for the user's VPS and is not part of v9.

## 1. Overview

Today every action is in the right-click menu or the tray menu. The user wants the most used actions closer at hand: when the mouse rests on the cat, a few round buttons float up and spread in an arc over its head. One click does the action; the buttons go away when the mouse leaves.

## 2. Decisions (user, 2026-11-10)

| Topic | Decision |
| --- | --- |
| Trigger | The mouse rests still on the cat for a moment (not on first touch), so petting by stroking keeps working. |
| Leaving | The buttons stay a short moment after the mouse leaves the cat, so the mouse can travel to them. |
| Moving cat | While the mouse is on the cat or the buttons, the cat waits (no wander). No buttons while it walks, hops, falls, jumps, climbs or is dragged. |
| Screen edges | Near the top of the screen the arc flips below the feet; near the left or right edge it shifts and tilts toward the middle. Always fully on screen. |
| Buttons | Four: Feed, Focus, Settings, Hide. |
| Layout | Floating round buttons spread in an arc over the head, not a straight row; they pop out of the head one after another and bob gently while shown. |

## 3. Scope

In scope: the hover trigger and hide rules, a small buttons window, the arc layout with edge handling, the four actions, the pop and float animation, a setting to turn it off, Thai and English labels.

Out of scope for v9.0: more or user-picked buttons, keyboard access, buttons for other windows (Settings, adoption), new cat art or clips, drawn icon art (icons are emoji until the user brings art).

## 4. Showing and hiding

| ID | Requirement |
| --- | --- |
| FR-120 | The buttons appear when the cursor stays over the cat's drawn pixels (the same hit test as click-through) without moving more than a few DIP for 0.7 s, while the cat is idle, looking or asleep (on the floor or on a window edge), visible, and the setting is on. Moving the mouse restarts the wait, so a stroke (FR-18) never opens them. |
| FR-121 | The buttons hide 0.6 s after the cursor is on neither the cat nor a button, at once on a click on the cat, a drag start, a right-click menu, a care or focus reaction, a fall, the cat or app being hidden, a fullscreen app in front (FR-16), or the setting turned off. |
| FR-122 | While the buttons show, or the cursor rests on the cat, the cat stays where it is: the wander timer does not run (like `look`, FR-56). It goes back to its usual life when they hide. An asleep cat stays asleep (opening the buttons is not "user back"). |
| FR-123 | No buttons while the cat moves: walk, hop, fall, jump, climb, hang, drag. A move never starts while they show. |

## 5. Layout

| ID | Requirement |
| --- | --- |
| FR-124 | Four round buttons on an arc centred over the top of the cat's art (the top of the current frame's opaque pixels), spread over about 140 degrees, in this order from left to right: Feed, Focus, Settings, Hide. Button size and arc radius scale with the pet size and stay readable at the smallest size. |
| FR-125 | Edges: if the arc does not fit above the cat inside the work area of the cat's display, it opens below the feet instead; if it would cross the left or right edge, it rotates toward the middle of the display and then shifts, so every button is fully on screen. |
| FR-126 | Empty space between and around the buttons lets clicks through (like FR-05); only the buttons themselves catch the mouse. |
| FR-127 | Each button shows a short label next to it while the cursor is on it (Thai or English, NFR-20 rule). |

## 6. Actions

| ID | Requirement |
| --- | --- |
| FR-128 | Feed: the same as Feed in the cat's menu (care:request, through the pet's state machine). A full cat politely refuses as today. Without an adopted cat the button is not shown and the arc has three buttons. |
| FR-129 | Focus: the timer's main action for its state: Start focus when stopped, Pause while running (focus or break), Resume when paused, Start break when a break waits to be started (added in V9-M2, like the Focus menu). Icon and label follow the state. |
| FR-130 | Settings opens (or brings to front) the settings window; Hide hides the cat like the menu's Hide (the tray brings it back). |
| FR-131 | After a click the buttons hide, then the action runs, so the cat's reaction (eat, focusStart, ...) is not covered. |

## 7. Look and motion

| ID | Requirement |
| --- | --- |
| FR-132 | Icons are emoji in round light buttons with a soft outline: Feed 🍗, Focus 🍅 (Pause ⏸️, Resume ▶️, Start break ☕), Settings ⚙️, Hide 🙈. They can be swapped for drawn icons later without changing the layout. |
| FR-133 | Appear: the buttons grow out of the head point to their places one after another (about 40 ms apart, 220 ms each). Hide: they shrink back into the head (150 ms). While shown each button bobs up and down by a few DIP, each at its own phase (a 12 fps timer in 0.5 DIP steps since V9-M3: a CSS animation repainted the window 60 times a second, about 28 % of one core). Hovered button grows a little. |
| FR-134 | Settings > General: "Buttons over the cat" (on by default; older settings files read as on). Off means the v8 behavior. |

## 8. Non-functional requirements (additions)

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-50 | Cost | Nothing runs for the buttons while they are hidden except the dwell wait inside the pet's existing pointer handling (no new timers while the cursor is away from the cat). The bob runs only while the buttons show. Idle CPU and RAM stay within NFR-01 (RAM measured with the buttons window). |
| NFR-51 | Speed | Buttons start to appear within 100 ms after the dwell ends; a click runs its action within 100 ms (NFR-04 rule). |
| NFR-52 | Security | The buttons window follows NFR-06/07: its own tiny typed preload, contextIsolation, no Node, no remote content. |
| NFR-53 | Language | All new text in both language tables (NFR-20). |

## 9. Architecture notes

- New window `actions.html` (renderer page, preload `actions`): transparent, frameless, always on top, skipTaskbar, not focusable, not resizable, created hidden at start (or on first use if RAM needs it) and shown/hidden by main. Main places it from the pet window's bounds and the head point (src/main/lib/actionArc.ts: pure arc and edge math, tested), follows the pet if its window moves while shown.
- Pet renderer: dwell detection in the pointer handling (config in src/renderer/config.ts), sends `pet:actions-show` with the head point; petMachine gets a calm state for "buttons open" (no wander timer, like `look`), left on hide or any event that hides the buttons.
- Actions renderer: pointer enter/leave keeps the buttons open (`actions:hover`), click sends `actions:run` (feed / focus / settings / hide); main runs feed through care:request, focus through focusEngine, settings and hide through the existing app actions, and pushes the focus state for the Focus button.
- Click-through in the actions window: setIgnoreMouseEvents(true, { forward: true }) toggled by whether the cursor is over a button.
- Timings (dwell 0.7 s, hide delay 0.6 s, animation times) and sizes in config, not in components.

## 10. Testing notes

- Unit: arc layout (centre, flip below, rotate and shift at the left and right edges, every button inside the work area, three-button arc), dwell rules (movement restarts it), focus button state, settings parsing, petMachine transitions.
- App checks (isolated data, CDP): dwell opens the arc; a stroke does not; moving from the cat to a button keeps it open; leaving hides it; each button does its action; cat at the top, left and right edges; perched cat; no buttons while walking or hopping; click-through between buttons; Thai and English labels; CPU and RAM idle and with the buttons shown.

## 11. Milestones (v9)

Same phase approval rule as before.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V9-M1 | Buttons window, dwell trigger and hide rules, arc layout with edge handling, cat waits; buttons without actions | Unit tests; in the app the arc opens on a rest, not on a stroke, stays while moving to it, fits at all edges; click-through between buttons | Done 2026-11-10, approved |
| V9-M2 | The four actions, focus button states, labels TH/EN, Settings switch | Each button does what the menu does; Feed hidden without a cat; switch off = v8 | Done 2026-11-10, approved |
| V9-M3 | Pop and float animation, tuning, NFR measurement, README, installer 9.0.0, upgrade from 8.0.0 | Acceptance criteria below pass | Done 2026-11-10, accepted (released as 9.0.0) |

## 12. Acceptance criteria (v9)

- [x] Resting the mouse on the cat opens four buttons in an arc over its head; stroking it still pets it without opening them. (V9-M1, V9-M3)
- [x] The buttons stay while the mouse moves to them and hide shortly after it leaves. (V9-M1: 0.6 s; shrink 138 ms)
- [x] Feed, Focus (start, pause, resume), Settings and Hide do the same as the menu. (V9-M2)
- [x] At the top, left and right edges of the screen and on a window edge every button is fully visible. (V9-M1 edges; labels V9-M2)
- [x] The cat does not wander off while the buttons show; no buttons while it moves. (V9-M1: 16 s at Lively)
- [x] Clicks pass through the gaps between buttons. (V9-M1)
- [x] Idle CPU and RAM still meet NFR-01. (section 14)

## 13. Open questions

Defaults are used until the user decides:

- Icons: emoji (default) or drawn icons from the user later.
- Dwell 0.7 s and hide delay 0.6 s (default); tune after trying it.
- The setting on by default (default: yes).
- Should Hide ask first? (default: no, the tray brings the cat back like the menu's Hide.)

## 14. Measurements (V9-M3, 2026-11-10)

Production build, isolated data, pet size 0.7, Calm, 2560 x 1600 at 125 %, 16 logical processors. CPU is the app's processes together (now five: the buttons window has its own renderer); RAM is private bytes.

| Check | Result | Target |
| --- | --- | --- |
| NFR-01 idle, 60 s | CPU 0.14 % of the machine, 216 MB (8.0.0 Calm: 191 MB; the buttons window adds about 25 MB) | Pass |
| NFR-50 buttons hidden | buttons renderer 0 s CPU over 60 s | Pass |
| NFR-50 buttons shown and bobbing, 10 s | 6.2 % of one core, 0.39 % of the machine (first try with a 60 fps CSS bob: 28.3 %) | - |
| NFR-51 rest end -> first button frame | 58 ms | 100 ms |
| NFR-51 click Focus -> timer running | 12 ms | 100 ms |
| FR-133 appear | buttons start 20-40 ms apart, each about 205 ms to full size (slight overshoot to 1.08) | 40 / 220 ms |
| FR-133 hide | shrink 138 ms; window hidden 814 ms after the pointer left (0.6 s delay + shrink + 30 ms) | 150 ms |
| Upgrade | 9.0.0 installed over 8.0.0: settings.json and pet.json byte-identical, cat and look kept, buttons on | - |
