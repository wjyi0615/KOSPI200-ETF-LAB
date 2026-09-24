# ETF Starter: 분석과 단계별 구현 기록

## Phase 1 — 현재 구조 분석 및 설계

기존 기능을 먼저 읽고 2026-09-23에 설계했다. 작업 브랜치: `codex/etf-starter`.

| 항목 | 분석 결과 및 유지 결정 |
|---|---|
| Frontend | 순수 HTML/CSS/JavaScript. SPA 프레임워크·빌드 단계 없음 |
| Backend | 상시 서버 없음. Python 배치 수집과 분석만 존재 |
| 저장 | CSV 원본 + JSON 메타데이터/체크섬. 공개용 `window.ETF_DATA` JS 스냅샷 |
| 수집 | 자동: NAVER chart XML, 단일 ETF: FinanceDataReader NAVER 또는 명시적 yfinance |
| API | 자체 REST API 없음. 브라우저는 외부 API를 부르지 않음 |
| 차트 | 사이트는 SVG 직접 렌더링. 오프라인 보고서는 matplotlib |
| Lab | 공통 거래일 비교, 전년도 마지막 종가 연초 기준, CAGR·변동성·Sharpe·MDD, 상대 성과 |
| 자동화 | GitHub Actions 검증 후 단일 스냅샷 교체, main/docs Pages |
| 유지 | 기존 `app.js`, `style.css`, 가격 스냅샷, Python 지표·수집·검증. 기존 HTML을 `kospi200.html`로 보존 |
| 개선 대상 | 기존 app.js 한 파일에 화면과 차트 계산 혼재. 새 기능의 계산은 `starter-core.js`로 분리 |
| 확장 한계 | 4개 국내 ETF, 공통 날짜 배열, 종가만 저장. 다른 시장 캘린더·통화는 현재 비교에 바로 넣을 수 없음 |
| 중복 판단 | 기존 Lab의 안정성을 위해 기존 SVG 렌더러를 유지. 새 상세/비교/시뮬레이션은 `lineChart` 하나를 공유 |

### 추천 아키텍처와 페이지

Python → 검증된 `data.js` → 공통 ETF adapter → 화면. 신규 프레임워크·API 서버·DB·dependency 없음.
GitHub Pages의 저장소 하위 경로와 file 열기를 위해 hash routing을 사용한다.
`#/`, `#/explore/:category`, `#/compare`, `#/etf/:ticker`, `#/simulator/:ticker`, `#/learn/:term`, `#/kospi200`.
마지막 경로는 독립된 기존 Lab으로 이동한다. 기존 Lab의 연도별 비교를 새 최대 3개 비교로 대체하지 않는다.

### 필요한 데이터와 확보 상태

| 데이터 | 상태 | 다음 수집 조건 |
|---|---|---|
| 날짜·종가·기본 명칭 | 기존 NAVER 스냅샷 사용 | 가격 조정 정책 검증 필요 |
| 거래량 | 기존 XML에는 있음, 공개 snapshot에 선택 필드 추가 | 다음 성공 수집부터 노출 |
| 순자산·총보수·상장일 | 미확보 | 운용사/거래소 기준일·단위·출처와 함께 수집 |
| NAV·KOSPI200 지수 | 미확보 | 같은 날짜, 가격/총수익 지수 기준 명시 |
| 분배금 | 미확보 | 분배락일·권리기준일·지급일·좌당금액·수정이력 |
| 구성종목 | 미확보 | 기준일과 종목코드·비중. 잔여 비중과 현금도 필요 |
| 기여도 | 계산 함수 및 빈 UI만 제공 | 전일 비중 + 동일 기간 종목 수익률, 기업행동 |

변경 파일: `DESIGN.md`. 실행: 이 문서. 미구현: 별도 서버/다른 시장 데이터. 다음: 공통 모델.

## Phase 2 — 공통 모델

- 파일: `docs/starter-core.js`, `src/comparison.py`, `tests/test_starter.cjs`, `tests/test_comparison.py`.
- `symbol/manager`를 `ticker/issuer`로 변환하는 단일 adapter. 기존 snapshot 계약을 깨지 않음.
- `ticker, name, issuer, category, benchmark, price, aum, expenseRatio, volume, trackingError, premiumDiscount, dividendYield, inceptionDate, returns, holdings` 제공.
- 추가: 가격/날짜 시계열, 출처, 기준일, 분배금·NAV·지수 빈 배열. 없는 숫자는 null, 화면은 ‘미확보’.
- 날짜 중복/역순/잘못된 날짜, 잘못된 가격/종목코드를 검증. 범위를 못 채우는 기간 수익률은 null.
- 실행: `node tests/test_starter.cjs`.
- 미구현: 실제 보수·NAV·분배금 metadata 수집. 현재 metadataStatus는 unavailable.
- 다음: 검증된 metadata adapter와 시장별 캘린더·통화 확장. 다른 시장을 KOSPI200으로 묵시 분류하지 않도록 category/benchmark 설정을 필수로 늘릴 것.

## Phase 3 — 홈·탐색

- 파일: `docs/index.html`, `docs/starter.js`, `docs/starter.css`.
- 7개 투자 카테고리, 한국 4개 ETF 카드, 이름/코드/운용사 검색, 비교 담기, 용어 설명 링크.
- 다른 카테고리는 명확한 준비 중 화면. 없는 숫자를 mock이나 0으로 채우지 않음.
- 실행: `python -m http.server 8000 --directory docs` → `http://localhost:8000/#/explore`.
- 미구현: 타 시장 상품. 다음: 비교.

## Phase 4 — 비교

