# Requirement v3: Focus timer (Pomodoro) and Thai/English UI - | - | - | - |

Status: APPROVED by the user on 2026-11-06. Not built yet; implementation starts with V3-M1 only after the user says go. Open questions (section 13) use the defaults written here until decided. v2.0 (requirement-v2.md) stays the base: everything in v1 and v2 keeps working.

## 1. Overview

v3 adds two things:

1. A focus timer in the Pomodoro style: focus for a set time, take a short break, take a long
   break after a few rounds. The cat cheers you on at each change of phase, but otherwise
   keeps living its normal life.
2. A language setting: the whole UI in Thai or English.

Still one pet, fully offline, personal use, gentle (no penalties).

## 2. Decisions made (user, 2026-11-06)

| Topic | Decision |
| --- | --- |
| Cat during focus | Lively, lives as usual (wanders, sleeps, reacts, care works). The timer does not change its behavior except for the phase reactions. |
| Link to pet care | None. Focus sessions do not change hunger, happiness or decay. |
| Durations | User sets them in Settings. |
| Stats | Only the number of focus sessions completed today. |
| Art | New clips for the timer; the user provides the sheet later (section 9 lists what is needed). |
| Language | User picks Thai or English. |

## 3. Scope

v3.0 in scope:
- Focus timer with focus, short break and long break phases; start, pause, resume, skip and
  stop from menus.
- Remaining time in the tooltips and the tray menu; Windows notification at each phase end.
- Settings section for the timer; completed-today counter.
- Cat reactions at phase changes, using new clips (fallback to existing clips until the art
  arrives).
- Thai and English UI with a language setting.

