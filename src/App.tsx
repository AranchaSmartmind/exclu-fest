import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, CheckCircle2, ChevronLeft, Gift, LockKeyhole, RefreshCw, Sparkles, Ticket, Trophy, Users, XCircle, Volume2, VolumeX, Search, MousePointerClick, Home, Gamepad2, Camera, CalendarDays, UserRound } from "lucide-react";
import { supabase } from "./lib/supabase";
import "./styles.css";


function PassportGlyph() {
  return <img className="passport-glyph-image" src="/assets/passport-nav-approved.png" alt="" aria-hidden="true" />;
}


function PhotoBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={`photo-count-badge ${className}`} aria-label={`${count} foto${count === 1 ? "" : "s"} en el fotomatón`} title={`${count} foto${count === 1 ? "" : "s"}`}>*</span>;
}

function BottomNav({ view, setView, photoCount }: { view: View; setView: (v: View) => void; photoCount: number }) {
  const gamesActive = view === "games" || ["scratch", "fly", "find", "memory", "rings"].includes(view);
  return <nav className="unified-bottom-nav" aria-label="Navegación La Exclusiva">
    <button onClick={() => { sound("click"); setView("home"); }} className={view === "home" ? "active" : ""}><Home/><span>Inicio</span></button>
    <button onClick={() => { sound("click"); setView("passport"); }} className={view === "passport" ? "active" : ""}><span className="passport-icon"><PassportGlyph/></span><span>Pasaporte</span></button>
    <button onClick={() => { sound("click"); setView("games"); }} className={gamesActive ? "active" : ""}><Gamepad2/><span>Juegos</span></button>
    <button onClick={() => { sound("click"); setView("photo"); }} className={view === "photo" ? "active" : ""}><span className="nav-icon-wrap"><Camera/><PhotoBadge count={photoCount}/></span><span>Fotomatón</span></button>
  </nav>;
}

const FESTIVAL = "exclu-fest-2026";
const ROULETTE_PREVIEW_ENABLED = true; // TEMPORAL: desactivar al cerrar las pruebas

function sound(kind: "click" | "spin" | "win" | "lose" | "correct" | "wrong" | "open" = "click") {
  if (localStorage.getItem("exclu_sound") === "off") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const notes: Record<string, number[]> = { click:[440], spin:[220,330,440,660], win:[523,659,784,1046], lose:[220,185], correct:[660,880], wrong:[180,140], open:[330,495,740] };
    const seq = notes[kind];
    seq.forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const g=ctx.createGain();
      osc.type = kind === "win" || kind === "correct" ? "sine" : "triangle";
      osc.frequency.value=freq;
      g.gain.setValueAtTime(0.0001, now+i*.09);
      g.gain.exponentialRampToValueAtTime(.10, now+i*.09+.015);
      g.gain.exponentialRampToValueAtTime(.0001, now+i*.09+.12);
      osc.connect(g); g.connect(gain); osc.start(now+i*.09); osc.stop(now+i*.09+.14);
    });
    setTimeout(()=>ctx.close(),900);
  } catch {}
}

function Confetti({ count = 42 }: { count?: number }) {
  return <div className="confetti" aria-hidden="true">{Array.from({length:count}).map((_,i)=><i key={i} style={{left:`${(i*37)%100}%`, animationDelay:`${(i%12)*.07}s`, animationDuration:`${1.8+(i%7)*.17}s`, ['--r' as any]:`${(i*83)%360}deg`}} />)}</div>;
}

type View = "home" | "play" | "games" | "wheel" | "quiz" | "box" | "passport" | "photo" | "prizes" | "scratch" | "fly" | "find" | "memory" | "rings";
type GameType = "wheel" | "quiz" | "box";

type PlayedDay = { day: number; game_type: GameType; played_at: string };
type Reward = {
  name: string;
  icon: string;
  reward_code: string;
  status: "pending" | "redeemed" | "expired" | "cancelled";
  claimed_at: string;
  redeemed_at?: string | null;
};

type FestivalStatus = {
  registered: boolean;
  phone_masked?: string;
  played_days?: PlayedDay[];
  rewards?: Reward[];
  raffle_entries?: number;
  passport_complete?: boolean;
  test_mode?: boolean;
};

type GameResult = {
  already_played?: boolean;
  won?: boolean;
  day?: number;
  prize_name?: string | null;
  prize_description?: string | null;
  prize_icon?: string | null;
  reward_code?: string | null;
  raffle_entries?: number;
  passport_complete?: boolean;
  message?: string;
};

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path.startsWith("/admin")) return <AdminPanel />;
  return <Customer />;
}

function Customer() {
  const [view, setView] = useState<View>("home");
  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<FestivalStatus>({ registered: false });
  useEffect(() => { const h=()=>setView("play"); window.addEventListener("exclu-back-to-play", h); return()=>window.removeEventListener("exclu-back-to-play", h); }, []);
  const [result, setResult] = useState<GameResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("exclu_sound") !== "off");
  const [photoCount, setPhotoCount] = useState(() => {
    const saved = Number(localStorage.getItem("exclu_photo_count") ?? "0");
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  });

  function registerPhotoCreated() {
    setPhotoCount((current) => {
      const next = current + 1;
      localStorage.setItem("exclu_photo_count", String(next));
      return next;
    });
  }

  const played = useMemo(() => new Set((status.played_days ?? []).map((d) => d.day)), [status.played_days]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUserId(data.session?.user?.id ?? null);
        if (data.session?.user) await loadStatus();

        const today = new Date().toISOString().slice(0, 10);
        const scanKey = `exclu_scan_${today}`;
        if (!sessionStorage.getItem(scanKey)) {
          try {
            const { error } = await supabase.rpc("register_scan", { p_festival_slug: FESTIVAL });
            if (!error) sessionStorage.setItem(scanKey, "1");
          } catch (error) {
            console.warn("No se pudo registrar el escaneo", error);
          }
        }
      } finally {
        if (mounted) setSessionReady(true);
      }
    }

    boot();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  async function loadStatus() {
    try {
      const { data, error } = await supabase.rpc("get_my_festival_status", { p_festival_slug: FESTIVAL });
      if (error) {
        console.warn("Estado no disponible", error.message);
        return;
      }
      setStatus((data ?? { registered: false }) as FestivalStatus);
    } catch (error) {
      console.warn("Error cargando estado", error);
    }
  }

  async function registerWithoutSms() {
    if (busy) return;
    if (!phone.trim()) return setNotice("Introduce tu número de teléfono para continuar.");
    if (!accepted) return setNotice("Debes aceptar las bases y la política de privacidad.");

    setBusy(true);
    setNotice(null);
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("anonymous") || msg.includes("disabled")) {
            throw new Error("Activa Anonymous Sign-Ins en Supabase: Authentication → Providers → Anonymous Sign-Ins.");
          }
          throw error;
        }
        currentUserId = data.user?.id ?? null;
        setUserId(currentUserId);
      }

      const { data, error } = await supabase.rpc("register_participant", {
        p_festival_slug: FESTIVAL,
        p_phone: phone,
        p_accept_terms: true,
      });
      if (error) throw error;

      await loadStatus();
      setNotice(`¡Listo! ${data?.phone_masked ?? "Tu teléfono"} ha quedado registrado para EXCLU FEST.`);
      setTimeout(() => setNotice(null), 3500);
    } catch (error: any) {
      setNotice(error?.message || "No hemos podido completar el registro.");
    } finally {
      setBusy(false);
    }
  }

  async function play(gameType: GameType, testDay: 11 | 12 | 13, choice?: string, presentResult = true): Promise<GameResult | null> {
    if (busy) return null;
    if (!status.registered) {
      setNotice("Primero registra tu teléfono. No enviaremos ningún SMS.");
      document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return null;
    }

    setBusy(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc("play_daily_game", {
        p_festival_slug: FESTIVAL,
        p_game_type: gameType,
        p_test_day: testDay,
        p_choice: choice ?? null,
      });
      if (error) throw error;
      const gameResult = (data ?? {}) as GameResult;
      if (presentResult) setResult(gameResult);
      await loadStatus();
      return gameResult;
    } catch (error: any) {
      setNotice(friendlyError(error?.message));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!sessionReady) {
    return <div className="splash"><img src="/assets/exclu-robot-premium.png" alt="EXCLU"/><p>EXCLU está preparando la fiesta…</p></div>;
  }

  if (result) {
    return <Result result={result} onBack={() => { setResult(null); setView("play"); }} />;
  }

  return (
    <div className={`app ${view === "home" ? "home-screen" : ""} ${view === "passport" ? "passport-view" : ""} ${view === "photo" ? "photo-view" : ""}`}>
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
      {view !== "home" && view !== "play" && view !== "passport" && view !== "photo" && (
        <button className="sound-toggle" onClick={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}>{soundOn ? <Volume2/> : <VolumeX/>}</button>
      )}

      {view === "home" ? (
        <>
          <DesktopPoster setView={setView} />
          <MobileHome
            setView={setView}
            played={played}
            registered={status.registered}
            raffleEntries={status.raffle_entries ?? 0}
            soundOn={soundOn}
            photoCount={photoCount}
            onToggleSound={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem("exclu_sound", next ? "on" : "off");
              if (next) sound("correct");
            }}
          />
          <ArcadeStrip setView={setView} />
        </>
      ) : view === "play" ? (
        <PlayHub
          status={status}
          played={played}
          setView={setView}
          soundOn={soundOn}
          photoCount={photoCount}
          onToggleSound={() => {
            const next = !soundOn;
            setSoundOn(next);
            localStorage.setItem("exclu_sound", next ? "on" : "off");
            if (next) sound("correct");
          }}
        />
      ) : (
        <div className="screen-wrap">
          <button className="back" onClick={() => { sound("click"); setView(["wheel", "quiz", "box"].includes(view) ? "play" : "home"); }}><ChevronLeft /> Volver</button>
          {view === "games" && <GamesHub setView={setView} />}
          {view === "wheel" && <Wheel busy={busy} played={played.has(11)} registered={status.registered} play={() => play("wheel", 11, undefined, false)} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
          {view === "quiz" && <Quiz busy={busy} played={played.has(12)} play={() => play("quiz", 12)} />}
          {view === "box" && <Boxes busy={busy} played={played.has(13)} play={(choice) => play("box", 13, choice)} />}
          {view === "passport" && <Passport status={status} />}
          {view === "photo" && <Photo onPhotoCreated={registerPhotoCreated} setView={setView} />}
          {view === "prizes" && <Prizes status={status} />}
          {view === "scratch" && <ScratchGame />}
          {view === "fly" && <ExcluFly />}
          {view === "find" && <FindExclu />}
          {view === "memory" && <MemoryExclu />}
          {view === "rings" && <RingToss />}
        </div>
      )}

      {view !== "play" && <RegisterPanel
        registered={status.registered}
        phoneMasked={status.phone_masked}
        phone={phone}
        setPhone={setPhone}
        accepted={accepted}
        setAccepted={setAccepted}
        busy={busy}
        onRegister={registerWithoutSms}
      />}
      <BottomNav view={view} setView={setView} photoCount={photoCount} />
    </div>
  );
}

