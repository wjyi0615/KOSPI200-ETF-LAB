/* Shared data adapter and pure calculations. No DOM or network dependencies. */
(function (root) {
  'use strict';
  const missing = '미확보';
  const fmt = {
    money: v => Number.isFinite(v) ? Math.round(v).toLocaleString('ko-KR') + '원' : missing,
    number: v => Number.isFinite(v) ? v.toLocaleString('ko-KR') : missing,
    percent: v => Number.isFinite(v) ? (v * 100).toFixed(2) + '%' : missing
  };
  /** Validate the immutable public snapshot before any page consumes it. */
  function catalog(data, metadata = root.ETF_FUNDAMENTALS) {
    if (!data || !Array.isArray(data.dates) || data.dates.length < 2 || !Array.isArray(data.universe) || !data.universe.length) throw Error('가격 데이터가 없습니다.');
    const dates = data.dates;
    if (dates.some((d,i) => !validDate(d) || (i && d <= dates[i-1]))) throw Error('가격 날짜가 올바르지 않습니다.');
    const seen = new Set();
    return data.universe.map(e => {
      if (!/^\d{6}$/.test(e.symbol) || seen.has(e.symbol)) throw Error('종목코드가 올바르지 않습니다.');
      seen.add(e.symbol);
      const prices = data.prices?.[e.symbol];
      if (!Array.isArray(prices) || prices.length !== dates.length || prices.some(p => !Number.isFinite(p) || p <= 0)) throw Error('유효하지 않은 가격 데이터입니다.');
      const volume = data.volumes?.[e.symbol]?.at(-1);
      const details = metadata?.schema_version === 1 ? metadata.funds?.[e.symbol] || {} : {};
      const accepted = {};
      for (const key of ['aum','expenseRatio','inceptionDate']) {
        const r = details[key];
        if (!r || !validDate(r.checkedAt) || !/^https:\/\//.test(r.sourceUrl || '') || !r.sourceName || (r.asOf && (!validDate(r.asOf) || r.asOf > r.checkedAt))) continue;
        const valid = key === 'inceptionDate' ? validDate(r.value) && r.value <= r.checkedAt : Number.isFinite(r.value) && r.value >= 0 && (key === 'aum' ? r.value > 0 && validDate(r.asOf) && r.unit === 'KRW' : r.value <= .1 && r.unit === 'annual_fraction');
        if (valid) accepted[key] = r;
      }
      const history = metadata?.schema_version === 1 ? metadata.distributions?.[e.symbol] : null;
      const distributionHistory = validHistory(history) ? history : null;
      return {
        ticker:e.symbol, name:e.name, issuer:e.manager, category:e.category || 'equity', region:e.region || 'korea', strategy:e.strategy || 'broad', description:e.description || 'KOSPI200을 추종하는 주식 ETF입니다.', productType:e.productType || '국내 주식형 · 패시브',
        benchmark:e.benchmark || 'KOSPI200', color:e.color, sourceUrl:e.source_url,
        price:prices.at(-1), asOf:dates.at(-1), dates, prices,
        aum:accepted.aum?.value ?? null, expenseRatio:accepted.expenseRatio?.value ?? null, volume:Number.isFinite(volume) && volume >= 0 ? volume : null,
        trackingError:null, premiumDiscount:null, dividendYield:null, inceptionDate:accepted.inceptionDate?.value ?? null, metadata:accepted,
        holdings:[], distributions:distributionHistory?.events || [], distributionHistory, nav:[], benchmarkPrices:[],
        provenance:{provider:data.provider, priceBasis:data.price_basis, metadataStatus:Object.keys(accepted).length ? 'dated_snapshot' : 'unavailable'},
        returns:{month:periodReturn(dates,prices,1), quarter:periodReturn(dates,prices,3), year:periodReturn(dates,prices,12)}
      };
    });
  }
  function validDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  }
  /** Partial, paid records for display only; record dates are not ex-dates. */
  function validHistory(h) {
    return !!h && h.complete === false && h.unit === 'KRW_per_share' && validDate(h.checkedAt)
      && h.checkedAt <= new Date().toISOString().slice(0,10) && /^https:\/\//.test(h.sourceUrl || '') && !!h.sourceName
      && Array.isArray(h.events) && h.events.length > 0 && h.events.every((e,i) =>
        validDate(e.recordDate) && validDate(e.paymentDate) && e.paymentDate >= e.recordDate && e.paymentDate <= h.checkedAt
        && (!i || e.recordDate > h.events[i-1].recordDate) && Number.isFinite(e.amountPerShare) && e.amountPerShare >= 0);
  }
  /** Shift calendar months, clamping month-end rather than overflowing. */
  function monthsBefore(date, months) {
    const d = new Date(date + 'T00:00:00Z'), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - months);
    const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(day,last)); return d.toISOString().slice(0,10);
  }
  /** Latest observed close on/before the calendar boundary; no extrapolation. */
  function rangeStart(dates, months) {
    if (!months) return 0;
    const cutoff = monthsBefore(dates.at(-1), months);
    if (dates[0] > cutoff) return -1;
    let i = dates.length-1; while (i > 0 && dates[i] > cutoff) i--; return i;
  }
  function periodReturn(dates, prices, months) {
    const i = rangeStart(dates, months); return i < 0 ? null : prices.at(-1)/prices[i]-1;
  }
  /** Monthly contributions at the first observed close in each selected month.
   * Whole units, carry unused cash, no distributions/costs/taxes. Cash enters
   * after that day's price movement; unitized returns remove deposit effects.
   * This is a vendor-close scenario, not a verified historical execution ledger.
   */
  function simulate(etf, {start, end, monthly, mode='monthly'}) {
    if (!validDate(start) || !validDate(end) || start > end || start < etf.dates[0] || end > etf.dates.at(-1)) throw Error('보유 데이터 범위 안에서 시작일과 종료일을 선택해 주세요.');
    if (!Number.isFinite(monthly) || monthly <= 0 || monthly > 1e9) throw Error('투자금은 1원 이상 10억원 이하로 입력해 주세요.');
    if (!['monthly','lump'].includes(mode)) throw Error('지원하지 않는 투자 방식입니다.');
    const rows = etf.dates.map((date,i)=>({date,price:etf.prices[i]})).filter(r=>r.date>=start && r.date<=end);
    if (rows.length < 2) throw Error('거래일이 최소 2일 포함되도록 기간을 늘려 주세요.');
    if (rows.some(r=>!Number.isFinite(r.price)||r.price<=0)) throw Error('가격을 확인할 수 없습니다.');
    const monthCount = new Set(rows.map(r=>r.date.slice(0,7))).size;
    let units=0,cash=0,invested=0,lastMonth='',previousValue=0,growth=1,peak=1,mdd=0;
    const history=rows.map((r,i)=>{
      const before=units*r.price+cash;
      if (i && previousValue>0) growth*=before/previousValue;
      peak=Math.max(peak,growth); mdd=Math.min(mdd,growth/peak-1);
      const newMonth=r.date.slice(0,7)!==lastMonth;
      const deposit=mode==='lump' ? (i===0 ? monthly*monthCount : 0) : (newMonth ? monthly : 0);
      if (deposit) {
        cash+=deposit;invested+=deposit;
        const bought=Math.floor(cash/r.price);units+=bought;cash-=bought*r.price;
      }
      lastMonth=r.date.slice(0,7);previousValue=units*r.price+cash;
      return {date:r.date,invested,value:previousValue,deposit,units,cash,growth};
    });
    return {history,invested,value:previousValue,profit:previousValue-invested,return:previousValue/invested-1,mdd,units,cash,monthCount};
  }
  /** Approximate constituent price contribution, only for verified prior weights.
   * Never infer weights from current holdings or claim exact fund attribution.
   */
  function contributions(holdings) {
    if (!holdings.length) return [];
    if (holdings.some(h=>!Number.isFinite(h.previousWeight)||h.previousWeight<0||h.previousWeight>1||!Number.isFinite(h.priceReturn)||h.priceReturn < -1) || holdings.reduce((s,h)=>s+h.previousWeight,0)>1.000001) throw Error('전일 비중과 동일 기간 수익률을 확인해야 합니다.');
    return holdings.map(h=>({...h,contribution:h.previousWeight*h.priceReturn})).sort((a,b)=>b.contribution-a.contribution);
  }
  function filterEtfs(list,{category="all",region="all",strategy="all",query=""}={}) {
    const q=query.trim().toLowerCase();
    return list.filter(e=>(category==="all"||e.category===category)&&(region==="all"||e.region===region)&&(strategy==="all"||e.strategy===strategy)&&(e.name+e.ticker+e.issuer).toLowerCase().includes(q));
  }
  const api={filterEtfs,fmt,catalog,rangeStart,periodReturn,monthsBefore,simulate,contributions};
  if (typeof module !== 'undefined') module.exports=api; else root.ETFCore=api;
})(typeof window !== 'undefined' ? window : globalThis);
