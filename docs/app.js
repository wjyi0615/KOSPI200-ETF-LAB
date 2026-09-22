/* Python provides the performance metrics; the browser only renders the snapshot. */
const state={period:'all',mode:'cumulative'};
const percent=value=>(value*100).toFixed(2)+'%';
function render(){
  const data=window.ETF_DATA,period=data.periods[state.period];
  const indices=data.dates.map((d,i)=>d>=period.start&&d<=period.end?i:-1).filter(i=>i>=0);
  const dates=indices.map(i=>data.dates[i]);
  document.getElementById('range').textContent=`기준 종가 ${period.start} → ${period.end} · 공통 관측치 ${period.observations}개`;
  document.getElementById('return-label').textContent=state.period===String(new Date().getFullYear())?'YTD 수익률':'기간 수익률';
  const years=(Date.parse(period.end)-Date.parse(period.start))/86400000/365.25;
  document.getElementById('comparison').innerHTML=data.universe.map(etf=>{const m=period.metrics[etf.symbol];return `<tr><td><a href="${etf.source_url}" target="_blank" rel="noopener noreferrer"><b>${etf.name}</b></a><small>${etf.manager} · ${etf.symbol}</small></td><td>${percent(m.cumulative_return)}</td><td>${years>=1?percent(m.cagr):'—'}</td><td>${percent(m.annualized_volatility)}</td><td>${m.sharpe_ratio===null?'—':m.sharpe_ratio.toFixed(2)}</td><td>${percent(m.maximum_drawdown)}</td></tr>`}).join('');
  const curves=data.universe.map(etf=>{const p=indices.map(i=>data.prices[etf.symbol][i]);let peak=p[0];return {etf,values:p.map(v=>{peak=Math.max(peak,v);return state.mode==='price'?v:state.mode==='drawdown'?v/peak-1:v/p[0]-1})}});
  const all=curves.flatMap(c=>c.values),low=Math.min(...all),high=Math.max(...all),pad=(high-low)*.1||1,lo=low-pad,hi=high+pad;
  const x=i=>80+i/(dates.length-1)*885,y=v=>18+(hi-v)/(hi-lo)*260;
  let svg='<desc id="chart-desc">선택 기간 네 운용사 ETF의 '+({price:'종가',cumulative:'누적수익률',drawdown:'낙폭'}[state.mode])+' 비교. 상세 지표는 위 표에 표시됩니다.</desc>';
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,Y=y(v);svg+=`<line x1="80" y1="${Y}" x2="965" y2="${Y}" stroke="#e4ebf0"/><text x="68" y="${Y+5}" text-anchor="end" fill="#587083" font-size="14">${state.mode==='price'?Math.round(v).toLocaleString():Math.round(v*100)+'%'}</text>`;}
  curves.forEach(c=>{svg+=`<polyline points="${c.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${c.etf.color}" stroke-width="2" stroke-linejoin="round"><title>${c.etf.name}</title></polyline>`});
  for(let i=0;i<5;i++){const n=Math.round(i*(dates.length-1)/4);svg+=`<text x="${x(n)}" y="310" text-anchor="${i===0?'start':i===4?'end':'middle'}" fill="#587083" font-size="14">${dates[n].slice(0,7)}</text>`;}
  document.getElementById('chart').innerHTML=svg;
  document.getElementById('chart-title').textContent={price:'종가 (KRW)',cumulative:'누적수익률',drawdown:'기간 고점 대비 낙폭'}[state.mode];
  document.getElementById('chart-note').textContent={price:'ETF별 단위가격 차이는 성과 차이가 아닙니다.',cumulative:'각 ETF의 기준일 가격 = 0%',drawdown:'선택 기간 내 최고가격에서 얼마나 하락했는가'}[state.mode];
  document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.period===state.period));
}
function init(){
  const data=window.ETF_DATA;
  if(!data||!data.periods||!data.periods.all){document.getElementById('status').textContent='비교 데이터를 불러오지 못했습니다. 새로고침하거나 GitHub의 업데이트 실행 결과를 확인해 주세요.';document.getElementById('status').classList.add('warning');return;}
  const year=new Date().getFullYear(),latest=String(year);
  state.period=data.periods[latest]?latest:'all';
  document.getElementById('periods').innerHTML=Object.keys(data.periods).sort((a,b)=>a==='all'?-1:b==='all'?1:Number(a)-Number(b)).map(key=>`<button data-period="${key}" aria-pressed="false">${key==='all'?'전체 기간':key===latest?key+' YTD':key}</button>`).join('');
  document.getElementById('data-date').textContent=`마지막 공통 거래일 ${data.as_of} · ${data.universe.length}개 ETF`;
  const stale=(Date.now()-Date.parse(data.as_of+'T00:00:00+09:00'))/86400000>7;
  const status=document.getElementById('status');status.textContent=stale?`데이터 기준일은 ${data.as_of}입니다. 휴장 또는 수집 지연으로 최신 가격과 차이가 있을 수 있습니다.`:`${data.as_of} 종가 기준 · 평일 19:23 KST 자동 갱신 예약 · 실시간 시세가 아닙니다.`;
  if(stale)status.classList.add('warning');
  document.getElementById('checked-at').textContent='마지막 수집 확인: '+new Date(data.generated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST';
  document.getElementById('legend').innerHTML=data.universe.map(e=>`<span><i class="swatch" style="background:${e.color}"></i>${e.name}</span>`).join('');
  document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{state.period=b.dataset.period;render()}));
  document.querySelectorAll('[data-chart]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.chart;document.querySelectorAll('[data-chart]').forEach(n=>n.setAttribute('aria-pressed',n===b));render()}));
  render();
}
init();