function friendlyError(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("ya has participado")) return "Ya has jugado este día. Tu participación sigue guardada y puedes volver mañana.";
  if (lower.includes("no hay ningún juego")) return "Hoy todavía no hay un juego activo. Durante las pruebas puedes usar los tres juegos porque el modo test está activado.";
  if (lower.includes("teléfono ya está registrado")) return "Ese teléfono ya está asociado a una participación de EXCLU FEST.";
  if (lower.includes("promoción no está activa")) return "EXCLU FEST todavía no está activo.";
  return message || "Ha ocurrido un problema. Inténtalo de nuevo.";
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="notice" role="status"><img src="/assets/exclu-robot-premium.png" alt="EXCLU"/><div><b>EXCLU</b><p>{text}</p></div><button onClick={onClose} aria-label="Cerrar">×</button></div>;
}

function DesktopPoster({ setView }: { setView: (v: View) => void }) {
  return <div className="desktop-poster poster-shell poster-009">
    <img src="/assets/exclu-fest-009-boceto.png" className="poster-img" alt="EXCLU FEST · diseño 009" />
    <Hot x={1.0} y={3.0} w={22.0} h={48.0} onClick={() => setView("passport")} label="Inicio y pasaporte" />
    <Hot x={24.0} y={3.0} w={22.0} h={48.0} onClick={() => setView("wheel")} label="Ruleta EXCLU" />
    <Hot x={47.0} y={3.0} w={22.0} h={48.0} onClick={() => setView("prizes")} label="Ver mis premios" />
    <Hot x={70.0} y={3.0} w={29.0} h={48.0} onClick={() => setView("photo")} label="Fotomatón EXCLU" />
    <Hot x={24.0} y={53.0} w={30.0} h={33.0} onClick={() => setView("fly")} label="EXCLU Vuela" />
    <Hot x={55.0} y={53.0} w={14.0} h={33.0} onClick={() => setView("find")} label="Encuentra a EXCLU" />
    <Hot x={70.0} y={53.0} w={14.0} h={33.0} onClick={() => setView("memory")} label="Memoria EXCLU" />
    <Hot x={85.0} y={53.0} w={14.0} h={33.0} onClick={() => setView("rings")} label="Lanza Aros" />
  </div>;
}

function MobileHome({ setView, played, registered, raffleEntries, soundOn, photoCount, onToggleSound }: { setView: (v: View) => void; played: Set<number>; registered: boolean; raffleEntries: number; soundOn: boolean; photoCount: number; onToggleSound: () => void }) {
  return <main className="mobile-home mobile-home-final" aria-label="Inicio La Exclusiva">
    <section className="home-visual-final">
      <img
        className="home-visual-final__art"
        src="/assets/home-la-exclusiva-plaza.png"
        alt="La Exclusiva con EXCLU en ambiente festivo"
      />

      <button className="home-hot home-hot-play" onClick={() => { sound("click"); setView("play"); }} aria-label="Jugar ahora" />
      <button className="home-hot home-hot-prizes" onClick={() => { sound("click"); setView("prizes"); }} aria-label="Ver mis premios" />
      <button
        className={`home-sound-button ${soundOn ? "is-on" : "is-off"}`}
        onClick={onToggleSound}
        aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}
        title={soundOn ? "Desactivar sonido" : "Activar sonido"}
      >
        {soundOn ? <Volume2 /> : <VolumeX />}
      </button>



      <div className="home-live-status" aria-live="polite">
        {registered ? <><span>✓ Participante</span><span>{played.size}/3 días</span><span>{raffleEntries} participaciones</span></> : <span>Toca «¡JUGAR AHORA!» para comenzar</span>}
      </div>
    </section>
  </main>;
}


function PlayHub({ status, played, setView, soundOn, photoCount, onToggleSound }: { status: FestivalStatus; played: Set<number>; setView: (v: View) => void; soundOn: boolean; photoCount: number; onToggleSound: () => void }) {
  const madridParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(madridParts.find(p => p.type === type)?.value ?? 0);
  const year = part("year");
  const month = part("month");
  const dayOfMonth = part("day");

  const liveFestivalDay: 11 | 12 | 13 | null = year === 2026 && month === 9 && [11, 12, 13].includes(dayOfMonth)
    ? (dayOfMonth as 11 | 12 | 13)
    : null;

  // Modo de pruebas: solo fuerza un día si se ha definido expresamente desde desarrollo/admin.
  const storedTestDay = Number(localStorage.getItem("exclu_test_day"));
  const forcedTestDay: 11 | 12 | 13 | null = Boolean(status.test_mode) && [11, 12, 13].includes(storedTestDay)
    ? (storedTestDay as 11 | 12 | 13)
    : null;
  const activeDay = forcedTestDay ?? liveFestivalDay;
  const gameView: Record<11 | 12 | 13, View> = { 11: "wheel", 12: "quiz", 13: "box" };

  const isBeforeFestival = year < 2026 || (year === 2026 && (month < 9 || (month === 9 && dayOfMonth < 11)));
  const isAfterFestival = year > 2026 || (year === 2026 && (month > 9 || (month === 9 && dayOfMonth > 13)));

  function dayState(day: 11 | 12 | 13): "done" | "open" | "locked" | "missed" {
    // En producción, antes del 11 de septiembre TODO el pasaporte permanece bloqueado,
    // aunque exista información de pruebas previa en Supabase.
    if (forcedTestDay === null && isBeforeFestival) return "locked";
    if (played.has(day)) return "done";
    if (forcedTestDay === day || liveFestivalDay === day) return "open";
    if (forcedTestDay !== null) return "locked";
    if (isAfterFestival || (year === 2026 && month === 9 && dayOfMonth > day)) return "missed";
    return "locked";
  }

  function launchToday() {
    if (!activeDay && !ROULETTE_PREVIEW_ENABLED) return;
    sound("click");
    setView(activeDay ? gameView[activeDay] : "wheel");
  }

  const dayLabel = activeDay ? String(activeDay) : "11";
  const lockedLabel = isAfterFestival ? "FIESTAS FINALIZADAS" : `DISPONIBLE EL ${dayLabel} SEPT`;

  // Fecha visible de la tarjeta: siempre la fecha REAL de hoy en Europe/Madrid.
  // No depende del día del festival ni del modo test.
  const currentMonthLabel = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    month: "short",
  }).format(new Date()).replace(".", "").toUpperCase();

  return <main className="play-hub-approved play-hub-stable" aria-label="Jugar ahora · La Exclusiva">
    <div className="play-hub-stable__top">
      <img src="/assets/play-hub-top-user.png" alt="EXCLU · La Exclusiva" />
      <button className="play-back-button stable-back" onClick={() => { sound("click"); setView("home"); }} aria-label="Volver a Inicio"><ChevronLeft /></button>
      <button className={`play-sound-hotspot stable-sound ${soundOn ? "is-on" : "is-off"}`} onClick={onToggleSound} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
    </div>

    <section className="stable-card stable-game-card" aria-label="Juego del día">
      <img src="/assets/game-card-user.png" alt="Ruleta · juego del día" />
      <div className="stable-current-date" aria-label={`Hoy ${dayOfMonth} ${currentMonthLabel}`}>
        <span>HOY</span>
        <strong>{dayOfMonth}</strong>
        <em>{currentMonthLabel}</em>
      </div>
      <button className="stable-game-button" onClick={launchToday} disabled={!activeDay && !ROULETTE_PREVIEW_ENABLED} aria-label={activeDay ? `Jugar al juego del día ${activeDay}` : lockedLabel} />
      {!activeDay && <div className="stable-game-lock" aria-hidden="true"><LockKeyhole size={16}/><span>{lockedLabel}</span></div>}
    </section>

    <section className="stable-card stable-passport-card" aria-label="Tu Pasaporte">
      <img src="/assets/passport-card-user.png" alt="Tu Pasaporte · 11, 12 y 13 de septiembre" />
      <div className="stable-passport-states" aria-label="Estado de los tres días">
        {([11,12,13] as const).map((d, index) => {
          const state = dayState(d);
          return <div key={d} className={`stable-passport-day stable-passport-day-${index+1} ${state}`} title={`Día ${d}: ${state}`}>
            <span className="stable-day-symbol">
              {state === "done" ? <CheckCircle2/> : state === "open" ? <span className="stable-day-open">{index+1}</span> : <LockKeyhole/>}
            </span>
            <span className="stable-day-label">DÍA {index+1}</span>
          </div>;
        })}
      </div>
      <button className="stable-passport-hot" onClick={() => { sound("click"); setView("passport"); }} aria-label="Abrir mi Pasaporte" />
    </section>
  </main>;
}

