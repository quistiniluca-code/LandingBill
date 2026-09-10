/* ECON automatic electricity-bill reader
 * Reads selectable PDF text first, then uses OCR only when needed.
 * The document is processed in the browser; only the numeric values required by
 * the existing ECON estimator are written into the form controls.
 */
(function(){
'use strict';

const VERSION='bill-reader-2.0.0';
const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_TEXT_PAGES=10;
const MAX_OCR_PAGES=4;
const MIN_CONFIDENCE=.68;
let parseGeneration=0;
let tesseractPromise=null;
let pdfjsPromise=null;

const $=s=>document.querySelector(s);
const billInput=$('#bill');
const billChoices=$('#billChoices');
const spendPanel=$('#spendPanel');
const fileMeta=$('#fileMeta');
const energyNext=$('#energyNext');
const monthlyBand=$('#monthlyBand');
const annualKwh=$('#annualKwh');
const removeBill=$('#removeBill');
if(!billInput||!billChoices||!spendPanel||!energyNext||!monthlyBand||!annualKwh)return;

injectStyles();
const readerPanel=createReaderPanel();

function injectStyles(){
  if($('#econBillReaderStyles'))return;
  const style=document.createElement('style');
  style.id='econBillReaderStyles';
  style.textContent=`
    .billReader{display:none;margin-top:12px;border:1px solid #cfe0c9;background:#f8fbf5;border-radius:18px;padding:16px 18px;color:#043d00}
    .billReader.show{display:block}.billReaderRow{display:flex;gap:12px;align-items:flex-start}.billReaderIcon{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:grid;place-items:center;background:#eaf5dc;font-weight:900}
    .billReaderTitle{font-size:15px;font-weight:850;line-height:1.25}.billReaderText{margin-top:4px;font-size:13px;line-height:1.45;color:#355c31}.billReaderProgress{height:4px;border-radius:999px;background:#dfead9;margin-top:12px;overflow:hidden}.billReaderProgress>i{display:block;height:100%;width:18%;background:#8dc63f;border-radius:999px;transition:width .25s ease}
    .billReaderMetrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.billReaderMetric{background:#fff;border:1px solid #dce8d7;border-radius:12px;padding:10px 12px}.billReaderMetric small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#5f755c;font-weight:750}.billReaderMetric strong{display:block;margin-top:2px;font-size:17px;color:#043d00}
    .billReaderActions{display:flex;gap:12px;align-items:center;margin-top:12px}.billReaderEdit{appearance:none;border:0;background:none;color:#043d00;text-decoration:underline;font:inherit;font-size:12px;font-weight:750;padding:0;cursor:pointer}.billReaderPrivacy{margin-left:auto;font-size:11px;color:#6b7e68}.billReader.success{background:#f2f9e9;border-color:#afd28e}.billReader.success .billReaderIcon{background:#8dc63f;color:#043d00}.billReader.warning{background:#fffaf0;border-color:#e6cf9c}.billReader.warning .billReaderIcon{background:#f5e6b9;color:#664d00}.billReader.error{background:#fff7f5;border-color:#e5c1b8}.billReader.error .billReaderIcon{background:#f2d9d3;color:#7a2918}
    .billReaderSpinner{width:14px;height:14px;border:2px solid #b7cdae;border-top-color:#043d00;border-radius:50%;animation:econBillSpin .8s linear infinite}@keyframes econBillSpin{to{transform:rotate(360deg)}}
    @media(max-width:640px){.billReaderMetrics{grid-template-columns:1fr}.billReaderActions{align-items:flex-start;flex-direction:column}.billReaderPrivacy{margin-left:0}}
  `;
  document.head.appendChild(style);
}

function createReaderPanel(){
  let panel=$('#billReader');
  if(panel)return panel;
  panel=document.createElement('div');
  panel.id='billReader';
  panel.className='billReader';
  panel.setAttribute('role','status');
  panel.setAttribute('aria-live','polite');
  panel.innerHTML='<div class="billReaderRow"><div class="billReaderIcon" id="billReaderIcon"></div><div><div class="billReaderTitle" id="billReaderTitle"></div><div class="billReaderText" id="billReaderText"></div></div></div><div class="billReaderProgress" id="billReaderProgress"><i></i></div><div class="billReaderMetrics" id="billReaderMetrics"></div><div class="billReaderActions" id="billReaderActions"></div>';
  (fileMeta||billInput).insertAdjacentElement('afterend',panel);
  return panel;
}

function setReader(mode,title,text,progress){
  readerPanel.className='billReader show '+mode;
  $('#billReaderIcon').innerHTML=mode==='loading'?'<span class="billReaderSpinner" aria-hidden="true"></span>':mode==='success'?'✓':mode==='warning'?'!':'×';
  $('#billReaderTitle').textContent=title||'';
  $('#billReaderText').textContent=text||'';
  const p=$('#billReaderProgress');
  p.style.display=mode==='loading'?'block':'none';
  if(mode==='loading')p.querySelector('i').style.width=Math.max(8,Math.min(100,progress||10))+'%';
  $('#billReaderMetrics').innerHTML='';
  $('#billReaderActions').innerHTML='';
}
function hideReader(){readerPanel.className='billReader';readerPanel.removeAttribute('data-result')}
function setEnergyStatus(message,type){
  const el=$('#energyHelp');if(!el)return;el.textContent=message||'';el.className='help'+(type?' '+type:'');
}
function showManual(show){spendPanel.classList.toggle('hidden',!show)}
function setNextBusy(busy){energyNext.disabled=!!busy;energyNext.textContent=busy?'LETTURA IN CORSO…':'CONTINUA'}
function removeAutofillOption(){monthlyBand.querySelectorAll('option[data-bill-auto="1"]').forEach(o=>o.remove())}
function clearAutofill(){
  if(annualKwh.dataset.billParsed==='1')annualKwh.value='';
  delete annualKwh.dataset.billParsed;
  removeAutofillOption();
  if(monthlyBand.dataset.billParsed==='1')monthlyBand.value='';
  delete monthlyBand.dataset.billParsed;
}

function fmtNumber(n,digits=0){return new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n)}
function fmtEuro(n){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n)}
function confidenceLabel(c){return c>=.9?'Alta':c>=.78?'Buona':'Stimata'}

