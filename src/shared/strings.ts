/** All user-facing text in one place, so the UI language is easy to change later. */
export const STRINGS = {
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
    detail: (version: string): string =>
      `Version ${version}\nA cat for your desktop. Runs fully offline.`
  },
  settings: {
    title: 'Desktop Pet Settings',
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
    adopt: 'Adopt a cat…'
  },
  care: {
    fed: 'Fed',
    happy: 'Happy',
    separator: ' · ',
    noPet: 'No cat yet',
    moods: { hungry: 'Hungry', sad: 'Sad', happy: 'Happy', content: 'Content' }
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
  }
} as const
