#!/usr/bin/env python3
"""ORB Backtest Analyzer.

Reads a CSV trade log for Opening Range Breakout (ORB) setups on ES futures and
compares strategy variants (e.g. "breakout" vs "fade"): win rate, average win/loss,
expectancy, profit factor, max drawdown, breakeven win rate and a day-of-week split.

CSV columns: date (YYYY-MM-DD), strategy, direction (long/short), result_points
Usage:
    python orb_analyzer.py sample_trades.csv
    python orb_analyzer.py sample_trades.csv --point-value 50 --contracts 1 --chart equity.png
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]


@dataclass
class Trade:
    day: date
    strategy: str
    direction: str
    points: float


@dataclass
class Stats:
    strategy: str
    trades: int = 0
    wins: int = 0
    losses: int = 0
    scratches: int = 0
    gross_win: float = 0.0
    gross_loss: float = 0.0
    net: float = 0.0
    max_drawdown: float = 0.0
    equity: list[float] = field(default_factory=list)
    by_weekday: dict[str, list[int]] = field(default_factory=dict)  # day -> [wins, trades]

    @property
    def win_rate(self) -> float:
        decided = self.wins + self.losses
        return self.wins / decided if decided else 0.0

    @property
    def avg_win(self) -> float:
        return self.gross_win / self.wins if self.wins else 0.0

    @property
    def avg_loss(self) -> float:
        return self.gross_loss / self.losses if self.losses else 0.0  # positive number

    @property
    def expectancy(self) -> float:
        """Average result per trade in points."""
        return self.net / self.trades if self.trades else 0.0

    @property
    def profit_factor(self) -> float:
        return self.gross_win / self.gross_loss if self.gross_loss else float("inf")

    @property
    def breakeven_win_rate(self) -> float:
        """Win rate needed to break even given the observed avg win / avg loss."""
        if not self.avg_win and not self.avg_loss:
            return 0.0
        return self.avg_loss / (self.avg_win + self.avg_loss)


def load_trades(path: str) -> list[Trade]:
    trades: list[Trade] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"date", "strategy", "direction", "result_points"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing columns: {', '.join(sorted(missing))}")
        for line_no, row in enumerate(reader, start=2):
            try:
                trades.append(Trade(
                    day=date.fromisoformat(row["date"].strip()),
                    strategy=row["strategy"].strip().lower(),
                    direction=row["direction"].strip().lower(),
                    points=float(row["result_points"]),
                ))
            except (ValueError, KeyError) as e:
                raise ValueError(f"Bad row on line {line_no}: {e}") from e
    trades.sort(key=lambda t: t.day)
    return trades


def analyze(trades: list[Trade]) -> dict[str, Stats]:
    out: dict[str, Stats] = {}
    for t in trades:
        s = out.setdefault(t.strategy, Stats(t.strategy, by_weekday={d: [0, 0] for d in WEEKDAYS}))
        s.trades += 1
        if t.points > 0:
            s.wins += 1
            s.gross_win += t.points
        elif t.points < 0:
            s.losses += 1
            s.gross_loss += -t.points
        else:
            s.scratches += 1
        s.net += t.points
        s.equity.append(s.net)
        wd = WEEKDAYS[t.day.weekday()] if t.day.weekday() < 5 else None
        if wd:
            s.by_weekday[wd][1] += 1
            if t.points > 0:
                s.by_weekday[wd][0] += 1
    for s in out.values():
        peak = 0.0
        for e in s.equity:
            peak = max(peak, e)
            s.max_drawdown = max(s.max_drawdown, peak - e)
    return out


def money(x: float) -> str:
    return f"-${abs(x):,.0f}" if x < 0 else f"${x:,.0f}"


def report(stats: dict[str, Stats], point_value: float, contracts: int, min_sample: int = 30) -> str:
    mult = point_value * contracts
    lines = ["# ORB Backtest Report", ""]
    header = "| Metric | " + " | ".join(s.strategy for s in stats.values()) + " |"
    lines += [header, "|---" * (len(stats) + 1) + "|"]

    def row(name, fn):
        lines.append(f"| {name} | " + " | ".join(fn(s) for s in stats.values()) + " |")

    row("Trades", lambda s: str(s.trades))
    row("Wins / Losses", lambda s: f"{s.wins} / {s.losses}")
    row("Win rate", lambda s: f"{s.win_rate:.1%}")
    row("Breakeven win rate", lambda s: f"{s.breakeven_win_rate:.1%}")
    row("Avg win (pts)", lambda s: f"{s.avg_win:.2f}")
    row("Avg loss (pts)", lambda s: f"{s.avg_loss:.2f}")
    row("Expectancy / trade", lambda s: f"{s.expectancy:.2f} pts ({money(s.expectancy * mult)})")
    row("Profit factor", lambda s: "∞" if s.profit_factor == float("inf") else f"{s.profit_factor:.2f}")
    row("Net", lambda s: f"{s.net:.2f} pts ({money(s.net * mult)})")
    row("Max drawdown", lambda s: f"{s.max_drawdown:.2f} pts ({money(s.max_drawdown * mult)})")

    lines += ["", "## Win rate by weekday", "", "| Day | " + " | ".join(stats) + " |", "|---" * (len(stats) + 1) + "|"]
    for d in WEEKDAYS:
        cells = []
        for s in stats.values():
            w, n = s.by_weekday[d]
            cells.append(f"{w}/{n} ({w / n:.0%})" if n else "—")
        lines.append(f"| {d} | " + " | ".join(cells) + " |")

    lines += ["", "## Notes", ""]
    for s in stats.values():
        if s.trades < min_sample:
            lines.append(f"- **{s.strategy}**: only {s.trades} trades. Treat results as a hypothesis, not proof "
                         f"(fewer than {min_sample} trades).")
        edge = s.win_rate - s.breakeven_win_rate
        verdict = "positive" if s.expectancy > 0 else "negative"
        lines.append(f"- **{s.strategy}**: {verdict} expectancy; win rate is {edge:+.1%} versus breakeven.")
    lines.append("- Weekday splits with fewer than ~20 trades per day are mostly noise.")
    return "\n".join(lines)


def plot(stats: dict[str, Stats], path: str, mult: float) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=120)
    for s in stats.values():
        ax.plot(range(1, len(s.equity) + 1), [e * mult for e in s.equity], label=s.strategy, linewidth=2)
    ax.axhline(0, color="#888", linewidth=0.8)
    ax.set_xlabel("Trade #")
    ax.set_ylabel("Cumulative P&L ($)")
    ax.set_title("Equity curve by strategy")
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(path)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("csv")
    p.add_argument("--point-value", type=float, default=50.0, help="$ per point (ES=50, MES=5)")
    p.add_argument("--contracts", type=int, default=1)
    p.add_argument("--chart", help="write an equity-curve PNG to this path")
    p.add_argument("--out", help="write the Markdown report to this path")
    a = p.parse_args(argv)
    try:
        stats = analyze(load_trades(a.csv))
    except (OSError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    if not stats:
        print("error: no trades found", file=sys.stderr)
        return 1
    text = report(stats, a.point_value, a.contracts)
    print(text)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if a.chart:
        plot(stats, a.chart, a.point_value * a.contracts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