function GamesHub({ setView }: { setView: (v: View) => void }) {
  const games: Array<{view: View; icon:string; title:string; text:string; featured?:boolean}> = [
    {view:"fly", icon:"🚀", title:"EXCLU Vuela", text:"Vuela, esquiva obstáculos y supera tu récord.", featured:true},
    {view:"scratch", icon:"🪙", title:"Rasca EXCLU", text:"Rasca la tarjeta y descubre el mensaje de EXCLU."},
    {view:"find", icon:"🤖", title:"Encuentra a EXCLU", text:"Encuentra al robot escondido antes de que se acabe el tiempo."},
    {view:"memory", icon:"🧠", title:"Memoria EXCLU", text:"Encuentra todas las parejas en el menor número de movimientos."},
    {view:"rings", icon:"⭕", title:"Lanza Aros", text:"Afina la puntería y consigue la máxima puntuación."},
  ];
  return <section className="games-hub">
    <div className="play-brand compact"><img src="/assets/logo-la-exclusiva-approved.png" alt="La Exclusiva Cafetería" /></div>
    <div className="games-title"><Gamepad2/><div><span>JUEGOS</span><h1>EXCLU GAMES</h1><p>Diviértete y supera tus propios récords.</p></div></div>
    <div className="games-grid">{games.map(g=><button key={g.view} className={g.featured?"featured":""} onClick={()=>{sound("click");setView(g.view)}}><span className="games-icon">{g.icon}</span><div><b>{g.title}</b><small>{g.text}</small></div><strong>›</strong></button>)}</div>
    <p className="games-note">Los juegos son de habilidad y diversión. Los premios reales están ligados a la participación diaria.</p>
  </section>;
}

function DayTile({ tone, day, title, icon, done, onClick }: any) {
  return <button className={`day-tile ${tone}`} onClick={onClick}><span className="day-tag">DÍA {day}</span><span className="day-icon">{icon}</span><strong>{title}</strong><small>{done ? "✓ COMPLETADO" : "TOCA PARA JUGAR"}</small></button>;
}

function Hot({ x, y, w, h, onClick, label }: any) {
  return <button className="hot" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} onClick={onClick} aria-label={label} title={label} />;
}


function ArcadeStrip({ setView }: { setView: (v: View)=>void }) {
  return <section className="arcade-strip arcade-009">
    <div><span>EXCLU JUEGOS</span><h2>Juega, colecciona y presume de récord</h2><p>Los juegos son de habilidad y diversión. Los premios reales siguen ligados a la participación diaria de EXCLU FEST.</p></div>
    <div className="arcade-buttons">
      <button onClick={()=>{sound("click");setView("scratch")}}>🪙 Rasca EXCLU</button>
      <button className="featured" onClick={()=>{sound("click");setView("fly")}}>🚀 EXCLU Vuela</button>
      <button onClick={()=>{sound("click");setView("find")}}>🤖 Encuentra a EXCLU</button>
      <button onClick={()=>{sound("click");setView("memory")}}>🧠 Memoria EXCLU</button>
      <button onClick={()=>{sound("click");setView("rings")}}>⭕ Lanza Aros</button>
    </div>
  </section>;
}

function ScratchGame(){
  const [pct,setPct]=useState(0); const [done,setDone]=useState(false);
  function scratch(){ if(done)return; const next=Math.min(100,pct+14+Math.floor(Math.random()*13)); setPct(next); sound("click"); if(next>=72){setDone(true);sound("win");}}
  return <Card tone="orange" tag="EXCLU JUEGOS" title="RASCA EXCLU" sub="Rasca la tarjeta y descubre el mensaje de fiesta"><div className="scratch-card" onPointerMove={(e)=>{if(e.buttons===1)scratch()}} onClick={scratch}><div className="scratch-secret">🤖<b>¡EXCLU TE DESEA<br/>FELICES FIESTAS!</b><small>Has encontrado una estrella EXCLU ⭐</small></div><div className="scratch-cover" style={{clipPath:`inset(0 ${pct}% 0 0)`}}>✦ RASCA AQUÍ ✦<span>{pct}%</span></div></div>{done&&<div className="arcade-success">✨ ¡Descubierto! Coleccionable desbloqueado: Estrella de Fiesta.</div>}</Card>
}

function ExcluFly(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rafRef=useRef<number|undefined>(undefined);
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [distance,setDistance]=useState(0);
  const [collected,setCollected]=useState(0);
  const [best,setBest]=useState(()=>Number(localStorage.getItem("exclu_fly_best")||0));
  const [chest,setChest]=useState<string|null>(null);
  const stateRef=useRef({y:230,vy:0,t:0,last:0,dist:0,items:0,obstacles:[] as {x:number,gap:number}[],stars:[] as {x:number,y:number,taken:boolean}[]});

  function reset(){
    stateRef.current={y:230,vy:0,t:0,last:performance.now(),dist:0,items:0,obstacles:Array.from({length:7},(_,i)=>({x:620+i*210,gap:120+Math.random()*230})),stars:Array.from({length:12},(_,i)=>({x:480+i*125,y:80+Math.random()*300,taken:false}))};
    setDistance(0);setCollected(0);setFinished(false);setChest(null);
  }
  function flap(){if(!running)return;stateRef.current.vy=-6.2;sound("click");if(navigator.vibrate)navigator.vibrate(18)}
  function start(){reset();setRunning(true);sound("open")}
  useEffect(()=>{if(!running)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;
    const loop=(now:number)=>{const st=stateRef.current;const dt=Math.min(32,now-st.last)/16.67;st.last=now;st.t+=dt;st.vy+=0.34*dt;st.y+=st.vy*dt;st.dist+=2.4*dt;
      st.obstacles.forEach(o=>o.x-=3.2*dt);st.stars.forEach(o=>o.x-=3.2*dt);
      if(st.obstacles[0]?.x<-80){const o=st.obstacles.shift()!;o.x=(st.obstacles.at(-1)?.x||620)+210;o.gap=110+Math.random()*250;st.obstacles.push(o)}
      if(st.stars[0]?.x<-40){const q=st.stars.shift()!;q.x=(st.stars.at(-1)?.x||620)+125;q.y=70+Math.random()*320;q.taken=false;st.stars.push(q)}
      // colisiones con estrellas
      st.stars.forEach(q=>{if(!q.taken && Math.hypot(q.x-125,q.y-st.y)<34){q.taken=true;st.items++;sound("correct")}});
      // colisiones con pilares, techo y suelo
      const hit=st.y<28||st.y>432||st.obstacles.some(o=>Math.abs(o.x-125)<34 && (st.y<o.gap-72||st.y>o.gap+72));
      drawFly(ctx,c,st);
      setDistance(Math.floor(st.dist));setCollected(st.items);
      if(hit){setRunning(false);setFinished(true);sound("lose");return}
      if(st.dist>=1000){setRunning(false);setFinished(true);const score=Math.floor(st.dist)+st.items*60;const nb=Math.max(best,score);setBest(nb);localStorage.setItem("exclu_fly_best",String(nb));setChest(st.items>=7?"🏆 Cofre dorado: Coleccionable EXCLU Maestro del Vuelo":"⭐ Cofre EXCLU: Estrella de Festival desbloqueada");sound("win");return}
      rafRef.current=requestAnimationFrame(loop)};
    rafRef.current=requestAnimationFrame(loop);return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[running,best]);
  return <Card tone="purple" tag="EXCLU JUEGOS · JUEGO ESTRELLA" title="EXCLU VUELA" sub="Toca la pantalla para volar, esquiva obstáculos y recoge estrellas hasta llegar al Cofre EXCLU">
    <div className="fly-hud"><span>🚀 {distance} m</span><span>⭐ {collected}</span><span>🏆 Récord {best}</span></div>
    <div className="fly-stage" onPointerDown={flap}><canvas ref={canvasRef} width={720} height={460}/>{!running&&!finished&&<div className="fly-overlay"><img src="/assets/exclu-robot-premium.png"/><h2>¿LISTO PARA VOLAR?</h2><p>Llega a 1.000 m y abre el Cofre EXCLU.</p><button onClick={(e)=>{e.stopPropagation();start()}}>JUGAR AHORA</button></div>}{finished&&<div className="fly-overlay result-mini"><h2>{distance>=1000?"¡META CONSEGUIDA!":"¡CASI!"}</h2><p>{chest||`Has llegado a ${distance} m y recogido ${collected} estrellas.`}</p><button onClick={(e)=>{e.stopPropagation();start()}}>VOLVER A INTENTAR</button></div>}</div>
    <div className="fly-progress"><i style={{width:`${Math.min(100,distance/10)}%`}}/><span>🏁 1.000 m</span></div>
  </Card>
}

function drawFly(ctx:CanvasRenderingContext2D,c:HTMLCanvasElement,st:any){
  const g=ctx.createLinearGradient(0,0,0,c.height);g.addColorStop(0,"#16052b");g.addColorStop(.5,"#07142a");g.addColorStop(1,"#020406");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle="#ffc24a";for(let i=0;i<34;i++){const x=(i*97-st.dist*1.7)%c.width;const y=28+(i*67)%390;ctx.globalAlpha=.18+(i%5)*.1;ctx.fillRect(x<0?x+c.width:x,y,2,2)}ctx.globalAlpha=1;
  // skyline
  ctx.fillStyle="#09101d";for(let i=0;i<12;i++){const x=i*70-(st.dist*.35%70);ctx.fillRect(x,330+(i%3)*18,52,130)}
  // obstacles
  st.obstacles.forEach((o:any)=>{ctx.fillStyle="#42215f";ctx.strokeStyle="#e1a43b";ctx.lineWidth=3;ctx.fillRect(o.x-24,0,48,o.gap-72);ctx.strokeRect(o.x-24,0,48,o.gap-72);ctx.fillRect(o.x-24,o.gap+72,48,c.height-o.gap-72);ctx.strokeRect(o.x-24,o.gap+72,48,c.height-o.gap-72)});
  st.stars.forEach((q:any)=>{if(q.taken)return;ctx.font="28px Arial";ctx.fillText("⭐",q.x,q.y)});
  ctx.save();ctx.translate(125,st.y);ctx.rotate(Math.max(-.45,Math.min(.55,st.vy*.05)));ctx.fillStyle="#fff0d2";ctx.strokeStyle="#ffb43e";ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-28,-24,56,48,18);ctx.fill();ctx.stroke();ctx.fillStyle="#071218";ctx.beginPath();ctx.roundRect(-20,-15,40,28,10);ctx.fill();ctx.fillStyle="#58fff1";ctx.beginPath();ctx.arc(-8,-3,5,0,7);ctx.arc(8,-3,5,0,7);ctx.fill();ctx.strokeStyle="#58fff1";ctx.beginPath();ctx.arc(0,4,8,.2,2.9);ctx.stroke();ctx.fillStyle="#ff8a2b";ctx.beginPath();ctx.moveTo(-32,10);ctx.lineTo(-52,20);ctx.lineTo(-30,26);ctx.fill();ctx.restore();
}

