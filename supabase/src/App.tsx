import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "./lib/supabase";
import "./styles.css";

const FESTIVAL = "exclu-fest-2026";
type View = "home"|"wheel"|"quiz"|"box"|"passport"|"photo"|"prizes";

export default function App(){
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const f=()=>setPath(window.location.pathname);addEventListener("popstate",f);return()=>removeEventListener("popstate",f)},[]);
  if(path.startsWith("/admin")) return <AdminPlaceholder/>;
  return <Customer/>;
}

function Customer(){
  const [view,setView]=useState<View>("home");
  const [user,setUser]=useState<any>(null);
  const [phone,setPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<any>(null);

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setUser(data.user??null));
    const {data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user??null));
    const k="exclu_scan_"+new Date().toISOString().slice(0,10);
    if(!sessionStorage.getItem(k)){
      supabase.rpc("register_scan",{p_festival_slug:FESTIVAL}).finally(()=>sessionStorage.setItem(k,"1"));
    }
    return ()=>data.subscription.unsubscribe();
  },[]);

  async function sendOtp(){
    if(!phone.trim()) return alert("Introduce tu teléfono.");
    setBusy(true);
    const {error}=await supabase.auth.signInWithOtp({phone:phone.trim()});
    setBusy(false);
    if(error) return alert(error.message);
    setSent(true);
  }
  async function verifyOtp(){
    setBusy(true);
    const {error}=await supabase.auth.verifyOtp({phone:phone.trim(),token:otp.trim(),type:"sms"});
    setBusy(false);
    if(error) return alert(error.message);
  }
  async function play(){
    if(!user){document.getElementById("auth")?.scrollIntoView({behavior:"smooth"});return}
    setBusy(true);
    const {data,error}=await supabase.rpc("play_game",{p_festival_slug:FESTIVAL});
    setBusy(false);
    if(error) return alert(error.message);
    setResult(data);
  }
  if(result) return <Result result={result} onBack={()=>{setResult(null);setView("home")}}/>;

  return <div className="app">
    {view==="home" ? <Poster setView={setView}/> :
      <div className="screen-wrap">
        <button className="back" onClick={()=>setView("home")}><ChevronLeft/> Volver</button>
        {view==="wheel"&&<Wheel busy={busy} play={play}/>}
        {view==="quiz"&&<Quiz busy={busy} play={play}/>}
        {view==="box"&&<Boxes busy={busy} play={play}/>}
        {view==="passport"&&<Passport/>}
        {view==="photo"&&<Photo/>}
        {view==="prizes"&&<Prizes/>}
      </div>}
    <Auth user={user} phone={phone} setPhone={setPhone} otp={otp} setOtp={setOtp} sent={sent} busy={busy} sendOtp={sendOtp} verifyOtp={verifyOtp}/>
  </div>
}

