"""Unit/provenance checks for manually reviewed official metadata."""
import copy
import json
from pathlib import Path
import unittest
from src.fundamentals import validate_metadata

class FundamentalsTests(unittest.TestCase):
    def test_checked_snapshot_and_rejected_units(self):
        data=json.loads(Path('config/fundamentals.json').read_text())
        self.assertEqual(len(validate_metadata(data)['funds']),9)
        self.assertEqual(data['funds']['148020']['expenseRatio']['value'],.00017)
        for key,field,value in [('aum','asOf',None),('aum','unit','억원'),('expenseRatio','value',.15),('expenseRatio','sourceUrl','javascript:alert(1)'),('inceptionDate','value','2025-02-30')]:
            invalid=copy.deepcopy(data)
            invalid['funds']['069500'][key][field]=value
            with self.assertRaises(ValueError):validate_metadata(invalid)

    def test_partial_distributions(self):
        data=json.loads(Path('config/fundamentals.json').read_text())
        self.assertEqual(len(validate_metadata(data)['distributions']['161510']['events']),8)
        for key,value in [('paymentDate','2025-01-01'),('recordDate','2026-02-30'),('amountPerShare',-1),('amountPerShare',True)]:
            invalid=copy.deepcopy(data)
            invalid['distributions']['161510']['events'][0][key]=value
            with self.assertRaises(ValueError): validate_metadata(invalid)
        invalid=copy.deepcopy(data)
        invalid['distributions']['161510']['events'].append(invalid['distributions']['161510']['events'][0])
        with self.assertRaises(ValueError): validate_metadata(invalid)
        for key,value in [('complete',True),('sourceUrl','http://example.com'),('unit','percent')]:
            invalid=copy.deepcopy(data)
            invalid['distributions']['161510'][key]=value
            with self.assertRaises(ValueError): validate_metadata(invalid)