function MemoryExclu(){
  const symbols=["🤖","☕","🥐","🎉","⭐","🎁"];const [deck,setDeck]=useState(()=>shuffle([...symbols,...symbols]));const [open,setOpen]=useState<number[]>([]);const [matched,setMatched]=useState<number[]>([]);const [moves,setMoves]=useState(0);
  function restart(){setDeck(shuffle([...symbols,...symbols]));setOpen([]);setMatched([]);setMoves(0)}
  function flip(i:number){if(open.length===2||open.includes(i)||matched.includes(i))return;const next=[...open,i];setOpen(next);sound("click");if(next.length===2){setMoves(m=>m+1);if(deck[next[0]]===deck[next[1]]){setMatched(m=>[...m,...next]);setOpen([]);sound("correct")}else setTimeout(()=>{setOpen([]);sound("wrong")},650)}}
  const done=matched.length===deck.length;
  return <Card tone="teal" tag="EXCLU JUEGOS" title="MEMORIA EXCLU" sub="Encuentra las parejas con el menor número de movimientos"><div className="memory-top"><b>{moves} movimientos</b>{done&&<strong>✨ ¡COLECCIÓN COMPLETA!</strong>}</div><div className="memory-grid">{deck.map((x,i)=><button key={i} onClick={()=>flip(i)} className={open.includes(i)||matched.includes(i)?"open":""}>{open.includes(i)||matched.includes(i)?x:"✦"}</button>)}</div><button className="teal" onClick={restart}>NUEVA PARTIDA</button></Card>
}
function shuffle<T>(a:T[]){return a.sort(()=>Math.random()-.5)}

function RingToss(){
  const [pos,setPos]=useState(50);const [dir,setDir]=useState(1);const [score,setScore]=useState(0);const [throws,setThrows]=useState(5);const [flash,setFlash]=useState("");
  useEffect(()=>{if(throws<=0)return;const id=setInterval(()=>setPos(p=>{let n=p+dir*3;if(n>90){n=90;setDir(-1)}if(n<10){n=10;setDir(1)}return n}),45);return()=>clearInterval(id)},[dir,throws]);
  function toss(){if(throws<=0)return;const hit=Math.abs(pos-50)<13;setThrows(t=>t-1);if(hit){setScore(s=>s+1);setFlash("¡ARO DENTRO! +1");sound("correct")}else{setFlash("¡CERCA!");sound("wrong")}setTimeout(()=>setFlash(""),700)}
  return <Card tone="orange" tag="EXCLU JUEGOS" title="LANZA AROS" sub="Calcula el momento y encesta el aro en la botella"><div className="rings-stage"><div className="rings-bottle" style={{left:`${pos}%`}}>🍾</div><div className="rings-target">◎</div>{flash&&<strong>{flash}</strong>}</div><div className="rings-score"><span>⭕ Aros: {throws}</span><span>🏆 Aciertos: {score}</span></div><button className="teal" onClick={toss} disabled={throws<=0}>{throws>0?"LANZAR ARO":"PARTIDA TERMINADA"}</button>{throws<=0&&<button className="outline-gold" onClick={()=>{setThrows(5);setScore(0)}}>JUGAR OTRA VEZ</button>}</Card>
}

function FindExclu(){
 const [round,setRound]=useState(0); const [found,setFound]=useState(false); const pos=[12,68,35,80,48][round%5];
 function hit(){setFound(true);sound("win");setTimeout(()=>{setFound(false);setRound(r=>r+1)},1100)}
 return <Card tone="orange" tag="EXCLU JUEGOS" title="¿DÓNDE ESTÁ EXCLU?" sub="Encuentra al robot escondido entre la fiesta"><div className="find-stage">{Array.from({length:18}).map((_,i)=><span key={i} className="crowd">{["🥳","🎉","🍻","🎺","🕺","💃"][i%6]}</span>)}<button className={`hidden-exclu ${found?"found":""}`} onClick={hit} style={{left:`${pos}%`,top:`${22+(round*17)%55}%`}}><img src="/assets/exclu-robot-premium.png" alt="Encuentra a EXCLU"/></button>{found&&<strong>¡ENCONTRADO! 🤖✨</strong>}</div><p className="game-hint"><Search size={16}/> Ronda {round+1} · toca al robot cuando lo veas</p></Card>
}

function RegisterPanel({ registered, phoneMasked, phone, setPhone, accepted, setAccepted, busy, onRegister }: any) {
  return <section id="register" className={`register-panel ${registered ? "registered" : ""}`}>
    <img src="/assets/exclu-robot-premium.png" alt="EXCLU" />
    <div className="register-copy">
      <b>{registered ? "✓ YA ESTÁS REGISTRADO" : "PARTICIPA SIN SMS Y SIN COSTE"}</b>
      <small>{registered ? `${phoneMasked ?? "Tu teléfono"} · Una participación por persona y día.` : "Introduce tu teléfono. Lo usamos solo para evitar participaciones duplicadas; no enviamos ningún SMS."}</small>
    </div>
    {!registered && <div className="register-actions">
      <label className="phone-field"><span>🇪🇸 +34</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="600 000 000" maxLength={16} disabled={busy}/></label>
      <label className="terms"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> <span>Acepto las bases de participación y la política de privacidad.</span></label>
      <button className="cta-orange" onClick={onRegister} disabled={busy}>{busy ? "REGISTRANDO…" : "REGISTRARME Y PARTICIPAR"}</button>
    </div>}
  </section>;
}

