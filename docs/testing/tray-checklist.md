# Manual test checklist: system tray (M3.2)

The tray is Electron-native UI that Playwright cannot drive; verify these by hand
on each platform before a release. The menu _contents_ are unit-tested in
`src/main/tray/menu.test.ts` — this checklist covers the native integration only.

Run with `npm run dev` (from a regular terminal, not an IDE task shell).

## macOS

- [ ] Menu bar shows the AgentDeck ring icon; it adapts to light/dark menu bar (template image)
- [ ] Icon is crisp on a Retina display (@2x variant picked up)
- [ ] Hovering shows the tooltip: `AgentDeck — N working · N need input`
- [ ] Click opens the menu: summary line (disabled), up to 5 recent sessions with status, Open, Quit
- [ ] Clicking a session brings the window to front with that session's detail panel open
- [ ] Clicking a session while the window is closed re-creates the window and still opens the right session
- [ ] "Open AgentDeck" focuses/restores the window (also from minimized)
- [ ] "Quit AgentDeck" exits the app fully
- [ ] Menu contents refresh after new agent activity (within ~15s, or ~1s after a transcript change)

## Windows / Linux

- [ ] Tray icon appears in the notification area (Windows) / app indicator area (Linux)
- [ ] Same menu behavior as macOS
- [ ] Known gap: on Windows/Linux, closing the window quits the app instead of minimizing to tray
      (tray-resident lifecycle is deliberately post-v1)
