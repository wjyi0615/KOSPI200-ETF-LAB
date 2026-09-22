"""Regression checks for cross-ETF calendars, YTD and safe failed updates."""
import copy
from datetime import datetime
import tempfile
import unittest
from pathlib import Path
from zoneinfo import ZoneInfo
import pandas as pd
from src.comparison import align_prices, build_dataset, period_rows
from src.update_data import completed_date, parse_naver, publish_snapshot


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.dates = pd.to_datetime(['2025-12-29', '2025-12-30', '2026-01-02', '2026-01-05'])
        self.frame = pd.DataFrame({'Close': [95., 100., 110., 121.]}, index=self.dates)
        self.universe = [{'symbol': 'a', 'name': 'A'}]

    def test_ytd_includes_first_trading_day(self):
        data = build_dataset({'a': self.frame}, self.universe)
        annual = data['periods']['2026']
        self.assertEqual(annual['start'], '2025-12-30')
        self.assertAlmostEqual(annual['metrics']['a']['cumulative_return'], .21)
        self.assertEqual(annual['metrics']['a']['return_observations'], 2)

    def test_no_fabricated_baseline(self):
        self.assertIsNone(period_rows(self.frame.iloc[2:], 2026))

    def test_missing_date_and_stale_member_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Missing'):
            align_prices({'a': self.frame, 'b': self.frame.drop(self.dates[1])})
        with self.assertRaisesRegex(ValueError, 'end dates'):
            align_prices({'a': self.frame, 'b': self.frame.iloc[:-1]})

    def test_common_inception(self):
        result = align_prices({'a': self.frame, 'b': self.frame.iloc[1:]})
        self.assertEqual(len(result), 3)

    def test_failed_update_preserves_previous_bytes(self):
        data = build_dataset({'a': self.frame}, self.universe)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'data.js'
            publish_snapshot(data, path)
            original = path.read_bytes()
            older = copy.deepcopy(data)
            older['as_of'] = '2024-12-30'
            with self.assertRaises(ValueError):
                publish_snapshot(older, path)
            self.assertEqual(path.read_bytes(), original)

    def test_partial_bar_cutoff(self):
        zone = ZoneInfo('Asia/Seoul')
        self.assertEqual(completed_date(datetime(2026, 9, 22, 17, tzinfo=zone)), '2026-09-21')
        self.assertEqual(completed_date(datetime(2026, 9, 22, 19, tzinfo=zone)), '2026-09-22')

    def test_xml_filter_and_invalid_close(self):
        xml = b'<chart><item data="20260102|1|1|1|100|10"/><item data="20260105|1|1|1|101|10"/><item data="20260106|1|1|1|102|10"/><item data="20260107|1|1|1|103|10"/></chart>'
        self.assertEqual(len(parse_naver(xml, '2026-01-06')), 3)
        with self.assertRaises(ValueError):
            parse_naver(xml.replace(b'|101|', b'|0|'), '2026-01-06')