function applyParsedResult(result){
  clearAutofill();
  if(result.annualKwh){
    annualKwh.value=String(Math.round(result.annualKwh));
    annualKwh.dataset.billParsed='1';
  }
  if(result.annualSpend){
    const monthly=Math.max(1,result.annualSpend/12);
    const option=document.createElement('option');
    option.value=monthly.toFixed(2);option.textContent='Da bolletta: '+fmtEuro(monthly)+'/mese';option.dataset.billAuto='1';
    monthlyBand.appendChild(option);monthlyBand.value=option.value;monthlyBand.dataset.billParsed='1';
  }
  showManual(false);
  setNextBusy(false);
  setEnergyStatus('Bolletta letta: puoi continuare senza inserire altri dati.','ok');
  setReader('success','Bolletta letta automaticamente','Ho ricavato i dati necessari alla stima. Non devi compilare i campi sotto.');
  const metrics=$('#billReaderMetrics');
  if(result.annualKwh)metrics.insertAdjacentHTML('beforeend','<div class="billReaderMetric"><small>Consumo annuo</small><strong>'+fmtNumber(Math.round(result.annualKwh))+' kWh</strong></div>');
  if(result.annualSpend)metrics.insertAdjacentHTML('beforeend','<div class="billReaderMetric"><small>Spesa annua</small><strong>'+fmtEuro(result.annualSpend)+'</strong></div>');
  metrics.insertAdjacentHTML('beforeend','<div class="billReaderMetric"><small>Affidabilità lettura</small><strong>'+confidenceLabel(result.confidence)+'</strong></div>');
  if(result.periodDays)metrics.insertAdjacentHTML('beforeend','<div class="billReaderMetric"><small>Periodo riconosciuto</small><strong>'+Math.round(result.periodDays)+' giorni</strong></div>');
  const actions=$('#billReaderActions');
  const edit=document.createElement('button');edit.type='button';edit.className='billReaderEdit';edit.textContent='Controlla o correggi i dati';
  edit.addEventListener('click',()=>{showManual(true);const note=$('#billAccuracyNote');if(note)note.textContent='I valori sono stati precompilati dalla bolletta. Modificali solo se non corrispondono ai dati del documento.';});
  actions.appendChild(edit);
  const privacy=document.createElement('span');privacy.className='billReaderPrivacy';privacy.textContent=readerPanel.dataset.localOnly==='1'?'Lettura locale · file non allegato':'Lettura automatica nel browser';actions.appendChild(privacy);
  readerPanel.dataset.result=JSON.stringify({version:VERSION,annualKwh:result.annualKwh||0,annualSpend:result.annualSpend||0,confidence:result.confidence,method:result.method});
  try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'bill_auto_read_success',bill_parse_method:result.method,bill_parse_confidence:result.confidence,annual_kwh:Math.round(result.annualKwh||0)});}catch(e){}
}

