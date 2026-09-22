"""Offline buy-and-hold baseline; no factor selection or rebalancing yet."""
import argparse
import json
import os
from pathlib import Path

from .data_loader import ROOT, load_snapshot
from .metrics import performance_series, summarize


def run_analysis(input_path: Path, risk_free_rate: float = 0.0) -> dict:
    """Analyze a verified snapshot, writing daily series, metrics and a figure."""
    frame, provenance = load_snapshot(input_path)
    series = performance_series(frame.Close)
    metrics = summarize(frame.Close, risk_free_rate)
    metrics.update({"symbol": provenance["symbol"], "provider": provenance["provider"],
                    "price_basis": provenance["price_basis"], "source_sha256": provenance["sha256"]})
    tag = input_path.stem
    processed, results = ROOT / "data/processed", ROOT / "results"
    processed.mkdir(parents=True, exist_ok=True)
    results.mkdir(parents=True, exist_ok=True)
    series.to_csv(processed / f"{tag}_daily.csv", index_label="Date")
    (results / f"{tag}_metrics.json").write_text(json.dumps(metrics, indent=2, allow_nan=False), encoding="utf-8")
    os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".mplconfig"))
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import PercentFormatter
    fig, axes = plt.subplots(3, 1, figsize=(11, 9), sharex=True, layout="constrained")
    axes[0].plot(series.index, series.price, color="#2455a4")
    axes[0].set_ylabel("Price (KRW)")
    axes[0].set_title(f"{provenance['symbol']} | {provenance['provider']} Close | Buy and hold")
    axes[1].plot(series.index, series.cumulative_return, color="#138773")
    axes[1].set_ylabel("Cumulative return")
    axes[2].fill_between(series.index, series.drawdown, 0, color="#be5366", alpha=.7)
    axes[2].set_ylabel("Drawdown")
    for ax in axes:
        ax.grid(alpha=.2)
    for ax in axes[1:]:
        ax.yaxis.set_major_formatter(PercentFormatter(1))
    fig.supxlabel("Price performance only; distribution reinvestment not established. No taxes or trading costs.")
    fig.savefig(results / f"{tag}_performance.png", dpi=160)
    plt.close(fig)
    return metrics


def main() -> None:
    """Run offline analysis on an explicitly chosen cached snapshot."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--risk-free-rate", type=float, default=0.0)
    args = parser.parse_args()
    print(json.dumps(run_analysis(args.input, args.risk_free_rate), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
