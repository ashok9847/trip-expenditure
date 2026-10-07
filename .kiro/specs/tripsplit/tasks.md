# Implementation Plan: TripSplit

## Overview

Tasks 1–21 cover the shipped app (R1–R10, mind map, payment journey). Tasks 22–31 add R11 (Trail map redesign) and R12 (Payment QR codes). They are ordered so the app builds and the test suite passes after each task: pure logic first, then state, then R12 UI, then the trail map from palette up to TrailMap and the story export, and finally cleanup. All code is JavaScript/JSX (React 19, Vite, Tailwind v4, Vitest), matching the existing project.

## Tasks

- [x] 1. Scaffold project (Vite, React, Tailwind v4, Vitest), base config and index.html
- [x] 2. Pure utils: money, id, dates (R6.4)
- [x] 3. Split logic: equal split with remainder, custom split validation (R4)
- [x] 4. Balance calculation and total expenditure (R6.1, R6.2)
- [x] 5. Settlement algorithm: exact DP + greedy fallback (R6.3)
- [x] 6. Export builders: CSV and WhatsApp text (R7.2)
- [x] 7. Unit tests for 2–6 (R9.2)
- [x] 8. Storage layer with validation and safe fallback (R8)
- [x] 9. App state: context + reducer + persistence, theme hook (R1, R2, R3, R7.3)
- [x] 10. Shared UI primitives: Modal, ConfirmDialog, EmptyState, buttons
- [x] 11. Trip management UI (R1)
- [x] 12. People management UI with removal guard (R2)
- [x] 13. Expense form with checkbox and custom split (R3, R4)
- [x] 14. Expense log with filters, edit, delete (R5)
- [x] 15. Summary: balances, total, settle up, exports (R6, R7.2)
- [x] 16. Settings: currency symbol, dark mode (R7.1, R7.3)
- [x] 17. App shell: header, tabs, FAB, empty states (R3.3, R7.4, R9.1)
- [x] 18. README, build and test verification
- [x] 19. Bill / receipt attachments (R10)
- [x] 20. Mind map view (utils/mindmap.js)
- [x] 21. Payment journey view (utils/journey.js)

