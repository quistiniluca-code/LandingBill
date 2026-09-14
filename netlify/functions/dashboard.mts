import { getStore } from "@netlify/blobs";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c] || c));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function cookieValue(req: Request, name: string): string {
  const cookies = req.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

function nfmt(n: number): string {
  return new Intl.NumberFormat("it-IT").format(n || 0);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - Math.max(0, days - 1));
  return isoDay(d);
}

function loginPage(message = ""): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>ECON Dashboard</title><style>
  :root{--g:#043d00;--l:#8dc63f;--s:#f3faec;--m:#617158}*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f7faf5;color:#102410;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.box{width:min(100%,420px);background:#fff;border:1px solid rgba(4,61,0,.14);border-radius:24px;padding:28px;box-shadow:0 16px 46px rgba(4,61,0,.09)}h1{color:var(--g);margin:0 0 8px;font-size:30px}.sub{color:var(--m);line-height:1.45;margin-bottom:22px}input{width:100%;min-height:52px;border:1px solid rgba(4,61,0,.25);border-radius:14px;padding:12px 14px;font-size:16px}button{width:100%;margin-top:12px;min-height:52px;border:0;border-radius:14px;background:var(--l);color:var(--g);font-weight:800;font-size:16px}.err{color:#a13622;font-size:13px;margin:8px 0}</style></head><body><form class="box" method="post"><h1>ECON Dashboard</h1><div class="sub">Conversioni della landing, dati first-party.</div>${message ? `<div class="err">${escapeHtml(message)}</div>` : ""}<input type="password" name="key" autocomplete="current-password" placeholder="Chiave dashboard" required><button type="submit">ACCEDI</button></form></body></html>`;
}

function layout(body: string, days: number): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>ECON · Dashboard conversioni</title><style>
  :root{--g:#043d00;--l:#8dc63f;--s:#f3faec;--ink:#102410;--mut:#617158;--line:rgba(4,61,0,.13)}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#f8faf7;color:var(--ink)}main{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:26px 0 50px}header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:20px}h1{margin:0;color:var(--g);font-size:clamp(28px,4vw,42px)}.sub{color:var(--mut);margin-top:5px}.tabs{display:flex;gap:7px;flex-wrap:wrap}.tabs a{padding:9px 12px;border-radius:999px;border:1px solid var(--line);color:var(--g);text-decoration:none;font-weight:700;font-size:13px;background:#fff}.tabs a.active{background:var(--g);color:#fff}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpi,.panel{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 9px 28px rgba(4,61,0,.05)}.kpi{padding:17px}.kpi small{display:block;color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}.kpi strong{display:block;color:var(--g);font-size:31px;margin-top:7px;letter-spacing:-.04em}.kpi span{font-size:12px;color:var(--mut)}.panels{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-top:12px}.panel{padding:18px;overflow:auto}.panel h2{font-size:17px;color:var(--g);margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px 7px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mut);font-size:11px;text-transform:uppercase}.bar{height:8px;border-radius:999px;background:#e9f2e4;overflow:hidden;min-width:90px}.bar i{display:block;height:100%;background:var(--l)}.note{margin-top:13px;font-size:11px;line-height:1.4;color:var(--mut)}@media(max-width:800px){header{display:block}.tabs{margin-top:14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.panels{grid-template-columns:1fr}}@media(max-width:470px){.grid{grid-template-columns:1fr}.kpi strong{font-size:28px}}</style></head><body><main><header><div><h1>Dashboard conversioni</h1><div class="sub">ECON · ultimi ${days} giorni · analytics first-party</div></div><nav class="tabs"><a href="/dashboard?days=7" class="${days===7?"active":""}">7 giorni</a><a href="/dashboard?days=30" class="${days===30?"active":""}">30 giorni</a><a href="/dashboard?days=90" class="${days===90?"active":""}">90 giorni</a></nav></header>${body}</main></body></html>`;
}

