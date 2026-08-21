const $=id=>document.getElementById(id);
let stream=null,type=null,idVerified=false,idImage="";
let records=JSON.parse(localStorage.getItem("customer_records")||"[]");

async function openCam(t){
type=t;
$("camTitle").textContent={id:"Auto Scan Any ID Card",engine:"Scan Engine Number",chassis:"Scan Chassis Number",g:"Scan Guarantor ID"}[t];
$("camMsg").textContent=t==="id"?"Place the original ID card inside the frame. No capture button is needed.":"Place the document inside the frame.";
$("autoScanHint").style.display=t==="id"?"block":"none";
$("modal").classList.add("open");
try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});$("video").srcObject=stream;if(t==="id")startAutoIDScan()}
catch(e){closeCam();toast("Camera unavailable. Upload an image instead.");const map={id:"idFile",engine:"engineFile",chassis:"chassisFile",g:"gFile"};$(map[t]).click()}
}
function closeCam(){stopAutoScan();if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}$("video").srcObject=null;$("modal").classList.remove("open")}
let autoTimer=null,autoBusy=false,autoStable=0;
function stopAutoScan(){if(autoTimer){clearInterval(autoTimer);autoTimer=null}autoBusy=false;autoStable=0;const f=document.querySelector(".frame");if(f)f.classList.remove("detected")}
function getVideoFrame(){const v=$("video");if(!v.videoWidth)return null;const c=document.createElement("canvas"),w=v.videoWidth,h=v.videoHeight,cw=Math.round(w*.82),ch=Math.round(h*.70),x=Math.round((w-cw)/2),y=Math.round((h-ch)/2);c.width=1200;c.height=Math.round(1200*ch/cw);c.getContext("2d").drawImage(v,x,y,cw,ch,0,0,c.width,c.height);return c}
async function autoIDFrame(){if(autoBusy||type!=="id")return;const c=getVideoFrame();if(!c)return;autoBusy=true;try{const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.88)),r=await Tesseract.recognize(blob,"eng"),text=r.data.text||"",score=idTextScore(text),hasID=!!findID(text),hasName=!!extractName(text),ok=score>=3||(hasID&&hasName)||score>=2,f=document.querySelector(".frame");if(ok){autoStable++;f.classList.add("detected");$("camMsg").textContent="✓ ID detected — hold steady ("+autoStable+"/2)"}else{autoStable=0;f.classList.remove("detected");$("camMsg").textContent="Searching for ID card…"}if(autoStable>=2){stopAutoScan();const v=$("video"),full=document.createElement("canvas");full.width=v.videoWidth;full.height=v.videoHeight;full.getContext("2d").drawImage(v,0,0);const image=full.toDataURL("image/jpeg",.92);full.toBlob(async b=>{closeCam();idImage=image;$("idPreview").src=image;$("idPreviewBox").style.display="block";idVerified=true;await scanID(new File([b],"auto-id.jpg",{type:"image/jpeg"}))},"image/jpeg",.92)}}catch(e){console.log(e)}finally{autoBusy=false}}
function startAutoIDScan(){stopAutoScan();autoTimer=setInterval(autoIDFrame,1200)}
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
async function scanID(file){
  try{
    $("idStatus").textContent="🔎 Extracting details...";
    let r=await Tesseract.recognize(file,"eng"),text=r.data.text||"",name=extractName(text),id=findID(text);
    if(!name||!id){const p=await preprocessImage(file),r2=await Tesseract.recognize(p,"eng"),t2=r2.data.text||"";if(!name)name=extractName(t2);if(!id)id=findID(t2)}
    if(name)$("customerName").value=name;if(id)$("nic").value=id;
    idVerified=true;
    $("idStatus").textContent=name||id?"✓ ID card detected — verify extracted details":"✓ ID image accepted — enter details manually";
    $("idStatus").style.background="#ecfdf5";$("idStatus").style.color="#047857";update();
    toast(name||id?"ID scanned. Please verify the fields.":"ID image accepted; OCR could not read the text.")
  }catch(e){
    console.error(e);idVerified=true;$("idStatus").textContent="✓ ID image accepted — enter details manually";
    $("idStatus").style.background="#ecfdf5";$("idStatus").style.color="#047857";update()
  }
}
function extractName(text){
  const lines=(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const re=/^(FULL\s*NAME|NAME|SURNAME|GIVEN\s*NAME|FAMILY\s*NAME|FIRST\s*NAME|LAST\s*NAME|NAMA)\s*[:\-]?\s*/i;
  for(const line of lines){const m=line.match(re);if(m){const v=line.slice(m[0].length).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ .'-]/g,"").replace(/\s+/g," ").trim();if(v.length>=3)return v}}
  for(const line of lines){const v=line.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ .'-]/g,"").replace(/\s+/g," ").trim(),w=v.split(" ").filter(Boolean);if(w.length>=2&&w.length<=5&&v.length>=5&&v.length<=60&&w.every(x=>x.length>=2))return v}
  return ""
}
function findID(t){for(let p of [/\b\d{5}[- ]?\d{7}[- ]?\d\b/,/\b[A-Z]{1,3}\d{5,15}\b/i,/\b[A-Z0-9]{6,20}[-\/]?[A-Z0-9]{2,20}\b/i,/\b\d{6,20}\b/]){let m=t.match(p);if(m)return m[0].trim()}return""}
function clean(x){return x.replace(/[^A-Za-z .'-]/g,"").replace(/\s+/g," ").trim()}
async function scanVehicle(file,t){$("vehicleStatus").textContent="Scanning...";let r=await Tesseract.recognize(file,"eng"),s=r.data.text.toUpperCase().replace(/\s+/g," ");if(t==="engine"){let m=s.match(/SSE[\s:-]*[A-Z0-9-]{3,30}/);if(m)$("engine").value=m[0].replace(/\s+/g,"")}else{let m=s.match(/SAC[\s:-]*[A-Z0-9-]{3,30}/);if(m)$("chassis").value=m[0].replace(/\s+/g,"")}$("vehicleStatus").textContent="✓ Scan complete";update()}
async function scanG(file){$("gStatus").textContent="Scanning...";let r=await Tesseract.recognize(file,"eng"),t=r.data.text,n=t.match(/(?:FULL\s*NAME|NAME|SURNAME|NAMA)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{2,60})/i),i=findID(t);if(n)$("gName").value=clean(n[1]);if(i)$("gNic").value=i;$("gStatus").textContent="✓ Scan complete";update()}
async function processID(f){let r=await detectID(f);if(!r){idVerified=false;return toast("ID card not detected.")}await scanID(f)}
$("idFile").onchange=e=>{let f=e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{$("idPreview").src=rd.result;idImage=rd.result;$("idPreviewBox").style.display="block"};rd.readAsDataURL(f);processID(f)}
$("engineFile").onchange=e=>e.target.files[0]&&scanVehicle(e.target.files[0],"engine");$("chassisFile").onchange=e=>e.target.files[0]&&scanVehicle(e.target.files[0],"chassis");$("gFile").onchange=e=>e.target.files[0]&&scanG(e.target.files[0]);
function update(){let total=+$("total").value||0,adv=+$("advance").value||0,b=Math.max(total-adv,0);$("balance").textContent=b.toLocaleString();$("pName").textContent=$("customerName").value||"—";$("pPhone").textContent=$("phone").value||"—";$("pId").textContent=$("nic").value||"—";$("pEngine").textContent=$("engine").value||"—";$("pChassis").textContent=$("chassis").value||"—";$("pGName").textContent=$("gName").value||"—";$("pGId").textContent=$("gNic").value||"—";$("pGPhone").textContent=$("gPhone").value||"—";$("pTotal").textContent=total.toLocaleString();$("pAdvance").textContent=adv.toLocaleString();$("pBalance").textContent=b.toLocaleString();$("date").textContent=new Date().toLocaleString();if(idImage){$("entryId").src=idImage;$("entryId").style.display="block"}}
["total","advance","customerName","phone","nic","engine","chassis","gName","gPhone","gNic"].forEach(x=>$(x).addEventListener("input",update));
$("scanId").onclick=()=>openCam("id");$("scanEngine").onclick=()=>openCam("engine");$("scanChassis").onclick=()=>openCam("chassis");$("scanG").onclick=()=>openCam("g");$("uploadId").onclick=()=>$("idFile").click();$("capture").onclick=capture;$("close").onclick=closeCam;
$("save").onclick=()=>{if(!idVerified)return toast("Scan and verify the customer ID first.");if(!$("customerName").value)return toast("Customer name is required.");let total=+$("total").value||0,adv=+$("advance").value||0;records.push({name:$("customerName").value,phone:$("phone").value,nic:$("nic").value,engine:$("engine").value,chassis:$("chassis").value,gName:$("gName").value,gPhone:$("gPhone").value,gNic:$("gNic").value,total,advance:adv,balance:Math.max(total-adv,0),idImage,createdAt:new Date().toISOString()});localStorage.setItem("customer_records",JSON.stringify(records));toast("✓ Entry saved")};
$("download").onclick=async()=>{if(!idVerified)return toast("Verify ID first.");update();let c=await html2canvas($("entry"),{scale:2,backgroundColor:"#fff",useCORS:true});let a=document.createElement("a");a.download="customer-entry-"+Date.now()+".png";a.href=c.toDataURL("image/png");a.click()};
$("csv").onclick=()=>{if(!records.length)return toast("No records.");let h=["Name","Phone","ID","Engine","Chassis","Guarantor","Guarantor Phone","Guarantor ID","Total","Advance","Balance","Date"],rows=records.map(r=>[r.name,r.phone,r.nic,r.engine,r.chassis,r.gName,r.gPhone,r.gNic,r.total,r.advance,r.balance,r.createdAt]),csv=[h,...rows].map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="customer-records.csv";a.click()};
function toast(x){let t=$("toast");t.textContent=x;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",3500)}update();