- [x] 22. Pure logic for Payment QR, UPI and trail sizing
  - [x] 22.1 Add pinned test devDependencies
    - Add `"fast-check": "4.3.0"`, `"@testing-library/react": "16.3.0"` and `"jsdom": "26.1.0"` to `devDependencies` in `package.json` and install them
    - Allow per-file jsdom via `// @vitest-environment jsdom` in component tests
    - _Requirements: 9.2_

  - [x] 22.2 Create `src/utils/pay.js`
    - `toUpiAmount(minor)` (exactly two decimals, no symbol or separators), `buildUpiLink(to, amountMinor, tripName)` (`pa`, `pn`, `am`, `cu=INR`, optional `tn`), `pruneSettled(settled, settlements)` using `settleKey` from `copy.js`
    - _Requirements: 12.11, 12.14, 12.16_

  - [ ]* 22.3 Write property test for UPI link parameters in `src/test/pay.test.js`
    - **Property 17: UPI link parameters**
    - **Validates: Requirements 12.11**

  - [ ]* 22.4 Write property test for pruning paid marks in `src/test/pay.test.js`
    - **Property 19: Pruning paid marks**
    - **Validates: Requirements 12.16**

  - [x] 22.5 Update `src/storage/storage.js`
    - Add exported `isQr` (jpeg/png/webp base64 data URL, length < 900,000)
    - Tighten `isUpi` to the R12.19 rule (3–50 chars, exactly one `@` with ≥1 char each side, no whitespace), applied to the trimmed value
    - `sanitizeTrip` maps participants to `{ id, name, photo, upi, qr: isQr(p.qr) ? p.qr : null }`; keep `settled` per trip
    - _Requirements: 12.5, 12.14, 12.19, 8.2_

  - [ ]* 22.6 Write property test for state round trip in `src/test/storage.test.js`
    - **Property 7: State persistence round trip (including Payment QR)**
    - **Validates: Requirements 8.1, 12.5, 12.14**

  - [ ]* 22.7 Write property test for corrupt input and corrupt QR in `src/test/storage.test.js`
    - **Property 8: Corrupt input never crashes, and a corrupt QR only nulls the QR**
    - **Validates: Requirements 8.2, 12.5**

  - [ ]* 22.8 Write property test for the UPI ID rule in `src/test/storage.test.js`
    - **Property 16: UPI ID rule**
    - **Validates: Requirements 12.19**

  - [x] 22.9 Update `src/hooks/appReducer.js` and `demoTrip.js`
    - `ADD_PARTICIPANT` / `UPDATE_PARTICIPANT` carry `qr: action.qr ?? null`
    - Add `PRUNE_SETTLED { tripId, settlements }` using `pruneSettled`; return the same trip object when nothing is removed
    - Ensure `REMOVE_PARTICIPANT`, `DELETE_TRIP` and `RESET` drop inline `qr` with the participant; demo participants get `qr: null`
    - _Requirements: 12.4, 12.6, 12.16, 12.17_

  - [ ]* 22.10 Write property test for paid marks in `src/test/reducer.test.js` (new)
    - **Property 18: Paid marks never change money and are isolated per trip**
    - **Validates: Requirements 12.13, 12.14, 12.17**

  - [ ]* 22.11 Write property test for QR deletion in `src/test/reducer.test.js`
    - **Property 20: Deletion removes QR data**
    - **Validates: Requirements 12.6**

  - [x] 22.12 Update `src/utils/image.js`
    - Add `QR_MAX_SIDE = 720`, pure `fitWithin(w, h, max)`, `QrError(code, message)` and `qrToDataUrl(file, max, quality)` with checks in the order type → size (20 MB) → decode, white-filled canvas, JPEG output
    - _Requirements: 12.2, 12.3_

  - [ ]* 22.13 Write property test for QR scaling in `src/test/image.test.js`
    - **Property 14: QR scaling bounds**
    - **Validates: Requirements 12.3**

  - [ ]* 22.14 Write property test for QR rejection reasons in `src/test/image.test.js`
    - **Property 15: QR file rejection reasons**
    - **Validates: Requirements 12.2**

  - [x] 22.15 Update `stickerSize` in `trailLayout.js` and fix `src/test/trail.test.js`
    - `stickerSize(amount, max) = round(50 + 34·sqrt(max(0, amount) / max(1, max)))`, range [50, 84]
    - Change the `118` expectation to `84` and scale the "top stop is bigger than stop 5" assertion to the 34-unit range
    - _Requirements: 11.5_

  - [ ]* 22.16 Write property test for trail layout invariants in `src/test/trail.test.js`
    - **Property 12: Trail layout invariants**
    - **Validates: Requirements 11.4, 11.5, 11.22**

  - [x] 22.17 Write demo trip unit test in `src/test/demo.test.js` (new)
    - Nets are priya +10,350, naveed +1,150, gautam +300, ashok −1,600, ande −3,750, ayush −6,450 (major units); `settleUp` returns exactly 5 payments
    - _Requirements: 11.21, 11.20_

  - [ ]* 22.18 Write property test for shares and nets in `src/test/balances.test.js`
    - **Property 1: Shares sum to the amount and nets sum to zero**
    - **Validates: Requirements 6.1, 6.4, 11.7, 11.20**

  - [ ]* 22.19 Migrate the randomized settle-up loop to fast-check in `src/test/settlement.test.js`
    - **Property 2: Settle-up clears every balance with the minimum number of transfers**
    - **Validates: Requirements 6.3, 11.20**

- [x] 23. Transactional save in app state
  - [x] 23.1 Add `commit(action) → boolean` to `src/hooks/useAppState.jsx`
    - Compute `next = appReducer(state, action)`, call `saveState(next)`; return `false` without dispatching on failure, otherwise dispatch and return `true`; expose it from the context
    - _Requirements: 12.21_

  - [ ]* 23.2 Write unit tests for `commit` in `src/test/commit.test.jsx` (new)
    - Mock `saveState` to return `false` and assert state is unchanged; assert dispatch on success
    - _Requirements: 12.21_

