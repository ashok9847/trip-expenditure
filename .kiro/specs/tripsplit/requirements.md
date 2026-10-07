# Requirements Document

## Introduction
TripSplit is a mobile-first, backend-free web app for tracking shared trip expenses among friends and working out who owes whom. All data lives in the browser (localStorage).

## Glossary
- **Trip**: a named container of participants and expenses, with an optional date range.
- **Participant**: a person on the trip (name only).
- **Expense**: a payment made by one participant, split among one or more participants.
- **Share**: the portion of an expense a participant is responsible for.
- **Net balance**: total paid − total share. Positive = is owed money, negative = owes money.
- **Minor units**: integer smallest currency unit (e.g. paise). All money math uses minor units.
- **Trail map**: the "Timeline" view of the Journey tab that draws the trip's expenses as stops along a route.
- **Stop**: one expense drawn on the trail map as a circular marker.
- **Road**: the route line connecting stops on the trail map.
- **Settlement payment**: one `{ from, to, amount }` transfer suggested by the settle-up algorithm.
- **Payment QR**: an optional image of a participant's payment QR code (e.g. a GPay/PhonePe/Paytm screenshot).
- **Pay sheet**: the bottom sheet opened from a settlement payment's "Pay" button.

## Requirements

### R1 – Trips
User story: As a traveller, I want multiple trips so I can keep each trip's expenses separate.
1. WHEN the user creates a trip THEN the system SHALL require a non-empty name and accept an optional start and end date.
2. IF the end date is before the start date THEN the system SHALL show a validation error and not save.
3. The system SHALL let the user switch the active trip, rename/edit it, and delete it (with confirmation).
4. WHEN no trips exist THEN the system SHALL show an onboarding empty state prompting trip creation.

### R2 – Participants
1. The user SHALL be able to add, rename, and remove participants.
2. Names SHALL be non-empty and unique within a trip (case-insensitive).
3. IF a participant is referenced by any expense (payer or split) THEN the system SHALL block removal and explain which/how many expenses use them.

### R3 – Adding / editing an expense
1. An expense SHALL have description, amount (> 0, max 2 decimals), paid by (one participant), date-time, and split participants.
2. Date-time SHALL default to now and be editable.
3. The form SHALL open from a floating "+" button reachable from every tab.
4. "Paid by" SHALL default to the last payer used in that trip (or the first participant).
5. IF the trip has fewer than 1 participant THEN the "+" flow SHALL direct the user to add people first.

### R4 – Checkbox split
1. The form SHALL list every participant with a large checkbox, all checked by default.
2. A "Select all / Deselect all" toggle SHALL sit at the top of the list.
3. The form SHALL show a live preview "Split among N people, ₹X each" (noting when some pay 1 minor unit more due to rounding).
4. IF no participant is selected THEN the system SHALL show an error and block saving.
5. Equal split SHALL be the default. A "Custom split" mode SHALL let the user enter an exact amount per selected person; IF the amounts do not sum to the total THEN the system SHALL show the difference and block saving.

### R5 – Expense log
1. The log SHALL list all expenses newest first.
2. Each entry SHALL show payer, amount, description, date and time, and split participants (e.g. "Ravi paid ₹500 for Noodles on 29 Sep, 8:45 PM, split among Ravi, Kiran, Anil, Sai").
3. The user SHALL be able to edit and delete any expense; deletion SHALL require confirmation.
4. The log SHALL be filterable by person (payer or in split) and by date.

### R6 – Calculations and summary
1. For each participant the system SHALL show total paid, total share, and net balance.
2. The system SHALL show total trip expenditure.
3. The system SHALL suggest settlement transactions using the minimum number of transfers (exact for groups of up to 15 people with non-zero balance, greedy fallback beyond).
4. Rounding SHALL be deterministic so all net balances sum exactly to zero and all shares of an expense sum exactly to its amount.
5. Positive balances SHALL be green, negative red.

### R7 – Extras
1. The user SHALL be able to set the currency symbol (default ₹).
2. The user SHALL be able to export the log and summary as CSV and copy/share a plain-text summary suitable for WhatsApp.
3. The user SHALL be able to toggle dark mode; the choice persists (defaulting to the OS preference).
4. Empty states and hints SHALL guide first-time users.

