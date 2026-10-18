# Responsive UI Test Log (PWM-NF-004 / TC-UX-01)

Issue: #25 · Owner: Shikshith V · Breakpoints: 360px (base), 768px, 1280px (SAD 4.7)

## How to run

```
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e
```

The automated suite (`frontend/e2e/dashboard.spec.js`) opens the dashboard at 360, 768 and 1280 px in
its normal, stale-price, empty and error states. In each case it checks that:

- the page has no horizontal scroll;
- no element inside the page extends past the screen edge;
- the net worth and allocation figures are correct;
- no text is smaller than 12px;
- the allocation legend can be reached with the keyboard.

## Screens covered

| Screen | 360px | 768px | 1280px | Notes |
|---|---|---|---|---|
| Dashboard: net worth (#15) | Pass | Pass | Pass | Automated |
| Dashboard: allocation chart (#16) | Pass | Pass | Pass | Automated |
| Dashboard: stale / empty / error states | Pass | Pass | Pass | Automated |
| Top navigation | Pass | Pass | Pass | Scrolls inside its own strip at 360px (by design) |
| Asset forms | n/a | n/a | n/a | Not built yet (asset issues). Retest when they are merged. |
| Login / register | n/a | n/a | n/a | Not built yet (auth issues). Retest when they are merged. |

Browsers: Chromium tested automatically. Firefox, Safari and Edge still need a manual pass, as TC-UX-01 requires.
Dark mode was checked at 360px and 1280px.

## Issues found and how they were resolved

| # | Width | Issue | Resolution |
|---|---|---|---|
| 1 | 360px | The four nav links (Dashboard, Assets, Reports, Settings) don't fit on one line and would widen the page. | The nav scrolls sideways inside its own strip (`.nav { overflow-x: auto }`), so the page itself never scrolls. This matches SAD 4.7: content may scroll in its own container. |
| 2 | 360px | Large net-worth values (₹1,03,45,000.00 and above) could overflow the card at a fixed 40px font size. | The font size scales with screen width (`clamp(1.75rem, 8vw, 2.5rem)`), and `overflow-wrap: anywhere` is a fallback for very large values. |
| 3 | 360px | In the legend, the label, rupee value and percentage on one row were cramped and wrapped unpredictably. | Below 768px the rupee value moves to a second line under the label. At 768px and up it's a single row. |
| 4 | 768–1279px | Putting the two cards side by side at tablet width squeezed the donut and legend too much. | The cards stay stacked until 1280px, and the allocation card switches to donut-beside-legend from 768px. |
| 5 | All | Grid children with long numbers could push the grid wider than the screen (CSS grid items default to `min-width: auto`). | Grid columns use `minmax(0, 1fr)` and cards have `min-width: 0`. |
| 6 | All | With no assets, the card read "₹0 across 0 asset classes". | The card shows "No assets added yet", and the chart shows an empty-state message. |
| 7 | All | Nav links and the "Try again" button were below a comfortable tap size on phones. | Minimum height set to 40px. |
