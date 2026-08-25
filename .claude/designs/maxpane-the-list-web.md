# MaxPane THE LIST — web terminal rebuild

Status: implemented and verified

## Problem

The current app uses MaxPane's Matrix colours, but its layout and interaction model are still a conventional graph dashboard. The target is a browser version of MaxPane's Curator "THE LIST": dense terminal panels, the same list modes and preset filters, and keyboard-first navigation, while retaining the existing CuratorWhitelist snapshot and SybilKit evidence graph.

## Facts and constraints

- The product is read-only. It has no signer and broadcasts no transactions.
- The source of truth remains the original CuratorWhitelist snapshot.
- SybilKit evidence is analytical evidence, not proof of common ownership.
- MaxPane's Curator screen uses `l` for lists, `h` for history, `y` for the selected wallet, `c` to cycle views, `f` to filter, `w` to choose a wallet, `r` to refresh, `e` to export, `Escape` to go back, and `1`/`2`/`3` for its three presets.
- MaxPane's presets are First 1000, Hour 0, and contributors with a deposit of at least 25 ETH.
- The project must remain KISS, follow MVC in the frontend, and never commit API keys.
- The shared terminal-hosting proposal favours `textual-serve` for publishing an unchanged Textual application and explicitly avoids React, xterm.js, and WASM in that scenario.

## Options considered

### 1. Serve the existing Textual screen

Highest pixel and keyboard fidelity, and the fastest route when the goal is to publish all of MaxPane unchanged. It also introduces a persistent WebSocket and an isolated Python TUI process per browser session. Browser-native graph interaction, responsive touch controls, semantic tables, and downloads become adapters around terminal rendering.

### 2. Embed a shell with xterm.js

This preserves terminal transport but adds an emulation layer without providing the operational simplicity of `textual-serve`. Accessibility, mobile navigation, graph interaction, and URL-addressable state still require custom work. There is no need for arbitrary shell access in this read-only product.

### 3. Rebuild THE LIST as a browser-native terminal application

The React view renders the MaxPane terminal grammar directly: square bordered panels, fixed-width typography, dense tables, a persistent shortcut bar, and mode-specific screens. The existing FastAPI read model remains the backend. Keyboard actions live in a controller; filtering, presets, API access, and export logic live in models/controllers; views remain declarative.

## Decision

Use option 3.

This scope is one focused MaxPane workflow plus an interactive SybilKit graph, not a request to expose the entire desktop TUI. A browser-native rebuild reuses the current data pipeline, supports keyboard and touch together, preserves semantic HTML, and avoids per-session terminal processes. It should feel like MaxPane, but it should behave like a good web application.

If the scope later becomes "publish every MaxPane screen unchanged", `textual-serve` should be reconsidered as a separate thin-hosting product rather than mixed into this app.

## Interaction model

- Default screen: `LISTS`, with raw, clean, and filtered views cycled by `c`.
- `h`: `HISTORY`, containing the SybilKit group map and signal ledger.
- `y`: `YOU`, containing the currently selected wallet. If no wallet is selected, open the wallet prompt.
- `w`: open the wallet-address prompt.
- `f` or `/`: open/focus filters.
- `r`: refresh the current snapshot-backed read model.
- `e`: download the current filtered list as JSON.
- `1`, `2`, `3`: apply First 1000, Hour 0, or Whale splash.
- `j`/`k` or arrow keys: move the list cursor; `Enter`: inspect; Page Up/Down: paginate.
- `Escape`: close overlays, then return to `LISTS`.
- `?`: show a complete keyboard reference.

Every keyboard command also has a visible button for touch and discoverability.

## Architecture

- Model: domain types, API calls, terminal state transitions, shortcut definitions.
- Controller: data loading and refresh, filters/presets/export, global keyboard routing, mode/cursor/dialog state.
- Views: title bar, list/history/wallet screens, terminal panels, prompts, and bottom shortcut bar.
- Backend model: applies MaxPane presets and enriches list rows.
- Backend controller: validates query parameters and returns JSON/API downloads.

## Visual language

- MaxPane Matrix palette: background `#1c1c1c`, surface `#262626`, panel `#303030`, primary `#00ff41`, foreground `#00dd33`, error `#ff0040`.
- Fragment Mono throughout, uppercase labels, one-pixel borders, no rounded cards, restrained scanlines.
- Information hierarchy comes from borders, brightness, spacing, and terminal titles rather than web-dashboard cards.
- Responsive layouts stack panels but retain the terminal table and on-screen shortcut rail.

## Verification target

- Backend tests cover all three presets and export.
- Frontend tests cover terminal rendering, shortcut transitions, API query encoding, and MVC boundaries.
- Production build and Python checks pass.
- Browser QA validates desktop, narrow viewport, keyboard navigation, focus, table selection, graph entry, wallet prompt, and export availability.

## Verification result

- Python repository/API suite: 10 passed.
- Frontend suite: 10 passed, including terminal state cycles and keyboard navigation.
- TypeScript and Vite production build: passed.
- Browser QA: LISTS, HISTORY map/signals, YOU via Enter, presets, wallet dialog, JSON download, and 390 px viewport passed.
- Browser console: zero errors and zero warnings.