Out of scope for v3.0:
- History, charts, streaks, goals (only today's count).
- Task lists, labels, sync, calendar (never online).
- Sounds other than the standard Windows notification sound.
- Rewards in the pet-care system (user decision).
- Coins, shop, more pets, other species (unchanged from v2).

## 4. Timer model

Phases: `idle` (no session), `focus`, `shortBreak`, `longBreak`. Each running phase has an end
time on the wall clock. Paused phases keep their remaining time instead.

Settings (all in config limits; defaults from the classic Pomodoro method):

| Setting | Default | Range |
| --- | --- | --- |
| focusMinutes | 25 | 1 to 120 |
| shortBreakMinutes | 5 | 1 to 60 |
| longBreakMinutes | 15 | 1 to 60 |
| longBreakEvery | 4 focus sessions | 2 to 10 |
| autoStartBreaks | on | on/off |
| autoStartFocus | off | on/off |
| notifications | on | on/off |

Flow:
- Start focus -> `focus`. When it ends: today's count +1, then a short break, or a long break
  if this was focus number `longBreakEvery` (2 x, 3 x ...) in the current run.
- When a break ends: `focus` again if autoStartFocus is on; otherwise `idle` waiting for the
  user (the menu offers "Start focus").
- If autoStartBreaks is off, the break waits for the user ("Start break" / "Skip break").
- Skip: ends the current phase without counting it and moves on as if it had ended (skipping a
  focus does not add to the count).
- Stop: back to `idle`; the run (counter towards the long break) resets. Today's count stays.
- Pause / Resume: only during a running phase.

Rules:
- Time comes from the wall clock (end time), not from counting ticks. One timer is set for the
  next phase end; there is no per-second work (NFR-16).
- PC asleep or app frozen: if the PC was asleep for more than 5 minutes during a focus phase,
  that focus is interrupted (not counted) and the timer goes to `idle` with a notification
  "Focus interrupted". A break that ends during sleep simply ends.
- Clock going backwards: end times are kept; the phase ends when the clock reaches them again
  or the user skips. (Edge case; documented, not special-cased beyond not crashing.)
- Quitting the app during a session ends the session (not resumed on next launch). Today's
  count is saved.
- "Today" is the local calendar date; the count resets at local midnight (checked when the
  count is read or changed, and at the midnight timer while the app runs).

## 5. Cat reactions

The cat lives as in v2. At phase changes it plays a reaction once, then goes back to what it
was doing:

| Moment | Clip (new) | Fallback until the art exists |
| --- | --- | --- |
| Focus starts | `focusStart` | `click` |
| Focus completed | `focusDone` | `happy` (or `click` if the model has no `happy`) |
| Break over (time to focus) | `breakOver` | `click` |
| Long break starts (Should) | `longBreak` | `focusDone` |

Rules:
- A reaction is skipped while the cat is being dragged, hidden (tray or fullscreen) or not
  adopted; the notification still shows.
- A sleeping cat (user away) wakes for the reaction and may fall asleep again (like FR-21).
- A reaction during a care animation waits until it ends (at most one queued reaction).
- No adopted pet: the timer still works from the tray; only notifications and tooltips show.

## 6. Interactions and display

| ID | Requirement |
| --- | --- |
| FR-35 | Tray menu and the cat's right-click menu get a "Focus" submenu: Start focus (idle), Pause / Resume, Skip (focus or break), Start break / Skip break (when a break waits), Stop. Only the items that apply are shown. |
| FR-36 | Tray tooltip and the cat tooltip show the phase and the minutes left (e.g. "Focus · 12 min left", "Paused · 8 min left"), plus "Today: 3 🍅". Updated once a minute and on every change. |
| FR-37 | Windows notification at the end of each phase (focus completed, break over, focus interrupted), unless notifications are off. Clicking it does nothing beyond showing the app. Uses Electron's built-in Notification (offline). |
| FR-38 | The cat plays the reaction for each phase change (section 5). |
| FR-39 | Settings gets a "Focus timer" section: the settings from section 4 and "Completed today: N". Changes apply to the next phase; a running phase keeps its end time. |
| FR-40 | Today's count is saved in its own file, focus.json, next to settings.json: { version, date, completed }. Atomic write, validated on load; a damaged file is renamed to focus.json.bad and the count starts at 0. Uninstall removes it (NFR-08). |
| FR-41 | (Could) The tray icon shows a small mark while a focus phase runs. |

## 7. Language

| ID | Requirement |
| --- | --- |
| FR-42 | Settings has a Language choice: ไทย / English. Default on first run: Thai if the Windows display language is Thai, otherwise English. Saved in settings.json. |
| FR-43 | Every user-facing text uses the chosen language: tray and cat menus, tooltips, settings, adoption window, dialogs (re-adopt), About, notifications, mood words. Text lives in one table per language in src/shared (keys identical; a test checks both tables have the same keys). |
| FR-44 | Changing the language applies at once without restart: open windows update, menus and tooltips use it from the next time they are shown or refreshed. |
| FR-45 | Upgrading from v2 keeps all settings; the language default applies only when settings.json has no language yet. |

Existing data is not translated: the cat's name stays as typed.

## 8. Non-functional requirements (additions)

| ID | Topic | Target |
| --- | --- | --- |
| NFR-16 | Cost | The timer adds no per-second work: one timeout to the next phase end, one minute tick for tooltips only while a phase runs. Idle CPU and RAM stay within NFR-01. |
| NFR-17 | Accuracy | A phase ends within 1 s of its end time while the PC is awake. |
| NFR-18 | Correctness | Timer logic (phases, long break cycle, skip, pause, sleep gap, midnight reset) is pure and unit tested. |
| NFR-19 | Config | Timer defaults and limits live in one config module (like careConfig.ts). |
| NFR-20 | Language | No hardcoded UI text outside the language tables; Thai text renders correctly in every window and in menus. |

## 9. Art needed from the user

A new sheet `cat-focus.png`, made the same way as the care sheet so it fits without changes
to the engine:

- 8 columns, one clip per row, starting at column 0; 224 x 224 px cells; transparent
  background; feet at about y = 210; the cat the same size and style as in the care sheet.
- No frame crosses its cell. Props (clock, tomato, sparkles, headband) count as part of the cat
  for clicks, so keep them close to the cat.
- Up to 8 frames per clip; each clip plays once and should start and end in a pose close to
  the normal sitting idle so it blends back.

| Row | Clip | Priority | Idea (free to change) |
| --- | --- | --- | --- |
| 1 | `focusStart` | Must | "Let's go!": the cat ties on a headband or puts on small glasses, fist pump |
| 2 | `focusDone` | Must | The cat cheers with a tomato or a little trophy, sparkles |
| 3 | `breakOver` | Must | An alarm clock rings next to the cat; it taps it and points "back to work" |
| 4 | `longBreak` | Should | The cat stretches long and yawns, or lies down with a cup of tea |

Three rows are enough to ship (row 4 falls back to `focusDone`). The inbox file goes into
`assets/sprites-inbox/`; `npm run sprite:prepare` cleans it like the care sheet.

## 10. Behavior state machine additions

New states `focusStart`, `focusDone`, `breakOver`, `longBreak`: reactions that return to
`idle` on clipFinished and can be interrupted by a drag, like the care reactions.

| From | Event | To |
| --- | --- | --- |
| idle, walk, sleep, land | timerReaction(x) | x (the reaction state) |
| eat, happy, hungry, pet, click | timerReaction(x) | queued; played on the next `idle` |
| focusStart, focusDone, breakOver, longBreak | clipFinished | idle |
| focusStart, focusDone, breakOver, longBreak | dragStart | drag |

Timer phases themselves live in main, not in the pet state machine: the pet machine only
plays reactions.

## 11. Milestones (v3)

Same rule as v1 and v2: each phase must pass its gate, then wait for the user's approval.
The language work comes first because it needs no art and touches every window once.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V3-M1 | Language: Thai and English tables, language setting, live switch, all existing text moved to the tables | Every window, menu, tooltip, dialog and notification shows correct Thai and English; key-parity test passes; upgrade from v2 keeps settings | Done 2026-11-06, approved |
| V3-M2 | Timer engine: pure timer logic, focus.json, today's count, midnight reset, sleep gap, config | Unit tests for every rule in section 4; count survives restart; damaged focus.json handled | Done 2026-11-06, approved |
| V3-M3 | Timer UI: Focus submenus, tooltips, notifications, settings section; reactions with fallback clips | Full focus/break/long-break cycle works from tray and cat menu; notifications appear; settings apply | - |
| V3-M4 | Art: import cat-focus.png, new clips and reactions (needs the user's sheet) | Each reaction plays at the right moment; feet do not jump between sheets | - |
| V3-M5 | Polish: NFR-01/16/17 measurement, installer 3.0.0, upgrade from 2.0.0 | Acceptance criteria below pass | - |

## 12. Acceptance criteria (v3)

- [ ] Language can be switched between Thai and English; all UI text follows without restart.
- [ ] A full cycle (4 focus sessions with breaks, then a long break) runs with the chosen
      durations; skip, pause, resume and stop behave as in section 4.
- [ ] Notifications show at each phase end and can be turned off.
- [ ] Tooltips and menus show the phase, minutes left and today's count.
- [ ] Today's count survives restart and resets at midnight.
- [ ] The cat plays the right reaction at each phase change and otherwise behaves as in v2.
- [ ] Pet care is not affected by the timer.
- [ ] Idle CPU and RAM still meet NFR-01, with and without a running timer.
- [ ] Upgrading from 2.0.0 keeps settings and pet data.

## 13. Open questions

Defaults are used until the user decides:

- Should a session survive quitting the app (resume on next launch)? Default: no.
- Sleep gap: interrupt a focus after 5 minutes of PC sleep. Is that the right threshold?
- Should the cat show the remaining time on screen (a small badge next to it)? Default: no,
  tooltips only (a badge needs a bigger window and its own design).
- Notification sound: Windows default, or silent? Default: Windows default.
- Long-break reaction (row 4): wanted, or reuse `focusDone`?
