/* ECON bill parser core v2.0.0
 * Pure parsing logic: no DOM, no network. Can run in browser or Node tests.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.EconBillParser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='bill-parser-2.0.0';
const MIN_CONFIDENCE=.68;
const NUM='(?:[0-9]{1,3}(?:\\.[0-9]{3})+(?:,[0-9]{1,3})?|[0-9]{1,3}(?:\\s[0-9]{3})+(?:,[0-9]{1,3})?|[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{1,3})?|[0-9]+(?:,[0-9]{1,3})?|[0-9]+\\.[0-9]{1,2})';
const MONTHS={
  gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11,
  gen:0,feb:1,mar:2,apr:3,mag:4,giu:5,lug:6,ago:7,set:8,ott:9,nov:10,dic:11
};

function normalizeText(text){
  return String(text||'')
    .replace(/\u00a0/g,' ')
    .replace(/[–—]/g,'-')
    .replace(/[ \t]+/g,' ')
    .replace(/\r/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}
function flatText(text){return normalizeText(text).replace(/\s+/g,' ')}

function parseLocaleNumber(raw){
  let s=String(raw||'').trim().replace(/[^0-9,.-]/g,'');
  if(!s)return NaN;
  const neg=s.startsWith('-');
  s=s.replace(/-/g,'');
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){
    if(comma>dot)s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  }else if(comma>=0){
    const decimals=s.length-comma-1;
    if(decimals>=1&&decimals<=3)s=s.slice(0,comma).replace(/,/g,'')+'.'+s.slice(comma+1);
    else s=s.replace(/,/g,'');
  }else if(dot>=0){
    const parts=s.split('.');
    // Italian bills overwhelmingly use a dot as thousands separator when the
    // final group has 3 digits (5.119; 136.044). Preserve decimal dot only
    // for one/two decimal digits.
    if(parts.length>2||(parts.length===2&&parts[1].length===3))s=parts.join('');
  }
  const n=Number(s);return Number.isFinite(n)?(neg?-n:n):NaN;
}
function inRange(n,min,max){return Number.isFinite(n)&&n>=min&&n<=max}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}

function parseDateToken(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/\./g,'/');
  let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    let y=Number(m[3]);if(y<100)y+=2000;
    const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));
    return Number.isNaN(d.getTime())?null:d;
  }
  m=s.match(/^(\d{1,2})\s+([a-zà]+)\s+(\d{2,4})$/i);
  if(m){
    let y=Number(m[3]);if(y<100)y+=2000;
    const mon=MONTHS[m[2].slice(0,3)] ?? MONTHS[m[2]];
    if(mon===undefined)return null;
    const d=new Date(Date.UTC(y,mon,Number(m[1])));
    return Number.isNaN(d.getTime())?null:d;
  }
  return null;
}
function daysInclusive(a,b){
  if(!a||!b)return 0;
  const d=Math.round((b-a)/86400000)+1;
  return d>0?d:0;
}
function dateRangeIn(text){
  const numeric=/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\s*(?:al|a|-)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i.exec(text);
  if(numeric){const a=parseDateToken(numeric[1]),b=parseDateToken(numeric[2]);const days=daysInclusive(a,b);if(days)return{a,b,days,raw:numeric[0]}}
  const wordy=/(\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{2,4})\s*(?:al|a|-)\s*(\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{2,4})/i.exec(text);
  if(wordy){const a=parseDateToken(wordy[1]),b=parseDateToken(wordy[2]);const days=daysInclusive(a,b);if(days)return{a,b,days,raw:wordy[0]}}
  return null;
}
function monthPeriodIn(text){
  const m=/(?:periodo(?:\s+di)?\s+fatturazione|periodo\s+fatturato)\s*[:\-]?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})/i.exec(text);
  if(!m)return null;
  const mon=MONTHS[m[1].toLowerCase()],year=Number(m[2]);
  const days=new Date(Date.UTC(year,mon+1,0)).getUTCDate();
  return{days,raw:m[0],confidence:.98};
}

function findBillingPeriod(text){
  const anchors=[
    /periodo(?:\s+oggetto)?\s+di\s+fatturazione\s*[:\-]?/ig,
    /periodo\s+fatturato\s*[:\-]?/ig,
    /periodo\s+di\s+riferimento\s*[:\-]?/ig
  ];
  for(const re of anchors){
    let m;while((m=re.exec(text))){
      const ctx=text.slice(m.index,Math.min(text.length,m.index+260));
      const r=dateRangeIn(ctx);if(r&&r.days>=15&&r.days<=370)return{days:r.days,raw:r.raw,confidence:.98};
    }
  }
  const mp=monthPeriodIn(text);if(mp)return mp;
  const explicit=/(?:periodicità|frequenza)\s+(?:di\s+)?fatturazione[^.]{0,80}\bbimestr(?:ale|e)\b/i.exec(text);
  if(explicit)return{days:61,raw:explicit[0],confidence:.82};
  const tri=/(?:periodicità|frequenza)\s+(?:di\s+)?fatturazione[^.]{0,80}\btrimestr(?:ale|e)\b/i.exec(text);
  if(tri)return{days:91,raw:tri[0],confidence:.82};
  return{days:0,raw:'',confidence:0};
}

function candidateNumbersWithUnit(ctx,unit,min,max){
  const unitExpr=unit==='kwh'?'kwh':'€|euro';
  const re=new RegExp('('+NUM+')\\s*(?:'+unitExpr+')','ig');
  const out=[];let m;
  while((m=re.exec(ctx))){const n=parseLocaleNumber(m[1]);if(inRange(n,min,max))out.push({value:n,index:m.index,raw:m[0]});}
  return out;
}
function bestAfterAnchor(text,anchorRe,unit,min,max,windowSize){
  anchorRe.lastIndex=0;let m;const out=[];
  while((m=anchorRe.exec(text))){
    const ctx=text.slice(m.index,Math.min(text.length,m.index+(windowSize||420)));
    const candidates=candidateNumbersWithUnit(ctx,unit,min,max);
    if(candidates.length)out.push({value:candidates[0].value,distance:candidates[0].index,anchor:m[0],context:ctx});
    if(!anchorRe.global)break;
  }
  out.sort((a,b)=>a.distance-b.distance);
  return out[0]||null;
}

function findExplicitAnnualKwh(text){
  // Strong semantic phrasing used by Plenitude and similar suppliers.
  let m=new RegExp('in\\s+un\\s+anno\\s+(?:hai\\s+)?consumat[oa][^0-9]{0,80}('+NUM+')\\s*kwh','i').exec(text);
  if(m){const n=parseLocaleNumber(m[1]);if(inRange(n,100,500000))return{value:n,confidence:.995,method:'EXPLICIT_ANNUAL_KWH_IN_YEAR',anchor:m[0]}}

  // Unit can precede the number: "Consumo annuo (kWh): 2.016,48".
  m=new RegExp('consum[oi]\\s+(?:annuo|annui|annuale|annuali)(?:\\s+aggiornat[oa])?\\s*(?:\\(\\s*kwh\\s*\\)|kwh)\\s*[:\\-]?\\s*('+NUM+')','i').exec(text);
  if(m){const n=parseLocaleNumber(m[1]);if(inRange(n,100,500000))return{value:n,confidence:.995,method:'EXPLICIT_ANNUAL_KWH_UNIT_FIRST',anchor:m[0]}}

  const direct=bestAfterAnchor(
    text,
    /(?:totale\s+)?consum[oi]\s+(?:annuo|annui|annuale|annuali)(?:\s+aggiornat[oa])?(?:\s+(?:totale|complessivo|di\s+energia|al\s+seguente\s+periodo))?\s*[:\-]?/ig,
    'kwh',100,500000,520
  );
  if(direct)return{value:direct.value,confidence:.99,method:'EXPLICIT_ANNUAL_KWH',anchor:direct.anchor};

  const twelve=bestAfterAnchor(text,/(?:consum[oi][^.]{0,120})?(?:ultimi|precedenti)\s+12\s+mesi/ig,'kwh',100,500000,420);
  if(twelve)return{value:twelve.value,confidence:.96,method:'EXPLICIT_12M_KWH',anchor:twelve.anchor};
  return null;
}

function findExplicitAnnualSpend(text){
  const anchors=[/totale\s+spesa\s+annua\s*[:\-]?/ig,/spesa\s+annua(?:\s+sostenuta)?\s*[:\-]?/ig];
  for(const re of anchors){
    re.lastIndex=0;let m;
    while((m=re.exec(text))){
      const ctx=text.slice(m.index,Math.min(text.length,m.index+520));
      const candidates=candidateNumbersWithUnit(ctx,'euro',50,1000000);
      if(!candidates.length)continue;
      const value=candidates[0].value;
      const range=dateRangeIn(ctx);
      // Some suppliers label a partial-period amount as "spesa annua sostenuta".
      // Never turn that into an annual figure unless the stated coverage is annual.
      if(range&&range.days<300)return{value:0,confidence:0,method:'PARTIAL_REPORTED_ANNUAL_SPEND',coverageDays:range.days};
      return{value,confidence:range?.days>=300?.97:.9,method:'EXPLICIT_ANNUAL_SPEND',coverageDays:range?.days||0};
    }
  }
  return null;
}

function findPeriodKwh(text){
  const anchors=[
    /consumo\s+totale\s+del\s+periodo\s+fatturato\s*[:\-]?/ig,
    /consumo\s+totale\s+fatturato\s+del\s+periodo\s*[:\-]?/ig,
    /consumo\s+totale\s+fatturato\s*[:\-]?/ig,
    /consumo\s+fatturato\s*[:\-]?/ig
  ];
  for(const re of anchors){const r=bestAfterAnchor(text,re,'kwh',10,500000,150);if(r)return r.value;}
  return 0;
}
function findBillAmount(text){
  const labels=[/totale\s+bolletta\s*[:\-]?/ig,/totale\s+da\s+pagare\s*[:\-]?/ig];
  for(const re of labels){const r=bestAfterAnchor(text,re,'euro',5,1000000,90);if(r)return r.value;}
  return 0;
}

function findPod(text){const m=/\b(IT\d{3}E\d{8,})\b/i.exec(text);return m?m[1].toUpperCase():''}
function findPower(text){
  const m=new RegExp('potenza\\s+impegnata\\s*[:\\-]?\\s*('+NUM+')\\s*kw','i').exec(text);
  const n=m?parseLocaleNumber(m[1]):0;return inRange(n,.5,10000)?n:0;
}
function detectSupplier(text){
  const t=text.toLowerCase();
  const suppliers=[['Sorgenia','sorgenia'],['Hera','hera comm'],['E.ON','e.on'],['Dolomiti Energia','dolomiti energia'],['Octopus Energy','octopus energy'],['Cogeme Energia','cogeme energia'],['Plenitude','plenitude']];
  const hit=suppliers.find(([,needle])=>t.includes(needle));return hit?hit[0]:'';
}

function parseBillText(rawText){
  const text=flatText(rawText);
  if(!text)return{usable:false,annualKwh:0,annualSpend:0,periodDays:0,confidence:0,method:'NO_TEXT',kwhConfidence:0,spendConfidence:0,version:VERSION};

  const period=findBillingPeriod(text);
  const explicitKwh=findExplicitAnnualKwh(text);
  const explicitSpend=findExplicitAnnualSpend(text);
  let annualKwh=explicitKwh?.value||0;
  let kwhConfidence=explicitKwh?.confidence||0;
  let kwhMethod=explicitKwh?.method||'';
  let annualSpend=explicitSpend?.value||0;
  let spendConfidence=explicitSpend?.confidence||0;
  let spendMethod=explicitSpend?.value?explicitSpend.method:'';

  // Only annualize current-period values when a billing-period range itself
  // was identified. Never infer the billing duration from unrelated words
  // such as "mensile" in tariff/index sections.
  if(!annualKwh&&period.days&&period.confidence>=.8){
    const pkwh=findPeriodKwh(text);
    if(pkwh){annualKwh=pkwh*365/period.days;kwhConfidence=.74;kwhMethod='ANNUALIZED_PERIOD_KWH';}
  }
  if(!annualSpend&&!annualKwh&&period.days&&period.confidence>=.8){
    const amount=findBillAmount(text);
    if(amount){annualSpend=amount*365/period.days;spendConfidence=.7;spendMethod='ANNUALIZED_BILL_AMOUNT';}
  }

  if(annualKwh)annualKwh=Math.round(annualKwh*100)/100;
  if(annualSpend)annualSpend=Math.round(annualSpend*100)/100;
  const bestConfidence=Math.max(kwhConfidence,spendConfidence);
  const usable=(inRange(annualKwh,100,500000)&&kwhConfidence>=MIN_CONFIDENCE)||(inRange(annualSpend,100,1000000)&&spendConfidence>=MIN_CONFIDENCE);
  return{
    usable,
    annualKwh:annualKwh||0,
    annualSpend:annualSpend||0,
    periodDays:period.days||0,
    confidence:bestConfidence,
    method:[kwhMethod,spendMethod].filter(Boolean).join('+')||'NO_RELIABLE_DATA',
    kwhConfidence,spendConfidence,
    annualKwhSource:explicitKwh?'supplier_reported':(annualKwh?'annualized':'none'),
    annualSpendCoverageDays:explicitSpend?.coverageDays||0,
    supplier:detectSupplier(text),
    pod:findPod(text),
    powerKw:findPower(text),
    version:VERSION
  };
}

return{VERSION,MIN_CONFIDENCE,normalizeText,flatText,parseLocaleNumber,parseBillText,findBillingPeriod,findExplicitAnnualKwh,findExplicitAnnualSpend};
});
