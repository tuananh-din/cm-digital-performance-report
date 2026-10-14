# CM Digital Performance Report

Monthly Channel Marketing report (Facebook Ads + store revenue), built as a single self-contained HTML page plus a 16:9 summary slide (PNG).

- Live report (latest month): `index.html`
- Monthly snapshots: `bao-cao-digital-performance-YYYY-MM.html`
- Slide for decks: `slide-digital-performance-YYYY-MM.png`, or use **Download PNG / Copy PNG** at the top of the page (exports the slide for the selected month, 3200×1800, light theme)

## Build a new month

1. Replace `CM - MONTHLY REPORT _data_media.csv` with the new export.
2. Add analyst notes for the month in `src/report-insights.js` (`MONTH_NOTES["YYYY.MM"]`: `overall`, `action`, `shops`, `slide`).
3. Run:

```bash
python3 build-monthly-report.py
```

The PNG export needs Google Chrome installed (headless screenshot of `index.html#slide`).

## Method notes

- Adjusted monthly target = quarter target − revenue already booked in earlier months of the quarter. Revenue ≥ adjusted target ⇒ store is on target.
- All total ratios (ROAS, CIR, Cost/Message) are sum ÷ sum, never an average of store ratios.