- 파일: `docs/starter.js`, `docs/starter-core.js`.
- 최대 3개 선택, 테이블, 같은 기간 정규화 차트, 1·3·6·12·36개월 및 전체.
- 기간 기준은 마지막 거래일에서 달력 월을 뺀 날 이전의 가까운 관측 종가. 세 ETF는 같은 공개 캘린더 사용.
- 가격 성과가 추적오차/운용 순위가 아님을 설명. metadata는 미확보 표시.
- 실행: 탐색에서 2–3개 선택 후 `#/compare`.
- 미구현: NAV 대비 추적오차·괴리율. 다음: 상세.

## Phase 5 — 상세·기존 Lab 보존

- 파일: `docs/starter.js`, `docs/kospi200.html`.
- 기본 정보, 상품 출처, 기간별 가격 차트, 시뮬레이터 연결.
- 구성종목 바 차트 renderer는 있으나 실데이터가 없어 빈 상태. 상세의 ‘왜 올랐을까’ 역시 준비 중.
- 분배금 재투자는 미검증 데이터로 계산하지 않도록 비활성 표시.
- 실행: `#/etf/069500`, `#/kospi200`.
- 미구현: 실제 holdings/NAV/지수·분배금 비교. 다음: 시뮬레이터.

## Phase 6 — 적립식 시뮬레이터

- 파일: `docs/starter-core.js`, `docs/starter.js`, `tests/test_starter.cjs`.
- ETF, 시작일·종료일·매월 금액 입력. 매월 첫 관측일 정수 매수, 잔여 현금 이월.
- 총 납입금·평가금액·수익금·납입금 대비 수익률·입금 보정 MDD, 투자금/평가금액 SVG, 월별 납입 내역.
- 동일 총액 일시 투자 비교. 적립식에는 시작일부터 전액 투자할 수 있다는 가정을 강제하지 않음.
- 입금 당일 가격 변화를 먼저 반영하고 입금하므로 납입금으로 drawdown이 가려지지 않음.
- 실행: `#/simulator`에서 계산. 독립 검증: `node tests/test_starter.cjs`.
- 미구현: 실제 분배금·세금·수수료·IRR. 보수는 공급자 가격에 반영된 범위 외에 별도 차감하지 않음.
- 과거 공급자 수정가격은 실제 매수가/좌수를 보장하지 않으므로 ‘학습용 가격 시나리오’로 명시.
- 다음: 조정 전 가격·기업행동 검증 후 분배금 현금/재투자 모드. 분배락일 보유좌수로 지급 권리를 정하고 지급일 이후 거래일에 재투자할 것. 수정주가에 분배금을 중복 가산하지 않을 것.

## Phase 7 — 학습

- 파일: `docs/starter.js`.
- 요구한 13개 용어 + MDD·재투자 설명, 가상 숫자 예시, 비교/상세에서 설명 링크.
- SEC 투자자 교육의 ETF/NAV·비용·일일 레버리지 자료를 확인하고 페이지에 출처 연결.
- 실행: `#/learn`, `#/learn/nav`.
- 미구현: 개인별 투자 추천·추천 종목은 제공하지 않음. 다음: 기여도 인터페이스.

## Phase 8 — 기여도 인터페이스 (데이터 대기)

- 파일: `docs/starter-core.js`, `docs/starter.js`, `tests/test_starter.cjs`.
- `contributions([{name, previousWeight, priceReturn}])` → `contribution` 내림차순. 입력 검증 포함.
- 실제 상세 화면에는 준비 중 표시. 현재 구성비를 과거 수익률에 곱하는 계산은 하지 않음.
- 실행: `node tests/test_starter.cjs`의 합성 테스트. 실제 서비스 기여도는 아직 없음.
- TODO: 전일 공식 비중·종목 수익률·가격 기준일·기업행동 자료 확보. 남은 비중·현금·비용·잔차를 별도 표시. 분배금 포함 기여도와 종가 기여도를 구분.

## 검증 및 공개 범위

Python 기존 15개 회귀 테스트 통과. 거래량 직렬화 테스트 추가.
Node 합성 현금흐름(정수좌수·잔여현금·입금 보정 MDD), 평탄 가격, 일시투자 총액, 잘못된 날짜·금액, 월말, 부족한 이력, null 표시, 기여도 입력, 실제 네 ETF snapshot 계산 통과.
JS 문법 검사 및 파일 경로 확인 완료.
브라우저 시각 검증은 미완료: 로컬 서버 연결 거부, file URL은 브라우저 보안 정책으로 차단됨. 이를 우회하지 않음.
모바일·키보드 동작은 코드에 반영했지만 실제 브라우저에서 별도 확인 필요. 이 변경은 새 브랜치/PR에서 검토하고 공개 main에 자동 병합하지 않는다.

## 후속: 기본 정보 연결 (codex/etf-fundamentals)

Phase 2의 null 고정 필드를 공식 자료 snapshot adapter로 확장했습니다.
변경: config/fundamentals.json, src/fundamentals.py, docs/fundamentals.js, starter-core.js, starter.js, index.html 및 테스트.
총보수·상장일·순자산은 출처 및 항목별 날짜와 함께 표시하며 오래된 AUM을 현재 규모로 해석하지 않도록 경고합니다.
NAVER 가격·거래량은 네 ETF 모두 2026-09-23까지 실제 수집 검증했습니다. 메타데이터는 가격 자동 갱신과 분리된 수동 검증 절차입니다.
미완료: 동시 기준일 AUM 자동 수집, 분배금 총수익률, holdings/기여도. 기존 Phase 기록의 ‘미확보’는 당시 상태이며 최신 기본 정보 상태는 README 후속 절을 따릅니다.
