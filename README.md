# KOSPI200 ETF LAB

**[웹사이트 보기](https://wjyi0615.github.io/KOSPI200-ETF-LAB/)** · [데이터 갱신 기록](https://github.com/wjyi0615/KOSPI200-ETF-LAB/actions/workflows/update-etfs.yml)

같은 KOSPI200 지수를 추종하는 네 ETF의 가격 성과와 위험을 공통 거래기간으로 비교하는 Python 리서치 프로젝트입니다.
데이터 수집 → 검증 → 성과 계산 → 시각화 → 자동 게시 과정을 재현할 수 있도록 구성했습니다.

## 비교 대상

| ETF | 종목코드 | 운용사 |
|---|---|---|
| KODEX 200 | 069500 | 삼성자산운용 |
| TIGER 200 | 102110 | 미래에셋자산운용 |
| RISE 200 | 148020 | KB자산운용 |
| PLUS 200 | 152100 | 한화자산운용 |

대상은 `config/etfs.json`에서 관리합니다. 현재 레버리지·인버스·TR 상품은 제외합니다.

## 화면에서 확인할 수 있는 것

- 전체 기간 및 연도별 가격 수익률, CAGR, 연환산 변동성, Sharpe, 최대 낙폭
- 누적수익률·종가·낙폭 차트
- **차이 확대:** KODEX 200을 0% 기준으로 놓고 상대 성과를 표시하는 차트와 표
- 마지막 공통 거래일과 수집 시각

상대 성과는 `(1 + ETF 누적수익률) / (1 + KODEX 200 누적수익률) - 1`입니다.
단순 수익률 차이(%p)와 다릅니다. 차이 확대 차트는 세로축을 자동 조절하므로 전체 수익률 차트와 함께 해석합니다.

**CAGR이 —인 이유:** 화면에서는 경과일수 / 365.25가 1 미만이면 CAGR을 숨깁니다.
2026 YTD처럼 짧은 기간을 연환산해 오해하는 것을 줄이기 위한 표시 규칙입니다.
선택한 연도에 따라 연말 거래일 사이가 365.25일 미만이면 과거 연도에서도 —가 표시될 수 있습니다.
전체 기간을 선택하면 장기 CAGR을 확인할 수 있습니다.

## 실행하기

Python 3.11을 기준으로 구성했습니다.

```bash
git clone https://github.com/wjyi0615/KOSPI200-ETF-LAB.git
cd KOSPI200-ETF-LAB
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

네 ETF의 데이터를 수집하고 웹페이지 스냅샷을 갱신합니다. 인터넷 연결이 필요합니다.

```bash
python -m src.update_data
python -m http.server 8000 --directory docs
```

브라우저에서 [로컬 미리보기](http://localhost:8000)를 엽니다.
저장된 `docs/data.js`가 있으면 `docs/index.html`을 직접 열어 오프라인으로도 볼 수 있습니다.
로컬 파일은 공개 사이트의 갱신 결과를 자동으로 받지 않으므로, 최신 저장소를 받거나 수집 명령을 다시 실행해야 합니다.

단일 ETF 분석도 실행할 수 있습니다.

```bash
python -m src.data_loader --symbol 069500 --start 2023-01-01 --end 2025-12-31
python -m src.backtest --input data/raw/069500_naver_2023-01-01_2025-12-31.csv
```

분석 결과는 `data/processed/`와 `results/`에 저장됩니다.
단일 ETF 수집은 FinanceDataReader의 NAVER 소스를 사용하며, `--provider yahoo`로 Yahoo 어댑터를 선택할 수 있습니다.
자동 비교 수집은 NAVER 차트 endpoint를 직접 사용합니다. 공급자가 실패해도 다른 공급자의 데이터를 자동 혼합하지 않습니다.

## 계산과 검증

| 지표 | 정의 |
|---|---|
| 일별수익률 | P[t] / P[t-1] − 1 |
| 누적수익률 | P[t] / P[0] − 1 |
| CAGR | (P끝 / P시작)^(365.25 / 경과일수) − 1 |
| 연환산 변동성 | 일별수익률 표본 표준편차 × √252 |
| Sharpe | (일별수익률 평균 − 일별 무위험수익률) / 표본 표준편차 × √252 |
| 최대 낙폭 | min(P[t] / 해당 기간 누적 최고가격 − 1) |

웹사이트의 무위험수익률은 연 0%입니다. 변동성이 0이면 Sharpe는 정의하지 않습니다.
연도별 수익률은 전년도 마지막 공통 거래일 종가를 기준으로 첫 거래일 수익까지 포함합니다.

양수·유한 가격, 중복 날짜, 거래일 일치 여부와 최신 기준일을 검증합니다.
결측 가격을 임의로 채우지 않으며, 일부 ETF 수집 실패나 과거 데이터 범위 축소가 발생하면 새 데이터 게시를 중단합니다.
원본 스냅샷과 메타데이터의 SHA-256 체크섬으로 저장 데이터의 무결성을 확인합니다.

## 자동 갱신과 배포

- GitHub Actions가 한국시간 평일 **19:23**에 수집을 예약합니다. 실행 시각은 지연될 수 있습니다.
- 한국시간 18시 이전에는 당일 데이터를 제외하며, 휴장일에는 마지막 거래일 데이터를 사용합니다.
- 수동 갱신: **Actions → Update ETF data and deploy → Run workflow**.
- 검증을 통과한 결과만 `docs/data.js`에 저장하고, 원본 수집 산출물은 Actions에서 14일 보관합니다.
- 공개 사이트는 GitHub Pages의 **main /docs** 설정으로 배포합니다.

## 프로젝트 구조

```text
├── config/etfs.json        # 비교 대상 ETF
├── src/
│   ├── data_loader.py     # 단일 ETF 수집·저장·체크섬 검증
│   ├── update_data.py     # 네 ETF 수집·검증·스냅샷 게시
│   ├── comparison.py      # 공통 거래일·연도별 비교
│   ├── metrics.py         # 성과·위험 지표
│   └── backtest.py        # 단일 자산 보유 분석
├── docs/                  # GitHub Pages 화면·데이터 스냅샷
├── data/raw/              # 원본·메타데이터
├── data/processed/        # 가공 데이터
├── notebooks/             # 대화형 분석 예제
├── results/               # 분석 결과
├── tests/                 # 계산·수집·게시 검증
├── .github/workflows/     # 자동 갱신
└── requirements.txt       # 의존성 버전
```

## 해석의 한계와 다음 연구

현재 결과는 **공급자 종가 기반 가격 성과**입니다.
분배금 재투자와 공급자의 과거 가격 조정 정책을 독립적으로 검증하지 않았으므로 총수익률이나 운용 능력 순위로 해석하지 않습니다.
거래비용·세금은 제외하고, 보수는 가격에 반영된 범위 외에 별도 차감하지 않습니다.
공통 날짜 검증은 거래소 공식 캘린더와의 완전성 대조를 대신하지 않습니다.
KODEX 대비 상대 성과는 지수 대비 추적오차가 아닙니다.

후속 연구는 분배금 포함 총수익률, NAV·지수 기준 추적차이와 추적오차, 거래대금·호가 스프레드 비교입니다.
Momentum·Value·Quality 전략은 향후 확장 과제로, 현재 매매 신호·체결 엔진은 구현하지 않았습니다.

## 작업 방식

변경은 `codex/작업명` 브랜치에서 진행하고 PR 검토·병합 후 완료된 브랜치를 삭제합니다.
`main`은 공개 버전을 유지하며, 자동 수집 결과는 워크플로가 갱신합니다.