function applyParseFailure(reason){
  clearAutofill();showManual(true);setNextBusy(false);
  setReader('warning','Serve un dato di supporto',reason||'Non sono riuscito a ricavare con sufficiente affidabilità consumo o spesa dalla bolletta.');
  $('#billReaderText').textContent+=(reason?' ':'')+'Inserisci sotto la fascia di spesa oppure il consumo annuo.';
  const note=$('#billAccuracyNote');if(note)note.textContent='Compila solo uno dei due dati: serve come fallback quando la bolletta non è leggibile automaticamente.';
  setEnergyStatus('La bolletta è stata caricata, ma la lettura automatica non è sufficientemente affidabile.');
  try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'bill_auto_read_fallback'});}catch(e){}
}

function loadScript(src,id){
  if(id&&document.getElementById(id))return Promise.resolve();
  return new Promise((resolve,reject)=>{const s=document.createElement('script');if(id)s.id=id;s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('library_load_failed'));document.head.appendChild(s)});
}
async function ensurePdfJs(){
  if(window.pdfjsLib)return window.pdfjsLib;
  if(!pdfjsPromise)pdfjsPromise=loadScript(PDFJS_URL,'econPdfJs').then(()=>{if(!window.pdfjsLib)throw new Error('pdfjs_unavailable');window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;return window.pdfjsLib});
  return pdfjsPromise;
}
async function ensureTesseract(){
  if(window.Tesseract)return window.Tesseract;
  if(!tesseractPromise)tesseractPromise=loadScript(TESSERACT_URL,'econTesseract').then(()=>{if(!window.Tesseract)throw new Error('ocr_unavailable');return window.Tesseract});
  return tesseractPromise;
}

