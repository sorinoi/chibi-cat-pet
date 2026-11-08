/** requirement-v6.md FR-98: dashboard text in English and Thai (English defines the shape). */
import { ref } from 'vue'

export type Lang = 'en' | 'th'
const STORAGE_KEY = 'dp-lang'

const EN = {
  locale: 'en-GB',
  appName: 'Desktop Pet',
  nav: {
    overview: 'Overview',
    events: 'Events',
    refresh: 'Refresh',
    logout: 'Log out',
    language: 'ไทย'
  },
  login: {
    title: 'Log in',
    name: 'User name',
    password: 'Password',
    submit: 'Log in',
    wrong: 'Wrong name or password.',
    tooMany: 'Too many tries. Wait a minute and try again.',
    failed: 'Could not log in. Try again.'
  },
  loading: 'Loading…',
  loadFailed: 'Could not load the data.',
  noPet: 'No pet yet. Turn on "Send activity to my server" in the app.',
  overview: {
    pet: 'Pet',
    days: (n: number): string => `${n} days`,
    adopted: (date: string): string => `Adopted ${date}`,
    replaced: (date: string): string => `Replaced ${date}`,
    current: 'current',
    fed: 'Fed',
    happy: 'Happy',
    mood: 'Mood',
    streak: 'Focus streak',
    streakDays: (n: number): string => (n === 1 ? '1 day' : `${n} days`),
    lastSeen: (when: string): string => `Last update ${when}`,
    needsTitle: 'Fed and happy',
    needsNote: 'Right after each action, 0 to 100',
    careTitle: 'Care per day',
    feeds: 'Feeds',
    pets: 'Pets',
    treats: 'Treats',
    focusDays: 'Focus sessions per day',
    focusWeeks: 'Focus sessions per week',
    weekOf: (date: string): string => `Week of ${date}`,
    total: (n: number): string => `Total ${n}`,
    noData: 'Nothing in this range yet.'
  },
  moods: { hungry: 'Hungry', sad: 'Lonely', happy: 'Happy', content: 'Content' } as Record<
    string,
    string
  >,
  events: {
    title: 'Events',
    pet: 'Pet',
    type: 'Type',
    from: 'From',
    to: 'To',
    all: 'All',
    time: 'Time',
    details: 'Details',
    none: 'No events match.',
    count: (n: number): string => (n === 1 ? '1 event' : `${n} events`),
    page: (p: number, of: number): string => `Page ${p} of ${of}`,
    prev: 'Newer',
    next: 'Older',
    refused: 'refused, full',
    notCounted: 'not counted (too soon)',
    wasFull: 'already full',
    interrupted: 'cut short (PC slept)',
    completed: 'completed',
    minutes: (n: number): string => `${n} min`
  },
  types: {
    'pet.adopted': 'Adopted',
    'pet.renamed': 'Renamed',
    'pet.replaced': 'Replaced',
    'care.feed': 'Fed',
    'care.pet': 'Petted',
    'care.treat': 'Treat given',
    'treat.earned': 'Treat earned',
    'focus.started': 'Phase started',
    'focus.paused': 'Paused',
    'focus.resumed': 'Resumed',
    'focus.skipped': 'Skipped',
    'focus.stopped': 'Stopped',
    'focus.phaseEnded': 'Phase ended'
  } as Record<string, string>,
  phases: { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' } as Record<
    string,
    string
  >
}

export type Text = typeof EN

const TH: Text = {
  locale: 'th-TH',
  appName: 'Desktop Pet',
  nav: {
    overview: 'ภาพรวม',
    events: 'เหตุการณ์',
    refresh: 'รีเฟรช',
    logout: 'ออกจากระบบ',
    language: 'English'
  },
  login: {
    title: 'เข้าสู่ระบบ',
    name: 'ชื่อผู้ใช้',
    password: 'รหัสผ่าน',
    submit: 'เข้าสู่ระบบ',
    wrong: 'ชื่อหรือรหัสผ่านไม่ถูกต้อง',
    tooMany: 'ลองหลายครั้งเกินไป รอสักนาทีแล้วลองใหม่',
    failed: 'เข้าสู่ระบบไม่ได้ ลองใหม่อีกครั้ง'
  },
  loading: 'กำลังโหลด…',
  loadFailed: 'โหลดข้อมูลไม่ได้',
  noPet: 'ยังไม่มีน้องแมว เปิด "ส่งกิจกรรมไปที่ server ของฉัน" ในแอปก่อน',
  overview: {
    pet: 'น้องแมว',
    days: (n: number): string => `${n} วัน`,
    adopted: (date: string): string => `รับเลี้ยงเมื่อ ${date}`,
    replaced: (date: string): string => `ถูกแทนเมื่อ ${date}`,
    current: 'ตัวปัจจุบัน',
    fed: 'อิ่ม',
    happy: 'สุข',
    mood: 'อารมณ์',
    streak: 'โฟกัสติดกัน',
    streakDays: (n: number): string => `${n} วัน`,
    lastSeen: (when: string): string => `อัปเดตล่าสุด ${when}`,
    needsTitle: 'ความอิ่มและความสุข',
    needsNote: 'ค่าหลังการกระทำแต่ละครั้ง 0 ถึง 100',
    careTitle: 'การดูแลต่อวัน',
    feeds: 'ให้อาหาร',
    pets: 'ลูบหัว',
    treats: 'ให้ขนม',
    focusDays: 'รอบโฟกัสต่อวัน',
    focusWeeks: 'รอบโฟกัสต่อสัปดาห์',
    weekOf: (date: string): string => `สัปดาห์ของ ${date}`,
    total: (n: number): string => `รวม ${n}`,
    noData: 'ยังไม่มีข้อมูลในช่วงนี้'
  },
  moods: { hungry: 'หิว', sad: 'เหงา', happy: 'มีความสุข', content: 'สบายดี' },
  events: {
    title: 'เหตุการณ์',
    pet: 'น้องแมว',
    type: 'ชนิด',
    from: 'ตั้งแต่',
    to: 'ถึง',
    all: 'ทั้งหมด',
    time: 'เวลา',
    details: 'รายละเอียด',
    none: 'ไม่มีเหตุการณ์ที่ตรงกัน',
    count: (n: number): string => `${n} รายการ`,
    page: (p: number, of: number): string => `หน้า ${p} จาก ${of}`,
    prev: 'ใหม่กว่า',
    next: 'เก่ากว่า',
    refused: 'ไม่กิน อิ่มแล้ว',
    notCounted: 'ไม่นับ (เร็วไป)',
    wasFull: 'อิ่มอยู่แล้ว',
    interrupted: 'ถูกตัด (คอมหลับ)',
    completed: 'ครบ',
    minutes: (n: number): string => `${n} นาที`
  },
  types: {
    'pet.adopted': 'รับเลี้ยง',
    'pet.renamed': 'เปลี่ยนชื่อ',
    'pet.replaced': 'ถูกแทนด้วยตัวใหม่',
    'care.feed': 'ให้อาหาร',
    'care.pet': 'ลูบหัว',
    'care.treat': 'ให้ขนม',
    'treat.earned': 'ได้ขนม',
    'focus.started': 'เริ่มช่วง',
    'focus.paused': 'หยุดชั่วคราว',
    'focus.resumed': 'ทำต่อ',
    'focus.skipped': 'ข้าม',
    'focus.stopped': 'หยุด',
    'focus.phaseEnded': 'จบช่วง'
  },
  phases: { focus: 'โฟกัส', shortBreak: 'พักสั้น', longBreak: 'พักยาว' }
}

function savedLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'th') return saved
  } catch {
    // storage blocked: fall back to the browser language
  }
  return navigator.language.toLowerCase().startsWith('th') ? 'th' : 'en'
}

export const lang = ref<Lang>(savedLang())

export function setLang(next: Lang): void {
  lang.value = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // not remembered; fine
  }
}

export const textFor = (l: Lang): Text => (l === 'th' ? TH : EN)