function Poster({setView}:{setView:(v:View)=>void}){
  return <div className="poster-shell">
    <img src="/assets/exclu-fest-boceto.png" className="poster-img" alt="EXCLU FEST"/>
    <Hot x={2.8} y={52.5} w={18.8} h={7.2} onClick={()=>setView("wheel")} label="Jugar ahora"/>
    <Hot x={2.8} y={59.7} w={18.8} h={6.0} onClick={()=>setView("prizes")} label="Ver mis premios"/>
    <Hot x={24.0} y={8.1} w={21.8} h={40.8} onClick={()=>setView("wheel")} label="Ruleta"/>
    <Hot x={46.5} y={8.1} w={22.5} h={40.8} onClick={()=>setView("quiz")} label="Reto del Coto"/>
    <Hot x={70.2} y={8.1} w={22.0} h={40.8} onClick={()=>setView("box")} label="Caja fuerte"/>
    <Hot x={24.0} y={50.5} w={21.9} h={25.8} onClick={()=>setView("passport")} label="Pasaporte"/>
    <Hot x={65.0} y={50.5} w={18.8} h={25.8} onClick={()=>setView("photo")} label="Fotomatón"/>
    <Hot x={84.0} y={50.5} w={14.1} h={25.8} onClick={()=>setView("prizes")} label="Mis premios"/>
    <Hot x={77.5} y={78.3} w={20.6} h={19.0} onClick={()=>setView("prizes")} label="Menú"/>
  </div>
}
function Hot({x,y,w,h,onClick,label}:any){return <button className="hot" style={{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`}} onClick={onClick} aria-label={label} title={label}/>}

function Auth(p:any){
  return <section id="auth" className="auth">
    <div><b>{p.user?"✓ TELÉFONO VERIFICADO":"PARTICIPA CON TU TELÉFONO"}</b><small>{p.user?"Ya puedes jugar y guardar tus premios.":"Una cuenta por persona para proteger los premios y el sorteo."}</small></div>
    {!p.user&&<div className="auth-actions">{!p.sent?<><input value={p.phone} onChange={(e:any)=>p.setPhone(e.target.value)} placeholder="+34 600 000 000"/><button onClick={p.sendOtp}>{p.busy?"ENVIANDO...":"ENVIAR CÓDIGO"}</button></>:<><input value={p.otp} onChange={(e:any)=>p.setOtp(e.target.value)} placeholder="Código SMS"/><button onClick={p.verifyOtp}>{p.busy?"VERIFICANDO...":"VERIFICAR"}</button></>}</div>}
  </section>
}

function Wheel({busy,play}:any){
 const [spin,setSpin]=useState(false);
 async function go(){if(spin||busy)return;setSpin(true);setTimeout(()=>{play();setSpin(false)},1900)}
 return <Card tone="orange" tag="DÍA 11 SEPTIEMBRE" title="RULETA DE LA EXCLUSIVA" sub="Gira la ruleta y descubre tu premio">
   <div className={"wheel "+(spin?"spin":"")}><div className="slice s1">Menú<br/>desayuno</div><div className="slice s2">Producto<br/><b>-20%</b></div><div className="slice s3">Menú<br/><b>-20%</b></div><div className="slice s4">Premio<br/>sorpresa</div><div className="slice s5">Bebida<br/>gratis</div><div className="slice s6">Descuento<br/><b>-20%</b></div><i>★</i></div>
   <button className="teal" onClick={go}>{spin?"GIRANDO...":"¡GIRAR!"}</button>
 </Card>
}
const qs=[["¿A qué hora abre La Exclusiva?",["08:00","06:00","10:00"],1],["¿Cómo se llama nuestro robot?",["EXCLU","NICO","LUX"],0],["¿Cuántos días dura EXCLU FEST?",["1","2","3"],2]] as const;
function Quiz({play}:any){
 const [n,setN]=useState(0); const [sel,setSel]=useState<number|null>(null); const q=qs[n];
 function choose(i:number){setSel(i);if(i===q[2])setTimeout(()=>{if(n===2)play();else{setN(n+1);setSel(null)}},600)}
 return <Card tone="teal" tag="DÍA 12 SEPTIEMBRE" title="EL RETO DEL COTO" sub="Pon a prueba lo que sabes sobre La Exclusiva">
   <div className="quiz"><small>Pregunta {n+1} de 3</small><h2>{q[0]}</h2>{q[1].map((a,i)=><button onClick={()=>choose(i)} className={sel===i?(i===q[2]?"good":"bad"):""} key={a}>{a}{sel===i&&i===q[2]?" ✓":""}</button>)}</div>
 </Card>
}
function Boxes({play}:any){const[pick,setPick]=useState(0);async function choose(n:number){if(pick)return;setPick(n);setTimeout(play,800)}return <Card tone="purple" tag="DÍA 13 SEPTIEMBRE" title="LA CAJA FUERTE DEL PREMIO FINAL" sub="Elige una caja y descubre tu premio"><h2 className="choose">ELIGE TU CAJA</h2><div className="boxes">{[1,2,3].map(n=><button className={pick===n?"picked":""} onClick={()=>choose(n)} key={n}>🎁<b>{n}</b></button>)}</div></Card>}
function Passport(){return <Card tone="orange" tag="PASAPORTE" title="COMPLETA LOS 3 DÍAS" sub="Consigue tus tres sellos y entra con más opciones en el sorteo"><div className="paper"><div><b>11<small>SEPT</small></b><b>12<small>SEPT</small></b><b>13<small>SEPT</small></b></div><h2>¡ENHORABUENA!</h2><p>Completar los tres días suma 2 participaciones extra.</p></div></Card>}
function Photo(){return <Card tone="teal" tag="FOTOMATÓN" title="FOTOMATÓN EXCLU" sub="Hazte tu foto más festiva y compártela"><div className="photo">😎 🤩 🥳<h2>Yo celebro las Fiestas del Coto<br/>con La Exclusiva!</h2></div><button className="teal" onClick={()=>alert("La cámara real se conecta en la siguiente integración.")}>ABRIR CÁMARA</button></Card>}
function Prizes(){return <Card tone="orange" tag="PREMIOS" title="MIS PREMIOS" sub="Consulta tus premios y tu participación en el sorteo"><div className="list"><p>🎁 Premios instantáneos</p><p>🏆 3 desayunos para dos en el sorteo final</p></div></Card>}
function Card({tone,tag,title,sub,children}:any){return <section className={"card "+tone}><span className="tag">{tag}</span><h1>{title}</h1><p>{sub}</p>{children}<img className="robot" src="/assets/exclu-robot-original.png" alt="EXCLU"/></section>}
function Result({result,onBack}:any){return <div className="result"><div><img src="/assets/exclu-robot-original.png"/><h1>{result?.won?"¡ENHORABUENA!":"¡SIGUES EN EL SORTEO!"}</h1><p>{result?.prize_name||result?.message||"Tu participación ha quedado registrada."}</p>{result?.reward_code&&<code>{result.reward_code}</code>}<button onClick={onBack}>VOLVER</button></div></div>}
function AdminPlaceholder(){return <div className="admin"><h1>EXCLU FEST · ADMIN</h1><p>Ruta reservada para el panel de La Exclusiva.</p></div>}