function normalizeText(text){return String(text||'').replace(/\u00a0/g,' ').replace(/[–—]/g,'-').replace(/[ \t]+/g,' ').replace(/\r/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function flatText(text){return normalizeText(text).replace(/\s+/g,' ')}
function parseLocaleNumber(raw){
  let s=String(raw||'').replace(/[^0-9,.-]/g,'').replace(/^-+/,'-');
  if(!s)return NaN;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){
    if(comma>dot)s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');
  }else if(comma>=0){
    const decimals=s.length-comma-1;s=decimals===1||decimals===2?s.replace(',','.'):s.replace(/,/g,'');
  }else if(dot>=0){
    const parts=s.split('.');if(parts.length>2||((parts[parts.length-1]||'').length===3&&parts[0].length<=3))s=parts.join('');
  }
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function inRange(n,min,max){return Number.isFinite(n)&&n>=min&&n<=max}
function uniqueNumbers(arr,tolerance=.01){const out=[];arr.forEach(n=>{if(Number.isFinite(n)&&!out.some(x=>Math.abs(x-n)<=Math.max(1,Math.abs(n)*tolerance)))out.push(n)});return out}
function collect(patterns,text,min,max){
  const values=[];patterns.forEach(re=>{re.lastIndex=0;let m;while((m=re.exec(text))){const n=parseLocaleNumber(m[1]);if(inRange(n,min,max))values.push(n);if(!re.global)break;}});return uniqueNumbers(values)
}
function parseDate(s){
  const m=String(s||'').match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(!m)return null;
  let y=Number(m[3]);if(y<100)y+=2000;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));return Number.isNaN(d.getTime())?null:d;
}
function findPeriodDays(text){
  const targeted=[
    /(?:periodo(?:\s+di)?\s+fatturazione|periodo\s+di\s+riferimento|consumi?\s+dal)[^0-9]{0,30}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s*(?:al|a|-)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/ig,
    /(?:dal\s+)(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s*(?:al|a|-)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/ig
  ];
  for(const re of targeted){let m;while((m=re.exec(text))){const a=parseDate(m[1]),b=parseDate(m[2]);if(a&&b){const days=Math.round((b-a)/86400000)+1;if(days>=15&&days<=370)return days}}}
  const explicit=text.match(/(?:periodo|fatturazione)[^0-9]{0,30}(\d{2,3})\s*giorni/i);if(explicit){const d=Number(explicit[1]);if(d>=15&&d<=370)return d}
  if(/\bbimestr(?:e|ale|ali)\b/i.test(text))return 61;
  if(/\btrimestr(?:e|ale|ali)\b/i.test(text))return 91;
  if(/\bmensile\b/i.test(text))return 30.44;
  return 0;
}
function sumBandsNearContext(text,contextPattern){
  const ctx=contextPattern.exec(text);if(!ctx)return 0;
  const start=Math.max(0,ctx.index-80),windowText=text.slice(start,Math.min(text.length,ctx.index+900));
  const vals={};
  for(const band of ['F1','F2','F3']){
    const re=new RegExp('\\b'+band+'\\b[^0-9]{0,40}([0-9][0-9\\s.,]{0,16})\\s*kwh','i');const m=windowText.match(re);if(m){const n=parseLocaleNumber(m[1]);if(inRange(n,10,200000))vals[band]=n}
  }
  return Object.keys(vals).length>=2?Object.values(vals).reduce((a,b)=>a+b,0):0;
}

function parseBillText(rawText){
  if(window.EconBillParser&&typeof window.EconBillParser.parseBillText==='function')return window.EconBillParser.parseBillText(rawText);
  const text=flatText(rawText);
  const annualKwhPatterns=[
    /(?:consum[oi])\s+(?:annuo|annui|annuale|annuali)(?:\s+(?:totale|complessivo|di\s+energia))?[^0-9]{0,90}([0-9][0-9\s.,]{1,18})\s*kwh/ig,
    /(?:consum[oi])[^.]{0,100}(?:ultimi|precedenti)\s+12\s+mesi[^0-9]{0,60}([0-9][0-9\s.,]{1,18})\s*kwh/ig,
    /(?:ultimi|precedenti)\s+12\s+mesi[^.]{0,120}(?:consum[oi])[^0-9]{0,50}([0-9][0-9\s.,]{1,18})\s*kwh/ig,
    /(?:energia\s+consumata|prelevata)\s+(?:annua|annuale)[^0-9]{0,70}([0-9][0-9\s.,]{1,18})\s*kwh/ig
  ];
  const annualValues=[];
  annualKwhPatterns.forEach(re=>{re.lastIndex=0;let m;while((m=re.exec(text))){if(/\bF[123]\b/i.test(m[0]))continue;const n=parseLocaleNumber(m[1]);if(inRange(n,100,500000))annualValues.push(n)}});
  let annualKwh=uniqueNumbers(annualValues)[0]||0;
  let kwhMethod=annualKwh?'EXPLICIT_ANNUAL_KWH':'';let kwhConfidence=annualKwh?.98:0;
  if(!annualKwh){
    const bandSum=sumBandsNearContext(text,/(?:consum[oi]\s+(?:annuo|annuale)|ultimi\s+12\s+mesi)/i);
    if(inRange(bandSum,100,500000)){annualKwh=bandSum;kwhMethod='ANNUAL_F1_F2_F3_SUM';kwhConfidence=.94}
  }

  const annualSpendPatterns=[
    /(?:spesa|costo)\s+(?:annua|annuo|annuale)(?:\s+(?:sostenuta|stimata|complessiva))?[^€0-9]{0,100}(?:€\s*)?([0-9][0-9\s.,]{1,18})\s*(?:€|euro)?/ig,
    /(?:spesa\s+complessiva\s+annua)[^€0-9]{0,80}(?:€\s*)?([0-9][0-9\s.,]{1,18})/ig
  ];
  let annualSpend=collect(annualSpendPatterns,text,100,100000)[0]||0;
  let spendMethod=annualSpend?'EXPLICIT_ANNUAL_SPEND':'';let spendConfidence=annualSpend?.9:0;

  const periodDays=findPeriodDays(text);
  if(!annualKwh&&periodDays){
    const periodKwhPatterns=[
      /(?:consumo|consumi)(?:\s+di\s+energia)?\s+(?:nel|del)\s+periodo[^0-9]{0,90}([0-9][0-9\s.,]{1,18})\s*kwh/ig,
      /(?:energia\s+(?:attiva\s+)?fatturata|consumo\s+fatturato)[^0-9]{0,90}([0-9][0-9\s.,]{1,18})\s*kwh/ig,
      /(?:totale\s+(?:energia|consumo|consumi))[^0-9]{0,70}([0-9][0-9\s.,]{1,18})\s*kwh/ig
    ];
    const periodKwh=collect(periodKwhPatterns,text,20,300000)[0]||0;
    if(periodKwh){annualKwh=periodKwh*365/periodDays;kwhMethod='ANNUALIZED_PERIOD_KWH';kwhConfidence=periodDays>=25&&periodDays<=100?.80:.72}
    else{
      const bandSum=sumBandsNearContext(text,/(?:consumo|consumi).{0,30}(?:periodo|fatturat)/i);
      if(inRange(bandSum,20,300000)){annualKwh=bandSum*365/periodDays;kwhMethod='ANNUALIZED_PERIOD_F1_F2_F3';kwhConfidence=.76}
    }
  }

  if(!annualSpend&&periodDays){
    const amountPatterns=[
      /(?:totale\s+da\s+pagare|importo\s+(?:totale\s+)?da\s+pagare|totale\s+bolletta|totale\s+documento)[^€0-9]{0,55}(?:€\s*)?([0-9][0-9\s.,]{1,18})\s*(?:€|euro)?/ig,
      /(?:€\s*)([0-9][0-9\s.,]{1,18})[^.]{0,35}(?:totale\s+da\s+pagare)/ig
    ];
    const billAmount=collect(amountPatterns,text,5,50000)[0]||0;
    if(billAmount){annualSpend=billAmount*365/periodDays;spendMethod='ANNUALIZED_BILL_AMOUNT';spendConfidence=periodDays>=25&&periodDays<=100?.76:.68}
  }

  if(annualKwh)annualKwh=Math.round(annualKwh);
  if(annualSpend)annualSpend=Math.round(annualSpend*100)/100;
  const bestConfidence=Math.max(kwhConfidence,spendConfidence);
  const usable=(inRange(annualKwh,100,500000)&&kwhConfidence>=MIN_CONFIDENCE)||(inRange(annualSpend,100,100000)&&spendConfidence>=MIN_CONFIDENCE);
  return{usable,annualKwh:annualKwh||0,annualSpend:annualSpend||0,periodDays:periodDays||0,confidence:bestConfidence,method:[kwhMethod,spendMethod].filter(Boolean).join('+')||'NO_RELIABLE_DATA',kwhConfidence,spendConfidence};
}

async function extractPdfText(file,generation){
  const pdfjs=await ensurePdfJs();if(generation!==parseGeneration)throw new Error('cancelled');
  setReader('loading','Sto leggendo la bolletta','Analisi del testo del PDF…',24);
  const data=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjs.getDocument({data,useSystemFonts:true}).promise;
  const pages=Math.min(pdf.numPages,MAX_TEXT_PAGES),parts=[];
  for(let i=1;i<=pages;i++){
    if(generation!==parseGeneration)throw new Error('cancelled');
    setReader('loading','Sto leggendo la bolletta','Analisi pagina '+i+' di '+pages+'…',24+Math.round(30*i/pages));
    const page=await pdf.getPage(i),content=await page.getTextContent();
    let line='';for(const item of content.items){line+=String(item.str||'')+(item.hasEOL?'\n':' ')}parts.push(line);
  }
  return{pdf,text:parts.join('\n')};
}
async function ocrSource(source,progressBase,progressSpan,generation,label){
  const T=await ensureTesseract();if(generation!==parseGeneration)throw new Error('cancelled');
  const logger=m=>{if(generation!==parseGeneration)return;if(m&&m.status==='recognizing text'&&Number.isFinite(m.progress))setReader('loading','Sto leggendo la bolletta',label||'Riconoscimento testo…',progressBase+Math.round(progressSpan*m.progress))};
  try{return (await T.recognize(source,'ita',{logger})).data.text||''}catch(e){return (await T.recognize(source,'eng',{logger})).data.text||''}
}
async function extractPdfWithOcr(pdf,generation){
  const pages=Math.min(pdf.numPages,MAX_OCR_PAGES),parts=[];
  for(let i=1;i<=pages;i++){
    if(generation!==parseGeneration)throw new Error('cancelled');
    const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.65});
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    const base=55+Math.round((i-1)*(40/pages)),span=Math.max(6,Math.round(40/pages));
    parts.push(await ocrSource(canvas,base,span,generation,'OCR pagina '+i+' di '+pages+'…'));
    const partial=parseBillText(parts.join('\n'));if(partial.usable&&partial.confidence>=.88)break;
  }
  return parts.join('\n');
}
async function parseFile(file,generation){
  if(file.type==='application/pdf'){
    const extracted=await extractPdfText(file,generation);let result=parseBillText(extracted.text);
    if(result.usable)return result;
    setReader('loading','Il PDF è un’immagine','Avvio il riconoscimento OCR. Può richiedere qualche secondo…',55);
    const ocrText=await extractPdfWithOcr(extracted.pdf,generation);result=parseBillText(extracted.text+'\n'+ocrText);return result;
  }
  setReader('loading','Sto leggendo la foto','Avvio il riconoscimento OCR…',18);
  const url=URL.createObjectURL(file);try{return parseBillText(await ocrSource(url,20,72,generation,'Riconoscimento della bolletta…'))}finally{URL.revokeObjectURL(url)}
}