function makePreviewRewardCode(day = 11) {
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const datePart = `${String(day).padStart(2,"0")}${months[8]}`;
  const storageKey = "exclu_preview_reward_codes";
  let used: string[] = [];
  try { used = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch {}
  let code = "";
  do {
    const randomNumber = String(Math.floor(100000 + Math.random() * 900000));
    code = `EXCLU-${datePart}-${randomNumber}`;
  } while (used.includes(code));
  used.push(code);
  try { localStorage.setItem(storageKey, JSON.stringify(used.slice(-250))); } catch {}
  return code;
}

function RoulettePrizePopup({ result, onClose }: { result: GameResult; onClose: () => void }) {
  return (
    <div className="roulette-prize-overlay roulette-prize-overlay--v084" role="dialog" aria-modal="true" aria-labelledby="roulette-prize-title">
      <div className="roulette-prize-v084">
        <img
          className="roulette-prize-v084__art"
          src="/assets/roulette-popup-approved-v084.png"
          alt=""
          aria-hidden="true"
        />

        <button
          className="roulette-prize-v084__close"
          onClick={onClose}
          aria-label="Cerrar premio"
        />

        <div className="roulette-prize-v084__prize" aria-live="polite">
          <span className="roulette-prize-v084__icon">{result.prize_icon || "🎁"}</span>
          <div className="roulette-prize-v084__copy">
            <strong id="roulette-prize-title">{result.prize_name || "PREMIO"}</strong>
            <small>{result.prize_description || "Premio de La Exclusiva"}</small>
          </div>
        </div>

        <code className="roulette-prize-v084__code">{result.reward_code}</code>

        <button
          className="roulette-prize-v084__ok"
          onClick={onClose}
          aria-label="Cerrar y continuar"
        />
      </div>
    </div>
  );
}

function Wheel({ busy, played, registered, play, soundOn, onToggleSound }: { busy: boolean; played: boolean; registered: boolean; play: () => Promise<GameResult | null>; soundOn: boolean; onToggleSound: () => void }) {
  const wheelRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "spin" | "saving">("idle");
  const [prizePopup, setPrizePopup] = useState<GameResult | null>(null);
  const [spinMessage, setSpinMessage] = useState("");
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickIndexRef = useRef(-1);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close(); } catch {}
  }, []);

  function rouletteTick(strength = 1) {
    if (!soundOn || localStorage.getItem("exclu_sound") === "off") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioCtxRef.current && audioCtxRef.current.state !== "closed" ? audioCtxRef.current : new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(900 + Math.random()*220, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045 * strength, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.032);
    } catch {}
  }

  function prizeFanfare() {
    if (!soundOn || localStorage.getItem("exclu_sound") === "off") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
      const now = ctx.currentTime;
      const melody = [523.25,659.25,783.99,1046.5,783.99,1046.5];
      melody.forEach((freq,i)=>{
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i < 4 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now + i*0.105);
        g.gain.setValueAtTime(0.0001, now + i*0.105);
        g.gain.exponentialRampToValueAtTime(0.16, now + i*0.105 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.105 + 0.19);
        osc.connect(g); g.connect(master); osc.start(now + i*0.105); osc.stop(now + i*0.105 + 0.22);
      });
      setTimeout(()=>{ try { ctx.close(); } catch {} }, 1600);
    } catch {}
  }

  function playCelebration() {
    if (!soundOn || localStorage.getItem("exclu_sound") === "off") return;
    try {
      const audio = new Audio("/assets/celebration-v2.wav");
      audio.volume = 0.9;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {}
  }

  function animate(to:number,duration:number){
    const from=angleRef.current;
    return new Promise<void>((resolve)=>{
      const started=performance.now();
      const frame=(now:number)=>{
        const t=Math.min(1,(now-started)/duration);
        const eased=1-Math.pow(1-t,4);
        const a=from+(to-from)*eased;
        angleRef.current=a;
        if(wheelRef.current) wheelRef.current.style.transform=`rotate(${a}deg)`;
        const tickIndex = Math.floor(a / 30);
        if (tickIndex !== tickIndexRef.current) {
          tickIndexRef.current = tickIndex;
          rouletteTick(Math.max(.35, 1 - t*.45));
        }
        if(t<1) rafRef.current=requestAnimationFrame(frame); else resolve();
      };
      rafRef.current=requestAnimationFrame(frame);
    });
  }

  async function go(){
    if(phase!=="idle" || busy) return;
    if(!registered){
      document.getElementById("register")?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }
    if(played && !ROULETTE_PREVIEW_ENABLED) return;
    setPrizePopup(null);
    setSpinMessage("");
    rouletteTick(1);
    if(navigator.vibrate) navigator.vibrate([20,25,20]);
    setPhase("spin");

    // El puntero permanece fijo. Solo gira la rueda y termina con el centro
    // de un sector exactamente bajo la flecha superior.
    const sectorAngle = 30;
    const targetIndex = Math.floor(Math.random() * 12);
    const currentNormalized = ((angleRef.current % 360) + 360) % 360;
    const desiredNormalized = (360 - targetIndex * sectorAngle) % 360;
    const correction = (desiredNormalized - currentNormalized + 360) % 360;
    const targetAngle = angleRef.current + (8 * 360) + correction;

    await animate(targetAngle,5200);
    setPhase("saving");
    try {
      let gameResult: GameResult | null;
      if (ROULETTE_PREVIEW_ENABLED) {
        // Premios TEMPORALES de prueba vinculados al sector real donde se detiene la ruleta.
        // Se sustituirán por el catálogo definitivo de Supabase cuando nos pases los premios finales.
        // Orden REAL de los 12 sectores de la imagen aprobada, empezando arriba
        // (bajo el puntero) y avanzando en sentido horario.
        const previewPrizes = [
          { prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁" }, // 12:00
          { prize_name: "PREMIO SORPRESA", prize_description: "Premio identificado con ticket", prize_icon: "🎟️" },
          { prize_name: "PREMIO ESPECIAL", prize_description: "Premio identificado con estrella", prize_icon: "⭐" },
          { prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁" },
          { prize_name: "CAFÉ GRATIS", prize_description: "Cualquier café de la carta", prize_icon: "☕" },
          { prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁" },
          { prize_name: "CAFÉ GRATIS", prize_description: "Cualquier café de la carta", prize_icon: "☕" },
          { prize_name: "PREMIO ESPECIAL", prize_description: "Premio identificado con estrella", prize_icon: "⭐" },
          { prize_name: "PREMIO SORPRESA", prize_description: "Premio identificado con ticket", prize_icon: "🎟️" },
          { prize_name: "CAFÉ GRATIS", prize_description: "Cualquier café de la carta", prize_icon: "☕" },
          { prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁" },
          { prize_name: "CAFÉ GRATIS", prize_description: "Cualquier café de la carta", prize_icon: "☕" },
        ];
        // El giro se programa para dejar exactamente targetIndex bajo la flecha fija.
        // Usamos ese mismo índice como fuente del premio para evitar cualquier desfase visual.
        const landedIndex = targetIndex;
        const previewPrize = previewPrizes[landedIndex] ?? previewPrizes[0];
        gameResult = {
          won: true,
          day: 11,
          ...previewPrize,
          reward_code: makePreviewRewardCode(11),
          message: "Premio de prueba",
        };
      } else {
        gameResult = await play();
      }

      if (gameResult?.won && gameResult.reward_code) {
        playCelebration();
        if(navigator.vibrate) navigator.vibrate([35,35,70,40,120]);
        setPrizePopup(gameResult);
      } else if (gameResult) {
        sound("correct");
        setSpinMessage(gameResult.message || "Tu participación está registrada para el sorteo final.");
      }
    } finally { setPhase("idle"); }
  }

  const label = !registered ? "REGÍSTRATE PARA JUGAR" : (played && !ROULETTE_PREVIEW_ENABLED) ? "✓ COMPLETADO" : phase!=="idle" || busy ? "¡GIRANDO!" : "¡JUGAR AHORA!";

  return <section className="roulette-approved" aria-label="Ruleta La Exclusiva">
    <img className="roulette-approved__art" src="/assets/roulette-approved-screen.png" alt="Ruleta La Exclusiva" />
<img ref={wheelRef} className={`roulette-approved__wheel ${phase!=="idle"?"is-spinning":""}`} src="/assets/roulette-approved-wheel.png" alt="" aria-hidden="true" />
<span className="roulette-approved__pointer" aria-hidden="true"><i /></span>
    <button className="roulette-approved__back" onClick={()=>{sound("click"); window.dispatchEvent(new CustomEvent("exclu-back-to-play"));}} aria-label="Volver" />
    <button className={`roulette-approved__sound ${soundOn ? "is-on" : "is-off"}`} onClick={onToggleSound} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"} title={soundOn ? "Desactivar sonido" : "Activar sonido"}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
    <button className="roulette-approved__cta" onClick={go} disabled={phase!=="idle" || busy || (played && !ROULETTE_PREVIEW_ENABLED)} aria-label={label}><span>{label}</span></button>
    {!registered && <div className="roulette-approved__status">Primero regístrate para poder girar</div>}
    {played && !ROULETTE_PREVIEW_ENABLED && <div className="roulette-approved__status">Ya has realizado tu giro de hoy</div>}
    {spinMessage && !prizePopup && <div className="roulette-approved__message">{spinMessage}</div>}
    {prizePopup && <RoulettePrizePopup result={prizePopup} onClose={()=>{sound("click");setPrizePopup(null);}} />}
  </section>;
}

const questions = [
  ["¿A qué hora abre La Exclusiva?", ["08:00", "06:00", "10:00"], 1],
  ["¿Cómo se llama nuestro robot?", ["EXCLU", "NICO", "LUX"], 0],
  ["¿Cuántos días dura EXCLU FEST?", ["1", "2", "3"], 2],
] as const;

function Quiz({ busy, played, play }: { busy: boolean; played: boolean; play: () => Promise<GameResult | null> }) {
  const [n, setN] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const q = questions[n];

  async function choose(i: number) {
    if (locked || busy || played) return;
    setSelected(i);
    if (i !== q[2]) { sound("wrong"); setTimeout(()=>setSelected(null),650); return; }
    sound("correct");
    setLocked(true);
    await new Promise((r) => setTimeout(r, 550));
    if (n === questions.length - 1) {
      try { await play(); } finally { setLocked(false); }
    } else {
      setN((v) => v + 1); setSelected(null); setLocked(false);
    }
  }

  return <Card tone="teal" tag="DÍA 12 SEPTIEMBRE" title="EL RETO DEL COTO" sub={played ? "Reto completado" : "Pon a prueba lo que sabes sobre La Exclusiva"}>
    <div className="quiz"><div className="quiz-progress"><i style={{width:`${((n+1)/3)*100}%`}}/></div><small>Pregunta {n + 1} de 3</small><h2>{q[0]}</h2>{q[1].map((answer, i) => <button disabled={played || locked || busy} onClick={() => choose(i)} className={selected === i ? (i === q[2] ? "good" : "bad") : ""} key={answer}>{answer}{selected === i && i === q[2] ? " ✓" : ""}</button>)}</div>
    {played && <div className="completed-pill">✓ YA COMPLETADO</div>}
  </Card>;
}

function Boxes({ busy, played, play }: { busy: boolean; played: boolean; play: (choice: string) => Promise<GameResult | null> }) {
  const [pick, setPick] = useState<number | null>(null);
  async function choose(n: number) {
    if (pick || busy || played) return;
    setPick(n); sound("open");
    await new Promise((r) => setTimeout(r, 1500));
    try { await play(String(n)); } catch { setPick(null); }
  }
  return <Card tone="purple" tag="DÍA 13 SEPTIEMBRE" title="LA CAJA FUERTE DEL PREMIO FINAL" sub={played ? "Ya abriste tu caja de este día" : "Elige una caja y descubre tu premio"}>
    <h2 className="choose">ELIGE TU CAJA</h2>
    <div className="boxes">{[1,2,3].map((n) => <button className={pick === n ? "picked" : ""} disabled={played || busy || pick !== null} onClick={() => choose(n)} key={n}><span className="box-lid">🎁</span><b>{n}</b><em>✦</em></button>)}</div>
    {pick && !played && <p>EXCLU está abriendo la caja {pick}…</p>}
    {played && <div className="completed-pill">✓ YA COMPLETADO</div>}
  </Card>;
}

function Passport({ status }: { status: FestivalStatus }) {
  const rawPlayedDays = new Set((status.played_days ?? []).map((d) => Number(d.day)));

  const madridParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const part = (type: "year" | "month" | "day") =>
    Number(madridParts.find((p) => p.type === type)?.value ?? 0);

  const year = part("year");
  const month = part("month");
  const today = part("day");

  const storedTestDay = Number(localStorage.getItem("exclu_test_day"));
  const forcedTestDay: 11 | 12 | 13 | null =
    Boolean(status.test_mode) && [11, 12, 13].includes(storedTestDay)
      ? (storedTestDay as 11 | 12 | 13)
      : null;

  const beforeFestival =
    year < 2026 || (year === 2026 && (month < 9 || (month === 9 && today < 11)));

  const afterFestival =
    year > 2026 || (year === 2026 && (month > 9 || (month === 9 && today > 13)));

  type PassportDayState = "done" | "open" | "locked" | "missed";

  function isPlayedDayValidForDisplay(day: 11 | 12 | 13) {
    if (forcedTestDay !== null) {
      return rawPlayedDays.has(day) && day === forcedTestDay;
    }
    if (beforeFestival) return false;
    if (afterFestival) return rawPlayedDays.has(day);
    if (year === 2026 && month === 9) {
      return rawPlayedDays.has(day) && day <= today;
    }
    return false;
  }

  function getDayState(day: 11 | 12 | 13): PassportDayState {
    if (forcedTestDay !== null) {
      if (isPlayedDayValidForDisplay(day)) return "done";
      return forcedTestDay === day ? "open" : "locked";
    }

    if (beforeFestival) return "locked";
    if (isPlayedDayValidForDisplay(day)) return "done";

    if (year === 2026 && month === 9 && today === day) {
      return "open";
    }

    if (afterFestival || (year === 2026 && month === 9 && today > day)) {
      return "missed";
    }

    return "locked";
  }

  const dayConfig = [
    { day: 11 as const, dayLabel: "DÍA 1", dateLabel: "11 SEPT" },
    { day: 12 as const, dayLabel: "DÍA 2", dateLabel: "12 SEPT" },
    { day: 13 as const, dayLabel: "DÍA 3", dateLabel: "13 SEPT" },
  ];

  const visibleCompleted = dayConfig.filter(({ day }) => isPlayedDayValidForDisplay(day)).length;
  const passportComplete = visibleCompleted === 3;
  const raffleEntries = beforeFestival && forcedTestDay === null ? 0 : (status.raffle_entries ?? 0);

  return (
    <main className="passport-screen" aria-label="Pasaporte EXCLU">
      <section className="passport-book">
        <header className="passport-book__brand">
          <div className="passport-book__brand-mark">
            <img src="/assets/logo-la-exclusiva-real-icon.png" alt="" aria-hidden="true" />
          </div>
          <div className="passport-book__brand-text">
            <strong>La Exclusiva</strong>
            <span>CAFETERÍA</span>
          </div>
        </header>

        <div className="passport-book__rule" />

        <div className="passport-book__hero">
          <div>
            <span className="passport-book__eyebrow">PASAPORTE EXCLU</span>
            <h1>TU PASAPORTE</h1>
            <p>
              Completa los tres días de fiesta y consigue
              <strong> +2 participaciones extra</strong> para el sorteo final.
            </p>
          </div>

          <div className="passport-book__cover" aria-hidden="true">
            <div className="passport-book__cover-logo">
              <PassportGlyph />
            </div>
            <strong>EXCLU</strong>
            <span>PASAPORTE</span>
          </div>
        </div>

        <div className="passport-book__divider" />

        <div className="passport-book__days">
          {dayConfig.map(({ day, dayLabel, dateLabel }) => {
            const state = getDayState(day);
            const isDone = state === "done";
            const isOpen = state === "open";

            return (
              <article
                key={day}
                className={`passport-book__day is-${state}`}
                aria-label={`${dayLabel} ${dateLabel}`}
              >
                <div className="passport-book__stamp">
                  {isDone ? (
                    <CheckCircle2 size={31} strokeWidth={2.6} />
                  ) : (
                    <LockKeyhole size={25} strokeWidth={2.1} />
                  )}
                </div>
                <strong>{dayLabel}</strong>
                <span>{dateLabel}</span>
                <small>
                  {isDone
                    ? "COMPLETADO"
                    : isOpen
                      ? (status.registered ? "DISPONIBLE HOY" : "REGÍSTRATE")
                      : state === "missed"
                        ? "FINALIZADO"
                        : "BLOQUEADO"}
                </small>
              </article>
            );
          })}
        </div>

        <div className={`passport-book__reward ${passportComplete ? "is-complete" : ""}`}>
          <Gift size={26} />
          <div>
            <strong>{passportComplete ? "¡PASAPORTE COMPLETO!" : "COMPLETA LOS 3 DÍAS"}</strong>
            <span>
              {passportComplete
                ? "Tus +2 participaciones extra ya están añadidas."
                : "+2 PARTICIPACIONES EXTRA PARA EL SORTEO FINAL"}
            </span>
          </div>
        </div>

        <div className="passport-book__footer">
          <div>
            <span>SELLOS</span>
            <strong>{visibleCompleted}/3</strong>
          </div>
          <div className="passport-book__footer-separator" />
          <div>
            <span>PARTICIPACIONES</span>
            <strong>{raffleEntries}</strong>
          </div>
        </div>

        {forcedTestDay !== null && (
          <div className="passport-book__test">
            MODO PRUEBAS · DÍA {forcedTestDay} HABILITADO
          </div>
        )}
      </section>
    </main>
  );
}

function Photo({ onPhotoCreated, setView }: { onPhotoCreated: () => void; setView: (v: View) => void }){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const [cameraOn,setCameraOn]=useState(false);
  const [cameraSwitching,setCameraSwitching]=useState(false);
  const [photoUrl,setPhotoUrl]=useState<string|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("user");
  const [flash,setFlash]=useState(false);
  const [frame,setFrame]=useState("classic");
  const [sticker,setSticker]=useState("exclu");
  const [filter,setFilter]=useState("normal");

  const frameIds=["classic","party","selfie","cheers","good","team","asturias"];
  const stickerIds=["exclu","salud","beer","hearts","crown","glasses","confetti","heart","coffee","exclusive","selfie","fiestas"];
  const filterIds=["normal","warm","bw","party","vintage","neon"];
  const filterCss:Record<string,string>={
    normal:"none",warm:"sepia(.28) saturate(1.2)",bw:"grayscale(1)",
    party:"saturate(1.6) hue-rotate(12deg)",vintage:"sepia(.6) saturate(.8)",
    neon:"saturate(1.9) contrast(1.2) hue-rotate(-18deg)"
  };

  async function stopCamera(){
    const current=streamRef.current;
    streamRef.current=null;
    current?.getTracks().forEach(track=>track.stop());
    if(videoRef.current){
      videoRef.current.pause();
      videoRef.current.srcObject=null;
    }
    setCameraOn(false);
  }

  async function getCameraStream(next: "user" | "environment"){
    const preferred: MediaStreamConstraints = {
      audio:false,
      video:{
        facingMode:{exact:next},
        width:{ideal:1280},
        height:{ideal:1280},
        aspectRatio:{ideal:1}
      }
    };
    try{
      return await navigator.mediaDevices.getUserMedia(preferred);
    }catch{
      return await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{
          facingMode:{ideal:next},
          width:{ideal:1280},
          height:{ideal:1280}
        }
      });
    }
  }

  async function startCamera(next: "user" | "environment" = facing){
    try{
      const oldStream=streamRef.current;
      oldStream?.getTracks().forEach(track=>track.stop());

      const stream=await getCameraStream(next);
      streamRef.current=stream;
      setFacing(next);
      setPhotoUrl(null);

      if(videoRef.current){
        videoRef.current.srcObject=stream;
        videoRef.current.muted=true;
        videoRef.current.playsInline=true;
        await videoRef.current.play();
      }

      setCameraOn(true);
    }catch(err){
      console.error("Error al abrir la cámara:",err);
      setCameraOn(false);
      alert("No se ha podido abrir la cámara. Revisa que el navegador tenga permiso para usarla.");
    }
  }

  async function switchCamera(){
    if(cameraSwitching) return;
    setCameraSwitching(true);

    const currentFacing=facing;
    const next: "user" | "environment" = currentFacing==="user" ? "environment" : "user";
    const previous=streamRef.current;

    try{
      // En móviles es más fiable liberar primero la cámara actual.
      previous?.getTracks().forEach(track=>track.stop());

      const stream=await getCameraStream(next);
      streamRef.current=stream;

      if(videoRef.current){
        videoRef.current.srcObject=stream;
        videoRef.current.muted=true;
        videoRef.current.playsInline=true;
        await videoRef.current.play();
      }

      setFacing(next);
      setCameraOn(true);
      setPhotoUrl(null);
    }catch(err){
      console.error("Error al cambiar de cámara:",err);

      // Recuperamos la cámara anterior sin desmontar los controles.
      try{
        const recovery=await getCameraStream(currentFacing);
        streamRef.current=recovery;
        if(videoRef.current){
          videoRef.current.srcObject=recovery;
          videoRef.current.muted=true;
          videoRef.current.playsInline=true;
          await videoRef.current.play();
        }
        setFacing(currentFacing);
        setCameraOn(true);
      }catch(recoveryError){
        console.error("Error al recuperar la cámara:",recoveryError);
        setCameraOn(false);
      }
    }finally{
      setCameraSwitching(false);
    }
  }
  function capture(){
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c||!cameraOn)return;
    const vw=v.videoWidth||1080,vh=v.videoHeight||1080,size=Math.min(vw,vh);
    c.width=1080;c.height=1080;
    const x=c.getContext("2d");if(!x)return;
    x.save();
    if(facing==="user"){x.translate(1080,0);x.scale(-1,1);}
    x.filter=filterCss[filter]||"none";
    x.drawImage(v,(vw-size)/2,(vh-size)/2,size,size,0,0,1080,1080);
    x.restore();
    x.strokeStyle="#f6c51c";x.lineWidth=22;x.strokeRect(12,12,1056,1056);
    const names:Record<string,string>={classic:"LA EXCLUSIVA",party:"FIESTAS",selfie:"SELFIE EXCLU",cheers:"BRINDIS",good:"BUEN ROLLO",team:"EQUIPO EXCLU",asturias:"ASTURIAS"};
    x.fillStyle="rgba(0,0,0,.68)";x.fillRect(25,25,1030,90);
    x.fillStyle="#ffd329";x.font="700 36px sans-serif";x.textAlign="center";x.fillText(names[frame],540,82);
    const st:Record<string,string>={exclu:"🤖",salud:"¡Salud!",beer:"🍻",hearts:"💕",crown:"👑",glasses:"🕶️",confetti:"🎉",heart:"💗",coffee:"☕",exclusive:"LA EXCLUSIVA",selfie:"Selfie Time ♡",fiestas:"FIESTAS 2026"};
    x.font=["salud","exclusive","selfie","fiestas"].includes(sticker)?"700 52px sans-serif":"105px sans-serif";
    x.textAlign="right";x.fillStyle="#ffd329";x.fillText(st[sticker],1015,1010);
    setPhotoUrl(c.toDataURL("image/jpeg",.92));onPhotoCreated();navigator.vibrate?.(60);
  }
  function save(){
    if(!photoUrl)return;const a=document.createElement("a");a.href=photoUrl;a.download=`exclu-fotomaton-${Date.now()}.jpg`;a.click();
  }
  async function share(){
    if(!photoUrl)return;
    try{const blob=await(await fetch(photoUrl)).blob();const file=new File([blob],"exclu-fotomaton.jpg",{type:"image/jpeg"});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:"Fotomatón La Exclusiva",files:[file]});else save();
    }catch{}
  }
  useEffect(()=>()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); },[]);

  return <main className="photo112">
    <div className="photo112-stage" data-facing={facing}>
      <img className="photo112-art" src="/assets/fotomaton-definitivo-aprobado.png" alt="Fotomatón La Exclusiva"/>
      <button className="p112-back" onClick={()=>{stopCamera();setView("home")}} aria-label="Volver"/>

      <div className="p112-preview">
        {!cameraOn&&!photoUrl&&<button className="p112-start" onClick={()=>startCamera()} aria-label="Activar cámara"/>}
        <video ref={videoRef} playsInline muted className={cameraOn&&!photoUrl?"show":""} style={{filter:filterCss[filter]}}/>
        {photoUrl&&<img src={photoUrl} alt="Tu foto" className="p112-result"/>}
      </div>

      <div className="p112-frames">
        {frameIds.map((id,i)=><button key={id} className={frame===id?"active":""} style={{top:`${i*14.2857}%`}} onClick={()=>setFrame(id)} aria-label={`Marco ${id}`}/>)}
      </div>
      <div className="p112-stickers">
        {stickerIds.map((id,i)=><button key={id} className={sticker===id?"active":""} style={{left:`${(i%2)*50}%`,top:`${Math.floor(i/2)*16.6667}%`}} onClick={()=>setSticker(id)} aria-label={`Sticker ${id}`}/>)}
      </div>
      <div className="p112-filters">
        {filterIds.map((id,i)=><button key={id} className={filter===id?"active":""} style={{left:`${(i%2)*50}%`,top:`${Math.floor(i/2)*33.3333}%`}} onClick={()=>setFilter(id)} aria-label={`Filtro ${id}`}/>)}
      </div>

      <button className={`p112-switch ${cameraSwitching?"switching":""}`} onClick={switchCamera} disabled={cameraSwitching} aria-label={facing==="user"?"Cambiar a cámara trasera":"Cambiar a cámara frontal"}/>
      <button className="p112-shot" onClick={()=>cameraOn?capture():startCamera()} aria-label="Hacer foto"/>
      <button className={`p112-flash ${flash?"active":""}`} onClick={()=>setFlash(v=>!v)} aria-label="Flash"/>
      {photoUrl&&<>
        <button className="p112-save" onClick={save} aria-label="Guardar"/>
        <button className="p112-share" onClick={share} aria-label="Compartir"/>
        <button className="p112-repeat" onClick={()=>setPhotoUrl(null)} aria-label="Repetir"/>
      </>}
      <canvas ref={canvasRef} hidden/>
    </div>
  </main>;
}

