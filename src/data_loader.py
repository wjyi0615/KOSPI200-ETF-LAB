"""Explicit provider adapters and verifiable local price snapshots."""
import argparse
import hashlib
import importlib.metadata
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .metrics import validate_prices

ROOT = Path(__file__).resolve().parents[1]


def fetch_prices(symbol: str, start: str, end: str, provider: str = "naver") -> pd.DataFrame:
    """Fetch inclusive date bounds; never silently switch price providers.

    NAVER exposes vendor OHLCV, without a verified distribution-reinvestment
    series. Yahoo Close is explicitly unadjusted; Adj Close is saved separately.
    """
    if not re.fullmatch(r"\d{6}", symbol):
        raise ValueError("Use a six-digit Korean symbol, e.g. 069500")
    first, last = pd.Timestamp(start), pd.Timestamp(end)
    if first > last:
        raise ValueError("start must be <= end")
    if provider == "naver":
        import FinanceDataReader as fdr
        frame = fdr.DataReader(f"NAVER:{symbol}", start, end)
    elif provider == "yahoo":
        import yfinance as yf
        frame = yf.download(f"{symbol}.KS", start=start,
                            end=(last + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                            auto_adjust=False, actions=True, progress=False, timeout=30)
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = frame.columns.get_level_values(0)
    else:
        raise ValueError(f"Unknown provider: {provider}")
    if frame.empty or "Close" not in frame:
        raise ValueError(f"{provider}: no price data returned")
    frame.index = pd.to_datetime(frame.index).tz_localize(None)
    frame = frame.sort_index().loc[first:last].copy()
    frame.index.name = "Date"
    validate_prices(frame["Close"])
    return frame


def save_snapshot(frame: pd.DataFrame, path: Path, metadata: dict) -> None:
    """Save provider output and a provenance sidecar with a SHA-256 checksum."""
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, float_format="%.12g")
    metadata = {**metadata, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
                "actual_start": str(frame.index[0].date()), "actual_end": str(frame.index[-1].date()),
                "rows": len(frame), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "versions": {p: importlib.metadata.version(p) for p in ["finance-datareader", "yfinance", "pandas"]},
                "price_basis": "provider Close; distribution reinvestment not established"}
    path.with_suffix(".json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def load_snapshot(path: Path) -> tuple[pd.DataFrame, dict]:
    """Load a saved snapshot, rejecting edits that invalidate its checksum."""
    metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
    if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["sha256"]:
        raise ValueError("Snapshot checksum mismatch; collect a fresh snapshot")
    frame = pd.read_csv(path, index_col="Date", parse_dates=["Date"])
    validate_prices(frame["Close"])
    return frame, metadata


def main() -> None:
    """Collect data only; analysis is a separate, offline command."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", default="069500")
    parser.add_argument("--start", default="2023-01-01")
    parser.add_argument("--end", default="2025-12-31")
    parser.add_argument("--provider", choices=["naver", "yahoo"], default="naver")
    args = parser.parse_args()
    frame = fetch_prices(args.symbol, args.start, args.end, args.provider)
    path = ROOT / "data/raw" / f"{args.symbol}_{args.provider}_{args.start}_{args.end}.csv"
    save_snapshot(frame, path, vars(args))
    print(f"Saved {len(frame)} rows: {path}")


if __name__ == "__main__":
    main()
