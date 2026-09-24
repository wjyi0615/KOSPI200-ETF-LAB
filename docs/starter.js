/* Page views use ETFCore; data is loaded once from the existing public snapshot. */
'use strict';
const C=window.ETFCore, F=C.fmt;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>/^https:\/\//.test(value||'') ? esc(value) : '#';
const categories=[['equity','📈','주식'],['bonds','🏦','채권'],['commodity','🥇','금·원자재'],['theme','🔬','테마·산업']];
let activeCategory='all';
const filters={region:'all',strategy:'all',query:''};
const terms=[
 ['etf','ETF','여러 자산을 한 바구니에 담고, 그 바구니를 주식처럼 사고파는 펀드예요.','예: 주식형 ETF 한 종목으로 여러 기업에 나누어 투자할 수 있어요. 분산해도 손실 위험은 남아요.'],
 ['index','기초지수','ETF가 따라가려는 시장의 성적표예요. 무엇을 담고 비중을 어떻게 정하는지 규칙이 있어요.','예: 같은 국내 주식형이어도 KOSPI200과 다른 지수는 담는 종목·비중이 달라요.'],
 ['nav','NAV','ETF가 보유한 자산에서 부채를 뺀 가치를 1좌 기준으로 나눈 값이에요. 시장에서 거래되는 가격과 다를 수 있어요.','가상 예: 1좌의 NAV가 10,000원이어도 거래가격은 10,050원일 수 있어요.'],
 ['premium','괴리율','거래가격이 NAV보다 얼마나 높거나 낮은지 보여줘요. 양수는 더 비싸게, 음수는 더 싸게 거래된다는 뜻이에요.','가상 예: NAV 10,000원, 가격 10,050원이면 괴리율은 +0.5%예요. 싸 보인다고 반드시 좋은 투자는 아니에요.'],
 ['tracking','추적오차','ETF와 목표 지수의 일별 수익률 차이가 얼마나 들쭉날쭉한지 나타내요. 계산 기간·가격 또는 NAV·배당 기준을 같게 맞춰야 해요.','가상 예: 매일 비슷한 폭으로 뒤처지는 ETF는 추적오차가 작아도 누적 성과 차이는 생길 수 있어요.'],
 ['fee','총보수','운용·관리 등에 지급되는 정기적인 보수예요. 다른 거래비용까지 모두 포함하는 숫자는 아니에요.','가상 예: 연 0.1%를 100만원에 단순 적용하면 연 1,000원 수준이지만 실제 비용은 자산가치 등에 따라 달라요.'],
 ['aum','AUM / 순자산','ETF 전체의 자산에서 부채를 뺀 규모예요. 1좌 가격과는 다른 개념이에요.','예: 1좌 가격이 낮다고 펀드 전체 규모도 작은 것은 아니에요. 규모만으로 수익률을 판단하지 않아요.'],
 ['volume','거래량','하루 동안 거래된 ETF 수량이에요. 내가 원하는 가격으로 거래하기 쉬운지는 호가와 매수·매도 가격 차이도 살펴야 해요.','가상 예: 10만 좌 거래와 1만 좌 거래를 비교할 수 있지만, 이것만으로 체결 품질을 알 수는 없어요.'],
 ['distribution','분배금','ETF가 정한 기준에 따라 투자자에게 지급하는 돈이에요. 지급 내역·권리 기준일·지급일을 구분해야 해요.','가상 예: 가격 10,000원인 ETF에서 100원이 지급되어도 공짜 수익 1%가 생기는 것은 아니에요. 분배락과 가격 변화도 함께 봐요.'],
 ['active','액티브 ETF','지수를 그대로 따라가기보다 운용사의 판단을 반영해 목표 달성을 추구하는 ETF예요.','예: 운용사가 종목 비중을 조정해요. 적극적인 운용이 높은 수익을 보장하지는 않아요.'],
 ['passive','패시브 ETF','정해진 지수의 성과를 따라가는 것을 목표로 하는 ETF예요.','예: KOSPI200 추종 ETF도 비용·운용 방식·시장가격 때문에 지수와 성과가 조금 달라질 수 있어요.'],
 ['leverage','레버리지 ETF','보통 지수의 하루 수익률을 일정 배수로 추종하려고 해요. 여러 날의 누적수익률 배수를 보장하지 않아요.','가상 예: 지수가 하루 +10%, 다음 날 −9.09%면 거의 원점이에요. 일일 2배 상품은 +20%, −18.18%로 약 −1.82%가 돼요.'],
 ['inverse','인버스 ETF','보통 지수의 하루 수익률과 반대 방향의 수익률을 목표로 해요. 장기 누적수익률은 단순한 반대가 아니에요.','예: 지수가 오르내리는 동안 일별 복리가 쌓이므로 오래 보유한 결과가 예상과 달라질 수 있어요.'],
 ['mdd','최대 낙폭 (MDD)','선택한 기간의 고점에서 저점까지 가장 크게 하락한 비율이에요.','가상 예: 100 → 120 → 90이면 고점 120에서 90까지 내려간 최대 낙폭은 −25%예요.'],
 ['reinvest','분배금 재투자','받은 분배금으로 같은 ETF를 추가 매수하는 방식이에요. 미래 수익을 보장하지 않아요.','가상 예: 1만원을 받고 가격이 5천원이면 비용 제외 2좌를 더 살 수 있어요. 실제 계산에는 지급일·세금·가격 조정 여부가 필요해요.']
];
let etfs=[],loadError='';
try { etfs=C.catalog(window.ETF_DATA); } catch(e) { loadError=e.message; }
const selected=new Set();
const root=document.getElementById('content');
let chartMonths=12;
const help=(key,label)=>`<a class="term-link" href="#/learn/${key}" aria-label="${esc(label)} 설명">ⓘ</a>`;
/** Render each fundamental with its own date; never imply price-date freshness. */
function fundamental(e,key){
 const r=e.metadata[key]; if(!r)return '미확보';
 const value=key==='aum'?F.number(Math.round(r.value/1e8))+'억원':key==='expenseRatio'?'연 '+(r.value*100).toFixed(3)+'%':esc(r.value);
 const date=r.asOf?`${r.asOf} 자료`:`자료 기준일 미표기`;
 const old=r.asOf && Date.now()-Date.parse(r.asOf)>31*864e5;
 return `${value}<small style="display:block">${date}${old?' · 과거 자료':''}</small><small style="display:block"><a href="${safeUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceName)} ↗</a> · 확인 ${r.checkedAt}</small>`;
}
const metric=(name,value,key)=>`<div><dt>${name}${key?help(key,name):''}</dt><dd>${value}</dd></div>`;
const heading=(label,title,body='')=>`<p class="eyebrow">${label}</p><h1>${title}</h1><p class="muted">${body}</p>`;
function dataNotice(){
 const asOf=etfs[0]?.asOf;
 return loadError ? `<p role="alert" class="notice warning">${esc(loadError)} 학습 페이지는 계속 이용할 수 있습니다. <a href="https://github.com/wjyi0615/KOSPI200-ETF-LAB/actions">갱신 기록 확인</a></p>` : `<p class="notice">${asOf} 종가 기준 · 실시간 시세가 아닙니다.${Date.now()-Date.parse(asOf)>7*864e5?' 최근 7일 이상 갱신되지 않았습니다.':''} 분배금 재투자와 과거 가격 조정은 미검증입니다.</p>`;
}
function card(e){return `<article class="card"><span class="badge">${esc(e.benchmark)}</span><h3><a href="#/etf/${e.ticker}">${esc(e.name)}</a></h3><small>${e.ticker} · ${esc(e.issuer)}</small><p class="price">${F.money(e.price)}</p><small>${e.asOf} 종가</small><dl>${metric('최근 1개월',F.percent(e.returns.month))}${metric('거래량',F.number(e.volume)+(e.volume!==null?'좌 · '+e.asOf:''),'volume')}</dl><details><summary>보수·규모·분배금 확인</summary><dl>${metric('순자산',fundamental(e,'aum'),'aum')}${metric('총보수',fundamental(e,'expenseRatio'),'fee')}${metric('분배금','미확보','distribution')}</dl><p class="subtle">총보수는 기타비용·매매비용을 모두 포함하는 실부담비용과 다릅니다. 기본 정보는 수동 확인 자료이며 항목별 기준일이 다릅니다.</p></details><div class="actions"><button data-select="${e.ticker}" aria-pressed="${selected.has(e.ticker)}">${selected.has(e.ticker)?'비교에서 제외':'비교에 담기'}</button><a href="#/etf/${e.ticker}">자세히 →</a></div></article>`}
function home(){return `<section class="hero"><div>${heading('YOUR FIRST ETF','투자의 첫걸음,<br>이해하는 것부터.','ETF가 처음이어도 괜찮아요. 무엇에 투자하는지 살펴보고, 비슷한 상품의 차이를 하나씩 알아보세요.')}<div class="actions"><a class="button primary" href="#/explore">ETF 찾아보기 →</a><a class="button" href="#/learn">ETF가 뭔가요?</a></div></div><div class="hero-art" aria-label="학습 순서"><div><small>01 · 무엇을 담고 있나요?</small><strong>투자대상 알아보기</strong></div><div><small>02 · 같은 지수, 다른 ETF</small><strong>차이를 비교하기</strong></div><div><small>03 · 매달 조금씩 투자했다면</small><strong>내 금액으로 계산하기</strong></div></div></section><section><h2>어떤 투자를 하고 싶나요?</h2><p class="muted">국내 상장 ETF를 네 종류로 나눠 살펴보세요. 지역과 배당 전략은 탐색 화면에서 고를 수 있습니다. 전체 시장을 망라한 목록은 아닙니다.</p><div class="grid categories">${categories.map(([id,emoji,label])=>`<a class="card category" href="#/explore/${id}"><span aria-hidden="true">${emoji}</span><h3>${label}</h3><small>${etfs.filter(e=>e.category===id).length}개 ETF 둘러보기</small></a>`).join('')}</div></section><section class="section two-col"><article class="panel"><span class="badge">첫 번째 연구실</span><h2>같은 KOSPI200,<br>무엇이 다를까요?</h2><p>가격 흐름과 위험을 같은 기간으로 맞춰 살펴보세요.</p><a href="#/kospi200">기존 ETF Lab 열기 →</a></article><article class="panel"><span class="badge">직접 해보기</span><h2>매달 30만원씩<br>투자했다면?</h2><p>누적 납입금과 평가금액을 함께 보며 과거 투자 경로를 이해해요.</p><a href="#/simulator">시뮬레이터 시작 →</a></article></section>`}
function explore(category='all'){
 const aliases={korea:'equity',us:'equity',dividend:'equity',tech:'theme',world:'equity'};
 const legacy=category;category=aliases[category]||category;
 if(category!==activeCategory){filters.region='all';filters.strategy='all';filters.query='';}
 if(legacy==='korea'||legacy==='us')filters.region=legacy;
 if(legacy==='dividend')filters.strategy='dividend';
 activeCategory=category;
 const cat=categories.find(c=>c[0]===category);
 if(category!=='all'&&!cat)return empty('등록되지 않은 ETF 종류입니다.');
 const list=C.filterEtfs(etfs,{category,...filters});
 const descriptions={all:'종류를 고른 뒤 투자 지역과 전략을 좁혀 보세요.',equity:'대표지수와 배당 중심 ETF를 지역별로 탐색해요.',bonds:'채권 ETF도 금리 변화에 따라 가격이 움직이며 원금이 보장되지 않아요.',commodity:'현물과 선물은 다릅니다. 현재 금 선물 ETF를 제공하며 원유·은 상품은 아직 포함하지 않습니다.',theme:'특정 산업에 집중하는 ETF예요. 현재 반도체 상품부터 제공합니다.'};
 return heading('EXPLORE',cat?cat[2]+' ETF':'ETF 종류별 탐색',descriptions[category])+`<div class="actions"><a class="button" href="#/explore">전체</a>${categories.map(([id,,name])=>`<a class="button" href="#/explore/${id}" ${id===category?'aria-current="page"':''}>${name}</a>`).join('')}</div>`+dataNotice()+`<div class="form-grid panel"><label>투자 지역<select id="region-filter">${[['all','전체 지역'],['korea','한국'],['us','미국'],['global','글로벌']].map(([v,n])=>`<option value="${v}" ${v===filters.region?'selected':''}>${n}</option>`).join('')}</select></label><label>투자 전략<select id="strategy-filter"><option value="all">전체 전략</option><option value="dividend" ${filters.strategy==='dividend'?'selected':''}>배당 중심</option></select></label><label>이름·종목코드 검색<input id="search" type="search" value="${esc(filters.query)}" placeholder="예: 반도체 또는 091160"></label></div><p id="result-count" role="status">${list.length}개 ETF</p><div class="grid" id="cards">${list.length?list.map(card).join(''):'<p class="empty">이 조건에 맞는 ETF가 없습니다. 필터를 바꿔 주세요.</p>'}</div><div class="actions"><a class="button primary" href="#/compare">선택한 ETF 비교 →</a><span class="muted">최대 3개 · 서로 다른 자산의 성과는 위험 차이도 함께 살펴보세요.</span></div>`;
}

