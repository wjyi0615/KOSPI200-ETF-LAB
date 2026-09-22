"""Price-series performance measures, independent of any data provider."""
import numpy as np
import pandas as pd


def validate_prices(prices: pd.Series) -> pd.Series:
    """Require ordered, unique dates and at least three positive finite prices."""
    if not isinstance(prices.index, pd.DatetimeIndex):
        raise ValueError("Prices require a DatetimeIndex")
    if len(prices) < 3 or prices.index.hasnans or not prices.index.is_unique or not prices.index.is_monotonic_increasing:
        raise ValueError("Need >=3 observations with unique, increasing dates")
    prices = prices.astype(float)
    if not np.isfinite(prices).all() or (prices <= 0).any():
        raise ValueError("Prices must be positive and finite; missing values are not filled")
    return prices


def performance_series(prices: pd.Series) -> pd.DataFrame:
    """Return daily returns, growth of one unit and peak-to-trough drawdowns."""
    prices = validate_prices(prices)
    wealth = prices / prices.iloc[0]
    return pd.DataFrame({"price": prices, "daily_return": prices.pct_change(fill_method=None),
                         "wealth": wealth, "cumulative_return": wealth - 1,
                         "drawdown": wealth / wealth.cummax() - 1})


def summarize(prices: pd.Series, risk_free_rate: float = 0.0,
              periods_per_year: int = 252) -> dict:
    """Compute calendar-day CAGR and sample volatility/Sharpe on daily returns.

    risk_free_rate is an annual effective rate, converted to a daily rate.
    The first observation is a capital baseline, not a zero-return sample.
    Undefined Sharpe (zero volatility) is represented as None.
    """
    if not np.isfinite(risk_free_rate) or risk_free_rate <= -1 or periods_per_year <= 0:
        raise ValueError("Invalid risk-free rate or annualization factor")
    series = performance_series(prices)
    returns = series.daily_return.dropna()
    years = (prices.index[-1] - prices.index[0]).total_seconds() / (86400 * 365.25)
    std = float(returns.std(ddof=1))
    daily_rf = (1 + risk_free_rate) ** (1 / periods_per_year) - 1
    return {"start": str(prices.index[0].date()), "end": str(prices.index[-1].date()),
            "observations": len(prices), "return_observations": len(returns),
            "cumulative_return": float(series.wealth.iloc[-1] - 1),
            "cagr": float(series.wealth.iloc[-1] ** (1 / years) - 1),
            "annualized_volatility": std * np.sqrt(periods_per_year),
            "sharpe_ratio": float((returns.mean() - daily_rf) / std * np.sqrt(periods_per_year)) if std > 1e-15 else None,
            "maximum_drawdown": float(series.drawdown.min()),
            "risk_free_rate": risk_free_rate, "periods_per_year": periods_per_year}
