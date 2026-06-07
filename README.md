# Snappd

Snappd is a lightweight macOS screenshot utility built with Electron, TypeScript, Vite, and React. It runs primarily from the macOS menu bar and focuses on a fast local workflow: capture, copy to clipboard, optionally annotate, and save.

## Status

Snappd is under active development and is not release-ready yet.

Implemented so far:

- macOS menu bar app shell
- secure Electron windows with preload-only APIs
- local settings persistence
- region capture with `Cmd+Shift+2`
- full-screen capture
- window capture through an Electron-native source picker
- clipboard-first screenshot workflow
- post-capture preview
- basic annotation tools in preview
- manual PNG save to `~/Pictures/Snappd`
- Screen Recording permission recovery path

Known issues / follow-ups:

- Custom shortcut typing/recording is not fully reliable yet; preset shortcut buttons are a temporary workaround.
- Annotations are canvas-based and destructive after commit; move/resize/edit-after-draw needs an object-based annotation model.
- Text annotation is inline while entering text, but committed text is not editable afterward.
- Signing/notarization and release packaging are not complete.

## Goals

- Fast region capture on macOS.
- Clipboard-first by default.
- Local-only privacy model: no accounts, cloud upload, telemetry, analytics, or background network calls.
- Lightweight annotations without becoming a full image editor.
- Direct-download macOS `.dmg` distribution for V1.

## Requirements

- macOS 12 Monterey or newer is the intended minimum target.
- Apple Silicon `arm64` is the primary target.
- Node.js/npm.

## Development

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm run dev
```

Run quality checks:

```bash
npm run typecheck
npm run lint
npm test
```

Build:

```bash
npm run build
```

Package macOS app directory:

```bash
npm run package:mac
```

Create macOS DMG:

```bash
npm run make:mac
```

## macOS Screen Recording Permission

Screenshot capture requires macOS Screen Recording permission.

In development mode, macOS may attribute permission to the app that launched Electron, such as Terminal, kitty, an IDE, or Electron itself. If capture fails, open macOS System Settings and enable Screen Recording for the relevant launcher, then fully restart the dev process.

Packaged builds should eventually appear as Snappd once signing/packaging is finalized.

## Usage

Default workflow:

1. Launch Snappd.
2. Use the menu bar item or press `Cmd+Shift+2`.
3. Drag to select a region.
4. The screenshot is copied to the clipboard automatically.
5. Use the preview window to annotate, copy, save, or discard.

Menu bar actions:

- Capture Region
- Capture Window
- Capture Full Screen
- Preferences
- Quit

## Annotation Tools

The preview window includes basic annotation tools:

- Arrow
- Rectangle
- Text
- Pixelate
- Freehand pen

Annotated screenshots can be copied to the clipboard or saved as PNG.

## Project Structure

```text
src/
  main/       Electron main process
  preload/    contextBridge API exposed to renderer windows
  renderer/   React renderer windows and styles
  shared/     shared types, helpers, and pure tests
.docs/        PRD and implementation plan
```

## Scripts

- `npm run dev` — start Electron in development mode
- `npm run typecheck` — run TypeScript without emitting files
- `npm run lint` — run Biome checks
- `npm run format` — run Biome with writes enabled
- `npm test` — run Vitest
- `npm run build` — typecheck and build Electron bundles
- `npm run package:mac` — build unpacked macOS app for arm64
- `npm run make:mac` — build macOS DMG for arm64

## Documentation

- Product requirements: `.docs/prd.md`
- Implementation plan and known blockers: `.docs/implementation-plan.md`

## License

UNLICENSED.
