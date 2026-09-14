from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old="async function postEncoded(d){if(PREVIEW){await new Promise(r=>setTimeout(r,120));return true}const res=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:encode(d)});if(!res.ok)throw new Error('post_failed');return res}"
new="async function postEncoded(d){if(PREVIEW){await new Promise(r=>setTimeout(r,120));return true}if(d&&d['form-name']==='econ-intake-v2'&&window.ECON_DATA){try{return await window.ECON_DATA.saveIntake(d)}catch(e){}}const res=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:encode(d)});if(!res.ok)throw new Error('post_failed');return res}"
if s.count(old)!=1: raise SystemExit(f'postEncoded anchor count {s.count(old)}')
s=s.replace(old,new,1)

old_upload="track('bill_file_uploaded',{type:f.type,size:f.size})});"
new_upload="track('bill_file_uploaded',{type:f.type,size:f.size});if(window.ECON_DATA)window.ECON_DATA.uploadBill(f).catch(()=>{})});"
if s.count(old_upload)!=1: raise SystemExit(f'upload anchor count {s.count(old_upload)}')
s=s.replace(old_upload,new_upload,1)

pattern=r"async function saveOutcome\(preference\)\{.*?\}\nfunction waLink\(\)"
replacement="""async function saveOutcome(preference){state.contactPreference=preference;if(PREVIEW){await new Promise(r=>setTimeout(r,110));return}const d=intakeData(),r=state.result||{};const pairs={'form-name':'econ-outcome-v2',bot_field:'',session_id:sessionId,completed_at:new Date().toISOString(),...commonMeta(),street:d.street,civic:d.civic,municipality:d.municipality,province:d.province,phone:d.phone,profile_type:state.profileType,owner_status:state.ownerStatus,pv_existing:state.pvExisting,bill_path:state.billPath,bill_file_uploaded:String(state.billFileUploaded),annual_kwh:String(Math.round(r.annualKwh||state.annualKwh||0)),annual_spend:String(Math.round(r.annualSpend||state.annualSpend||0)),data_quality:state.dataQuality,purchase_saving_low:String(Math.round(r.purchaseLow||0)),purchase_saving_high:String(Math.round(r.purchaseHigh||0)),pv_saving_low:String(Math.round(r.pvLow||0)),pv_saving_high:String(Math.round(r.pvHigh||0)),total_saving_low:String(Math.round(r.totalLow||0)),total_saving_high:String(Math.round(r.totalHigh||0)),calculation_version:CONFIG.calculationVersion,benchmark_version:CONFIG.benchmarkVersion,lead_type:r.leadType||'NURTURE',fv_intent:state.fvIntent,contact_preference:preference};if(window.ECON_DATA){try{await window.ECON_DATA.saveOutcome(pairs);return}catch(e){}}const fd=new FormData();Object.entries(pairs).forEach(([k,v])=>fd.append(k,v));const f=$('#bill').files[0];if(f&&f.size<=7.5*1024*1024)fd.append('bolletta',f,f.name);const res=await fetch('/',{method:'POST',body:fd});if(!res.ok)throw new Error('outcome_failed')}
function waLink()"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'saveOutcome anchor count {n}')

script_anchor='<script src="/bill-parser-core.js?v=20260910-2"></script>'
script_new='<script src="/data-layer.js?v=20260914-1"></script>\n<script src="/bill-parser-core.js?v=20260910-2"></script>'
if s.count(script_anchor)!=1: raise SystemExit(f'script anchor count {s.count(script_anchor)}')
s=s.replace(script_anchor,script_new,1)

# Bump the bill reader cache token so the durable-storage copy is served immediately.
s=s.replace('<script src="/bill-reader.js?v=20260910-2"></script>','<script src="/bill-reader.js?v=20260914-1"></script>',1)

required=[
    "window.ECON_DATA.saveIntake(d)",
    "window.ECON_DATA.uploadBill(f)",
    "window.ECON_DATA.saveOutcome(pairs)",
    '/data-layer.js?v=20260914-1'
]
for token in required:
    if token not in s: raise SystemExit(f'missing token: {token}')

p.write_text(s,encoding='utf-8')