export default async (req: Request) => {
  const secret = Netlify.env.get("ECON_DASHBOARD_KEY") || "";
  if (!secret) return new Response("Dashboard key missing", { status: 503 });
  const expected = await sha256(secret);
  const authenticated = cookieValue(req, "econ_dashboard") === expected;

  if (req.method === "POST") {
    const form = await req.formData();
    const supplied = String(form.get("key") || "");
    if (supplied !== secret) return new Response(loginPage("Chiave non valida."), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response(null, { status: 303, headers: { location: "/dashboard", "set-cookie": `econ_dashboard=${expected}; Path=/dashboard; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` } });
  }

  if (!authenticated) return new Response(loginPage(), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });

  const url = new URL(req.url);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = [7,30,90].includes(requestedDays) ? requestedDays : 30;
  const startDay = daysAgo(days);

  const store = getStore("econ-funnel-events");
  const { blobs } = await store.list({ prefix: "events/" });
  const relevant = blobs.filter(({ key }) => {
    const day = key.slice("events/".length, "events/".length + 10);
    return day >= startDay;
  }).slice(-12000);

  const events: any[] = [];
  for (let i = 0; i < relevant.length; i += 30) {
    const batch = relevant.slice(i, i + 30);
    const rows = await Promise.all(batch.map(async ({ key }) => {
      try { return await store.get(key, { type: "json" }); } catch { return null; }
    }));
    rows.forEach(row => { if (row && row.deploy_context === "production") events.push(row); });
  }

  const sessionsFor = (name: string, predicate?: (e:any)=>boolean) => new Set(events.filter(e => e.event_name === name && (!predicate || predicate(e))).map(e => e.session_id)).size;
  const pageviews = sessionsFor("page_view");
  const starts = sessionsFor("savings_started");
  const bills = sessionsFor("energy_data_available");
  const parsed = sessionsFor("bill_auto_read_success");
  const results = sessionsFor("savings_estimate_viewed");
  const fvYes = sessionsFor("fv_intent_selected", e => e.payload?.value === "YES");
  const billOnly = sessionsFor("fv_intent_selected", e => e.payload?.value === "NO_BILL_SWITCH");
  const contacts = sessionsFor("contact_preference_saved", e => e.payload?.preference !== "NONE");

  const stages = [
    ["Visite",pageviews,pageviews],
    ["Avvio verifica",starts,pageviews],
    ["Dati energia disponibili",bills,starts],
    ["Risultato visto",results,starts],
    ["Interesse FV",fvYes,results],
    ["Solo cambio bolletta",billOnly,results],
    ["Contatto richiesto",contacts,results]
  ];

  const byDay = new Map<string, any>();
  for (const e of events) {
    const day = String(e.ts || e.received_at || "").slice(0,10);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day,{day,sessions:new Set(),starts:new Set(),results:new Set(),contacts:new Set()});
    const r=byDay.get(day); r.sessions.add(e.session_id);
    if(e.event_name==="savings_started")r.starts.add(e.session_id);
    if(e.event_name==="savings_estimate_viewed")r.results.add(e.session_id);
    if(e.event_name==="contact_preference_saved"&&e.payload?.preference!=="NONE")r.contacts.add(e.session_id);
  }
  const dayRows=[...byDay.values()].sort((a,b)=>b.day.localeCompare(a.day)).slice(0,days);

  const sources = new Map<string, Set<string>>();
  events.filter(e=>e.event_name==="page_view").forEach(e=>{const src=e.utm_source||e.source||"direct";if(!sources.has(src))sources.set(src,new Set());sources.get(src)!.add(e.session_id)});
  const sourceRows=[...sources.entries()].map(([source,set])=>[source,set.size]).sort((a:any,b:any)=>b[1]-a[1]).slice(0,12) as [string,number][];

  const body = `<div class="grid">
    <div class="kpi"><small>Start rate</small><strong>${pct(starts,pageviews)}</strong><span>${nfmt(starts)} avvii su ${nfmt(pageviews)} visite</span></div>
    <div class="kpi"><small>Completion rate</small><strong>${pct(results,starts)}</strong><span>${nfmt(results)} risultati su ${nfmt(starts)} avvii</span></div>
    <div class="kpi"><small>Interesse FV</small><strong>${pct(fvYes,results)}</strong><span>${nfmt(fvYes)} utenti interessati</span></div>
    <div class="kpi"><small>Lead rate</small><strong>${pct(contacts,results)}</strong><span>${nfmt(contacts)} richieste di contatto</span></div>
  </div>
  <div class="panels"><section class="panel"><h2>Funnel</h2><table><thead><tr><th>Passaggio</th><th>Utenti</th><th>Tasso</th><th></th></tr></thead><tbody>${stages.map(([label,value,den]:any)=>`<tr><td>${escapeHtml(label)}</td><td>${nfmt(value)}</td><td>${pct(value,den)}</td><td><div class="bar"><i style="width:${den?Math.min(100,Math.round(value/den*100)):0}%"></i></div></td></tr>`).join("")}</tbody></table><div class="note">“Solo cambio bolletta” identifica chi non vuole approfondire il FV ma resta commercialmente attivabile sulla fornitura.</div></section>
  <section class="panel"><h2>Origine visite</h2><table><thead><tr><th>Sorgente</th><th>Sessioni</th></tr></thead><tbody>${sourceRows.length?sourceRows.map(([s,n])=>`<tr><td>${escapeHtml(s)}</td><td>${nfmt(n)}</td></tr>`).join(""):`<tr><td colspan="2">Nessun dato nel periodo.</td></tr>`}</tbody></table></section></div>
  <section class="panel" style="margin-top:12px"><h2>Andamento giornaliero</h2><table><thead><tr><th>Giorno</th><th>Sessioni</th><th>Avvii</th><th>Risultati</th><th>Contatti</th></tr></thead><tbody>${dayRows.length?dayRows.map(r=>`<tr><td>${r.day}</td><td>${nfmt(r.sessions.size)}</td><td>${nfmt(r.starts.size)}</td><td>${nfmt(r.results.size)}</td><td>${nfmt(r.contacts.size)}</td></tr>`).join(""):`<tr><td colspan="5">La raccolta first-party è appena stata attivata: i KPI compariranno con le nuove visite.</td></tr>`}</tbody></table><div class="note">Eventi memorizzati: ${nfmt(events.length)}. Nessun dato personale viene mostrato in questa dashboard.</div></section>`;

  return new Response(layout(body,days), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config = {
  path: "/dashboard"
};
