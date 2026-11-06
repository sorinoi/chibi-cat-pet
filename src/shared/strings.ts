/** All user-facing text in one place, so the UI language is easy to change later. */
export const STRINGS = {
  appName: 'Desktop Pet',
  tray: {
    tooltip: 'Desktop Pet',
    feed: 'Feed',
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
    version: (version: string): string => `Version ${version}`
  }
} as const
