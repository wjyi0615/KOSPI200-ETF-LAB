"""Validate and publish manually verified, field-dated issuer metadata.

Price updates never silently refresh these dates. Re-check the official source,
edit config/fundamentals.json, then run python -m src.fundamentals.
"""
from datetime import date
import json
from math import isfinite
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {'aum', 'expenseRatio', 'inceptionDate'}


def validate_metadata(data):
    """Reject unit/date/provenance errors before replacing the published file."""
    if data.get('schema_version') != 1 or not isinstance(data.get('funds'), dict):
        raise ValueError('Invalid metadata schema')
    for ticker, fields in data['funds'].items():
        if len(ticker) != 6 or not ticker.isdigit() or set(fields) - FIELDS:
            raise ValueError('Invalid ticker or field')
        for name, record in fields.items():
            checked = date.fromisoformat(record['checkedAt'])
            if checked > date.today():
                raise ValueError('Future verification date')
            if record.get('asOf') and date.fromisoformat(record['asOf']) > checked:
                raise ValueError('Source date exceeds verification date')
            url = urlparse(record['sourceUrl'])
            if url.scheme != 'https' or not url.netloc or not record['sourceName']:
                raise ValueError('Missing official source')
            value = record['value']
            if name == 'inceptionDate':
                if date.fromisoformat(value) > checked:
                    raise ValueError('Future listing date')
            elif isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or value < 0:
                raise ValueError('Invalid numeric value')
            if name == 'aum' and (not record.get('asOf') or value <= 0 or record['unit'] != 'KRW'):
                raise ValueError('AUM requires dated KRW amount')
            if name == 'expenseRatio' and (value > .1 or record['unit'] != 'annual_fraction'):
                raise ValueError('Fee must be an annual fraction, not percentage points')
    return data


def main():
    """Generate the offline-compatible browser asset from reviewed metadata."""
    data = validate_metadata(json.loads((ROOT / 'config/fundamentals.json').read_text()))
    content = 'window.ETF_FUNDAMENTALS = ' + json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + ';\n'
    (ROOT / 'docs/fundamentals.js').write_text(content, encoding='utf-8')
    print(f"Published verified metadata for {len(data['funds'])} ETFs")


if __name__ == '__main__':
    main()
