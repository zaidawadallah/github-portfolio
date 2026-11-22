import os
import tempfile
import unittest
from datetime import date

from orb_analyzer import Trade, analyze, load_trades, main, report


def t(d, s, pts):
    return Trade(date.fromisoformat(d), s, "long", pts)


class AnalyzerTests(unittest.TestCase):
    def setUp(self):
        self.trades = [
            t("2026-11-02", "fade", 4.0),    # Mon win
            t("2026-11-03", "fade", -2.0),   # Tue loss
            t("2026-11-04", "fade", 4.0),    # Wed win
            t("2026-11-05", "fade", -2.0),   # Thu loss
            t("2026-11-06", "fade", 0.0),    # Fri scratch
            t("2026-11-02", "breakout", -3.0),
            t("2026-11-03", "breakout", 2.0),
        ]
        self.stats = analyze(self.trades)

    def test_counts_and_win_rate(self):
        f = self.stats["fade"]
        self.assertEqual((f.trades, f.wins, f.losses, f.scratches), (5, 2, 2, 1))
        self.assertAlmostEqual(f.win_rate, 0.5)

    def test_expectancy_and_profit_factor(self):
        f = self.stats["fade"]
        self.assertAlmostEqual(f.net, 4.0)
        self.assertAlmostEqual(f.expectancy, 0.8)
        self.assertAlmostEqual(f.profit_factor, 2.0)

    def test_breakeven_win_rate(self):
        # avg win 4, avg loss 2 -> need 2/(4+2) = 33.3%
        self.assertAlmostEqual(self.stats["fade"].breakeven_win_rate, 1 / 3)

    def test_max_drawdown(self):
        # fade equity: 4, 2, 6, 4, 4 -> peak 6, low after 4 -> dd 2
        self.assertAlmostEqual(self.stats["fade"].max_drawdown, 2.0)
        # breakout equity: -3, -1 -> peak 0 -> dd 3
        self.assertAlmostEqual(self.stats["breakout"].max_drawdown, 3.0)

    def test_weekday_split(self):
        self.assertEqual(self.stats["fade"].by_weekday["Mon"], [1, 1])
        self.assertEqual(self.stats["fade"].by_weekday["Tue"], [0, 1])

    def test_report_flags_small_sample(self):
        text = report(self.stats, 50, 1)
        self.assertIn("only 5 trades", text)
        self.assertIn("$40", text)  # 0.8 pts * $50

    def test_csv_round_trip_and_bad_columns(self):
        with tempfile.TemporaryDirectory() as d:
            good = os.path.join(d, "g.csv")
            with open(good, "w") as f:
                f.write("date,strategy,direction,result_points\n2026-11-02,Fade,short,3.5\n")
            self.assertEqual(load_trades(good)[0].strategy, "fade")
            bad = os.path.join(d, "b.csv")
            with open(bad, "w") as f:
                f.write("date,points\n2026-11-02,3\n")
            with self.assertRaises(ValueError):
                load_trades(bad)
            self.assertEqual(main([bad]), 1)


if __name__ == "__main__":
    unittest.main()