function empty(title,note=''){return `<div class="empty"><h2>${title}</h2><p>${note}</p><a href="#/explore">ETF 둘러보기 →</a></div>`}
function periodControls(){return `<div class="controls" role="group" aria-label="차트 기간">${[[1,'1개월'],[3,'3개월'],[6,'6개월'],[12,'1년'],[36,'3년'],[0,'전체']].map(([n,t])=>`<button data-months="${n}" aria-pressed="${chartMonths===n}">${t}</button>`).join('')}</div>`}
/** Accessible SVG shared by performance and contribution simulations. */
function lineChart(dates,series,format=F.percent,title='가격 수익률'){
 if(dates.length<2)return empty('차트를 그릴 데이터가 부족합니다.');
 const values=series.flatMap(s=>s.values),low=Math.min(...values),high=Math.max(...values),pad=(high-low)*.08 || 1,lo=low-pad,hi=high+pad;
 const x=i=>90+i/(dates.length-1)*790,y=v=>20+(hi-v)/(hi-lo)*235;
 let svg=`<title>${esc(title)}</title><desc>${esc(dates[0])}부터 ${esc(dates.at(-1))}까지. ${series.map(s=>`${esc(s.name)} 마지막 값 ${esc(format(s.values.at(-1)))}`).join('. ')}</desc>`;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;svg+=`<line x1="90" x2="880" y1="${y(v)}" y2="${y(v)}" stroke="#dce5e8"/><text x="80" y="${y(v)+4}" text-anchor="end" font-size="13" fill="#526775">${esc(format(v))}</text>`;}
 series.forEach((s,k)=>{svg+=`<polyline fill="none" stroke="${esc(s.color||'#087e75')}" stroke-width="2.5" ${k===1?'stroke-dasharray="7 3"':''} points="${s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`;});
 for(let i=0;i<3;i++){const n=Math.round(i*(dates.length-1)/2);svg+=`<text x="${x(n)}" y="287" text-anchor="${i===0?'start':i===2?'end':'middle'}" font-size="13" fill="#526775">${dates[n]}</text>`;}
 return `<div class="legend">${series.map(s=>`<span><i style="background:${esc(s.color||'#087e75')}"></i>${esc(s.name)} · ${format(s.values.at(-1))}</span>`).join('')}</div><svg class="chart" viewBox="0 0 920 310" role="img" aria-label="${esc(title)}">${svg}</svg>`;
}
function performance(list){
 if(!list.length)return '';
 const start=C.rangeStart(list[0].dates,chartMonths);
 if(start<0)return `<p class="notice warning">이 기간 전체의 데이터가 없습니다. 더 짧은 기간이나 전체를 선택해 주세요.</p>`;
 return lineChart(list[0].dates.slice(start),list.map(e=>({name:e.name,color:e.color,values:e.prices.slice(start).map(p=>p/e.prices[start]-1)})))+`<p class="subtle muted">${list[0].dates[start]}의 각 ETF 가격 = 0%. 달력 기준 시작일 이전의 가장 가까운 관측 종가를 사용합니다. 분배금 포함 총수익률이 아닙니다.</p>`;
}
function compare(){
 const list=etfs.filter(e=>selected.has(e.ticker));
 return heading('COMPARE','ETF의 차이를 비교해요.','가격은 같은 기간으로, 기본 정보는 표시된 기준일로 확인해요. 순자산 자료 날짜가 달라 현재 규모 순위로 해석하지 마세요.')+dataNotice()+(list.length?`<div class="actions">${list.map(e=>`<button data-select="${e.ticker}" aria-pressed="true">${esc(e.name)} 제외 ×</button>`).join('')}<a href="#/explore">ETF 추가하기</a></div><section class="panel">${periodControls()}<div class="section">${performance(list)}</div></section><div class="table-wrap section"><table><caption>선택한 ETF 비교 · 미확보는 0이 아닙니다</caption><thead><tr><th scope="col">비교 항목</th>${list.map(e=>`<th scope="col"><a href="#/etf/${e.ticker}">${esc(e.name)}</a></th>`).join('')}</tr></thead><tbody>${[
 ['운용사',e=>esc(e.issuer)],['추종지수',e=>esc(e.benchmark)],['상장일',e=>fundamental(e,'inceptionDate')],['순자산',e=>fundamental(e,'aum'),'aum'],['거래량',e=>F.number(e.volume)+(e.volume!==null?'좌 · '+e.asOf:''),'volume'],['총보수',e=>fundamental(e,'expenseRatio'),'fee'],['추적오차',e=>F.percent(e.trackingError),'tracking'],['괴리율',e=>F.percent(e.premiumDiscount),'premium'],['분배금',()=> '미확보','distribution'],['1개월 가격 수익률',e=>F.percent(e.returns.month)],['3개월 가격 수익률',e=>F.percent(e.returns.quarter)],['1년 가격 수익률',e=>F.percent(e.returns.year)]
 ].map(([label,value,key])=>`<tr><th scope="row">${label}${key?help(key,label):''}</th>${list.map(e=>`<td>${value(e)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('비교할 ETF를 먼저 담아 주세요.','탐색 화면에서 최대 3개를 선택할 수 있어요.'))+`<section class="panel section"><h2>${new Set(list.map(e=>e.benchmark)).size>1?'서로 다른 지수·자산을 비교하고 있어요':'같은 지수인데 왜 다를까요?'}</h2><p>다른 지수나 자산의 수익률 차이는 운용 능력 차이가 아닙니다. 채권의 금리 위험, 해외 주식의 환율, 선물의 교체 비용처럼 위험 구조가 다릅니다.</p><p>따라가는 지수는 같아도 보수, 운용 방식, 분배금 지급 시점과 거래가격은 다를 수 있어요. 가격선이 조금 다르다고 곧바로 운용 능력 차이라고 해석하지 않아요.</p><p>① 같은 기간인가요? ② 분배금 기준이 같나요? ③ 시장가격과 NAV를 구분했나요?</p><p class="muted">현재는 종가만 비교합니다. NAV·지수 데이터가 없으므로 추적오차를 계산하지 않습니다.</p><a href="#/learn/tracking">추적오차와 성과 차이 알아보기 →</a></section>`;
}
function detail(ticker){
 const e=etfs.find(e=>e.ticker===ticker);if(!e)return empty('해당 ETF를 찾을 수 없습니다.');
 return heading('ETF OVERVIEW',esc(e.name),`${e.ticker} · ${esc(e.issuer)} · ${esc(e.benchmark)}`)+`<p class="notice">${esc(e.description)}</p>`+dataNotice()+`<div class="stats"><div class="stat">마지막 종가<strong>${F.money(e.price)}</strong><small>${e.asOf}</small></div><div class="stat">1년 가격 수익률<strong>${F.percent(e.returns.year)}</strong></div><div class="stat">총보수 ${help('fee','총보수')}<strong>${fundamental(e,'expenseRatio')}</strong></div></div><div class="actions"><button data-select="${e.ticker}" aria-pressed="${selected.has(e.ticker)}">${selected.has(e.ticker)?'비교에서 제외':'비교에 담기'}</button><a class="button primary" href="#/simulator/${e.ticker}">이 ETF로 계산하기</a><a href="${safeUrl(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">상품 정보 출처 ↗</a></div><section class="panel"><h2>ETF 한눈에 보기</h2><dl>${metric('추종지수',esc(e.benchmark),'index')}${metric('운용사',esc(e.issuer))}${metric('유형',esc(e.productType))}${metric('순자산',fundamental(e,'aum'),'aum')}${metric('거래량',F.number(e.volume)+(e.volume!==null?'좌 · '+e.asOf:''),'volume')}${metric('상장일',fundamental(e,'inceptionDate'))}</dl></section><section class="panel section"><h2>가격은 어떻게 변했을까요?</h2>${periodControls()}${performance([e])}<p class="muted">기초지수와 NAV 시계열은 아직 확보하지 않아 표시하지 않습니다.</p></section><section class="panel section"><h2>이 ETF는 어디에 투자하고 있을까?</h2>${e.holdings.length?holdingsChart(e.holdings):'<p class="notice">구성종목과 비중 데이터 준비 중</p><p>기준일이 있는 공식 구성종목 데이터를 연결하면 상위 종목의 비중을 여기에 표시합니다. 익숙한 기업 이름이나 현재 비중을 과거에 소급해 넣지 않습니다.</p>'}</section><section class="panel section"><h2>가격 수익률과 분배금 재투자</h2><p>지금 차트는 공급자 종가 기준입니다. 분배금을 현금으로 모으거나 재투자한 결과와는 구분해야 해요.</p><button disabled>실제 분배금 재투자 · 데이터 검증 대기</button><p class="subtle">분배락일·지급일·1좌당 분배금·가격 조정 이력을 확보해야 중복 계산 없이 제공할 수 있습니다.</p><a href="#/learn/reinvest">재투자는 어떤 뜻일까요? →</a></section><section class="panel section"><h2>오늘 이 ETF가 오른 이유</h2><p class="notice">수익률 기여도 분석 준비 중</p><p>전 거래일 종목 비중 × 같은 기간 종목 수익률로 가격 기여도를 근사할 예정입니다. 배당·현금·보수·리밸런싱 등으로 ETF 실제 수익률과 차이가 생깁니다.</p><p class="muted">현재는 전일 비중과 종목별 가격이 없어 상승 이유를 추정하지 않습니다.</p></section>`;
}
function holdingsChart(holdings){return holdings.slice(0,10).map(h=>`<p>${esc(h.name)} · ${F.percent(h.weight)}<span class="bar" style="width:${Math.max(0,Math.min(100,h.weight*100))}%"></span></p>`).join('');}
function simulator(ticker){
 if(!etfs.length)return heading('SIMULATOR','내 투자금으로 계산해 보기')+dataNotice();
 const e=etfs.find(e=>e.ticker===ticker)||etfs[0];
 return heading('SIMULATOR','매달 조금씩 투자했다면?','과거 종가로 계산하는 학습용 시나리오입니다. 실제 체결 결과나 미래 예상 수익이 아닙니다.')+dataNotice()+`<form id="simulation" class="panel"><div class="form-grid"><label>ETF<select name="ticker">${etfs.map(x=>`<option value="${x.ticker}" ${e.ticker===x.ticker?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>매월 투자금액 (원)<input name="monthly" type="number" min="1" max="1000000000" step="1" value="300000" required></label><label>투자 시작일<input name="start" type="date" min="${e.dates[0]}" max="${e.asOf}" value="${e.dates.find(d=>d>='2023-01-01')||e.dates[0]}" required></label><label>종료일<input name="end" type="date" min="${e.dates[0]}" max="${e.asOf}" value="${e.asOf}" required></label></div><div class="actions"><button class="primary" type="submit">과거 투자 결과 계산하기</button></div><p class="subtle muted">선택 범위의 첫 관측 거래일, 이후 매월 첫 관측 거래일 종가에 정수 단위로 매수합니다. 남은 현금은 다음 매수일까지 보유합니다. 세금·수수료·분배금은 제외합니다. 공급자의 과거 가격 조정 이력이 미검증이므로 실제 보유좌수와 다를 수 있습니다.</p></form><div id="sim-result" aria-live="polite" class="section"><p class="empty">기간과 금액을 입력한 뒤 계산해 보세요.</p></div>`;
}
function simulationResult(e,inputs){
 const r=C.simulate(e,inputs),lump=C.simulate(e,{...inputs,mode:'lump'});
 return `<h2>${esc(e.name)} · ${r.monthCount}회 납입 시나리오</h2><p>${r.history[0].date} → ${r.history.at(-1).date} 실제 관측 기간</p><div class="stats">${[['총 투자금',F.money(r.invested)],['현재 평가금액 · 현금 포함',F.money(r.value)],['총 수익금',F.money(r.profit)],['납입금 대비 누적수익률',F.percent(r.return)],['입금 효과를 제외한 MDD',F.percent(r.mdd)],['잔여 현금',F.money(r.cash)]].map(([k,v])=>`<div class="stat">${k}<strong>${v}</strong></div>`).join('')}</div><section class="panel"><h3>넣은 돈과 평가금액을 함께 봐요</h3>${lineChart(r.history.map(x=>x.date),[{name:'누적 투자금',color:'#7a8693',values:r.history.map(x=>x.invested)},{name:'평가금액 (현금 포함)',color:'#087e75',values:r.history.map(x=>x.value)}],v=>F.number(Math.round(v/10000))+'만원','누적 투자금과 평가금액')}<p class="subtle">수익률 = (평가금액 − 납입금) ÷ 납입금. 연환산 수익률이나 IRR이 아닙니다. MDD는 매일 입금 전 평가변화를 연결한 지수에서 계산하여 추가 입금을 수익으로 세지 않습니다.</p></section><section class="panel section"><h3>같은 총액을 처음에 모두 투자했다면?</h3><p>일시 투자 평가금액 <b>${F.money(lump.value)}</b> · 수익률 <b>${F.percent(lump.return)}</b></p><p class="muted">총 ${F.money(r.invested)}을 처음부터 가지고 있다고 가정합니다. 적립식과 자금 사용 시점·시장 노출 기간이 다르므로 어느 방식이 항상 유리하다는 뜻은 아닙니다.</p></section><details class="section"><summary>월별 납입 기록 보기</summary><div class="table-wrap"><table><thead><tr><th>매수일</th><th>납입금</th><th>누적 좌수</th><th>잔여 현금</th></tr></thead><tbody>${r.history.filter(x=>x.deposit).map(x=>`<tr><td>${x.date}</td><td>${F.money(x.deposit)}</td><td>${F.number(x.units)}</td><td>${F.money(x.cash)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function learn(term){return heading('LEARN','어려운 말은, 쉬운 예시로.','비교표에서 ⓘ를 누르면 해당 설명으로 이동해요. 예시 숫자는 실제 ETF 데이터가 아닙니다.')+`<nav class="actions" aria-label="용어 바로가기">${terms.map(([id,name])=>`<a class="button" href="#/learn/${id}">${name}</a>`).join('')}</nav><div class="two-col section">${terms.map(([id,name,text,example])=>`<article class="panel glossary" id="term-${id}" tabindex="-1"><h2>${name}</h2><p>${text}</p><p class="notice">${example}</p></article>`).join('')}</div><section class="panel section"><h2>읽어볼 자료</h2><p>정의 확인: <a href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24" target="_blank" rel="noopener noreferrer">SEC 투자자 교육 · ETF 구조와 NAV</a>, <a href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/mutual-fund-and-etf-fees-and-expenses-investor-bulletin" target="_blank" rel="noopener noreferrer">보수와 비용</a>, <a href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec" target="_blank" rel="noopener noreferrer">레버리지·인버스의 일일 목표</a>. 국내 상품의 구체적인 조건은 해당 상품 설명서를 확인하세요.</p></section>`;}
function render(){
 const [page='',arg]=location.hash.replace(/^#\/?/,'').split('/');
 if(page==='kospi200'){location.replace('kospi200.html');return;}
 document.querySelectorAll('header nav a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')===`#/${page}`?'page':'false'));
 root.innerHTML=page===''?home():page==='explore'?explore(arg):page==='compare'?compare():page==='etf'?detail(arg):page==='simulator'?simulator(arg):page==='learn'?learn(arg):empty('페이지를 찾을 수 없습니다.');
 document.title=(root.querySelector('h1')?.textContent||'ETF Starter')+' | ETF Starter';
 document.getElementById('selected-count').textContent=selected.size;
 if(page==='learn' && arg){const target=document.getElementById('term-'+arg);if(target){target.scrollIntoView();target.focus({preventScroll:true});}}
}
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.select){const ticker=button.dataset.select;
   if(selected.has(ticker))selected.delete(ticker);else if(selected.size<3)selected.add(ticker);else {document.getElementById('announce').textContent='최대 3개까지 비교할 수 있어요. 먼저 하나를 제외해 주세요.';return;}
   const search=root.querySelector('#search'),query=search?.value;
   render();if(query){root.querySelector('#search').value=query;filterCards(query);}
   document.getElementById('announce').textContent=`비교할 ETF ${selected.size}개 선택됨`;
   root.querySelector(`[data-select="${ticker}"]`)?.focus();
 }
 if(button.dataset.months!==undefined){chartMonths=Number(button.dataset.months);render();root.querySelector(`[data-months="${chartMonths}"]`)?.focus();}
});
function filterCards(query){filters.query=query;const list=C.filterEtfs(etfs,{category:activeCategory,...filters});document.getElementById('cards').innerHTML=list.length?list.map(card).join(''):'<p class="empty">이 조건에 맞는 ETF가 없습니다. 필터를 바꿔 주세요.</p>';document.getElementById('result-count').textContent=`${list.length}개 ETF`;}

root.addEventListener('input',event=>{if(event.target.id==='search')filterCards(event.target.value);});
root.addEventListener('submit',event=>{
 if(event.target.id!=='simulation')return;event.preventDefault();
 const data=new FormData(event.target),e=etfs.find(x=>x.ticker===data.get('ticker'));
 try{document.getElementById('sim-result').innerHTML=simulationResult(e,{start:data.get('start'),end:data.get('end'),monthly:Number(data.get('monthly'))});}
 catch(err){document.getElementById('sim-result').innerHTML=`<p class="notice warning" role="alert">${esc(err.message)}</p>`;}
});
root.addEventListener('change',event=>{if(event.target.id==='region-filter'){filters.region=event.target.value;filterCards(filters.query);}if(event.target.id==='strategy-filter'){filters.strategy=event.target.value;filterCards(filters.query);}if(event.target.closest('#simulation'))document.getElementById('sim-result').innerHTML='<p class="empty">입력이 변경되었습니다. 다시 계산해 주세요.</p>';});
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render();});
render();
