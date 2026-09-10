const assert=require('assert');
const parser=require('../bill-parser-core.v2.js');

const cases=[
  {name:'Sorgenia direct annual',text:'Periodo di fatturazione Luglio 2026. Consumo totale del periodo fatturato 850,4 kWh. CONSUMO ANNUO 5.107,5 kWh. PERIODO CONSUMO ANNUO da Agosto 2025 a Luglio 2026. TOTALE SPESA ANNUA: 1.567,57 €',kwh:5107.5,spend:1567.57},
  {name:'Hera annual after date range',text:'Periodo oggetto di fatturazione: dal 01.03.2026 al 30.04.2026. Consumo totale fatturato del periodo: 228,868 kWh. Consumo annuo aggiornato al seguente periodo: dal 01.05.2025 al 30.04.2026 1.276,36 kWh. Totale spesa annua dal 30.04.2025 al 30.04.2026: 419,30 €',kwh:1276.36,spend:419.30},
  {name:'EON OCR wording',text:'Periodo di fatturazione 01 luglio 2025 - 31 luglio 2025. Consumo totale fatturato 431,63 kWh. Il tuo consumo annuo aggiornato 5.119,42 kWh. Periodo di riferimento 01 agosto 2024 - 31 luglio 2025',kwh:5119.42},
  {name:'Dolomiti unit before value',text:'Periodo oggetto di fatturazione: 1 agosto 2025 - 30 settembre 2025. Consumo totale fatturato: 337 kWh. Consumo annuo (kWh): 2.016,48 fino al 30/09/2025. SPESA ANNUA SOSTENUTA 101,89 € 01/08/25-20/10/25',kwh:2016.48,spend:0},
  {name:'Octopus annual after reference period',text:'PERIODO DI RIFERIMENTO: dal 01/08/2025 al 31/08/2025. CONSUMO FATTURATO: 210 kWh. CONSUMO ANNUO: Periodo di riferimento considerato da 01/09/2024 a 31/08/2025: 2695 kWh. SPESA ANNUA: Periodo di riferimento considerato da 01/09/2024 a 31/08/2025: 962,05 €',kwh:2695,spend:962.05},
  {name:'Cogeme OCR rounded large annual',text:'Periodo fatturato: 01/10/2025 - 31/10/2025. Consumo fatturato: 9.503,21 kWh. Consumo annuo aggiornato: 136.044 kWh (dal 01/11/2024 al 31/10/2025)',kwh:136044},
  {name:'Plenitude in one year wording',text:'Periodo di fatturazione: dal 01/01/2026 al 28/02/2026. Consumo totale fatturato del periodo 2566 kWh. In un anno hai consumato 10.000 kWh (dal 01/07/2025 al 28/02/2026). Totale da pagare 595,49 €',kwh:10000,spend:0},
];

for(const tc of cases){
  const r=parser.parseBillText(tc.text);
  assert.equal(r.usable,true,tc.name+' should be usable');
  assert.ok(Math.abs(r.annualKwh-tc.kwh)<=Math.max(.01,tc.kwh*.001),`${tc.name}: expected kWh ${tc.kwh}, got ${r.annualKwh}`);
  if('spend' in tc)assert.ok(Math.abs(r.annualSpend-tc.spend)<=.01,`${tc.name}: expected spend ${tc.spend}, got ${r.annualSpend}`);
  assert.ok(r.kwhConfidence>=.9,tc.name+' should use an explicit annual value');
}

// Guardrail: monthly tariff-index wording must not be mistaken for invoice periodicity.
const noPeriod=parser.parseBillText('Periodicità di aggiornamento dell’indice: Mensile. Consumo fatturato 500 kWh. Totale bolletta 150 €');
assert.equal(noPeriod.periodDays,0);
assert.equal(noPeriod.annualKwh,0);
assert.equal(noPeriod.usable,false);

// Guardrail: a partial-period amount labelled "spesa annua sostenuta" is not a 12-month spend.
const partialSpend=parser.parseBillText('SPESA ANNUA SOSTENUTA 101,89 € 01/08/25-20/10/25');
assert.equal(partialSpend.annualSpend,0);
assert.equal(partialSpend.usable,false);

console.log(`bill-parser corpus: ${cases.length+2}/${cases.length+2} tests passed`);