- [x] 24. Payment QR and UPI in the People editor
  - [x] 24.1 Update `src/components/people/PersonSheet.jsx`
    - "Payment QR (optional)" block: hidden `<input type="file" accept="image/*" data-testid="qr-upload">`; Upload when empty; 96 px preview with `alt="Payment QR for {name}"`, Replace and Remove when set
    - Local `qr`, `qrBusy`, `errors.qr` state; `qrToDataUrl` on pick; `QrError` messages inline in `<p role="alert">` linked by `aria-describedby`; no `alert()`; previous QR kept on error
    - "UPI ID" field: trim, empty → `null`, invalid → inline error and block save
    - Save calls `onSave({ name, photo, upi, qr })`; on `false` show "Couldn’t save the image. Browser storage is full." and keep the sheet open; closing without saving leaves the stored QR unchanged
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.19, 12.20, 12.21, 9.3_

  - [x] 24.2 Wire `src/components/people/PeopleTab.jsx` to `commit`
    - `onSave` calls `commit({ type: 'ADD_PARTICIPANT' | 'UPDATE_PARTICIPANT', ..., qr })` and returns its boolean
    - _Requirements: 12.4, 12.21_

  - [ ]* 24.3 Write component tests in `src/test/personsheet.test.jsx` (new)
    - Upload shows preview with Replace/Remove; non-image, oversized and decode failure show the right inline message and `window.alert` is never called; close without save keeps `person.qr`; invalid UPI blocks save; `commit` returning `false` shows the storage error
    - _Requirements: 12.1, 12.2, 12.4, 12.20, 12.21_

- [x] 25. Pay flow in Balances
  - [x] 25.1 Add `QrIcon` to `src/components/ui/Icons.jsx`
    - _Requirements: 12.7_

  - [x] 25.2 Create `src/components/summary/PayModal.jsx`
    - Built on `ui/Modal` (dialog role, `aria-modal`, focus trap, Escape, focus return)
    - Header `from → to` and `formatMoney(amount, currency)` identical to the row
    - QR in `<button aria-label="Enlarge QR">` with `alt="Payment QR for {to.name}"`, width ≥ 240 px (or full sheet width); full-viewport overlay that closes on tap or Escape (capture-phase `stopPropagation` so the sheet stays open)
    - No-QR message pointing to the People tab
    - "Open UPI app" link with `buildUpiLink` only when `currency === '₹'` and `to.upi`
    - UPI ID as `select-all` text plus Copy button with success and failure toasts
    - "Mark as paid" / "Mark as unpaid" footer calling `onToggle`
    - _Requirements: 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.18_

  - [x] 25.3 Update `src/components/summary/SummaryTab.jsx`
    - Trailing "Pay" button per settle row (`min-h-11 min-w-11`, `QrIcon`, `aria-label="Pay {to} {amount}"`, ref kept for focus return) opening `PayModal`
    - `isPaid` from `trip.settled`; paid rows at `opacity-60` with a visible "Paid" pill in the row content and line-through amount
    - `TOGGLE_SETTLED` dispatch via `onToggle`; `PRUNE_SETTLED` effect when a stored key no longer matches the recalculated settlements
    - _Requirements: 12.7, 12.13, 12.14, 12.15, 12.16, 12.17, 9.1_

  - [ ]* 25.4 Write component tests in `src/test/pay.flow.test.jsx` (new)
    - Every row has Pay; sheet shows names and the same amount; QR alt text, enlarge and Escape back to the sheet; no-QR message; UPI link only for ₹ + UPI with `href === buildUpiLink(...)`; copy success and failure toasts; Mark as paid toggles label and row "Paid"; editing an expense prunes the stale mark
    - _Requirements: 12.7–12.18_

- [x] 26. Trail palette, fonts and marker styles
  - [x] 26.1 Rewrite `src/components/trail/palette.js`
    - Remove `HAND` and scrapbook constants; export `ACCENT`, `SANS`, `GROT`, `SCENE_TINT`, new `SCENE_RING` and `trailPalette(dark)` with the design tokens (dark `paper` `#141A29`)
    - Replace any `HAND` usages in existing trail files with `SANS` so the build stays green
    - _Requirements: 11.1, 11.15_

  - [x] 26.2 Update `src/components/trail/trail.css`
    - `.stk-art` thinner strokes, `.stop-pop` and `.stop-pulse` keyframes (disabled under `prefers-reduced-motion`), scrubber styling; remove handwriting, paper-grain, cursor, coin and confetti styles
    - _Requirements: 11.1, 11.11, 11.17_

  - [x] 26.3 Update `src/components/trail/Stickers.jsx`
    - Replace the tilted sticker/tape wrapper with a clean marker disc: light disc, faint scene tint, `SCENE_RING` ring, icon in `.stk-art` scaled `0.8 · size / 64`, never rotated
    - _Requirements: 11.5, 11.11_

  - [ ]* 26.4 Write palette contrast unit test in `src/test/palette.test.js` (new)
    - WCAG luminance helper: `text` and `sub` vs `paper` and both `band` colours ≥ 4.5:1 in light and dark; dark `paper` ≠ `#000000`
    - _Requirements: 11.15_

