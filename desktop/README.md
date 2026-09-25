# OmniForge for macOS

The full OmniForge harness as a native macOS app. The app bundles the same Next.js
server the web version runs, starts it on `127.0.0.1`, and shows it in a native
window. Chat, AI tools, and model loading talk to OpenRouter directly from your Mac.

## Install a prebuilt app

1. Download the zip for your Mac:
   - `OmniForge-macOS-apple-silicon.zip` for M-series Macs
   - `OmniForge-macOS-intel.zip` for Intel Macs
2. Double-click the zip, then drag **OmniForge.app** into **Applications**.
3. Open it. The app is signed ad hoc, not with an Apple Developer ID, so macOS
   blocks the first launch:
   - Open **System Settings → Privacy & Security**, scroll to the message about
     OmniForge, and click **Open Anyway**. Or, in Terminal:
     `xattr -dr com.apple.quarantine /Applications/OmniForge.app`
4. Open **OmniForge → Settings… (⌘,)** and add your OpenRouter API key. The key
   is encrypted with your macOS Keychain and kept between launches.

Requires macOS 12 or later.

## What is different from the web app

- Native menus: **File → New Chat (⌘N)**, **Run Scan (⇧⌘R)**, **View → Overview /
  Findings / Scan History / AI Analyst (⌘1–⌘4)**, **Settings… (⌘,)**, standard Edit
  menu for copy and paste, and **Help → Show Server Log**.
- Your OpenRouter key is stored encrypted with the Keychain instead of the
  browser session.
- External links open in your default browser.
- Server logs are written to `~/Library/Application Support/OmniForge/logs/server.log`.

## Build it yourself

From the repository root:

```bash
pnpm install
cd desktop
npm install
npm run dist
```

`npm run dist` builds the Next.js app as a standalone server, copies it into
`desktop/server`, and packages `dist/OmniForge-macOS-apple-silicon.zip` and
`dist/OmniForge-macOS-intel.zip`. On a Mac it signs with `codesign`; elsewhere it
uses [`rcodesign`](https://github.com/indygreg/apple-platform-rs) (set `RCODESIGN`
to its path). To try the app without packaging, run `npm run prepare-server` and
then `npm start`.

To ship without the Gatekeeper prompt, sign with your Developer ID and notarize the
app with your Apple Developer account.
