/**
 * All user-facing text, one table per language (requirement-v3.md section 7, NFR-20).
 * English defines the shape; Thai must have exactly the same keys (checked by the compiler
 * and by strings.test.ts).
 */

export const LANGUAGES = ['en', 'th'] as const
export type Language = (typeof LANGUAGES)[number]

/** Shown in the language picker in their own language, never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = { th: 'ไทย', en: 'English' }

export const isLanguage = (value: unknown): value is Language =>
  (LANGUAGES as readonly unknown[]).includes(value)

/** Thai if the system prefers Thai, otherwise English (FR-42). */
export function languageForLocales(locales: readonly string[]): Language {
  const first = locales[0]?.toLowerCase() ?? ''
  return first === 'th' || first.startsWith('th-') ? 'th' : 'en'
}

const EN = {
  /** BCP 47 locale for dates. */
  locale: 'en-US',
  appName: 'Desktop Pet',
  tray: {
    tooltip: 'Desktop Pet',
    feed: 'Feed',
    adopt: 'Adopt a cat…',
    petStatus: 'Pet status…',
    show: 'Show pet',
    hide: 'Hide pet',
    settings: 'Settings…',
    about: 'About',
    quit: 'Quit'
  },
  contextMenu: {
    feed: 'Feed',
    pet: 'Pet',
    hide: 'Hide',
    settings: 'Settings…',
    quit: 'Quit'
  },
  about: {
    title: 'About Desktop Pet',
    ok: 'OK',
    detail: (version: string): string =>
      `Version ${version}\nA cat for your desktop. Runs fully offline.`
  },
  settings: {
    title: 'Desktop Pet Settings',
    language: 'Language',
    petSize: 'Pet size',
    opacity: 'Opacity',
    alwaysOnTop: 'Always on top',
    startWithWindows: 'Start with Windows',
    startWithWindowsDevNote: 'Saved, but only applied in the installed app.',
    sleepAfter: 'Sleep after (minutes without input)',
    version: (version: string): string => `Version ${version}`,
    petSection: 'Your cat',
    generalSection: 'General',
    name: 'Name',
    rename: 'Save name',
    nameInvalid: (max: number): string => `Use 1 to ${max} characters.`,
    fed: 'Fed',
    happy: 'Happy',
    mood: 'Mood',
    adoptedOn: (date: string): string => `Adopted on ${date}`,
    adoptNew: 'Adopt a new cat…',
    noPet: 'You have no cat yet.',
    hungerReminder: 'Remind me when the cat is hungry',
    adopt: 'Adopt a cat…'
  },
  care: {
    fed: 'Fed',
    happy: 'Happy',
    separator: ' · ',
    noPet: 'No cat yet',
    moods: { hungry: 'Hungry', sad: 'Sad', happy: 'Happy', content: 'Content' },
    hungryNoticeTitle: (name: string): string => `${name} is hungry`,
    hungryNoticeBody: "Feed them from the cat's menu or the tray menu."
  },
  adopt: {
    title: 'Adopt a cat',
    heading: 'A cat is looking for a home',
    intro: 'Give your new cat a name. You can change it later in Settings.',
    nameLabel: 'Name',
    placeholder: 'e.g. Mochi',
    button: 'Adopt',
    count: (n: number, max: number): string => `${n} / ${max}`,
    failed: 'Could not adopt. Please check the name and try again.'
  },
  readopt: {
    message: 'Adopt a new cat?',
    detail: 'Your current cat and all its data will be deleted now. This cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete and adopt'
  },
  focus: {
    menu: 'Focus',
    startFocus: 'Start focus',
    startBreak: 'Start break',
    pause: 'Pause',
    resume: 'Resume',
    skip: 'Skip',
    skipBreak: 'Skip break',
    stop: 'Stop',
    phases: { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' },
    running: (phase: string, minutes: number): string => `${phase} · ${minutes} min left`,
    paused: (phase: string, minutes: number): string => `Paused (${phase}) · ${minutes} min left`,
    waiting: (phase: string): string => `${phase} is ready`,
    today: (count: number): string => `Today: ${count} 🍅`,
    notify: {
      focusDoneTitle: 'Focus complete 🍅',
      focusDoneBreak: (phase: string, minutes: number): string =>
        `Nice work! ${phase}: ${minutes} minutes.`,
      focusDoneWaiting: (phase: string): string => `Nice work! ${phase} is ready when you are.`,
      breakOverTitle: 'Break over',
      breakOverFocus: (minutes: number): string => `Next focus started: ${minutes} minutes.`,
      breakOverIdle: 'Ready for the next focus?',
      interruptedTitle: 'Focus interrupted',
      interrupted: 'The PC was asleep, so this focus was not counted.'
    },
    settings: {
      section: 'Focus timer',
      focusMinutes: 'Focus (minutes)',
      shortBreakMinutes: 'Short break (minutes)',
      longBreakMinutes: 'Long break (minutes)',
      longBreakEvery: 'Long break every (sessions)',
      autoStartBreaks: 'Start breaks automatically',
      autoStartFocus: 'Start the next focus automatically',
      notifications: 'Show notifications',
      completedToday: (count: number): string => `Completed today: ${count} 🍅`,
      lastDays: (days: number): string => `Last ${days} days`
    }
  }
}

export type Strings = typeof EN

const TH: Strings = {
  locale: 'th-TH',
  appName: 'Desktop Pet',
  tray: {
    tooltip: 'Desktop Pet',
    feed: 'ให้อาหาร',
    adopt: 'รับเลี้ยงแมว…',
    petStatus: 'สถานะน้องแมว…',
    show: 'แสดงน้องแมว',
    hide: 'ซ่อนน้องแมว',
    settings: 'ตั้งค่า…',
    about: 'เกี่ยวกับ',
    quit: 'ออก'
  },
  contextMenu: {
    feed: 'ให้อาหาร',
    pet: 'ลูบหัว',
    hide: 'ซ่อน',
    settings: 'ตั้งค่า…',
    quit: 'ออก'
  },
  about: {
    title: 'เกี่ยวกับ Desktop Pet',
    ok: 'ตกลง',
    detail: (version: string): string =>
      `เวอร์ชัน ${version}\nแมวน้อยบนเดสก์ท็อปของคุณ ทำงานได้โดยไม่ต้องต่ออินเทอร์เน็ต`
  },
  settings: {
    title: 'ตั้งค่า Desktop Pet',
    language: 'ภาษา',
    petSize: 'ขนาดน้องแมว',
    opacity: 'ความทึบ',
    alwaysOnTop: 'อยู่บนสุดเสมอ',
    startWithWindows: 'เปิดพร้อม Windows',
    startWithWindowsDevNote: 'บันทึกแล้ว แต่จะมีผลเฉพาะแอปที่ติดตั้งแล้วเท่านั้น',
    sleepAfter: 'หลับเมื่อไม่ได้ใช้เครื่อง (นาที)',
    version: (version: string): string => `เวอร์ชัน ${version}`,
    petSection: 'น้องแมวของคุณ',
    generalSection: 'ทั่วไป',
    name: 'ชื่อ',
    rename: 'บันทึกชื่อ',
    nameInvalid: (max: number): string => `ใช้ 1 ถึง ${max} ตัวอักษร`,
    fed: 'อิ่ม',
    happy: 'สุข',
    mood: 'อารมณ์',
    adoptedOn: (date: string): string => `รับเลี้ยงเมื่อ ${date}`,
    adoptNew: 'รับเลี้ยงแมวตัวใหม่…',
    noPet: 'คุณยังไม่มีน้องแมว',
    hungerReminder: 'แจ้งเตือนเมื่อน้องแมวหิว',
    adopt: 'รับเลี้ยงแมว…'
  },
  care: {
    fed: 'อิ่ม',
    happy: 'สุข',
    separator: ' · ',
    noPet: 'ยังไม่มีน้องแมว',
    moods: { hungry: 'หิว', sad: 'เศร้า', happy: 'มีความสุข', content: 'สบายดี' },
    hungryNoticeTitle: (name: string): string => `${name}หิวแล้ว`,
    hungryNoticeBody: 'ให้อาหารได้จากเมนูคลิกขวาที่ตัวแมว หรือเมนู tray'
  },
  adopt: {
    title: 'รับเลี้ยงแมว',
    heading: 'มีน้องแมวกำลังหาบ้านอยู่',
    intro: 'ตั้งชื่อให้น้องแมวตัวใหม่ เปลี่ยนชื่อทีหลังได้ในหน้าตั้งค่า',
    nameLabel: 'ชื่อ',
    placeholder: 'เช่น มะลิ',
    button: 'รับเลี้ยง',
    count: (n: number, max: number): string => `${n} / ${max}`,
    failed: 'รับเลี้ยงไม่สำเร็จ ลองตรวจชื่อแล้วลองใหม่อีกครั้ง'
  },
  readopt: {
    message: 'รับเลี้ยงแมวตัวใหม่ไหม?',
    detail: 'น้องแมวตัวปัจจุบันและข้อมูลทั้งหมดจะถูกลบทันที และกู้คืนไม่ได้',
    cancel: 'ยกเลิก',
    confirm: 'ลบและรับเลี้ยงใหม่'
  },
  focus: {
    menu: 'โฟกัส',
    startFocus: 'เริ่มโฟกัส',
    startBreak: 'เริ่มพัก',
    pause: 'หยุดชั่วคราว',
    resume: 'ทำต่อ',
    skip: 'ข้าม',
    skipBreak: 'ข้ามการพัก',
    stop: 'หยุด',
    phases: { focus: 'โฟกัส', shortBreak: 'พักสั้น', longBreak: 'พักยาว' },
    running: (phase: string, minutes: number): string => `${phase} · เหลือ ${minutes} นาที`,
    paused: (phase: string, minutes: number): string =>
      `หยุดชั่วคราว (${phase}) · เหลือ ${minutes} นาที`,
    waiting: (phase: string): string => `พร้อม${phase}แล้ว`,
    today: (count: number): string => `วันนี้: ${count} 🍅`,
    notify: {
      focusDoneTitle: 'โฟกัสครบแล้ว 🍅',
      focusDoneBreak: (phase: string, minutes: number): string =>
        `เก่งมาก! ${phase} ${minutes} นาที`,
      focusDoneWaiting: (phase: string): string => `เก่งมาก! พร้อมเมื่อไหร่ก็เริ่ม${phase}ได้เลย`,
      breakOverTitle: 'หมดเวลาพักแล้ว',
      breakOverFocus: (minutes: number): string => `เริ่มโฟกัสรอบถัดไปแล้ว ${minutes} นาที`,
      breakOverIdle: 'พร้อมโฟกัสรอบถัดไปหรือยัง?',
      interruptedTitle: 'โฟกัสถูกขัดจังหวะ',
      interrupted: 'คอมพิวเตอร์หลับไป รอบนี้เลยไม่นับ'
    },
    settings: {
      section: 'ตัวจับเวลาโฟกัส',
      focusMinutes: 'โฟกัส (นาที)',
      shortBreakMinutes: 'พักสั้น (นาที)',
      longBreakMinutes: 'พักยาว (นาที)',
      longBreakEvery: 'พักยาวทุก (รอบ)',
      autoStartBreaks: 'เริ่มพักอัตโนมัติ',
      autoStartFocus: 'เริ่มโฟกัสรอบถัดไปอัตโนมัติ',
      notifications: 'แสดงการแจ้งเตือน',
      completedToday: (count: number): string => `วันนี้ทำครบแล้ว: ${count} 🍅`,
      lastDays: (days: number): string => `${days} วันที่ผ่านมา`
    }
  }
}

const TABLES: Record<Language, Strings> = { en: EN, th: TH }

export function stringsFor(language: Language): Strings {
  return TABLES[language]
}