function Card({ tone, tag, title, sub, children }: any) {
  return <section className={`card ${tone}`}><span className="tag">{tag}</span><h1>{title}</h1><p>{sub}</p>{children}<img className="robot" src="/assets/exclu-robot-premium.png" alt="EXCLU" /></section>;
}

function Prizes({ status }: { status: FestivalStatus }) {
  const rewards = status.rewards ?? [];
  return <Card tone="orange" tag="PREMIOS" title="MIS PREMIOS" sub="Tus premios y participaciones están guardados en Supabase">
    <div className="prize-summary"><div><Ticket/><b>{status.raffle_entries ?? 0}</b><span>participaciones sorteo</span></div><div><Gift/><b>{rewards.length}</b><span>premios instantáneos</span></div></div>
    <div className="list">{rewards.length === 0 ? <p>🎟️ Todavía no tienes premios instantáneos. Tus participaciones para los 3 desayunos para dos siguen contando.</p> : rewards.map((r) => <div className="reward-row" key={r.reward_code}><span>{r.icon}</span><div><b>{r.name}</b><code>{r.reward_code}</code></div><em className={r.status}>{r.status === "redeemed" ? "CANJEADO" : "PENDIENTE"}</em></div>)}</div>
  </Card>;
}

function Result({ result, onBack }: { result: GameResult; onBack: () => void }) {
  useEffect(()=>{
    sound(result.won ? "win" : "correct");
    if (result.won && navigator.vibrate) navigator.vibrate([80, 40, 100, 40, 160]);
  },[]);
  return <div className={`result celebration-screen ${result.won ? "winner" : "raffle-only"}`}>
    {result.won && <><Confetti count={120}/><div className="firework fw1"/><div className="firework fw2"/><div className="firework fw3"/></>}
    <div className="celebration-content">
      <div className="result-glow"/>
      <div className="celebration-kicker">EXCLU FEST · LA EXCLUSIVA</div>
      <h1>{result.already_played ? "¡YA JUGASTE HOY!" : result.won ? "¡ENHORABUENA!" : "¡SIGUES EN EL SORTEO!"}</h1>
      {result.won && <h2>¡HAS GANADO!</h2>}
      <img className="celebration-robot" src="/assets/exclu-robot-premium.png" alt="EXCLU celebrando"/>
      <div className="prize-burst">
        <strong>{result.prize_icon ? `${result.prize_icon} ` : ""}{result.prize_name || result.message || "Tu participación ha quedado registrada."}</strong>
        {result.prize_description && <small>{result.prize_description}</small>}
      </div>
      {result.reward_code && <div className="reward-code-card"><span className="code-label">TU CÓDIGO DE PREMIO</span><code>{result.reward_code}</code><p>Enséñalo al personal de La Exclusiva para canjearlo.</p></div>}
      <div className="result-ticket"><Ticket/> {result.raffle_entries ?? 0} participaciones para los 3 desayunos para dos</div>
      {result.passport_complete && <div className="bonus"><Trophy/> ¡Pasaporte completo! +2 participaciones extra</div>}
      <button className="celebration-button" onClick={()=>{sound("click");onBack();}}>VOLVER A EXCLU FEST</button>
    </div>
  </div>;
}

