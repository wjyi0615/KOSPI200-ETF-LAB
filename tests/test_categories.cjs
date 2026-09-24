/** Category and view regression checks without browser or external dependencies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../docs/starter-core.js');
const el={innerHTML:'',textContent:'',addEventListener(){},querySelector(){return null;}};
const context=vm.createContext({window:{ETFCore:C,addEventListener(){}},document:{getElementById(){return el;},querySelectorAll(){return [];}},location:{hash:'#/explore'},Date,console});
for(const file of ['docs/explore-data.js','docs/fundamentals.js','docs/starter.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const etfs=C.catalog(context.window.ETF_DATA,context.window.ETF_FUNDAMENTALS);
assert.equal(etfs.length,9);
for(const category of ['equity','bonds','commodity','theme']) {
 const list=C.filterEtfs(etfs,{category});assert.ok(list.length);
 const html=vm.runInContext(`explore('${category}')`,context);assert.ok(html.includes(list[0].name));
 for(const e of list){const detail=vm.runInContext(`detail('${e.ticker}')`,context);assert.ok(detail.includes(e.description));assert.ok(detail.includes(e.productType));}
}
assert.equal(C.filterEtfs(etfs,{category:'equity',region:'us'})[0].ticker,'360750');
assert.equal(C.filterEtfs(etfs,{category:'equity',strategy:'dividend'})[0].ticker,'161510');
assert.equal(C.filterEtfs(etfs,{category:'bonds',query:'반도체'}).length,0);
assert.equal(C.filterEtfs(etfs,{category:'commodity',strategy:'dividend'}).length,0);
vm.runInContext("selected.add('114260');selected.add('132030')",context);
assert.ok(vm.runInContext('compare()',context).includes('서로 다른 지수·자산'));
for(const e of etfs){assert.ok(Number.isFinite(e.volume));assert.ok(Number.isFinite(C.simulate(e,{start:e.dates[0],end:e.asOf,monthly:300000}).value));}
const legacy={window:{}};vm.runInNewContext(fs.readFileSync('docs/data.js','utf8'),legacy);assert.equal(legacy.window.ETF_DATA.universe.length,4);
console.log('9 ETF catalog, 4 categories, filters, details, mixed comparison, simulation and legacy Lab passed.');
// Render with the same metadata binding as the browser's shared window.
context.window.ETFCore={...C,catalog:data=>C.catalog(data,context.window.ETF_FUNDAMENTALS)};
vm.runInContext('etfs=window.ETFCore.catalog(window.ETF_DATA)',context);
assert.ok(vm.runInContext("detail('360750')",context).includes('0.0068%'));
const dividend=etfs.find(e=>e.ticker==='161510');
assert.equal(dividend.distributions.length,8);
assert.equal(dividend.distributions.at(-1).amountPerShare,103);
assert.ok(vm.runInContext("detail('161510')",context).includes('2026-09-02'));
assert.ok(vm.runInContext("detail('161510')",context).includes('일부 내역'));
assert.ok(vm.runInContext("detail('069500')",context).includes('분배금 자료 미확보'));
const options={start:dividend.dates[0],end:dividend.asOf,monthly:300000};
assert.deepEqual(C.simulate(dividend,options),C.simulate({...dividend,distributions:[]},options));
const invalid=JSON.parse(JSON.stringify(context.window.ETF_FUNDAMENTALS));
invalid.distributions['161510'].events[0].amountPerShare=-1;
assert.equal(C.catalog(context.window.ETF_DATA,invalid).find(e=>e.ticker==='161510').distributions.length,0);
console.log('Partial distributions, fee precision, missing state and price-only simulation passed.');
