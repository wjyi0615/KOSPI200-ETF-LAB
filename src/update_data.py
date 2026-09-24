"""Fetch all ETFs and replace the website snapshot only after full validation."""
import argparse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import hashlib
import json
import os
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .comparison import build_dataset
from .data_loader import ROOT, save_snapshot
from .metrics import validate_prices

ENDPOINT = "https://fchart.stock.naver.com/sise.nhn"


def completed_date(now: datetime | None = None) -> str:
    """Avoid same-day partial bars before 18:00 Asia/Seoul, including manual runs."""
    now = now or datetime.now(ZoneInfo("Asia/Seoul"))
    now = now.astimezone(ZoneInfo("Asia/Seoul"))
    day = now.date() if now.hour >= 18 else now.date() - timedelta(days=1)
    return day.isoformat()


def parse_naver(payload: bytes, end: str) -> pd.DataFrame:
    """Validate the vendor XML schema, filtering out dates outside the request."""
    # NAVER's chart endpoint declares EUC-KR. Passing the raw bytes directly
    # to ElementTree raises ``ValueError: multi-byte encodings are not
    # supported`` on current Python, so decode the declared legacy encoding
    # before parsing the XML text.
    try:
        decoded = payload.decode("euc-kr")
    except UnicodeDecodeError as exc:
        raise ValueError("NAVER response is not valid EUC-KR XML") from exc
    rows = [item.attrib["data"].split("|") for item in ET.fromstring(decoded).iter("item")]
    if not rows or any(len(row) != 6 for row in rows):
        raise ValueError("NAVER returned no data or an unexpected schema")
    frame = pd.DataFrame(rows, columns=["Date", "Open", "High", "Low", "Close", "Volume"])
    frame["Date"] = pd.to_datetime(frame.Date, format="%Y%m%d", errors="raise")
    frame = frame.set_index("Date").sort_index().apply(pd.to_numeric, errors="raise")
    frame = frame.loc["2022-12-01":end]
    validate_prices(frame.Close)
    if not frame.Volume.ge(0).all():
        raise ValueError("Invalid volume")
    return frame


def collect(universe: list, end: str, raw_dir: Path) -> dict:
    """Fetch a bounded history with retries; no cross-provider fallback."""
    frames = {}
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    with requests.Session() as session:
        session.mount("https://", HTTPAdapter(max_retries=retry))
        for etf in universe:
            symbol = etf["symbol"]
            response = session.get(ENDPOINT, params={"symbol": symbol, "timeframe": "day", "count": 6000,
                                                     "requestType": 0}, timeout=(10, 45))
            response.raise_for_status()
            raw_dir.mkdir(parents=True, exist_ok=True)
            (raw_dir / f"{symbol}.xml").write_bytes(response.content)
            frame = parse_naver(response.content, end)
            if (pd.Timestamp(end) - frame.index[-1]).days > 10:
                raise ValueError(f"{symbol}: latest price is older than 10 calendar days")
            save_snapshot(frame, raw_dir / f"{symbol}.csv",
                          {"symbol": symbol, "provider": "naver", "start": "2022-12-01", "end": end,
                           "endpoint": ENDPOINT, "response_sha256": hashlib.sha256(response.content).hexdigest()})
            frames[symbol] = frame
            print(f"{symbol}: {len(frame)} observations, through {frame.index[-1].date()}")
    return frames


def publish_snapshot(dataset: dict, output: Path) -> None:
    """Atomically replace one self-contained JS snapshot after regression checks."""
    if output.exists():
        old_text = output.read_text(encoding="utf-8")
        # The repository starts with a deliberately empty ``window.ETF_DATA
        # = null`` seed. Treat that as no prior release; later releases are
        # parsed only from the generated JSON payload.
        if "window.ETF_DATA =" not in old_text:
            raise ValueError("Existing data.js has an unexpected format")
        payload = old_text.split("window.ETF_DATA =", 1)[1].strip().rstrip(";\n").strip()
        old = None if payload == "null" else json.loads(payload)
        if old is not None and dataset["as_of"] < old["as_of"]:
            raise ValueError("New data regresses the last published date")
        old_symbols = set(old["prices"]) if old is not None else set()
        if old is not None and old_symbols == set(dataset["prices"]) and dataset["dates"][0] > old["dates"][0]:
            raise ValueError("New response truncates historical coverage")
    output.parent.mkdir(parents=True, exist_ok=True)
    content = "window.ETF_DATA = " + json.dumps(dataset, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + ";\n"
    # Serialization completes before touching the last valid public snapshot.
    with tempfile.NamedTemporaryFile(mode="w", dir=output.parent, encoding="utf-8", delete=False) as handle:
        handle.write(content)
        temporary = handle.name
    os.replace(temporary, output)


def main() -> None:
    """Collect, validate and publish one snapshot; failures leave the old site intact."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--end", default=completed_date())
    parser.add_argument("--output", type=Path, default=ROOT / "docs/data.js")
    parser.add_argument("--universe", type=Path, default=ROOT / "config/etfs.json")
    args = parser.parse_args()
    if args.end > completed_date():
        parser.error("end exceeds the latest completed-session cutoff")
    universe = json.loads(args.universe.read_text())
    raw_dir = ROOT / "data/raw" / datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%dT%H%M%S")
    dataset = build_dataset(collect(universe, args.end, raw_dir), universe)
    publish_snapshot(dataset, args.output)
    print(f"Published {len(universe)} ETFs; last common date {dataset['as_of']}")


if __name__ == "__main__":
    main()
