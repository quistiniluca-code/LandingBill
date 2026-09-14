from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

def must(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {n}')
    s=s.replace(old,new,1)

must(
"function eventPost(d){if(PREVIEW)return;try{fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:encode(d),keepalive:true}).catch(()=>{})}catch(e){}}",
"function eventPost(d){if(PREVIEW)return;try{let payload={};try{payload=typeof d.payload==='string'?JSON.parse(d.payload):d.payload||{}}catch(e){};fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,payload}),keepalive:true}).catch(()=>{})}catch(e){}}",
'first-party event endpoint')

must(
"function track(name,payload={}){try{eventPost({'form-name':'econ-events-v2','bot_field':'',event_name:name,session_id:sessionId,ts:new Date().toISOString(),source:attr.source,format:attr.format,wave:attr.wave,cluster:attr.cluster,point:attr.point,utm_source:attr.utm_source,utm_medium:attr.utm_medium,utm_campaign:attr.utm_campaign,step:String(state.screen),payload:JSON.stringify(payload)});window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,...payload})}catch(e){}}",
"function track(name,payload={}){try{eventPost({event_name:name,session_id:sessionId,ts:new Date().toISOString(),source:attr.source,format:attr.format,wave:attr.wave,cluster:attr.cluster,point:attr.point,utm_source:attr.utm_source,utm_medium:attr.utm_medium,utm_campaign:attr.utm_campaign,step:String(state.screen),payload});window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,...payload})}catch(e){}}\nwindow.ECON_TRACK=track;",
'expose ECON track')

if '<link rel="canonical" href="https://verifica.econ-apex.com/">' not in s:
    must('<meta name="theme-color" content="#043D00">','<meta name="theme-color" content="#043D00">\n<link rel="canonical" href="https://verifica.econ-apex.com/">','canonical domain')

for token in ["fetch('/api/track'","window.ECON_TRACK=track","https://verifica.econ-apex.com/"]:
    if token not in s:
        raise SystemExit(f'missing analytics/domain token: {token}')
p.write_text(s,encoding='utf-8')
