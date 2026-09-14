/* ECON durable data layer
 * Postgres stores structured lead/verification data.
 * Netlify Blobs stores original bills in 3 MB chunks with SHA-256 integrity.
 * Existing Netlify Forms remain available as fallback from the landing.
 */
(function(){
'use strict';

const CHUNK_SIZE=3*1024*1024;
const MAX_FILE=20*1024*1024;
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const storage={get(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}};
const uuid=()=>{try{return crypto.randomUUID()}catch(e){return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2)}};
const sessionId=storage.get('econ_savings_session')||uuid();
storage.set('econ_savings_session',sessionId);
const verificationKey='econ_verification_id_'+sessionId;
const verificationId=storage.get(verificationKey)||uuid();
storage.set(verificationKey,verificationId);
let documentState=null;
let uploadPromise=null;

function track(name,payload={}){try{if(typeof window.ECON_TRACK==='function')window.ECON_TRACK(name,payload)}catch(e){}}
async function jsonPost(url,payload){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true});
  if(!res.ok)throw new Error(url+'_'+res.status);
  return res.json().catch(()=>({ok:true}));
}
async function sha256(file){
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function saveIntake(data){
  const payload={...data,session_id:data.session_id||sessionId};
  delete payload['form-name'];delete payload.bot_field;
  const result=await jsonPost('/api/intake',payload);
  track('data_db_saved',{record:'intake'});
  return result;
}

async function saveOutcome(data){
  const payload={...data,session_id:data.session_id||sessionId,verification_id:verificationId,document_id:documentState&&documentState.status==='archived'?documentState.document_id:''};
  delete payload['form-name'];delete payload.bot_field;
  const result=await jsonPost('/api/outcome',payload);
  track('data_db_saved',{record:'outcome'});
  return result;
}

async function uploadBill(file){
  if(!file||!ALLOWED.has(file.type)||file.size<1||file.size>MAX_FILE)return null;
  const fingerprint=[file.name,file.size,file.lastModified,file.type].join('|');
  if(documentState&&documentState.fingerprint===fingerprint&&documentState.status==='archived')return documentState;
  if(uploadPromise&&documentState&&documentState.fingerprint===fingerprint)return uploadPromise;

  const documentId=uuid();
  documentState={document_id:documentId,fingerprint,status:'uploading',size:file.size};
  uploadPromise=(async()=>{
    try{
      track('bill_document_archive_started',{size:file.size,type:file.type});
      const hash=await sha256(file);
      const count=Math.ceil(file.size/CHUNK_SIZE);
      for(let i=0;i<count;i++){
        const chunk=file.slice(i*CHUNK_SIZE,Math.min(file.size,(i+1)*CHUNK_SIZE));
        const res=await fetch('/api/document-chunk',{
          method:'POST',body:chunk,
          headers:{
            'content-type':'application/octet-stream',
            'x-econ-session':sessionId,
            'x-econ-document':documentId,
            'x-econ-chunk-index':String(i),
            'x-econ-chunk-count':String(count)
          }
        });
        if(!res.ok)throw new Error('chunk_'+i+'_'+res.status);
      }
      await jsonPost('/api/document-finalize',{
        session_id:sessionId,verification_id:verificationId,document_id:documentId,
        original_name:file.name,mime_type:file.type,size_bytes:file.size,sha256:hash,chunk_count:count
      });
      documentState={...documentState,status:'archived',sha256:hash,chunk_count:count};
      track('bill_document_archived',{size:file.size,type:file.type,chunks:count});
      return documentState;
    }catch(error){
      documentState={...documentState,status:'failed'};
      track('bill_document_archive_failed',{size:file.size,type:file.type});
      throw error;
    }finally{uploadPromise=null}
  })();
  return uploadPromise;
}

function currentDocumentId(){return documentState&&documentState.status==='archived'?documentState.document_id:''}
function currentVerificationId(){return verificationId}

window.ECON_DATA={saveIntake,saveOutcome,uploadBill,documentId:currentDocumentId,verificationId:currentVerificationId};
})();
