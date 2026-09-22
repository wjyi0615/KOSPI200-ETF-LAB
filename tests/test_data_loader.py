"""Offline snapshot integrity and provider-boundary tests."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pandas as pd
from src.data_loader import fetch_prices, save_snapshot, load_snapshot


class LoaderTests(unittest.TestCase):
    def test_snapshot_integrity(self):
        frame = pd.DataFrame({"Close": [100, 110, 105]}, index=pd.date_range("2024-01-01", periods=3, name="Date"))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "prices.csv"
            save_snapshot(frame, path, {"symbol": "069500", "provider": "naver"})
            restored, metadata = load_snapshot(path)
            self.assertEqual(restored.Close.tolist(), [100, 110, 105])
            self.assertEqual(metadata["rows"], 3)
            path.write_text(path.read_text().replace("110", "111"))
            with self.assertRaisesRegex(ValueError, "checksum"):
                load_snapshot(path)

    def test_yahoo_inclusive_end(self):
        frame = pd.DataFrame({("Close", "069500.KS"): [100, 110, 105]}, index=pd.date_range("2024-01-01", periods=3))
        with patch("yfinance.download", return_value=frame) as download:
            result = fetch_prices("069500", "2024-01-01", "2024-01-03", "yahoo")
            self.assertEqual(len(result), 3)
            self.assertEqual(download.call_args.kwargs["end"], "2024-01-04")
            self.assertFalse(download.call_args.kwargs["auto_adjust"])

    def test_empty_response(self):
        with patch("FinanceDataReader.DataReader", return_value=pd.DataFrame()):
            with self.assertRaisesRegex(ValueError, "no price"):
                fetch_prices("069500", "2024-01-01", "2024-01-03")
