"""Deterministic checks for financial definitions and invalid inputs."""
import unittest
import numpy as np
import pandas as pd
from src.metrics import performance_series, summarize


class MetricsTests(unittest.TestCase):
    def test_known_path(self):
        prices = pd.Series([100., 120., 90., 108.], index=pd.date_range("2024-01-01", periods=4))
        result = summarize(prices)
        self.assertAlmostEqual(result["cumulative_return"], .08)
        self.assertAlmostEqual(result["maximum_drawdown"], -.25)
        expected_std = np.std([.2, -.25, .2], ddof=1)
        self.assertAlmostEqual(result["annualized_volatility"], expected_std * np.sqrt(252))
        self.assertAlmostEqual(result["sharpe_ratio"], .05 / expected_std * np.sqrt(252))
        self.assertAlmostEqual(result["cagr"], 1.08 ** (365.25 / 3) - 1)
        self.assertTrue(pd.isna(performance_series(prices).daily_return.iloc[0]))

    def test_flat_prices(self):
        result = summarize(pd.Series([100.] * 3, index=pd.date_range("2024-01-01", periods=3)))
        self.assertIsNone(result["sharpe_ratio"])
        self.assertEqual(result["maximum_drawdown"], 0)

    def test_invalid_prices(self):
        for values in ([100, np.nan, 110], [100, 0, 110], [100, np.inf, 110]):
            with self.assertRaises(ValueError):
                summarize(pd.Series(values, index=pd.date_range("2024-01-01", periods=3)))
        with self.assertRaises(ValueError):
            summarize(pd.Series([100, 101, 102], index=pd.to_datetime(["2024-01-01"] * 3)))


if __name__ == "__main__":
    unittest.main()
