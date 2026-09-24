/** Deterministic cash-flow regression checks; synthetic inputs never ship as ETF data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../docs/starter-core.js');
const e={dates:['2024-01-02','2024-01-03','2024-02-01','2024-02-02','2024-03-01'],prices:[100,120,60,90,100]};
const inputs={start:e.dates[0],end:e.dates.at(-1),monthly:150};
const r=C.simulate(e,inputs);
assert.equal(r.invested,450);assert.equal(r.units,5);assert.equal(r.cash,70);assert.equal(r.value,570);
assert.ok(Math.abs(r.mdd - (-60/170)) < 1e-12); // Before February deposit: 170 -> 110.
assert.deepEqual(r.history.filter(x=>x.deposit).map(x=>x.date),['2024-01-02','2024-02-01','2024-03-01']);
const flat=C.simulate({...e,prices:[100,100,100,100,100]},inputs);
assert.equal(flat.value,450);assert.equal(flat.profit,0);assert.equal(flat.mdd,0);
const lump=C.simulate(e,{...inputs,mode:'lump'});assert.equal(lump.invested,r.invested);assert.equal(lump.value,450);
assert.equal(C.simulate(e,{...inputs,start:'2024-01-03'}).history[0].date,'2024-01-03');
for(const invalid of [{monthly:NaN},{monthly:0},{monthly:Infinity},{end:'2025-01-01'},{start:'2024-02-30'},{start:'2024-03-01',end:'2024-01-01'},{start:'2024-02-03',end:'2024-02-04'}])assert.throws(()=>C.simulate(e,{...inputs,...invalid}));
assert.equal(C.monthsBefore('2024-03-31',1),'2024-02-29');
assert.equal(C.monthsBefore('2025-03-31',1),'2025-02-28');
assert.equal(C.periodReturn(e.dates,e.prices,12),null);
assert.equal(C.rangeStart(['2024-01-01','2024-01-31','2024-03-01'],1),1);
assert.throws(()=>C.catalog(null));
assert.throws(()=>C.catalog({dates:e.dates,universe:[{symbol:'069500'}],prices:{'069500':[0]}}));
assert.equal(C.fmt.percent(null),'미확보');
assert.equal(C.contributions([{name:'A',previousWeight:.2,priceReturn:.1}])[0].contribution,.2*.1);
assert.throws(()=>C.contributions([{previousWeight:1.2,priceReturn:0}]));
// Load the actual bundled snapshot and check every instrument's simulation.
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('docs/data.js','utf8'),sandbox);
const catalog=C.catalog(sandbox.window.ETF_DATA);
assert.equal(catalog.length,4);
for(const etf of catalog){
 const result=C.simulate(etf,{start:etf.dates[0],end:etf.dates.at(-1),monthly:300000});
 assert.ok(Number.isFinite(result.value));assert.ok(result.mdd<=0 && result.mdd>=-1);
 assert.equal(result.invested,result.monthCount*300000);
 for(const row of result.history){assert.ok(row.cash>=-1e-7);assert.ok(Number.isInteger(row.units));}
 assert.equal(etf.aum,null);assert.deepEqual(etf.distributions,[]);
}
console.log('Starter: cash flows, MDD, dates, missing data, attribution and 4 real snapshots passed.');
vm.runInNewContext(fs.readFileSync('docs/fundamentals.js','utf8'),sandbox);
const verified=C.catalog(sandbox.window.ETF_DATA,sandbox.window.ETF_FUNDAMENTALS);
assert.equal(verified[0].expenseRatio,.0015);
assert.equal(verified[1].inceptionDate,'2008-04-03');
assert.equal(verified[2].expenseRatio,.00017);
assert.equal(verified[3].aum,1528000000000);
assert.ok(verified.every(e=>Number.isFinite(e.volume)));
const broken=JSON.parse(JSON.stringify(sandbox.window.ETF_FUNDAMENTALS));
broken.funds['069500'].aum.unit='억원';
assert.equal(C.catalog(sandbox.window.ETF_DATA,broken)[0].aum,null);
broken.funds['069500'].expenseRatio.sourceUrl='javascript:alert(1)';
assert.equal(C.catalog(sandbox.window.ETF_DATA,broken)[0].expenseRatio,null);
console.log('Fundamentals: verified sources, fractional fees, dated AUM and volume passed.');
