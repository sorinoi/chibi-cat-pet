<div align="center">

<img src="resources/icon.png" width="96" alt="Desktop Pet icon">

# Desktop Pet

**A little cat that lives on your Windows desktop, and wants you to look after it.**<br>
**แมวน้อยที่มาอยู่บนเดสก์ท็อป Windows ของคุณ และรอให้คุณดูแล**

![version](https://img.shields.io/badge/version-2.0.0-f4a261)
![platform](https://img.shields.io/badge/platform-Windows%20x64-2a9d8f)
![offline](https://img.shields.io/badge/works-100%25%20offline-264653)
![stack](https://img.shields.io/badge/Electron%20%2B%20Vue%203-TypeScript-6c757d)

<img src="docs/images/hero.png" width="338" alt="The cat walks in, celebrates, eats, gets petted, walks back and falls asleep">

[English](#english) · [ภาษาไทย](#thai)

</div>

## Meet the cat · รู้จักน้องแมว

Every animation below is rendered straight from the app's sprite sheets.<br>
ทุกท่าด้านล่างสร้างจาก sprite sheet ตัวเดียวกับที่แอปใช้จริง

<table align="center">
  <tr>
    <td align="center"><img src="docs/images/clip-idle.png" width="128" alt="idle"><br><sub><b>idle</b><br>นั่งเล่น</sub></td>
    <td align="center"><img src="docs/images/clip-walk.png" width="128" alt="walk"><br><sub><b>walk</b><br>เดินเล่น</sub></td>
    <td align="center"><img src="docs/images/clip-click.png" width="128" alt="click"><br><sub><b>click</b><br>โดนจิ้ม</sub></td>
    <td align="center"><img src="docs/images/clip-drag.png" width="128" alt="drag"><br><sub><b>drag</b><br>โดนอุ้ม</sub></td>
    <td align="center"><img src="docs/images/clip-land.png" width="128" alt="land"><br><sub><b>land</b><br>ลงพื้น</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/images/clip-sleep.png" width="128" alt="sleep"><br><sub><b>sleep</b><br>หลับปุ๋ย</sub></td>
    <td align="center"><img src="docs/images/clip-eat.png" width="128" alt="eat"><br><sub><b>eat</b><br>กินข้าว</sub></td>
    <td align="center"><img src="docs/images/clip-happy.png" width="128" alt="happy"><br><sub><b>happy</b><br>ดีใจ</sub></td>
    <td align="center"><img src="docs/images/clip-hungry.png" width="128" alt="hungry"><br><sub><b>hungry</b><br>หิวแล้ว</sub></td>
    <td align="center"><img src="docs/images/clip-pet.png" width="128" alt="pet"><br><sub><b>pet</b><br>โดนลูบหัว</sub></td>
  </tr>
</table>

---

<a name="english"></a>

## English

### What it does

**A desktop companion (v1)**

- 🪟 Sits in a transparent, always-on-top window. Clicks pass through everything except the
  cat itself, so it never gets in your way.
- 🖱️ Click it for a reaction, drag it anywhere, drop it and it lands. It remembers where you
  left it.
- 🚶 Wanders around now and then, and 💤 falls asleep after a few minutes without input.
- 🎮 Pauses when it is hidden or a fullscreen game or video is in front.
- ⚙️ Tray icon and settings: size, opacity, always on top, start with Windows, sleep delay.

**A pet to look after (v2)**

- 🏡 Adopt one cat and give it a name (1 to 20 characters, Thai works too).
- 🍗 **Hunger** and 💛 **happiness** go from 0 to 100 and drop slowly while the app runs. While
  the app is closed they drop much more slowly, and never below 30.
- 🥣 **Feed** it from the cat's right-click menu or the tray menu. A full cat politely
  refuses.
- ✋ **Pet** it by moving the mouse back and forth over it (no button), or pick "Pet" from
  its menu. Clicks cheer it up a little too.
- 🎭 Moods show in its behavior: hungry cats dream of food, sad cats wander less, happy cats
  sometimes celebrate when clicked.
- 🌱 Gentle by design: it never dies, never runs away and never nags.
- 🔍 Hover over the cat or the tray icon to see its name, needs and mood.

### Install

Build the installer (see Development) and run `dist/desktop-pet-setup-2.0.0.exe`. It
installs for your user only (no admin rights) and adds Start menu and desktop shortcuts.
Installing over an older version keeps your settings.

| | |
| --- | --- |
| Your data | `%APPDATA%\desktop-pet` (`settings.json`, `pet.json`), removed on uninstall |
| Open settings | `"Desktop Pet.exe" --settings`, also while the app is running |
| Privacy | No network, no telemetry, no account. Nothing leaves your PC |
| Tested on | Windows 11, one monitor. Windows 10 is the target but untested |

### Development

You need Windows x64, Node.js 22.18 or newer (the `scripts/` tools rely on its built-in
TypeScript type stripping) and npm.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Run with hot reload. Uses `%APPDATA%\desktop-pet-dev`, never the installed app's data |
| `npm run build` | Production build into `out/` |
| `npm run typecheck` | vue-tsc and tsc for main, preload and `scripts/` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run dist` | Build plus the NSIS installer in `dist/` |
| `npm run icons:build` | Regenerate `resources/*.png` and `build/icon.ico` |
| `npm run sprite:prepare -- <in.png> <out.png> [cols] [rows]` | Clean a sprite sheet and print its cell boxes |
| `npm run readme:art` | Re-render the animated README images in `docs/images/` |

Run `typecheck`, `lint` and `test` before committing.

<details>
<summary><b>Tech stack and project layout</b></summary>

- Electron with `contextIsolation`, no `nodeIntegration`, sandboxed preloads and one small
  typed API per window
- Vue 3 (Composition API, `<script setup>`) and strict TypeScript, built with electron-vite
- Canvas 2D drawing PNG sprite sheets, at most 30 frames per second and nothing in between
- Small JSON files for settings and pet data, no database
- koffi (FFI) for one Windows call: detecting fullscreen apps
- electron-builder (NSIS), Vitest, ESLint, Prettier

```
src/main/        Electron main process: windows, tray, settings store, care engine, IPC
src/preload/     one typed contextBridge API per window (pet, settings, adopt)
src/renderer/    Vue pages: the pet scene and state machine, settings, adoption
src/shared/      types and pure logic shared by main and renderer (needs math, care config, IPC)
assets/models/   sprite sheets, model config and the art license note
scripts/         icon generator, sprite prep tool, README image renderer
docs/images/     animated README previews (generated)
```

Pet-care tuning (rates, floors, cooldowns, stroke detection) lives in
`src/shared/careConfig.ts`. Behavior is an explicit state machine in
`src/renderer/lib/petMachine.ts`.

</details>

---

<a name="thai"></a>

## ภาษาไทย

### ทำอะไรได้บ้าง

**เพื่อนบนเดสก์ท็อป (v1)**

- 🪟 อยู่ในหน้าต่างโปร่งใสที่ลอยอยู่บนสุดเสมอ คลิกทะลุได้ทุกที่ยกเว้นตัวแมว เลยไม่เกะกะการทำงาน
- 🖱️ คลิกแล้วน้องจะตอบสนอง ลากไปวางตรงไหนก็ได้ ปล่อยแล้วน้องจะกระโดดลงพื้น และจำตำแหน่งไว้ให้
- 🚶 เดินเล่นเองเป็นระยะ และ 💤 หลับเมื่อคุณไม่ได้แตะเครื่องสักพัก
- 🎮 หยุดพักเองเมื่อถูกซ่อน หรือเมื่อเปิดเกมหรือวิดีโอเต็มจอ
- ⚙️ มีไอคอนใน tray และหน้าตั้งค่า: ขนาด ความโปร่งใส ลอยบนสุด เปิดพร้อม Windows และเวลาก่อนหลับ

**สัตว์เลี้ยงให้ดูแล (v2)**

- 🏡 รับเลี้ยงแมวหนึ่งตัวและตั้งชื่อ (1 ถึง 20 ตัวอักษร ใช้ภาษาไทยได้)
- 🍗 **ความอิ่ม** และ 💛 **ความสุข** มีค่า 0 ถึง 100 ค่อย ๆ ลดลงตอนเปิดแอป ตอนปิดแอปจะลดช้ากว่ามาก และไม่ต่ำกว่า 30
- 🥣 **ให้อาหาร** จากเมนูคลิกขวาที่ตัวแมว หรือจากเมนู tray ถ้าน้องอิ่มแล้วจะไม่ยอมกิน
- ✋ **ลูบหัว** โดยขยับเมาส์ไปมาบนตัวน้อง (ไม่ต้องกดปุ่ม) หรือเลือก "Pet" จากเมนู การคลิกก็ช่วยให้น้องอารมณ์ดีขึ้นนิดหน่อย
- 🎭 อารมณ์แสดงออกผ่านท่าทาง: หิวจะฝันถึงชามข้าว เศร้าจะเดินเล่นน้อยลง มีความสุขจะดีใจเวลาโดนคลิก
- 🌱 ใจดีเป็นหลัก: น้องไม่มีวันตาย ไม่หนีหาย และไม่ตื๊อให้รำคาญ
- 🔍 ชี้เมาส์ค้างที่ตัวแมวหรือไอคอน tray เพื่อดูชื่อ ค่าความอิ่ม ความสุข และอารมณ์

### ติดตั้ง

build installer ก่อน (ดูหัวข้อพัฒนาต่อ) แล้วรัน `dist/desktop-pet-setup-2.0.0.exe` ติดตั้งเฉพาะผู้ใช้ปัจจุบัน
ไม่ต้องใช้สิทธิ์ admin และสร้าง shortcut ให้ทั้งใน Start menu และบนเดสก์ท็อป ติดตั้งทับเวอร์ชันเก่าได้โดยการตั้งค่าเดิมยังอยู่

| | |
| --- | --- |
| ข้อมูลของคุณ | `%APPDATA%\desktop-pet` (`settings.json`, `pet.json`) ลบออกเมื่อถอนการติดตั้ง |
| เปิดหน้าตั้งค่า | `"Desktop Pet.exe" --settings` ใช้ได้แม้แอปเปิดอยู่ |
| ความเป็นส่วนตัว | ไม่ใช้เน็ต ไม่เก็บสถิติ ไม่มีบัญชี ข้อมูลไม่ออกจากเครื่อง |
| ทดสอบแล้วบน | Windows 11 จอเดียว (Windows 10 เป็นเป้าหมาย แต่ยังไม่ได้ทดสอบ) |

### พัฒนาต่อ

ต้องมี Windows x64, Node.js 22.18 ขึ้นไป (สคริปต์ใน `scripts/` ใช้การรัน TypeScript ที่ติดมากับ Node) และ npm

```bash
npm install
npm run dev
```

คำสั่งทั้งหมดอยู่ในตารางหัวข้อ [Development](#development) ด้านบน ก่อน commit ให้รัน `typecheck`, `lint` และ `test` ทุกครั้ง
ค่าที่ใช้จูนระบบเลี้ยง (อัตราลด ค่าต่ำสุด คูลดาวน์ การจับการลูบ) อยู่ที่ `src/shared/careConfig.ts`

---

## Documents · เอกสาร

| | |
| --- | --- |
| [requirement.md](requirement.md) | v1 requirements, architecture, measurements |
| [requirement-v2.md](requirement-v2.md) | Pet-care system, acceptance criteria, open questions |
| [WORK-LOG.md](WORK-LOG.md) | Progress log and where to resume |
| [CLAUDE.md](CLAUDE.md) · [AGENTS.md](AGENTS.md) | Working rules for coding agents |

## Art · ภาพ

The cat sprites were generated by the project owner with Claude (claude.ai); no third-party
artwork is included. See [cat-sprite.LICENSE.txt](assets/models/cat-sprite.LICENSE.txt).<br>
ภาพแมวสร้างโดยเจ้าของโปรเจกต์ด้วย Claude (claude.ai) ไม่มีภาพจากบุคคลอื่น

<div align="center">
<sub>v2.0.0 · personal project, not distributed · โปรเจกต์ส่วนตัว ไม่ได้แจกจ่าย</sub>
</div>