async function handleFile(file){
  const generation=++parseGeneration;clearAutofill();showManual(false);setNextBusy(true);
  setEnergyStatus('Lettura automatica della bolletta in corso…','ok');
  setReader('loading','Sto leggendo la bolletta','Cerco consumo annuo, periodo e importi utili alla stima…',10);
  try{
    const result=await parseFile(file,generation);if(generation!==parseGeneration)return;
    if(result.usable)applyParsedResult(result);else applyParseFailure('Il documento è leggibile, ma non contiene un consumo o una spesa annualizzabile con sufficiente certezza.');
  }catch(err){
    if(generation!==parseGeneration||String(err&&err.message)==='cancelled')return;
    applyParseFailure('La lettura automatica non è riuscita'+(navigator.onLine?'':' perché il dispositivo risulta offline')+'.');
  }
}

billChoices.addEventListener('click',e=>{
  const btn=e.target.closest('.choice');if(!btn)return;
  const v=btn.dataset.value;
  if(v==='upload'){
    clearAutofill();showManual(false);hideReader();setNextBusy(false);
    const note=$('#billAccuracyNote');if(note)note.textContent='Se la lettura automatica non riesce, questi campi compariranno come fallback.';
  }else if(v==='manual'){
    ++parseGeneration;clearAutofill();hideReader();showManual(true);setNextBusy(false);
  }
});

billInput.addEventListener('change',()=>{
  const f=billInput.files&&billInput.files[0];if(!f)return;
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!allowed.includes(f.type)||f.size>20*1024*1024)return;
  readerPanel.dataset.localOnly=f.size>7.5*1024*1024?'1':'0';
  handleFile(f);
});

if(removeBill)removeBill.addEventListener('click',()=>{++parseGeneration;clearAutofill();hideReader();showManual(false);setNextBusy(false)});

annualKwh.addEventListener('input',()=>{if(annualKwh.dataset.billParsed==='1')delete annualKwh.dataset.billParsed});
monthlyBand.addEventListener('change',()=>{if(monthlyBand.dataset.billParsed==='1'&&!monthlyBand.selectedOptions[0]?.dataset.billAuto)delete monthlyBand.dataset.billParsed});

window.ECON_BILL_READER={version:VERSION,parseText:parseBillText};
})();