type AdminOverview = {
  test_mode?: boolean;
  scans?: number;
  participants?: number;
  participations?: number;
  raffle_entries?: number;
  prizes_claimed?: number;
  prizes_redeemed?: number;
  passports_complete?: number;
  prizes?: Array<{ id: string; name: string; icon: string; stock_total: number; stock_remaining: number; active: boolean }>;
  recent_claims?: Array<{ reward_code: string; prize_name: string; icon: string; phone_masked: string; status: string; claimed_at: string; redeemed_at?: string | null }>;
  winners?: Array<{ position: number; participant_id: string; phone_masked: string; entries: number }>;
};

type RewardLookup = {
  found: boolean;
  reward_code?: string;
  prize_name?: string;
  prize_icon?: string;
  phone_masked?: string;
  status?: string;
  claimed_at?: string;
  redeemed_at?: string | null;
  message?: string;
};

function AdminPanel() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview>({});
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<RewardLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showRaffleConfirm, setShowRaffleConfirm] = useState(false);
  const [testAction, setTestAction] = useState<"participant" | "raffle" | null>(null);

  useEffect(() => { void bootAdmin(); }, []);

  async function bootAdmin() {
    setReady(false);
    setMessage(null);
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      let uid = sessionData.session?.user?.id ?? null;
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = data.user?.id ?? null;
      }
      setUserId(uid);
      const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
      if (adminError) throw adminError;
      const allowed = Boolean(isAdmin);
      setAdmin(allowed);
      if (allowed) await loadOverview();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo iniciar el panel de administración.");
    } finally {
      setReady(true);
    }
  }

  async function loadOverview() {
    const { data, error } = await supabase.rpc("admin_overview", { p_festival_slug: FESTIVAL });
    if (error) throw error;
    setOverview((data ?? {}) as AdminOverview);
  }

  async function refresh() {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await loadOverview(); }
    catch (error: any) { setMessage(error?.message || "No se pudieron actualizar los datos."); }
    finally { setBusy(false); }
  }

  async function lookupCode() {
    const clean = code.trim().toUpperCase();
    if (!clean) return setMessage("Introduce un código de premio.");
    setBusy(true); setMessage(null); setLookup(null);
    try {
      const { data, error } = await supabase.rpc("admin_lookup_reward", { p_reward_code: clean });
      if (error) throw error;
      setLookup((data ?? { found: false }) as RewardLookup);
    } catch (error: any) {
      setMessage(error?.message || "No se pudo comprobar el código.");
    } finally { setBusy(false); }
  }

  async function redeem() {
    if (!lookup?.reward_code || busy) return;
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.rpc("redeem_reward", { p_reward_code: lookup.reward_code });
      if (error) throw error;
      if (!data?.valid) {
        setMessage(data?.message || "Este premio no se puede canjear.");
      } else {
        setMessage(`✓ ${data.prize_name} canjeado correctamente.`);
      }
      await lookupCode();
      await loadOverview();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo canjear el premio.");
    } finally { setBusy(false); }
  }

  async function adjustStock(prizeId: string, current: number, total: number, delta: number) {
    const next = Math.max(0, Math.min(total, current + delta));
    if (next === current || busy) return;
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.rpc("admin_set_prize_stock", { p_prize_id: prizeId, p_stock_remaining: next });
      if (error) throw error;
      await loadOverview();
    } catch (error: any) { setMessage(error?.message || "No se pudo cambiar el stock."); }
    finally { setBusy(false); }
  }

  async function drawRaffle() {
    setShowRaffleConfirm(false);
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.rpc("draw_final_raffle", { p_festival_slug: FESTIVAL });
      if (error) throw error;
      setMessage(`Sorteo realizado. ${Array.isArray(data) ? data.length : 0} ganador(es) guardados.`);
      await loadOverview();
    } catch (error: any) { setMessage(error?.message || "No se pudo realizar el sorteo."); }
    finally { setBusy(false); }
  }

  async function resetTestParticipant() {
    if (busy) return;
    setTestAction(null);
    setBusy(true); setMessage(null); setLookup(null); setCode("");
    try {
      const { data, error } = await supabase.rpc("admin_test_reset_current_device", { p_festival_slug: FESTIVAL });
      if (error) throw error;
      setMessage(`✓ ${data?.message || "Participante de prueba reseteado."}`);
      await loadOverview();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo resetear el participante de prueba.");
    } finally { setBusy(false); }
  }

  async function resetTestRaffle() {
    if (busy) return;
    setTestAction(null);
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.rpc("admin_test_reset_raffle", { p_festival_slug: FESTIVAL });
      if (error) throw error;
      setMessage(`✓ ${data?.message || "Sorteo de prueba reseteado."}`);
      await loadOverview();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo resetear el sorteo de prueba.");
    } finally { setBusy(false); }
  }

  if (!ready) return <div className="admin admin-loading"><div><img src="/assets/exclu-robot-premium.png" alt="EXCLU"/><p>Abriendo el panel…</p></div></div>;

  if (!admin) {
    const sql = userId ? `insert into public.admin_users(user_id) values ('${userId}') on conflict do nothing;` : "";
    return <div className="admin admin-access"><div className="admin-access-card"><LockKeyhole size={42}/><h1>EXCLU FEST · ADMIN</h1><p>Este navegador todavía no tiene permiso de administrador.</p>{message && <div className="admin-alert error">{message}</div>}<small>ID de esta sesión</small><code>{userId ?? "Sin sesión"}</code><p className="admin-help">Para autorizar este navegador, copia esta línea en <b>Supabase → SQL Editor</b>, ejecútala y vuelve aquí.</p><textarea readOnly value={sql}/><button onClick={() => navigator.clipboard?.writeText(sql)}>COPIAR SQL</button><button className="admin-secondary" onClick={bootAdmin}>YA HE DADO ACCESO</button><a href="/">← Volver a EXCLU FEST</a></div></div>;
  }

  const prizes = overview.prizes ?? [];
  const claims = overview.recent_claims ?? [];
  const winners = overview.winners ?? [];

  return <div className="admin-shell-real">
    <header className="admin-top"><div><span className="admin-kicker">CAFETERÍA LA EXCLUSIVA</span><h1>EXCLU FEST · ADMIN</h1><p>Control de premios, participantes y sorteo final</p></div><div className="admin-top-actions"><span className={overview.test_mode ? "test-badge" : "live-badge"}>{overview.test_mode ? "MODO PRUEBAS" : "PRODUCCIÓN"}</span><button onClick={refresh} disabled={busy}><RefreshCw size={18}/> Actualizar</button><a href="/">Ver app</a></div></header>

    {message && <div className={`admin-alert ${message.startsWith("✓") ? "ok" : ""}`}>{message}<button onClick={() => setMessage(null)}>×</button></div>}

    <section className="admin-stats">
      <StatCard icon={<BarChart3/>} label="Escaneos" value={overview.scans ?? 0}/>
      <StatCard icon={<Users/>} label="Participantes" value={overview.participants ?? 0}/>
      <StatCard icon={<Ticket/>} label="Entradas sorteo" value={overview.raffle_entries ?? 0}/>
      <StatCard icon={<Gift/>} label="Premios generados" value={overview.prizes_claimed ?? 0}/>
      <StatCard icon={<CheckCircle2/>} label="Premios canjeados" value={overview.prizes_redeemed ?? 0}/>
      <StatCard icon={<Trophy/>} label="Pasaportes completos" value={overview.passports_complete ?? 0}/>
    </section>

    <div className="admin-columns">
      <section className="admin-panel admin-redeem"><div className="admin-panel-title"><div><span>CANJE</span><h2>Validar premio</h2></div><Gift/></div><p>Introduce el código que te enseñe el cliente. Primero se comprueba y después decides si lo canjeas.</p><div className="redeem-search"><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} onKeyDown={(e)=>e.key === "Enter" && lookupCode()} placeholder="EXC-12-ABC123"/><button onClick={lookupCode} disabled={busy}>COMPROBAR</button></div>{lookup && <div className={`lookup-card ${lookup.status === "redeemed" ? "used" : ""}`}>{lookup.found ? <><div className="lookup-prize"><span>{lookup.prize_icon ?? "🎁"}</span><div><small>{lookup.reward_code}</small><h3>{lookup.prize_name}</h3><p>{lookup.phone_masked}</p></div></div>{lookup.status === "redeemed" ? <div className="lookup-state used"><XCircle/> YA CANJEADO</div> : <><div className="lookup-state pending"><CheckCircle2/> CÓDIGO VÁLIDO</div><button className="redeem-confirm" onClick={redeem} disabled={busy}>MARCAR COMO CANJEADO</button></>}</> : <div className="lookup-state used"><XCircle/> {lookup.message || "Código no encontrado"}</div>}</div>}</section>

      <section className="admin-panel"><div className="admin-panel-title"><div><span>INVENTARIO</span><h2>Stock de premios</h2></div><Gift/></div><div className="stock-list">{prizes.map((p)=><div className="stock-row" key={p.id}><span className="stock-icon">{p.icon}</span><div className="stock-name"><b>{p.name}</b><small>{p.stock_remaining} de {p.stock_total} disponibles</small><div className="stock-bar"><i style={{width:`${p.stock_total ? (p.stock_remaining/p.stock_total)*100 : 0}%`}}/></div></div><div className="stock-controls"><button disabled={busy || p.stock_remaining<=0} onClick={()=>adjustStock(p.id,p.stock_remaining,p.stock_total,-1)}>−</button><b>{p.stock_remaining}</b><button disabled={busy || p.stock_remaining>=p.stock_total} onClick={()=>adjustStock(p.id,p.stock_remaining,p.stock_total,1)}>+</button></div></div>)}</div></section>
    </div>

    <div className="admin-columns admin-bottom-grid">
      <section className="admin-panel"><div className="admin-panel-title"><div><span>ACTIVIDAD</span><h2>Últimos premios</h2></div><RefreshCw/></div><div className="claims-table">{claims.length === 0 ? <p className="empty-admin">Todavía no hay premios generados.</p> : claims.map((c)=><div className="claim-row" key={c.reward_code}><span>{c.icon}</span><div><b>{c.prize_name}</b><code>{c.reward_code}</code><small>{c.phone_masked}</small></div><em className={c.status}>{c.status === "redeemed" ? "CANJEADO" : "PENDIENTE"}</em></div>)}</div></section>

      <section className="admin-panel raffle-panel"><div className="admin-panel-title"><div><span>SORTEO FINAL</span><h2>3 desayunos para dos</h2></div><Trophy/></div>{winners.length > 0 ? <div className="winner-list">{winners.map((w)=><div className="winner-row" key={w.position}><b>#{w.position}</b><div><strong>{w.phone_masked || "Participante"}</strong><small>{w.entries} participaciones en el sorteo</small></div><Trophy/></div>)}</div> : <><p>El sorteo utiliza todas las participaciones acumuladas y selecciona hasta 3 personas distintas.</p><button className="raffle-button" onClick={()=>setShowRaffleConfirm(true)} disabled={busy || (overview.raffle_entries ?? 0) === 0}><Trophy/> REALIZAR SORTEO FINAL</button><small className="raffle-warning">Una vez realizado, los ganadores quedan guardados y el sorteo no se repite.</small></>}</section>
    </div>

    {overview.test_mode && <section className="admin-test-tools">
      <div className="admin-panel-title"><div><span>LABORATORIO</span><h2>Herramientas de prueba</h2></div><RefreshCw/></div>
      <p>Solo aparecen mientras el festival está en <b>MODO PRUEBAS</b>. No borran el participante ni la configuración del festival.</p>
      <div className="test-tool-grid">
        <article><h3>Repetir circuito del dispositivo</h3><p>Conserva el teléfono registrado, pero borra las jugadas, entradas de sorteo y premios generados por <b>este navegador</b>. El stock consumido por esos premios se devuelve automáticamente.</p><button disabled={busy} onClick={()=>setTestAction("participant")}><RefreshCw size={17}/> RESET PARTICIPANTE DE PRUEBA</button></article>
        <article><h3>Repetir sorteo final</h3><p>Borra únicamente el sorteo de prueba y sus ganadores. Las participaciones acumuladas permanecen intactas para poder volver a comprobar los 3 ganadores.</p><button disabled={busy || winners.length===0} onClick={()=>setTestAction("raffle")}><Trophy size={17}/> RESET SORTEO DE PRUEBA</button></article>
      </div>
      <small className="test-safety">🔒 Estas funciones quedan bloqueadas automáticamente cuando <code>test_mode=false</code>.</small>
    </section>}

    {showRaffleConfirm && <div className="admin-modal"><div><Trophy size={42}/><h2>¿Realizar el sorteo final?</h2><p>Se seleccionarán hasta 3 ganadores distintos entre todas las participaciones guardadas.</p><button className="raffle-button" onClick={drawRaffle}>SÍ, REALIZAR SORTEO</button><button className="admin-secondary" onClick={()=>setShowRaffleConfirm(false)}>CANCELAR</button></div></div>}

    {testAction && <div className="admin-modal"><div><RefreshCw size={42}/><h2>{testAction === "participant" ? "¿Resetear este participante de prueba?" : "¿Resetear el sorteo de prueba?"}</h2><p>{testAction === "participant" ? "Se borrarán las jugadas, premios y entradas del sorteo de este navegador. El teléfono seguirá registrado y podrá volver a jugar desde el día 11." : "Se borrarán únicamente los ganadores y el sorteo realizado. Las entradas del sorteo seguirán guardadas."}</p><button className="test-confirm" onClick={testAction === "participant" ? resetTestParticipant : resetTestRaffle}>{testAction === "participant" ? "SÍ, RESET PARTICIPANTE" : "SÍ, RESET SORTEO"}</button><button className="admin-secondary" onClick={()=>setTestAction(null)}>CANCELAR</button></div></div>}
  </div>;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="admin-stat"><span>{icon}</span><div><b>{value.toLocaleString("es-ES")}</b><small>{label}</small></div></div>;
}
