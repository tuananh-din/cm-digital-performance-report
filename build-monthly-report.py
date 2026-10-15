"""Build the self-contained Digital Performance HTML report from the monthly media CSV.

Usage:  python3 build-monthly-report.py ["CM - MONTHLY REPORT _data_media.csv"]
Output: bao-cao-digital-performance-<latest month>.html  (CSS, JS and data inlined; Chart.js + font via CDN)
        index.html                                       (copy of the latest report, served by GitHub Pages)
        slide-digital-performance-<latest month>.png     (1-slide summary, 3200x1800, needs Google Chrome)
"""
import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "src"
DEFAULT_CSV = ROOT / "CM - MONTHLY REPORT _data_media.csv"
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome") or "", shutil.which("chromium") or "",
]
JS_ORDER = [
    "report-data-utils.js", "report-sections-render.js", "report-charts-core.js", "report-charts-trend.js",
    "report-charts-shop.js", "report-adjusted-target.js", "report-store-momentum.js", "report-advanced-insights.js", "report-insights.js", "report-slide-summary.js", "report-slide-export.js", "report-main.js",
]

# report field -> CSV column
FIELDS = {
    "target": "tRevenue", "revenue": "Revenue", "t_units": "tSale Units", "units": "Sale Units",
    "units_o2o": "Sale Units (O2O)", "contacts": "Total Contacts", "contacts_org": "Organic Contacts",
    "contacts_paid": "Paid Contacts", "budget": "Est. Ad Cost", "ad": "FB Ad Cost",
    "msg": "FB Messages", "msg2": "FB Messages 2 way", "msg5": "FB Messages 5 way",
    "msg_org": "FB Messages Organic", "msg_cmt": "FB Messages From Comment",
    "purchase_msg": "Purchase From Messages", "cmt": "FB Comments", "fol": "FB Followers", "aov": "AOV",
}


def to_number(value):
    """'₫4,000,000,000' / '2.26e+09' / '57%' / '1,143' -> float; blanks -> None."""
    s = (value or "").strip().replace("₫", "").replace(",", "")
    if not s:
        return None
    is_pct = s.endswith("%")
    try:
        x = float(s.rstrip("%"))
    except ValueError:
        return None
    return x / 100 if is_pct else x


def load_rows(csv_path):
    rows = []
    with open(csv_path, encoding="utf-8-sig", newline="") as f:  # file ships with a BOM
        reader = csv.DictReader(f)
        missing = [c for c in ["Month Name", "Shop", *FIELDS.values()] if c not in reader.fieldnames]
        if missing:
            raise SystemExit(f"CSV is missing columns: {missing}")
        for r in reader:
            shop = (r.get("Shop") or "").strip()
            if not shop:  # blank spacer rows
                continue
            row = {"month": r["Month Name"].strip(), "shop": shop, "tier": (r.get("Tier") or "").strip(),
                   "has_source": bool((r.get("Source Table") or "").strip())}
            row.update({k: to_number(r.get(col)) for k, col in FIELDS.items()})
            rows.append(row)
    if not rows:
        raise SystemExit("No data rows found in CSV")
    return rows


def build(csv_path):
    rows = load_rows(csv_path)
    template = (SRC_DIR / "report-template.html").read_text(encoding="utf-8")
    css = (SRC_DIR / "report-styles.css").read_text(encoding="utf-8")
    js = "\n".join((SRC_DIR / name).read_text(encoding="utf-8") for name in JS_ORDER)
    data = json.dumps(rows, ensure_ascii=False).replace("</", "<\\/")  # keep </script> out of inline JSON
    html = template.replace("/*@@CSS@@*/", css).replace("/*@@DATA@@*/", data).replace("/*@@JS@@*/", js)
    latest = max(r["month"] for r in rows)
    out = ROOT / f"bao-cao-digital-performance-{latest.replace('.', '-')}.html"
    out.write_text(html, encoding="utf-8")
    (ROOT / "index.html").write_text(html, encoding="utf-8")  # GitHub Pages entry = latest month
    print(f"{len(rows)} rows, months {min(r['month'] for r in rows)}..{latest} -> {out.name} (+ index.html)")
    export_slide_png(out, ROOT / f"slide-digital-performance-{latest.replace('.', '-')}.png")


def export_slide_png(html_path, png_path):
    """Screenshot the report's '#slide' view (1600x900 @2x) with headless Chrome; skipped if Chrome is missing."""
    chrome = next((c for c in CHROME_CANDIDATES if c and Path(c).exists()), None)
    if not chrome:
        print("Chrome not found -> skip PNG export (open the HTML and screenshot the slide instead)")
        return
    url = "file://" + quote(str(html_path)) + "#slide"
    cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
           "--window-size=1600,900", "--virtual-time-budget=10000", f"--screenshot={png_path}", url]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=90)
        print(f"slide PNG -> {png_path.name}")
    except (subprocess.SubprocessError, OSError) as e:
        print(f"PNG export failed ({e}); HTML report is still complete")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV)