### R8 – Persistence
1. All state SHALL be saved to localStorage on every change and restored on load.
2. IF stored data is missing or corrupt THEN the system SHALL start fresh without crashing.

### R9 – Quality / UX
1. Touch targets SHALL be at least 44px; UI SHALL be usable at 320px width.
2. Calculation logic SHALL be pure functions with unit tests covering uneven splits, single-person expenses, custom splits, and rounding.
3. Forms SHALL show friendly inline validation messages and be keyboard/screen-reader accessible (labels, focus handling, aria attributes).

### R10 – Bill / receipt attachment
User story: As a traveller, I want to attach the bill to an expense when I have one, so the group can check it later.
1. The expense form SHALL offer an optional bill field with "Take photo" (camera) and "Upload" (image or PDF).
2. IF the file is not an image/PDF, or is too large (images > 20 MB, PDFs > 5 MB), THEN the system SHALL show a friendly error.
3. Photos SHALL be downscaled before saving; bills SHALL be stored in IndexedDB and referenced from the expense by id.
4. The user SHALL be able to preview, replace and remove the bill while editing.
5. Expenses with a bill SHALL show a "View bill" thumbnail in the log that opens a full-size viewer with download.
6. Deleting an expense, trip or all data SHALL delete the related bill files; orphaned files SHALL be pruned on load.

### R11 – Trail map redesign
User story: As a traveller, I want the trip map to look like a clean, professional illustrated route poster that shows only what was spent and who paid, so that I can read the trip at a glance without clutter.

Typography and chrome
1. The trail map SHALL render all text labels in the app's sans font (Inter) and all money amounts in Space Grotesk with tabular numerals; no handwriting font (e.g. Caveat) SHALL be loaded or used by the trail map.
2. The trail map SHALL render the Play trip control as its topmost element; the trip heading, badges (e.g. "Bank of X", "Last-minute UPI"), the who's-up ticker and the person filter chips SHALL NOT be rendered anywhere in the trail map.
3. The trail map SHALL NOT contain a Settle-up section (settle-up remains in the Balances tab).

Stops
4. Each stop SHALL display exactly two text lines: line 1 the expense amount formatted with the trip's currency symbol and digit grouping (e.g. "₹18,000"), and line 2 "PAID BY <PAYER NAME>" in upper case; IF the payer name does not fit in the stop label width THEN the system SHALL truncate it with an ellipsis on a single line and expose the full name to assistive technology.
5. Each stop SHALL be drawn as a circular map marker: a light disc containing the expense's icon, a thin ring in the stop's scene colour, and a small avatar of the payer overlapping the marker's lower-right corner.
6. Stops SHALL NOT show captions, joke lines, "N people owe" text or mini avatars of the people who owe.
7. WHEN the user taps or activates a stop (click, Enter or Space while the stop has keyboard focus) THEN the system SHALL open a detail card showing the expense title, the amount, the payer, and one row per split participant with that participant's exact share formatted with the currency symbol; the shares shown SHALL sum exactly to the expense amount.

Road
8. The route SHALL be drawn as a road: a dark asphalt stroke with a thin light edge on both sides and a dashed light centre lane; no river or water-style route SHALL be drawn.
9. WHILE playback is in progress or paused after starting THEN the untravelled part of the road SHALL be drawn at no more than 40% opacity and the travelled part at 100% opacity, and a small car marker SHALL be positioned on the road at the current playback position.
10. WHILE playback has not started (initial state) or has reached the FINISH stop THEN the full road SHALL be drawn at 100% opacity.

