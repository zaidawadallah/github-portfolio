"""Generates the SYNTHETIC sample_trades.csv used to demo the ORB analyzer.
These are not real trades; the seed keeps the file reproducible."""
import csv
import random
import sys
from datetime import date, timedelta

random.seed(4272)
out = sys.argv[1] if len(sys.argv) > 1 else "sample_trades.csv"
start = date(2026, 8, 31)  # Monday, 10 weeks of sessions
rows = []
d = start
while len(rows) < 100:
    if d.weekday() < 5:
        for strat, p_win, win, loss in (("breakout", 0.36, 6.0, 4.0), ("fade", 0.57, 4.5, 4.0)):
            res = win if random.random() < p_win else -loss
            res += random.choice([-0.5, -0.25, 0, 0, 0.25, 0.5])
            rows.append([d.isoformat(), strat, random.choice(["long", "short"]), round(res, 2)])
    d += timedelta(days=1)
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["date", "strategy", "direction", "result_points"])
    w.writerows(rows)
print(f"wrote {len(rows)} rows to {out}")
