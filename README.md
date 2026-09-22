# KOSPI200-ETF-LAB

여러 운용사의 KOSPI200 ETF를 비교하기 위한 Python 리서치 프로젝트입니다.
현재 구현은 **KODEX 200 단일 ETF 기준선 MVP**이며, 다중 ETF 비교와 팩터 전략은 확장 예정입니다.

KODEX 200(069500)의 일별 종가를 수집하고 매수 후 보유 성과를 분석하는 Python MVP.
현재 단계는 팩터 전략을 비교하기 위한 기준선이다. Python 3.11에서 검증한다.

## 실행

프로젝트 폴더에서 실행한다.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m src.data_loader --symbol 069500 --start 2023-01-01 --end 2025-12-31
python -m src.backtest --input data/raw/069500_naver_2023-01-01_2025-12-31.csv
python -m unittest discover -s tests -v
```

첫 수집에는 인터넷이 필요하다. 이후 분석은 저장한 CSV와 같은 이름의 JSON만으로 오프라인 실행된다.
조회 시작·종료일은 모두 포함하며 휴장일은 생성하지 않는다. 기간과 종목은 인자로 변경할 수 있다.
무위험수익률은 기본 0%, 예를 들어 연 3%를 가정하려면 분석 명령에 `--risk-free-rate 0.03`을 붙인다.
가상환경과 대용량 원본·결과는 Git에서 제외한다. CSV와 JSON을 함께 보관해야 체크섬 검증이 가능하다.

## 구조

```text
kospi-factor-investing/
├── data/raw/           # 공급자 가격 CSV + 출처/체크섬 JSON
├── data/processed/     # 일별수익률, 누적수익률, 자산곡선, 낙폭
├── src/data_loader.py  # 수집 어댑터, 저장, 검증
├── src/metrics.py      # 데이터 소스와 독립적인 순수 분석 함수
├── src/backtest.py     # 보유 기준선 분석 및 그림 저장
├── notebooks/         # 대화형 분석 예제
├── tests/             # 지표 정의와 데이터 검증 테스트
├── results/           # 지표 JSON, 성과 PNG
├── requirements.txt   # 실행 환경 버전 고정
└── .gitignore
```

## 데이터 소스 선택

기본값은 FinanceDataReader의 명시적 `NAVER:069500` 소스다. 자동 공급자 선택을 피하고,
반환된 OHLCV를 그대로 저장한다. 실패 시 조용히 다른 소스로 바꾸지 않는다.

| 방식 | MVP에서의 판단 |
|---|---|
| FinanceDataReader / NAVER | 계정 없이 명시적 종목 조회 가능. 기본 후보이며 실제 조회 검증 결과는 아래 기록 |
| yfinance / Yahoo | `069500.KS`, `auto_adjust=False` 명시. 대체 어댑터 제공. Yahoo의 가격 수정 및 접근 제한 가능 |
| pykrx / KRX | 공식 거래소 기반 확장에 유용하지만 2026년 릴리스에 로그인/세션 관리가 추가되어 인증 의존성이 있음. 이번 MVP에서 실조회 비교하지 않음 |

Yahoo 대체 수집·분석:

```sh
python -m src.data_loader --provider yahoo --start 2023-01-01 --end 2025-12-31
python -m src.backtest --input data/raw/069500_yahoo_2023-01-01_2025-12-31.csv
```

Yahoo의 `Adj Close`가 반환되면 원본에 보존하지만 MVP 계산은 항상 `Close`를 사용한다.
네이버 종가의 과거 수정 정책 및 분배금 재투자 처리는 독립적으로 검증하지 않았다.
따라서 이 결과는 **공급자 종가 기반 가격 성과**이며 투자자의 분배금 포함 총수익률이라고 해석하면 안 된다.
거래비용·세금도 포함하지 않는다. ETF 보수 등을 별도 차감하지 않으며 실제 NAV 추적오차 분석도 아니다.

재현성은 버전 고정 + 원본 스냅샷 + SHA-256으로 확보한다. 나중에 재수집하면 공급자의 과거 가격 수정으로
결과가 달라질 수 있다. 네이버 조회는 라이브러리 구현상 최근 약 6,000개 관측치로 제한될 수 있다.
요청 기간과 실제 반환 기간을 원본 JSON에서 비교해야 하며, 내부 거래일 누락 여부는 거래소 캘린더와 대조하지 않는다.
0·음수·결측·무한대 종가 및 중복 날짜는 거부한다. 휴장일이나 결측 가격을 임의로 채우지 않는다.

참고한 1차 자료:
- [FinanceDataReader](https://github.com/FinanceData/FinanceDataReader)
- [네이버 조회 구현](https://github.com/FinanceData/FinanceDataReader/blob/master/src/FinanceDataReader/naver/data.py)
- [yfinance download API](https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html)
- [pykrx 로그인 대응 릴리스](https://github.com/sharebook-kr/pykrx/releases)

## 계산 정의

- 일별수익률: `P[t] / P[t-1] - 1`; 첫 행은 비교 대상이 없어 결측으로 유지.
- 누적수익률: `P[t] / P[0] - 1`.
- CAGR: `(P[-1] / P[0]) ** (365.25 / 실제 경과일수) - 1`.
- 연환산 변동성: 일별수익률 표본 표준편차(`ddof=1`) × `sqrt(252)`.
- Sharpe: `(일별수익률 평균 - 일별 무위험수익률) / 표본 표준편차 × sqrt(252)`.
  일별 무위험수익률은 `(1 + 연 무위험수익률) ** (1/252) - 1`. 변동성 0이면 JSON `null`.
- Maximum Drawdown: `min(P[t] / 과거 최고가격 - 1)`, 음수로 표시.

관측치가 3개 미만이면 분석을 거부한다. 짧은 기간의 연환산 지표는 해석에 유의한다.

## 확장 방향

1. KOSPI200 종목별 가격을 같은 어댑터로 수집하고 날짜 × 종목 종가 패널 구성.
2. 당시 구성종목 이력을 확보하여 생존편향 통제.
3. Momentum 점수 산출과 월별 목표 비중 산출 모듈 분리.
4. 신호 생성 다음 거래일 체결, 거래비용·회전율을 반영하는 포트폴리오 엔진 추가.
5. Value/Quality는 DART 공시 시점 이후에만 이용 가능한 재무 데이터로 확장.
6. 분배금·기업행동 처리 기준을 맞춘 전략/벤치마크 총수익률 비교.

현재 `backtest.py`는 단일 자산 보유 기준선만 구현하며 신호·체결 엔진은 포함하지 않는다.

## 실제 검증 기록 (2026-09-22)

동일한 요청 기간 `2023-01-01` ~ `2025-12-31`로 실조회했다.

| 소스 | 행 수 | 최초 거래일 | 최종 거래일 |
|---|---:|---|---|
| NAVER | 731 | 2023-01-02 | 2025-12-30 |
| Yahoo | 712 | 2023-01-02 | 2025-12-30 |

이번 환경에서 더 많은 관측치를 반환한 NAVER를 기본 소스로 선정했다.
거래소 거래일 목록과 대조한 완전성 보증은 아니며, 공급자 간 가격 조정 차이도 있으므로 데이터를 혼합하지 않는다.
`requirements.txt`에는 검증에 사용한 전체 의존성 버전을 고정했다.
지표 공식, 상수가격, 비정상 입력, 체크섬 변조, Yahoo 날짜 경계, 빈 응답을 다루는 6개 테스트를 통과했다.

## 포트폴리오 웹페이지

`docs/index.html`을 브라우저로 열면 인터넷 연결 없이 연도별 성과와 차트를 볼 수 있습니다.
이 페이지는 저장된 데이터 스냅샷을 사용하며 실시간 시세가 아닙니다.
GitHub Pages를 사용할 경우 저장소 Settings → Pages에서 배포 브랜치의 `/docs` 폴더를 선택합니다.
실제 공개 주소가 생성되기 전까지는 외부에 공유할 수 있는 웹사이트가 아닙니다.

## 웹페이지 공개 설정

GitHub 저장소 **Settings → Pages → Deploy from a branch → main /docs → Save**를 선택합니다.
배포 완료 후 GitHub가 표시하는 주소를 사용하세요.

## 다음 단계: 운용사별 ETF 비교

동일한 KOSPI200 지수를 추종하는 일반 ETF를 대상으로 공통 거래기간과 가격 조정 기준을 맞춥니다.
레버리지·인버스·환헤지 등 구조가 다른 상품은 비교 대상에서 구분합니다.
각 ETF의 수익률·변동성·낙폭을 비교하고, 총수익률과 NAV 데이터를 확보한 뒤 추적차이·추적오차 분석으로 확장합니다.
