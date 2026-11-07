"""Common-calendar ETF comparisons with prior-year-close annual baselines."""
from datetime import datetime, timezone
import pandas as pd
from .metrics import summarize, validate_prices


def align_prices(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Align inception dates, rejecting missing interior dates or stale members.

    Do not forward-fill missing prices or conceal gaps by dropping dates.
    An identical vendor calendar does not establish exchange-calendar completeness.
    """
    if not frames:
        raise ValueError("No ETF data")
    series = {symbol: validate_prices(frame.Close) for symbol, frame in frames.items()}
    if len({s.index[-1] for s in series.values()}) != 1:
        raise ValueError("ETF end dates differ; preserve previous release")
    start = max(s.index[0] for s in series.values())
    trimmed = {symbol: s.loc[start:] for symbol, s in series.items()}
    calendar = next(iter(trimmed.values())).index
    if any(not s.index.equals(calendar) for s in trimmed.values()):
        raise ValueError("Missing or mismatched trading dates; no forward filling")
    return pd.DataFrame(trimmed)


def period_rows(panel: pd.DataFrame, year: int) -> pd.DataFrame | None:
    """Include the last common close before January 1 as annual return baseline."""
    boundary = pd.Timestamp(year=year, month=1, day=1)
    previous = panel.loc[panel.index < boundary]
    current = panel.loc[(panel.index >= boundary) & (panel.index.year == year)]
    if previous.empty or len(current) < 2:
        return None
    # Without a recent prior-year close, an honest YTD cannot be constructed.
    if (boundary - previous.index[-1]).days > 10:
        return None
    return pd.concat([previous.iloc[[-1]], current])


def build_dataset(frames: dict, universe: list, generated_at: str | None = None) -> dict:
    """Generate chart data and Python-calculated metrics for the public website."""
    panel = align_prices(frames)
    first_year = 2023
    ranges = {"all": panel.loc[panel.index >= pd.Timestamp("2023-01-01")]}
    prior = panel.loc[panel.index < pd.Timestamp("2023-01-01")]
    if not prior.empty:
        ranges["all"] = pd.concat([prior.iloc[[-1]], ranges["all"]])
    last_year = panel.index[-1].year
    for year in range(first_year, last_year + 1):
        selected = period_rows(panel, year)
        if selected is not None:
            ranges[str(year)] = selected
    periods = {}
    for key, selected in ranges.items():
        if len(selected) < 3:
            continue
        periods[key] = {"start": str(selected.index[0].date()),
                        "end": str(selected.index[-1].date()), "observations": len(selected),
                        "metrics": {symbol: summarize(selected[symbol]) for symbol in selected}}
    if not periods:
        raise ValueError("No usable comparison periods")
    first_date = min(p["start"] for p in periods.values())
    panel = panel.loc[first_date:]
    return {"schema_version": 1, "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
            "as_of": str(panel.index[-1].date()), "provider": "NAVER",
            "price_basis": "Vendor Close; distribution reinvestment and adjustment policy not independently verified",
            "universe": universe, "dates": panel.index.strftime("%Y-%m-%d").tolist(),
            "prices": {symbol: panel[symbol].tolist() for symbol in panel},
            "volumes": {symbol: frames[symbol].loc[panel.index, "Volume"].tolist()
                        for symbol in panel if "Volume" in frames[symbol]}, "periods": periods,
            "calendar_policy": "Same dates across all ETFs; no fill; exchange calendar not independently verified"}
