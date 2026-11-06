import { app } from 'electron'

/** NFR-06: never navigate away or open new windows; the app shows only bundled content. */
export function lockDownWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (navEvent) => navEvent.preventDefault())
    contents.on('will-attach-webview', (attachEvent) => attachEvent.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })
}
