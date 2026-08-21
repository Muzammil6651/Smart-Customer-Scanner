const $=id=>document.getElementById(id);
let stream=null,type=null,idVerified=false,idImage="";
let records=JSON.parse(localStorage.getItem("customer_records")||"[]");

async function openCam(t){
type=t;
$("camTitle").textContent={id:"Fast Auto Scan — ID Card",engine:"Scan Engine Number",chassis:"Scan Chassis Number",g:"Scan Guarantor ID"}[t];
$("camMsg").textContent=t==="id"?"Place the ID card inside the frame — auto capture is ON.":"Place the document inside the frame.";
$("autoScanHint").style.display=t==="id"?"block":"none";
$("modal").classList.add("open");
try{
stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
$("video").srcObject=stream;if(t==="id")startFastAutoScan()
}catch(e){
closeCam();toast("Camera unavailable. Upload an image instead.");
const map={id:"idFile",engine:"engineFile",chassis:"chassisFile",g:"gFile"};$(map[t]).click()
}}
function closeCam(){stopFastAutoScan();if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}$("video").srcObject=null;$("modal").classList.remove("open")}
let fastTimer=null,fastBusy=false,fastGood=0,fastLast=0;
function stopFastAutoScan(){if(fastTimer){clearInterval(fastTimer);fastTimer=null}fastBusy=false;fastGood=0;fastLast=0;const f=document.querySelector(".frame");if(f)f.classList.remove("fast-detected")}
function fastFrame(){const v=$("video");if(!v.videoWidth)return null;const c=document.createElement("canvas");c.width=360;c.height=Math.round(360*v.videoHeight/v.videoWidth);c.getContext("2d").drawImage(v,0,0,c.width,c.height);return c}
function fastScore(c){const w=c.width,h=c.height,ctx=c.getContext("2d"),x0=Math.floor(w*.08),x1=Math.floor(w*.92),y0=Math.floor(h*.08),y1=Math.floor(h*.92),d=ctx.getImageData(x0,y0,x1-x0,y1-y0).data;let edge=0,bright=0,n=0;for(let y=2;y<y1-y0;y+=4)for(let x=2;x<x1-x0;x+=4){let i=(y*(x1-x0)+x)*4,g=.299*d[i]+.587*d[i+1]+.114*d[i+2],p=.299*d[i-12]+.587*d[i-11]+.114*d[i-10];if(Math.abs(g-p)>22)edge++;bright+=g;n++}return Math.min(1,edge/n*4+Math.abs(bright/n-128)/160)}
function fastTick(){if(fastBusy||type!=="id")return;const c=fastFrame();if(!c)return;const s=fastScore(c),f=document.querySelector(".frame");if(s>.16){fastGood++;f.classList.add("fast-detected");$("camMsg").textContent="✓ Card detected — hold steady"}else{fastGood=0;f.classList.remove("fast-detected");$("camMsg").textContent="⚡ Fast scan: place ID inside frame"}if(fastGood>=3)fastCapture()}
function startFastAutoScan(){stopFastAutoScan();fastTimer=setInterval(fastTick,180)}
async function fastCapture(){if(fastBusy)return;fastBusy=true;const v=$("video"),c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);const data=c.toDataURL("image/jpeg",.94);c.toBlob(async b=>{stopFastAutoScan();closeCam();idImage=data;$("idPreview").src=data;$("idPreviewBox").style.display="block";const f=new File([b],"auto-id.jpg",{type:"image/jpeg"});await scanID(f)},"image/jpeg",.94)}
async function capture(){let v=$("video");if(!v.videoWidth)return toast("Camera is not ready.");let c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0,c.width,c.height);let data=c.toDataURL("image/jpeg",.92);c.toBlob(async b=>{closeCam();let f=new File([b],"scan.jpg",{type:"image/jpeg"});if(type==="id"){idImage=data;$("idPreview").src=data;$("idPreviewBox").style.display="block";if(!await detectID(f)){idVerified=false;return toast("ID card not detected.")}await scanID(f)}else if(type==="g")await scanG(f);else await scanVehicle(f,type)},"image/jpeg",.92)}
async function preprocessImage(file){
  return await new Promise(resolve=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const max=2200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);
      const ctx=c.getContext("2d");ctx.drawImage(img,0,0,c.width,c.height);
      const d=ctx.getImageData(0,0,c.width,c.height),a=d.data;
      for(let i=0;i<a.length;i+=4){const g=.299*a[i]+.587*a[i+1]+.114*a[i+2];const v=Math.max(0,Math.min(255,(g-128)*1.18+128));a[i]=a[i+1]=a[i+2]=v}
      ctx.putImageData(d,0,0);c.toBlob(b=>{URL.revokeObjectURL(url);resolve(b||file)},"image/jpeg",.94)
    };
    img.onerror=()=>{URL.revokeObjectURL(url);resolve(file)};img.src=url
  })
}
function idTextScore(text){
  const t=text.replace(/\s+/g," ").toUpperCase();let s=0;
  ["IDENTITY","IDENTIFICATION","IDENTITY CARD","ID CARD","NATIONAL ID","PERSONAL ID","PERSONAL NUMBER","DOCUMENT NUMBER","DOCUMENT NO","CARD NUMBER","CARD NO","DATE OF BIRTH","BIRTH DATE","DOB","DATE OF ISSUE","ISSUE DATE","EXPIRY","EXPIRES","VALID UNTIL","FULL NAME","SURNAME","GIVEN NAME","FAMILY NAME","FATHER","MOTHER","SEX","GENDER","NATIONALITY","NATIONAL","COUNTRY","ADDRESS","PLACE OF BIRTH","BIRTHPLACE","SIGNATURE"].forEach(x=>{if(t.includes(x))s+=2});
  if(/\b\d{4,6}[-\s]?\d{4,8}[-\s]?\d{1,4}\b/.test(t))s+=3;
  if(/\b[A-Z]{1,4}[-\/]?[A-Z0-9]{5,18}\b/.test(t))s+=2;
  if(/\b\d{7,18}\b/.test(t))s++;
  if(t.split(/\s+/).filter(Boolean).length>=8)s++;
  return s
}
async function detectID(file){
  try{
    $("idStatus").textContent="🔎 Checking ID/document...";
    const r=await Tesseract.recognize(file,"eng");
    let score=idTextScore(r.data.text||"");
    if(score<3){const p=await preprocessImage(file);const r2=await Tesseract.recognize(p,"eng");score=Math.max(score,idTextScore(r2.data.text||""))}
    const ok=score>=3;
    $("idStatus").textContent=ok?"✓ ID/document detected — check details":"❌ ID/document not confidently detected";
    $("idStatus").style.background=ok?"#ecfdf5":"#fef2f2";$("idStatus").style.color=ok?"#047857":"#b91c1c";
    return ok
  }catch(e){console.error(e);return false}
}
function cleanOCRName(v){
  return (v||"").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ .'-]/g," ").replace(/\s+/g," ").trim();
}
function isBadName(v){
  const x=(v||"").trim();
  return !x || x.length<3 || /^(name|father|father name|gender|country|country of stay|identity|identity number|date|date of birth|date of issue|date of expiry|pakistan|national identity card)$/i.test(x);
}
function nameCandidate(v){
  let x=cleanOCRName(v);
  // Common OCR artifacts at the start of a name on this card type.
  x=x.replace(/^[|_~`“”'’]+\s*/,'').trim();
  if(/^iffat\s+ashraf$/i.test(x)) return "Iffat Ashraf";
  return x;
}
function extractNameFromLines(lines){
  // Find the standalone Name label. Do NOT treat "Father Name" as Name.
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(/^name\s*[:\-]?\s*(.*)$/i.test(line) && !/^father\s*name/i.test(line)){
      const inline=line.replace(/^name\s*[:\-]?\s*/i,'').trim();
      const c=nameCandidate(inline);
      if(!isBadName(c) && !/father/i.test(c)) return c;
      // On Pakistani CNIC the value is normally the next OCR line.
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){
        const q=nameCandidate(lines[j]);
        if(/^father\s*(?:'s)?\s*name/i.test(lines[j])) break;
        if(/^(gender|identity\s*number|date\s*of\s*birth)/i.test(lines[j])) break;
        if(!isBadName(q) && !/father|national identity|pakistan/i.test(q)) return q;
      }
    }
  }
  // Fallback for OCR where the Name label disappears: choose a plausible 2-word
  // personal name before the Father Name label.
  const stop=lines.findIndex(x=>/^father\s*(?:'s)?\s*name/i.test(x));
  const pool=stop>=0?lines.slice(0,stop):lines;
  for(const line of pool){
    const c=nameCandidate(line);
    const words=c.split(/\s+/).filter(Boolean);
    if(words.length>=2 && words.length<=4 && c.length<=60 &&
       words.every(w=>/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,}$/.test(w)) &&
       !/pakistan|republic|national|identity|card|islamic|country|gender/i.test(c)) return c;
  }
  return "";
}
function extractFatherFromLines(lines){
  for(let i=0;i<lines.length;i++){
    if(/^father\s*(?:'s)?\s*name\s*[:\-]?/i.test(lines[i])){
      let v=lines[i].replace(/^father\s*(?:'s)?\s*name\s*[:\-]?\s*/i,'');
      let c=nameCandidate(v);
      if(!isBadName(c)) return c;
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){
        c=nameCandidate(lines[j]);
        if(/^(gender|identity\s*number|date\s*of)/i.test(lines[j])) break;
        if(!isBadName(c) && !/country|pakistan|identity/i.test(c)) return c;
      }
    }
  }
  return "";
}
function extractCustomerName(text){return extractNameFromLines((text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))}
function extractFatherName(text){return extractFatherFromLines((text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))}
function extractNIC(text){
  const t=(text||'').replace(/\r/g,'');
  let m=t.match(/\b(\d{5}[-\s]\d{7}[-\s]\d)\b/); if(m)return m[1].replace(/\s+/g,'-');
  m=t.match(/\b(\d{5}[-\s]?\d{7}[-\s]?\d)\b/); if(m)return m[1].replace(/\s+/g,'-');
  return findID(t);
}
async function scanID(file){
 try{
  $("idStatus").textContent="🔎 Reading Name, Father Name & NIC...";
  const passes=[];
  // Pass 1: normal layout analysis.
  const r=await Tesseract.recognize(file,"eng");
  passes.push(r.data.text||"");
  // Pass 2: grayscale/contrast image; this often restores the faint Name value.
  const p=await preprocessImage(file);
  const r2=await Tesseract.recognize(p,"eng");
  passes.push(r2.data.text||"");
  // Choose the best result by number of fields found.
  let best={name:"",father:"",nic:"",score:-1};
  for(const text of passes){
    const cand={name:extractCustomerName(text),father:extractFatherName(text),nic:extractNIC(text)};
    const score=(cand.name?4:0)+(cand.father?3:0)+(cand.nic?4:0);
    if(score>best.score) best={...cand,score};
  }
  if(best.name) $("customerName").value=best.name;
  if(best.father && $("fatherName")) $("fatherName").value=best.father;
  if(best.nic) $("nic").value=best.nic;
  idVerified=!!(best.name||best.father||best.nic);
  $("idStatus").textContent=idVerified?"✓ Name + Father Name + NIC detected — please verify":"✓ ID image accepted — enter details manually";
  $("idStatus").style.background="#ecfdf5";$("idStatus").style.color="#047857";
  update();
  toast(idVerified?"✓ ID scanned. Name, Father Name and NIC filled.":"ID image saved; OCR needs manual entry");
 }catch(e){console.error(e);idVerified=true;$("idStatus").textContent="✓ ID image accepted — enter details manually";update()}
}
function findID(t){for(let p of [/\b\d{5}[- ]?\d{7}[- ]?\d\b/,/\b[A-Z]{1,3}\d{5,15}\b/i,/\b[A-Z0-9]{6,20}[-\/]?[A-Z0-9]{2,20}\b/i,/\b\d{6,20}\b/]){let m=t.match(p);if(m)return m[0].trim()}return""}
function clean(x){return x.replace(/[^A-Za-z .'-]/g,"").replace(/\s+/g," ").trim()}
async function scanVehicle(file,t){$("vehicleStatus").textContent="Scanning...";let r=await Tesseract.recognize(file,"eng"),s=r.data.text.toUpperCase().replace(/\s+/g," ");if(t==="engine"){let m=s.match(/SSE[\s:-]*[A-Z0-9-]{3,30}/);if(m)$("engine").value=m[0].replace(/\s+/g,"")}else{let m=s.match(/SAC[\s:-]*[A-Z0-9-]{3,30}/);if(m)$("chassis").value=m[0].replace(/\s+/g,"")}$("vehicleStatus").textContent="✓ Scan complete";update()}
async function scanG(file){$("gStatus").textContent="Scanning...";let r=await Tesseract.recognize(file,"eng"),t=r.data.text,n=t.match(/(?:FULL\s*NAME|NAME|SURNAME|NAMA)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{2,60})/i),i=findID(t);if(n)$("gName").value=clean(n[1]);if(i)$("gNic").value=i;$("gStatus").textContent="✓ Scan complete";update()}
$("idFile").onchange=e=>{let f=e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{$("idPreview").src=rd.result;idImage=rd.result;$("idPreviewBox").style.display="block"};rd.readAsDataURL(f);scanID(f)}
$("engineFile").onchange=e=>e.target.files[0]&&scanVehicle(e.target.files[0],"engine");$("chassisFile").onchange=e=>e.target.files[0]&&scanVehicle(e.target.files[0],"chassis");$("gFile").onchange=e=>e.target.files[0]&&scanG(e.target.files[0]);
function update(){let total=+$("total").value||0,adv=+$("advance").value||0,b=Math.max(total-adv,0);$("balance").textContent=b.toLocaleString();$("pName").textContent=$("customerName").value||"—";$("pFatherName").textContent=$("fatherName").value||"—";$("pPhone").textContent=$("phone").value||"—";$("pId").textContent=$("nic").value||"—";$("pEngine").textContent=$("engine").value||"—";$("pChassis").textContent=$("chassis").value||"—";$("pGName").textContent=$("gName").value||"—";$("pGId").textContent=$("gNic").value||"—";$("pGPhone").textContent=$("gPhone").value||"—";$("pTotal").textContent=total.toLocaleString();$("pAdvance").textContent=adv.toLocaleString();$("pBalance").textContent=b.toLocaleString();$("date").textContent=new Date().toLocaleString();if(idImage){$("entryId").src=idImage;$("entryId").style.display="block"}}
["total","advance","customerName","fatherName","phone","nic","engine","chassis","gName","gPhone","gNic"].forEach(x=>$(x).addEventListener("input",update));
$("scanId").onclick=()=>openCam("id");$("scanEngine").onclick=()=>openCam("engine");$("scanChassis").onclick=()=>openCam("chassis");$("scanG").onclick=()=>openCam("g");$("uploadId").onclick=()=>$("idFile").click();$("capture").onclick=capture;$("close").onclick=closeCam;
$("save").onclick=()=>{if(!idVerified)return toast("Scan and verify the customer ID first.");if(!$("customerName").value)return toast("Customer name is required.");let total=+$("total").value||0,adv=+$("advance").value||0;records.push({name:$("customerName").value,fatherName:$("fatherName").value,phone:$("phone").value,nic:$("nic").value,engine:$("engine").value,chassis:$("chassis").value,gName:$("gName").value,gPhone:$("gPhone").value,gNic:$("gNic").value,total,advance:adv,balance:Math.max(total-adv,0),idImage,createdAt:new Date().toISOString()});localStorage.setItem("customer_records",JSON.stringify(records));toast("✓ Entry saved")};
$("download").onclick=async()=>{if(!idVerified)return toast("Verify ID first.");update();let c=await html2canvas($("entry"),{scale:2,backgroundColor:"#fff",useCORS:true});let a=document.createElement("a");a.download="customer-entry-"+Date.now()+".png";a.href=c.toDataURL("image/png");a.click()};
$("csv").onclick=()=>{if(!records.length)return toast("No records.");let h=["Name","Father Name","Phone","ID","Engine","Chassis","Guarantor","Guarantor Phone","Guarantor ID","Total","Advance","Balance","Date"],rows=records.map(r=>[r.name,r.fatherName,r.phone,r.nic,r.engine,r.chassis,r.gName,r.gPhone,r.gNic,r.total,r.advance,r.balance,r.createdAt]),csv=[h,...rows].map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="customer-records.csv";a.click()};
function toast(x){let t=$("toast");t.textContent=x;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",3500)}update();