Visual style
11. The trail map SHALL use a flat illustrated travel-poster style and SHALL NOT include torn-paper edges, tape, pushpins, crowns, rotated/tilted stickers, wobbly ink or displacement filters, paper-grain textures, a custom cursor, coin or confetti animations, joke copy, or emoji decorations.
12. The trail map SHALL include no decorative details other than: faint topographic contour lines, muted day bands, muted trees/hills, a small compass, a START marker at the first stop and a FINISH flag at the last stop.
13. WHEN the trip's expenses span more than one calendar day (in the device's local time zone) THEN each day band SHALL be labelled "DAY N" in small letter-spaced capitals, with N = 1 for the earliest day and incrementing by 1 per subsequent calendar day that has at least one expense; WHEN all expenses fall on one calendar day THEN no day labels SHALL be shown.
14. The FINISH flag SHALL show the trip total, equal to `totalExpenditure(expenses)` formatted with the currency symbol.
15. WHILE the dark theme is active THEN the trail map background SHALL be a deep navy colour (not pure black #000); in both dark and light themes, all text labels SHALL meet a contrast ratio of at least 4.5:1 against their immediate background.

Retained behaviour
16. The trail map SHALL keep Play/Pause, a scrubber for the playback position spanning the first to the last stop, and a 1x/2x speed toggle where 2x completes playback in half the 1x duration.
17. WHILE the user's system requests reduced motion (`prefers-reduced-motion: reduce`) THEN the trail map SHALL render the fully travelled road at 100% opacity, SHALL NOT animate the car marker, and SHALL update the displayed position immediately (no transition) when the scrubber moves.
18. WHEN the user activates "Share as story" THEN the system SHALL export a PNG rendered in the new style containing the road, the stops with amount and payer only, and the FINISH total, with no settle-up section.
19. WHEN the trip has no expenses THEN the trail map SHALL show an empty state prompting the user to add an expense and SHALL NOT render the road, stops, or playback controls.

Unchanged logic
20. The redesign SHALL NOT change money logic: amounts remain integer minor units, expense shares sum exactly to the amount, net balances sum exactly to zero, and settle-up uses the minimum number of transfers (R6).
21. FOR the demo trip, the computed net balances SHALL remain priya +10,350; naveed +1,150; gautam +300; ashok −1,600; ande −3,750; ayush −6,450 (in major units), and settle-up SHALL produce exactly 5 payments.

Ordering, dismissal and errors
22. The trail map SHALL place stops along the road in ascending expense date-time order, with the START marker at the earliest expense and the FINISH flag at the latest; expenses with identical date-times SHALL keep their creation order.
23. WHEN the detail card is open and the user presses Escape, activates its close control, or taps outside the card THEN the system SHALL close the card and return keyboard focus to the stop that opened it.
24. IF the "Share as story" export or share fails THEN the system SHALL show an error toast indicating the story could not be shared and SHALL leave the trail map and playback state unchanged.

### R12 – Payment QR codes
User story: As a traveller, I want each person to optionally store a picture of their payment QR code and pay straight from the settle-up list, so that the group can settle debts without asking for payment details.

People editor
1. The People editor (PersonSheet) SHALL offer an optional "Payment QR" field. WHILE the participant has no Payment QR, the field SHALL show an Upload action. WHILE the participant has a Payment QR, the field SHALL show a preview thumbnail of the stored image plus Replace and Remove actions.
2. IF the selected file's type is not an image (MIME type not starting with `image/`), is larger than 20 MB (20 × 1024 × 1024 bytes), or cannot be decoded as an image, THEN the system SHALL show an inline error message beside the Payment QR field naming the reason (not an image / file too large / unreadable image), SHALL NOT open a browser alert, and SHALL keep the previous Payment QR (or absence of one) unchanged.
3. WHEN a Payment QR image is accepted, THE system SHALL downscale it so its longer side is at most 720 px (preserving aspect ratio to within 1 px, never upscaling an image whose longer side is already ≤ 720 px) and store it as JPEG with the participant.
4. WHEN the user removes a Payment QR and saves the People editor, THE system SHALL leave the participant with no Payment QR and SHALL delete any stored image data for it; IF the user removes or replaces a Payment QR and then closes the People editor without saving, THEN the system SHALL keep the previously stored Payment QR unchanged.
5. THE system SHALL persist the Payment QR across page reloads (R8); IF stored Payment QR data is missing or cannot be decoded as an image on load, THEN the system SHALL treat that participant as having no Payment QR, keep all other participant and trip data intact, and SHALL NOT crash or show a blank screen.
6. WHEN a participant, a trip, or all data is deleted, THE system SHALL delete the Payment QR data belonging to every deleted participant, and no image data for those participants SHALL remain in browser storage.

Pay flow in Balances
7. THE Balances tab settle-up list SHALL show a "Pay" button on every settlement payment row, meeting the 44 px minimum touch target (R9.1).
8. WHEN the user taps "Pay" on a settlement payment row, THE system SHALL open the Pay sheet for that payment showing the recipient's name, the payer's name, and the payment amount formatted with the trip's currency symbol exactly as it appears in the settle-up row.
9. IF the recipient has a Payment QR, THEN the Pay sheet SHALL show the QR image rendered at a width of at least 240 px (or the full available sheet width if the viewport is narrower than 240 px plus sheet padding); WHEN the user taps the QR image, THE system SHALL show it enlarged to fill the viewport while preserving aspect ratio, and WHEN the user taps the enlarged image or presses Escape, THE system SHALL return to the Pay sheet.
10. IF the recipient has no Payment QR, THEN the Pay sheet SHALL show, in place of the QR image, a text message stating that the recipient has no Payment QR and that one can be added for them in the People tab.
11. WHERE the recipient has a UPI ID and the trip's currency symbol is ₹, THE Pay sheet SHALL show an "Open UPI app" link whose target is a `upi://pay` URL containing the recipient's UPI ID (`pa`), the recipient's name URL-encoded (`pn`), the payment amount in rupees with exactly two decimal places and no currency symbol or thousands separators (`am`, e.g. `1250.50`), and `cu=INR`; IF the currency symbol is not ₹, THEN the Pay sheet SHALL NOT show the "Open UPI app" link.
12. WHERE the recipient has a UPI ID, THE Pay sheet SHALL show the UPI ID as text and a "Copy UPI ID" button; WHEN the user taps "Copy UPI ID", THE system SHALL copy the exact UPI ID string to the clipboard and show a toast confirming it was copied; IF the clipboard write fails or is unavailable, THEN the system SHALL show a toast indicating the copy failed, and the UPI ID SHALL remain visible as selectable text.
13. THE Pay sheet SHALL show a "Mark as paid" button when the payment is unpaid and a "Mark as unpaid" button when it is paid; WHEN the user taps the button, THE system SHALL toggle the payment's paid state, and the button label and the corresponding settle-up row SHALL reflect the new state without reloading the page.
14. THE system SHALL persist the paid state per trip, keyed by the payment's payer, recipient and amount (amount compared after rounding to two decimal places), and the paid state SHALL be restored after a page reload; paid marks in one trip SHALL NOT affect payments shown for any other trip.
15. WHILE a settlement payment is marked paid, THE system SHALL show a visible "Paid" text label on its settle-up row and render the row with reduced emphasis compared with unpaid rows, and the paid state SHALL be exposed to screen readers as text (e.g. "Paid") within the row's accessible name or content.
16. WHEN the settle-up list is recalculated after expenses or participants change, THE system SHALL remove every paid mark whose payer, recipient and amount no longer match a payment in the recalculated list, and a payment that later reappears with the same payer, recipient and amount SHALL be shown as unpaid.
17. THE system SHALL NOT change any expense, net balance or suggested settlement payment as a result of marking a payment paid or unpaid.
18. THE Pay sheet SHALL follow the modal accessibility rules (R9.3): `role="dialog"`, `aria-modal="true"`, focus moved into the sheet on open and trapped within it, Escape closes it and returns focus to the "Pay" button that opened it; the QR image SHALL have alt text containing the recipient's name (e.g. "Payment QR for <name>").
19. THE People editor (PersonSheet) SHALL offer an optional "UPI ID" text field; THE system SHALL trim leading and trailing whitespace, treat an empty value as no UPI ID, and accept only values of 3 to 50 characters containing exactly one "@" with at least one character before and after it and no spaces.
20. IF the user tries to save the People editor with a non-empty UPI ID that fails the rule in criterion 19, THEN the system SHALL show an inline error beside the UPI ID field indicating the UPI ID format is invalid, SHALL NOT save the participant changes, and SHALL keep the previously stored UPI ID unchanged.
21. IF storing an accepted Payment QR fails because browser storage is full or unavailable, THEN the system SHALL show an inline error beside the Payment QR field indicating the image could not be saved, keep the previous Payment QR (or absence of one) unchanged, and keep all other stored trip data intact.
