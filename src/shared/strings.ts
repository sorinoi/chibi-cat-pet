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

/** "1 event", "3 events" (English only; Thai has no plural). */
const events = (count: number): string => `${count} ${count === 1 ? 'event' : 'events'}`

const EN = {
  /** BCP 47 locale for dates. */
  locale: 'en-US',
  appName: 'Desktop Pet',
  tray: {
    tooltip: 'Desktop Pet',
    feed: 'Feed',
    adopt: 'Adopt a cat…',
    petStatus: 'Pet status…',
    giveTreat: (count: number): string => `Give a treat (${count})`,
    show: 'Show pet',
    hide: 'Hide pet',
    settings: 'Settings…',
    about: 'About',
    quit: 'Quit'
  },
  contextMenu: {
    feed: 'Feed',
    pet: 'Pet',
    giveTreat: (count: number): string => `Give a treat (${count})`,
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
    /** requirement-v8.md FR-117. */
    activityLevel: 'Activity level',
    activityLevels: { calm: 'Calm', normal: 'Normal', lively: 'Lively' },
    petSize: 'Pet size',
    opacity: 'Opacity',
    alwaysOnTop: 'Always on top',
    gravity: 'Fall down when dropped (gravity)',
    sitOnWindows: 'Land and sit on other windows',
    jumpAndClimb: 'Jump and climb now and then',
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
    look: 'Coat',
    noPet: 'You have no cat yet.',
    hungerReminder: 'Remind me when the cat is hungry',
    adopt: 'Adopt a cat…',
    treats: (count: number): string => `Treats: ${count} 🍬`
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
  /** requirement-v7.md FR-100: look (coat) names by look id. */
  looks: {
    orange: 'Orange',
    gray: 'Gray tabby',
    black: 'Black',
    white: 'White'
  } as Record<string, string>,
  adopt: {
    title: 'Adopt a cat',
    heading: 'A cat is looking for a home',
    intro: 'Pick a coat and give your new cat a name. You can change both later in Settings.',
    lookLabel: 'Coat',
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
      interrupted: 'The PC was asleep, so this focus was not counted.',
      treatEarned: (count: number): string => ` +${count} treat 🍬`
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
      treats: 'Earn treats by focusing',
      completedToday: (count: number): string => `Completed today: ${count} 🍅`,
      lastDays: (days: number): string => `Last ${days} days`
    }
  },
  /** requirement-v6.md FR-87, FR-88. */
  activity: {
    section: 'Activity log',
    enabled: 'Send activity to my server',
    note: 'Feeding, petting, treats and focus sessions go to your own server. Nothing else is sent.',
    url: 'Server URL',
    urlPlaceholder: 'https://pets.example.com',
    key: 'API key',
    keyPlaceholder: 'Paste the key from your server',
    keySaved: 'Key saved',
    keyNotSaved: 'The key could not be stored safely on this PC.',
    saveKey: 'Save',
    removeKey: 'Remove',
    test: 'Test connection',
    testing: 'Testing…',
    testOk: 'Connected ✓',
    notSet: 'Enter the server URL and the key first.',
    badUrl: 'Use https:// (plain http only for this PC or your home network).',
    unauthorized: 'The server did not accept the key.',
    unreachable: 'Cannot reach the server.',
    serverError: (code: number): string => `The server answered with an error (${code}).`,
    status: {
      off: 'Off',
      ready: 'Connected, nothing waiting',
      sending: (count: number): string => `Sending ${events(count)}…`,
      waiting: (count: number): string => `${events(count)} waiting`,
      retry: (minutes: number): string => `trying again in ${minutes} min`,
      reasons: {
        offline: 'cannot reach the server',
        server: 'the server has a problem',
        busy: 'the server asked to wait'
      },
      refusedKey: 'Stopped: the server did not accept the key',
      refusedData: (code: number): string =>
        `Stopped: the server did not accept the data (${code})`,
      refusedOther: (code: number): string => `Stopped: the server answered ${code}`,
      dropped: (count: number): string =>
        `${count} old ${count === 1 ? 'event was' : 'events were'} dropped (limit)`
    },
    clear: 'Clear waiting events',
    clearMessage: 'Clear the waiting events?',
    clearDetail: 'They will not be sent to your server. This cannot be undone.',
    clearCancel: 'Cancel',
    clearConfirm: 'Clear'
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
    giveTreat: (count: number): string => `ให้ขนม (${count})`,
    show: 'แสดงน้องแมว',
    hide: 'ซ่อนน้องแมว',
    settings: 'ตั้งค่า…',
    about: 'เกี่ยวกับ',
    quit: 'ออก'
  },
  contextMenu: {
    feed: 'ให้อาหาร',
    pet: 'ลูบหัว',
    giveTreat: (count: number): string => `ให้ขนม (${count})`,
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
    activityLevel: 'ความซน',
    activityLevels: { calm: 'สงบ', normal: 'ปกติ', lively: 'ซน' },
    petSize: 'ขนาดน้องแมว',
    opacity: 'ความทึบ',
    alwaysOnTop: 'อยู่บนสุดเสมอ',
    gravity: 'ปล่อยแล้วตกลงพื้น (แรงโน้มถ่วง)',
    sitOnWindows: 'ลงไปนั่งบนหน้าต่างอื่นได้',
    jumpAndClimb: 'กระโดดและปีนบ้างเป็นครั้งคราว',
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
    look: 'สีขน',
    noPet: 'คุณยังไม่มีน้องแมว',
    hungerReminder: 'แจ้งเตือนเมื่อน้องแมวหิว',
    adopt: 'รับเลี้ยงแมว…',
    treats: (count: number): string => `ขนม: ${count} 🍬`
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
  looks: {
    orange: 'ส้ม',
    gray: 'เทาลายสลิด',
    black: 'ดำ',
    white: 'ขาว'
  },
  adopt: {
    title: 'รับเลี้ยงแมว',
    heading: 'มีน้องแมวกำลังหาบ้านอยู่',
    intro: 'เลือกสีขนและตั้งชื่อให้น้องแมวตัวใหม่ เปลี่ยนได้ทีหลังในหน้าตั้งค่า',
    lookLabel: 'สีขน',
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
      interrupted: 'คอมพิวเตอร์หลับไป รอบนี้เลยไม่นับ',
      treatEarned: (count: number): string => ` ได้ขนม +${count} 🍬`
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
      treats: 'ได้ขนมเมื่อโฟกัสครบ',
      completedToday: (count: number): string => `วันนี้ทำครบแล้ว: ${count} 🍅`,
      lastDays: (days: number): string => `${days} วันที่ผ่านมา`
    }
  },
  activity: {
    section: 'บันทึกกิจกรรม',
    enabled: 'ส่งกิจกรรมไปที่ server ของฉัน',
    note: 'การให้อาหาร ลูบหัว ให้ขนม และรอบโฟกัส จะถูกส่งไปที่ server ของคุณเอง ไม่ส่งอย่างอื่น',
    url: 'URL ของ server',
    urlPlaceholder: 'https://pets.example.com',
    key: 'API key',
    keyPlaceholder: 'วาง key จาก server ของคุณ',
    keySaved: 'บันทึก key แล้ว',
    keyNotSaved: 'เก็บ key อย่างปลอดภัยบนเครื่องนี้ไม่ได้',
    saveKey: 'บันทึก',
    removeKey: 'ลบ',
    test: 'ทดสอบการเชื่อมต่อ',
    testing: 'กำลังทดสอบ…',
    testOk: 'เชื่อมต่อได้ ✓',
    notSet: 'ใส่ URL ของ server และ key ก่อน',
    badUrl: 'ใช้ https:// (http ใช้ได้เฉพาะเครื่องนี้หรือวง LAN ในบ้าน)',
    unauthorized: 'server ไม่รับ key นี้',
    unreachable: 'ติดต่อ server ไม่ได้',
    serverError: (code: number): string => `server ตอบกลับว่ามีข้อผิดพลาด (${code})`,
    status: {
      off: 'ปิดอยู่',
      ready: 'เชื่อมต่อแล้ว ไม่มีรายการค้าง',
      sending: (count: number): string => `กำลังส่ง ${count} รายการ…`,
      waiting: (count: number): string => `ค้างอยู่ ${count} รายการ`,
      retry: (minutes: number): string => `จะลองใหม่ในอีก ${minutes} นาที`,
      reasons: {
        offline: 'ติดต่อ server ไม่ได้',
        server: 'server มีปัญหา',
        busy: 'server ขอให้รอก่อน'
      },
      refusedKey: 'หยุดส่งแล้ว: server ไม่รับ key นี้',
      refusedData: (code: number): string => `หยุดส่งแล้ว: server ไม่รับข้อมูล (${code})`,
      refusedOther: (code: number): string => `หยุดส่งแล้ว: server ตอบกลับ ${code}`,
      dropped: (count: number): string => `ทิ้งรายการเก่าไป ${count} รายการ (เกินขีดจำกัด)`
    },
    clear: 'ล้างรายการที่ค้าง',
    clearMessage: 'ล้างรายการที่ค้างอยู่ไหม',
    clearDetail: 'รายการเหล่านี้จะไม่ถูกส่งไปที่ server และย้อนกลับไม่ได้',
    clearCancel: 'ยกเลิก',
    clearConfirm: 'ล้าง'
  }
}

const TABLES: Record<Language, Strings> = { en: EN, th: TH }

export function stringsFor(language: Language): Strings {
  return TABLES[language]
}