- [ ] 27. MapScene rewrite
  - [x] 27.1 Add `fitLabel(text, width, charW = 7.2)` to `trailLayout.js`
    - Single line; full text when it fits, otherwise prefix + `…`
    - _Requirements: 11.4_

  - [ ]* 27.2 Write property test for payer label truncation in `src/test/trail.test.js`
    - **Property 13: Payer label truncation**
    - **Validates: Requirements 11.4**

  - [x] 27.3 Rewrite road and car in `src/components/trail/MapScene.jsx`
    - Faded base group at opacity 0.35 when `showBase`; travelled group masked by `#{idp}-reveal` with edge (17), asphalt `refs.trail` (13) and dashed lane (1.5, `7 7`); hidden `refs.measure`; no river path
    - Flat `ACCENT` car marker in `carRef` group
    - _Requirements: 11.8, 11.9, 11.10_

  - [x] 27.4 Rewrite stop markers and labels in `MapScene.jsx`
    - Marker disc via `Sticker`, payer avatar at lower-right with `pal.disc` border, dotted connector to road dot
    - Line 1 `money(amount)` in Space Grotesk tabular; line 2 `"PAID BY " + NAME` through `fitLabel`, `aria-hidden`
    - Unrevealed stops at 18% opacity; `.stop-pop` / `.stop-pulse` on landing, omitted when `reduced`
    - No captions, quips, owes text or owe avatars
    - _Requirements: 11.1, 11.4, 11.5, 11.6, 11.17_

  - [x] 27.5 Rewrite decor in `MapScene.jsx`
    - Seeded contour lines, alternating day bands with "DAY N" only when `layout.days.length > 1`, flat pine/mountain shapes only, compass, START marker with traveller count, FINISH checkered flag with `money(totalExpenditure(trip.expenses))`
    - _Requirements: 11.11, 11.12, 11.13, 11.14_

  - [ ]* 27.6 Write property test for journey order and day numbering in `src/test/journey.test.js`
    - **Property 11: Journey order and day numbering**
    - **Validates: Requirements 11.13, 11.22**

- [x] 28. TrailMap rewrite
  - [x] 28.1 Rewrite `src/components/trail/TrailMap.jsx` shell and playback
    - Remove heading, badges, ticker (`Odometer`, `Face`), filter chips, mute (`sound.js`), `Coin`, `Hand`, `Confetti`, `SettleCard`, paper grain, `tornClip`, `font-hand`
    - Single `.card`: control bar first (Play/Pause with `aria-pressed`, range scrubber 0–1000 `aria-label="Trip position"`, 1x/2x toggle doubling frame delta), SVG `role="img"` with descriptive label, footer "{N} stops · {total}" and "Share as story"
    - Rest/Finished draw the full road with no base and no car; Playing/Paused show base and car
    - Reduced motion: `REDUCED_TIMING`, full road, no car animation, synchronous `apply` on scrub
    - Empty state "No stops yet. Add an expense to start the trail." with Add expense action and no road, stops or controls
    - _Requirements: 11.2, 11.3, 11.9, 11.10, 11.16, 11.17, 11.19, 11.22_

  - [x] 28.2 Add stop buttons and detail card to `TrailMap.jsx`
    - Transparent button per stop with `aria-label` "<amount> paid by <full name> for <description>. Show shares." and `aria-expanded`
    - Opening pauses playback, sets `openId`, focuses close; card `role="dialog"` with title, 44 px `×`, amount, payer, one row per `computeShares` share
    - Escape, `×` or outside `pointerdown` closes and refocuses the stop button
    - _Requirements: 11.4, 11.7, 11.23, 9.3_

  - [ ]* 28.3 Write component tests in `src/test/trailmap.test.jsx` (new)
    - Play is first focusable; no heading, badges, ticker, filters, "Settle up" or `font-hand`; two label lines per stop; road strokes and lane dasharray, no river; DAY labels only for multi-day trips; FINISH total; empty state; detail card open via Enter/Space with shares summing to amount and all three close paths returning focus; reduced-motion checks
    - _Requirements: 11.2–11.10, 11.13, 11.14, 11.17, 11.19, 11.23_

- [x] 29. Story export in the new style
  - [x] 29.1 Rewrite `src/components/trail/story.jsx`
    - Static `MapScene live={false}` at 1080 px wide, Inter header with trip name and "{N} stops · {total}", FINISH total, no settle-up list
    - Embed base64 `@font-face` for Inter and Space Grotesk plus `.stk-art` CSS; fall back to system fonts if embedding fails
    - _Requirements: 11.1, 11.18_

  - [x] 29.2 Add share error handling in `TrailMap.jsx`
    - `navigator.share({ files })` when `canShare` allows, otherwise download; ignore `AbortError`; other errors show `toast('Couldn’t share the story. Please try again.', 'error')`; playback refs and `openId` untouched
    - _Requirements: 11.18, 11.24_

  - [ ]* 29.3 Write story tests in `src/test/story.test.jsx` (new)
    - Mocked `renderStory` rejection shows the error toast and leaves scrubber value and `openId` unchanged; story SVG contains FINISH and the total and no "Settle"
    - _Requirements: 11.18, 11.24_

- [x] 30. Cleanup and docs
  - [x] 30.1 Delete unused trail files and the handwriting font
    - Delete `trail/SettleCard.jsx`, `trail/Face.jsx`, `trail/Odometer.jsx`, `trail/torn.js`, `trail/Scenery.jsx`, `utils/sound.js`; remove any remaining imports
    - Uninstall `@fontsource/caveat` and remove its import
    - _Requirements: 11.1, 11.3, 11.11_

  - [x] 30.2 Update the empty state copy in `src/components/journey/JourneyTab.jsx`
    - _Requirements: 11.19_

  - [x] 30.3 Update `README.md` for the trail map redesign and Payment QR / Pay flow
    - _Requirements: 11, 12_

  - [ ]* 30.4 Write dependency smoke test in `src/test/deps.test.js` (new)
    - `package.json` has no `@fontsource/caveat`; no file under `src/` imports the deleted trail files or `sound.js`
    - _Requirements: 11.1, 11.11_

- [x] 31. Final checkpoint - Ensure all tests pass
  - Run `npm test` and `npm run build`; confirm the demo trip test (R11.21) passes. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; 22.15 and 22.17 are required because they keep existing tests green and pin R11.21.
- Property tests use fast-check with `numRuns: 100` and a tag comment `// Feature: tripsplit, Property {n}: {title}`.
- Properties 3–6, 9 and 10 cover R1–R10 logic already shipped and are not part of this plan.
- Visual, 320 px and screen reader checks are manual and outside these coding tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["22.1"] },
    { "id": 1, "tasks": ["22.2", "22.5", "22.12", "22.15"] },
    { "id": 2, "tasks": ["22.9", "22.3", "22.6", "22.13", "22.16"] },
    { "id": 3, "tasks": ["22.4", "22.7", "22.14", "22.10", "22.17", "23.1"] },
    { "id": 4, "tasks": ["22.8", "22.11", "22.18", "23.2", "24.1", "25.1"] },
    { "id": 5, "tasks": ["22.19", "24.2", "25.2"] },
    { "id": 6, "tasks": ["24.3", "25.3", "26.1", "26.2", "27.1"] },
    { "id": 7, "tasks": ["25.4", "26.3", "26.4", "27.2"] },
    { "id": 8, "tasks": ["27.3", "27.6"] },
    { "id": 9, "tasks": ["27.4"] },
    { "id": 10, "tasks": ["27.5"] },
    { "id": 11, "tasks": ["28.1"] },
    { "id": 12, "tasks": ["28.2"] },
    { "id": 13, "tasks": ["29.1", "28.3"] },
    { "id": 14, "tasks": ["29.2"] },
    { "id": 15, "tasks": ["29.3", "30.1", "30.2", "30.3"] },
    { "id": 16, "tasks": ["30.4"] }
  ]
}
```
