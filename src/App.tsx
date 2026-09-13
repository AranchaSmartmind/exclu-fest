import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, CheckCircle2, ChevronLeft, Gift, LockKeyhole, RefreshCw, Sparkles, Ticket, Trophy, Users, XCircle, Volume2, VolumeX, Search, MousePointerClick, Home, Gamepad2, Camera, CalendarDays, UserRound, Download, Share2 } from "lucide-react";
import { supabase } from "./lib/supabase";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import "./styles.css";


function PassportGlyph() {
  return <img className="passport-glyph-image" src={`${import.meta.env.BASE_URL}assets/passport-nav-approved.png`} alt="" aria-hidden="true" />;
}


function PhotoBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={`photo-count-badge ${className}`} aria-label={`${count} foto${count === 1 ? "" : "s"} en el fotomatón`} title={`${count} foto${count === 1 ? "" : "s"}`}>*</span>;
}

function BottomNav({ view, setView, photoCount }: { view: View; setView: (v: View) => void; photoCount: number }) {
  const gamesActive = view === "games" || ["scratch", "fly", "find", "memory", "rings", "rosco", "snake", "differences", "puzzle"].includes(view);
  return <nav className="unified-bottom-nav" aria-label="Navegación La Exclusiva">
    <button onClick={() => { sound("click"); setView("home"); }} className={(view === "home" || view === "prizes") ? "active" : ""}><Home/><span>Inicio</span></button>
    <button onClick={() => { sound("click"); setView("passport"); }} className={view === "passport" ? "active" : ""}><span className="passport-icon"><PassportGlyph/></span><span>Pasaporte</span></button>
    <button onClick={() => { sound("click"); setView("games"); }} className={gamesActive ? "active" : ""}><Gamepad2/><span>Juegos</span></button>
    <button onClick={() => { sound("click"); setView("photo"); }} className={view === "photo" ? "active" : ""}><span className="nav-icon-wrap"><Camera/><PhotoBadge count={photoCount}/></span><span>Fotomatón</span></button>
  </nav>;
}

const FESTIVAL = "exclu-fest-2026";
const ROULETTE_PREVIEW_ENABLED = false; // PRODUCCIÓN
const FORCE_REAL_BACKEND_TEST = false; // PRODUCCIÓN

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

type View = "home" | "play" | "games" | "wheel" | "quiz" | "box" | "passport" | "photo" | "prizes" | "scratch" | "fly" | "find" | "memory" | "rings" | "rosco" | "snake" | "differences" | "puzzle";
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
  reward_type?: "physical" | "raffle_tickets" | null;
  raffle_ticket_qty?: number;
  raffle_entries?: number;
  passport_complete?: boolean;
  message?: string;
};

export default function App() {
  const isAdminRoute =
    window.location.hash === "#/admin" ||
    window.location.pathname.endsWith("/admin");

  const isRedeemRoute =
    window.location.hash === "#/canje" ||
    window.location.pathname.endsWith("/canje");

  if (isRedeemRoute) return <QuickRedeem />;
  if (isAdminRoute) return <AdminPanel />;
  return <Customer />;
}

function Customer() {
  const [view, setView] = useState<View>("home");
  useEffect(() => {
    if (view === "play") {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }, [view]);
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

    // En modo pruebas, si este día ya fue registrado en Supabase, permitimos repetir
    // la experiencia tantas veces como sea necesario sin duplicar participaciones reales.
    if (ROULETTE_PREVIEW_ENABLED && !FORCE_REAL_BACKEND_TEST && played.has(testDay)) {
      const won = gameType === "box" ? Math.random() < 0.5 : false;
      const previewResult = {
        already_played: false,
        won,
        day: testDay,
        prize_name: won ? "PREMIO DE PRUEBA" : null,
        prize_description: won ? "Simulación visual: no consume stock ni genera un premio real." : null,
        prize_icon: won ? "🎁" : null,
        reward_code: null,
        raffle_entries: status.raffle_entries ?? 0,
        passport_complete: Boolean(status.passport_complete),
        message: won ? "MODO PRUEBAS · Simulación de premio." : "MODO PRUEBAS · Esta vez no ha tocado. Puedes volver a probar."
      } as GameResult;
      if (presentResult) setResult(previewResult);
      return previewResult;
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

  async function showQuizResult(r: GameResult) {
    let finalResult = r;

    // El Quiz del día 12 puede devolver "won: true" antes de incluir en la
    // respuesta el nombre/código del premio. Como el premio ya está guardado
    // en Supabase (y aparece en "Mis premios"), recuperamos el estado recién
    // actualizado y completamos la pantalla de celebración con ese premio.
    if (r.won && (!r.prize_name || !r.reward_code)) {
      try {
        // Damos un instante a la transacción del premio para quedar visible.
        await new Promise((resolve) => setTimeout(resolve, 180));

        const { data, error } = await supabase.rpc("get_my_festival_status", {
          p_festival_slug: FESTIVAL,
        });

        if (!error && data) {
          const freshStatus = data as FestivalStatus;
          setStatus(freshStatus);

          const latestReward = [...(freshStatus.rewards ?? [])]
            .filter((reward) => reward.status !== "cancelled" && reward.status !== "expired")
            .sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime())[0];

          if (latestReward) {
            finalResult = {
              ...r,
              prize_name: r.prize_name || latestReward.name,
              prize_icon: r.prize_icon || latestReward.icon || "🎁",
              reward_code: r.reward_code || latestReward.reward_code,
              raffle_entries: freshStatus.raffle_entries ?? r.raffle_entries,
              passport_complete: freshStatus.passport_complete ?? r.passport_complete,
            };
          }
        }
      } catch (error) {
        console.warn("No se pudo completar el premio del Quiz desde Mis premios", error);
      }
    }

    setResult(finalResult);
    await loadStatus();
  }

  if (!sessionReady) {
    return <div className="splash"><img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU"/><p>EXCLU está preparando la fiesta…</p></div>;
  }

  if (result) {
    return <Result result={result} onBack={() => { setResult(null); setView("play"); }} />;
  }

  return (
    <div className={`app ${view === "home" ? "home-screen" : ""} ${view === "play" ? "play-screen" : ""} ${view === "passport" ? "passport-view" : ""} ${view === "wheel" ? "wheel-view" : ""} ${view === "quiz" ? "quiz-view" : ""} ${view === "box" ? "box-view" : ""} ${view === "photo" ? "photo-view" : ""} ${view === "prizes" ? "prizes-view" : ""} ${view === "games" ? "games-view" : ""} ${view === "rosco" ? "rosco-view" : ""} ${view === "memory" ? "memory-view" : ""} ${view === "puzzle" ? "puzzle-view" : ""} ${view === "differences" ? "differences-view" : ""}`}>
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
      {view !== "home" && view !== "play" && view !== "passport" && view !== "photo" && view !== "prizes" && view !== "games" && view !== "rosco" && view !== "memory" && view !== "puzzle" && view !== "differences" && (
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
          {view !== "passport" && view !== "games" && view !== "rosco" && view !== "memory" && view !== "puzzle" && view !== "differences" && !["wheel","quiz","box"].includes(view) && <button className="back" onClick={() => { sound("click"); setView(["wheel", "quiz", "box"].includes(view) ? "play" : "home"); }}><ChevronLeft /> Volver</button>}
          {view === "games" && <GamesHub setView={setView} soundOn={soundOn} photoCount={photoCount} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
          {view === "wheel" && <Wheel busy={busy} played={played.has(11)} registered={status.registered} play={() => play("wheel", 11, undefined, false)} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
          {view === "quiz" && <Quiz busy={busy} played={played.has(12)} registered={status.registered} onFinished={showQuizResult} />}
          {view === "box" && <Boxes busy={busy} played={played.has(13)} registered={status.registered} phoneMasked={status.phone_masked} setView={setView} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} play={(choice) => play("box", 13, choice, false)} />}
          {view === "passport" && <Passport status={status} setView={setView} />}
          {view === "photo" && <Photo onPhotoCreated={registerPhotoCreated} setView={setView} />}
          {view === "prizes" && <Prizes status={status} setView={setView} />}
          {view === "scratch" && <ScratchGame />}
          {view === "fly" && <ExcluFly />}
          {view === "find" && <FindExclu />}
          {view === "memory" && <MemoryExclu setView={setView} userId={userId} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} photoCount={photoCount} />}
          {view === "rings" && <RingToss />}
          {view === "rosco" && <RoscoCoto setView={setView} userId={userId} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
          {view === "snake" && <SnakeExclu />}
          {view === "differences" && <SpotDifferences setView={setView} userId={userId} soundOn={soundOn} photoCount={photoCount} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
          {view === "puzzle" && <PuzzleExclu setView={setView} userId={userId} soundOn={soundOn} onToggleSound={() => { const next=!soundOn; setSoundOn(next); localStorage.setItem("exclu_sound", next ? "on" : "off"); if(next) sound("correct"); }} />}
        </div>
      )}

      {view !== "play" && view !== "box" && view !== "games" && view !== "rosco" && view !== "memory" && view !== "puzzle" && view !== "differences" && <RegisterPanel
        registered={status.registered}
        phoneMasked={status.phone_masked}
        phone={phone}
        setPhone={setPhone}
        accepted={accepted}
        setAccepted={setAccepted}
        busy={busy}
        onRegister={registerWithoutSms}
      />}
      {view !== "photo" && view !== "box" && view !== "games" && view !== "rosco" && view !== "memory" && view !== "puzzle" && view !== "differences" && <BottomNav view={view} setView={setView} photoCount={photoCount} />}
    </div>
  );
}

function friendlyError(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("ya has participado")) return "Ya has jugado este día. Tu participación sigue guardada y puedes volver mañana.";
  if (lower.includes("no hay ningún juego")) return "Hoy todavía no hay un juego activo. Durante las pruebas puedes usar los tres juegos porque el modo test está activado.";
  if (lower.includes("teléfono ya está registrado")) return "Ese teléfono ya está asociado a una participación de EXCLU FEST.";
  if (lower.includes("promoción no está activa")) return "EXCLU FEST todavía no está activo.";
  if (lower.includes("start_coto_quiz") || lower.includes("finish_coto_quiz") || lower.includes("schema cache")) return "El módulo del Quiz todavía no está instalado en Supabase. Ejecuta el archivo supabase/manual/SUPABASE-EJECUTAR-v182.sql una sola vez y vuelve a probar.";
  return message || "Ha ocurrido un problema. Inténtalo de nuevo.";
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="notice" role="status"><img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU"/><div><b>EXCLU</b><p>{text}</p></div><button onClick={onClose} aria-label="Cerrar">×</button></div>;
}

function DesktopPoster({ setView }: { setView: (v: View) => void }) {
  return <div className="desktop-poster poster-shell poster-009">
    <img src={`${import.meta.env.BASE_URL}assets/exclu-fest-009-boceto.png`} className="poster-img" alt="EXCLU FEST · diseño 009" />
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
        src={`${import.meta.env.BASE_URL}assets/home-la-exclusiva-plaza.png`}
        alt="La Exclusiva con EXCLU en ambiente festivo"
      />

      <button className="home-hot home-hot-play" onClick={() => {
        sound("click");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setView("play");
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
      }} aria-label="Jugar ahora" />
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

  // PRUEBAS: mientras ROULETTE_PREVIEW_ENABLED=true los tres juegos quedan visibles y abiertos.
  // PRODUCCIÓN: al ponerlo en false, los tres siguen visibles pero solo se desbloquea el que corresponde a su fecha.
  const testOpenAll = ROULETTE_PREVIEW_ENABLED;
  const gameView: Record<11 | 12 | 13, View> = { 11: "wheel", 12: "quiz", 13: "box" };

  const isBeforeFestival = year < 2026 || (year === 2026 && (month < 9 || (month === 9 && dayOfMonth < 11)));
  const isAfterFestival = year > 2026 || (year === 2026 && (month > 9 || (month === 9 && dayOfMonth > 13)));

  function dayState(day: 11 | 12 | 13): "done" | "open" | "locked" | "missed" {
    if (testOpenAll) return played.has(day) ? "done" : "open";
    if (played.has(day)) return "done";
    if (liveFestivalDay === day) return "open";
    if (isAfterFestival || (year === 2026 && month === 9 && dayOfMonth > day)) return "missed";
    return "locked";
  }

  function launchDay(day: 11 | 12 | 13) {
    const state = dayState(day);
    if (!testOpenAll && state !== "open") return;
    localStorage.setItem("exclu_test_day", String(day));
    sound("click");
    setView(gameView[day]);
  }

  const games: Array<{day:11|12|13; title:string; text:string; kind:"wheel"|"quiz"|"box"}> = [
    {day:11,title:"RULETA",text:"Gira la ruleta y gana premios al instante.",kind:"wheel"},
    {day:12,title:"QUIZ",text:"5 preguntas sobre El Coto. Acierta las 5 para optar a premio.",kind:"quiz"},
    {day:13,title:"CAJA SORPRESA",text:"Elige una caja y descubre si hoy te toca premio.",kind:"box"},
  ];

  return <main className="play-hub-approved play-hub-stable play-hub-v185" aria-label="Jugar ahora · La Exclusiva">
    <div className="play-hub-stable__top">
      <img src={`${import.meta.env.BASE_URL}assets/play-hub-top-user.png`} alt="EXCLU · La Exclusiva" />
      <button className="play-back-button stable-back" onClick={() => { sound("click"); setView("home"); }} aria-label="Volver a Inicio"><ChevronLeft /></button>
      <button className={`play-sound-hotspot stable-sound ${soundOn ? "is-on" : "is-off"}`} onClick={onToggleSound} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
    </div>

    {testOpenAll && <section className="festival-preview-banner" aria-label="Modo de pruebas activo">
      <b>MODO PRUEBAS ACTIVO</b><span>Los días 11, 12 y 13 están abiertos para comprobarlos.</span>
    </section>}

    <section className="daily-games-stack-v187" aria-label="Juegos diarios 11, 12 y 13 de septiembre">
      <img className="daily-games-stack-v187__art" src={`${import.meta.env.BASE_URL}assets/daily-games-stack-approved.png`} alt="Ruleta día 11, Quiz día 12 y Caja Sorpresa día 13" />
      {games.map((g) => {
        const state = dayState(g.day);
        const locked = !testOpenAll && state !== "open";
        return <Fragment key={g.day}>
          <button
            className={`daily-games-stack-v187__hot day-${g.day}`}
            onClick={() => launchDay(g.day)}
            disabled={locked}
            aria-label={locked ? `Disponible el ${g.day} de septiembre` : `Jugar al ${g.title}`}
          />
          {locked && <div className={`daily-games-stack-v187__lock day-${g.day}`} aria-hidden="true">
            <LockKeyhole size={15}/><span>{state === "missed" ? "FINALIZADO" : `DISPONIBLE EL ${g.day} SEPT`}</span>
          </div>}
        </Fragment>;
      })}
    </section>

    <section className="stable-card stable-passport-card" aria-label="Tu Pasaporte">
      <img src={`${import.meta.env.BASE_URL}assets/passport-card-user.png`} alt="Tu Pasaporte · 11, 12 y 13 de septiembre" />
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

function GamesHub({ setView, soundOn, photoCount, onToggleSound }: { setView: (v: View) => void; soundOn: boolean; photoCount: number; onToggleSound: () => void }) {
  const go = (view: View) => { sound("click"); setView(view); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); };
  const games = [
    { view: "rosco" as View, cls: "rosco", title: "ROSCO DEL COTO", sub: "Pon a prueba tus conocimientos en un rosco completo de 27 letras.", img: `${import.meta.env.BASE_URL}assets/games-v255/rosco.webp` },
    { view: "memory" as View, cls: "memory", title: "MEMORIA EXCLU", sub: "Encuentra todas las parejas y entrena tu memoria.", img: `${import.meta.env.BASE_URL}assets/games-v255/memory.webp` },
    { view: "puzzle" as View, cls: "puzzle", title: "PUZZLE EXCLU", sub: "Une las piezas y completa la imagen.", img: `${import.meta.env.BASE_URL}assets/games-v255/puzzle.webp` },
  ];
  return <section className="games-v255" aria-label="EXCLU Games">
    <div className="games-v255__hero-wrap">
      <img className="games-v255__hero" src={`${import.meta.env.BASE_URL}assets/games-v255/hero.webp`} alt="EXCLU Games · elige un juego" />
      <button className="games-v255__back" onClick={() => go("home")} aria-label="Volver a Inicio"><ChevronLeft/></button>
      <button className={`games-v255__sound ${soundOn ? "is-on" : "is-off"}`} onClick={onToggleSound} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"}>{soundOn ? <Volume2/> : <VolumeX/>}</button>
    </div>
    <div className="games-v255__list">
      {games.map((game) => <button key={game.view} className={`games-v255__card ${game.cls}`} onClick={() => go(game.view)}>
        <span className="games-v255__art"><img src={game.img} alt="" /></span>
        <span className="games-v255__copy"><strong>{game.title}</strong><small>{game.sub}</small></span>
        <span className="games-v255__play">JUGAR <b>›</b></span>
      </button>)}
    </div>
    <BottomNav view="games" setView={setView} photoCount={photoCount}/>
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
    <div className="fly-stage" onPointerDown={flap}><canvas ref={canvasRef} width={720} height={460}/>{!running&&!finished&&<div className="fly-overlay"><img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`}/><h2>¿LISTO PARA VOLAR?</h2><p>Llega a 1.000 m y abre el Cofre EXCLU.</p><button onClick={(e)=>{e.stopPropagation();start()}}>JUGAR AHORA</button></div>}{finished&&<div className="fly-overlay result-mini"><h2>{distance>=1000?"¡META CONSEGUIDA!":"¡CASI!"}</h2><p>{chest||`Has llegado a ${distance} m y recogido ${collected} estrellas.`}</p><button onClick={(e)=>{e.stopPropagation();start()}}>VOLVER A INTENTAR</button></div>}</div>
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

type MemoryCard = { id:string; image:string };
const MEMORY_LIBRARY: MemoryCard[] = [
  {id:"excu",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/excu.webp`},
  {id:"cafe",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/cafe.webp`},
  {id:"sidra",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/sidra.webp`},
  {id:"regalo",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/regalo.webp`},
  {id:"camara",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/camara.webp`},
  {id:"asturias",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/asturias.webp`},
  {id:"fiesta",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/fiesta.webp`},
  {id:"tapas",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/tapas.webp`},
  {id:"costa",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/costa.webp`},
  {id:"brindis",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/brindis.webp`},
  {id:"pasaporte",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/pasaporte.webp`},
  {id:"musica",image:`${import.meta.env.BASE_URL}assets/memory-cards-v225/musica.webp`},
];

function MemoryExclu({ setView, userId, soundOn, onToggleSound, photoCount }:{ setView:(v:View)=>void; userId:string|null; soundOn:boolean; onToggleSound:()=>void; photoCount:number }){
  // Cada partida usa 6 imágenes diferentes de una biblioteca de 12. EXCLU siempre participa.
  // Las 6 elegidas se duplican: siguen siendo siempre 6 parejas / 12 cartas.
  const makeDeck=()=>{
    const excu=MEMORY_LIBRARY.find(c=>c.id==="excu")!;
    const others=shuffle(MEMORY_LIBRARY.filter(c=>c.id!=="excu").slice()).slice(0,5);
    const chosen=shuffle([excu,...others]);
    return shuffle(chosen.flatMap((c)=>[
      {...c,uid:`${c.id}-a-${Math.random()}`},
      {...c,uid:`${c.id}-b-${Math.random()}`}
    ])) as Array<MemoryCard & {uid:string}>;
  };
  const [deck,setDeck]=useState(()=>makeDeck());
  const [open,setOpen]=useState<number[]>([]);
  const [matched,setMatched]=useState<number[]>([]);
  const [moves,setMoves]=useState(0);
  const [seconds,setSeconds]=useState(0);
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [bestMoves,setBestMoves]=useState<number|null>(null);
  const [bestTime,setBestTime]=useState<number|null>(null);

  const fmt=(n:number|null)=>n==null?"--:--":`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;

  useEffect(()=>{
    let cancelled=false;
    async function loadBest(){
      if(!userId)return;
      try{
        const {data}=await supabase.from("minigame_records").select("best_score,best_time_seconds").eq("user_id",userId).eq("game_key","memory").maybeSingle();
        if(cancelled||!data)return;
        const score=Number(data.best_score||0);
        if(score>0)setBestMoves(Math.max(0,1000-score));
        if(data.best_time_seconds!=null)setBestTime(Number(data.best_time_seconds));
      }catch{}
    }
    loadBest();
    return()=>{cancelled=true};
  },[userId]);

  useEffect(()=>{
    if(!running||finished)return;
    const id=window.setInterval(()=>setSeconds(s=>s+1),1000);
    return()=>window.clearInterval(id);
  },[running,finished]);

  async function saveRecord(finalMoves:number,finalSeconds:number){
    const previousMoves=bestMoves;
    const isBetter=previousMoves==null||finalMoves<previousMoves||(finalMoves===previousMoves&&(bestTime==null||finalSeconds<bestTime));
    if(isBetter){setBestMoves(finalMoves);setBestTime(finalSeconds)}
    if(!userId)return;
    try{await supabase.rpc("save_minigame_record",{p_game_key:"memory",p_score:Math.max(1,1000-finalMoves),p_time_seconds:finalSeconds})}
    catch(e){console.warn("No se pudo guardar récord de Memoria EXCLU",e)}
  }

  function restart(){setDeck(makeDeck());setOpen([]);setMatched([]);setMoves(0);setSeconds(0);setRunning(false);setFinished(false);sound("click")}

  function flip(i:number){
    if(finished||open.length===2||open.includes(i)||matched.includes(i))return;
    if(!running)setRunning(true);
    const next=[...open,i];setOpen(next);sound("click");
    if(next.length===2){
      const nextMoves=moves+1;setMoves(nextMoves);
      if(deck[next[0]].id===deck[next[1]].id){
        const nextMatched=[...matched,...next];setMatched(nextMatched);setOpen([]);sound("correct");
        if(nextMatched.length===deck.length){setFinished(true);setRunning(false);sound("win");void saveRecord(nextMoves,seconds)}
      }else window.setTimeout(()=>{setOpen([]);sound("wrong")},700);
    }
  }

  const cardPos=[[8.5,36.7],[29.7,36.7],[50.8,36.7],[71.7,36.7],[8.5,50.2],[29.7,50.2],[50.8,50.2],[71.7,50.2],[8.5,63.9],[29.7,63.9],[50.8,63.9],[71.7,63.9]];
  const go=(v:View)=>{sound("click");setView(v);window.scrollTo({top:0,behavior:"smooth"})};

  return <main className="memory-v224" aria-label="Memoria EXCLU"><section className="memory-v224__canvas">
    <img className="memory-v224__art" src={`${import.meta.env.BASE_URL}assets/memory-exclu-approved-v224.png`} alt="Memoria EXCLU"/>
    <button className="memory-v224__hot back" onClick={()=>go("games")} aria-label="Volver a EXCLU GAMES"/>
    <button className="memory-v224__hot sound" onClick={onToggleSound} aria-label={soundOn?"Desactivar sonido":"Activar sonido"}/>
    {!soundOn&&<span className="memory-v224__sound-off" aria-hidden="true"><VolumeX/></span>}
    <div className="memory-v224__stat time">{fmt(seconds)}</div>
    <div className="memory-v224__stat moves">{moves}</div>
    <div className="memory-v224__stat record"><b>{bestMoves==null?"-- mov.":`${bestMoves} mov.`}</b><small>{fmt(bestTime)}</small></div>
    {deck.map((card,i)=>{const visible=open.includes(i)||matched.includes(i);const isMatched=matched.includes(i);const [x,y]=cardPos[i];return <button key={card.uid} className={`memory-v224__card ${visible?"is-open":""} ${isMatched?"is-matched":""}`} style={{left:`${x}%`,top:`${y}%`}} onClick={()=>flip(i)} aria-label={visible?"Carta descubierta":"Carta oculta"}>
      {visible&&<span className="memory-v224__face"><img className="memory-v224__photo" src={card.image} alt=""/></span>}
    </button>})}
    {finished&&<div className="memory-v224__done"><strong>✨ ¡TODAS LAS PAREJAS!</strong><span>{moves} movimientos · {fmt(seconds)}</span></div>}
    <button className="memory-v224__hot restart" onClick={restart} aria-label={finished?"Jugar otra vez":"Nueva partida"}/>
    <button className="memory-v224__hot nav-home" onClick={()=>go("home")} aria-label="Inicio"/><button className="memory-v224__hot nav-passport" onClick={()=>go("passport")} aria-label="Pasaporte"/><button className="memory-v224__hot nav-games" onClick={()=>go("games")} aria-label="Juegos"/><button className="memory-v224__hot nav-photo" onClick={()=>go("photo")} aria-label="Fotomatón"/>
  </section></main>;
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
 return <Card tone="orange" tag="EXCLU JUEGOS" title="¿DÓNDE ESTÁ EXCLU?" sub="Encuentra al robot escondido entre la fiesta"><div className="find-stage">{Array.from({length:18}).map((_,i)=><span key={i} className="crowd">{["🥳","🎉","🍻","🎺","🕺","💃"][i%6]}</span>)}<button className={`hidden-exclu ${found?"found":""}`} onClick={hit} style={{left:`${pos}%`,top:`${22+(round*17)%55}%`}}><img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="Encuentra a EXCLU"/></button>{found&&<strong>¡ENCONTRADO! 🤖✨</strong>}</div><p className="game-hint"><Search size={16}/> Ronda {round+1} · toca al robot cuando lo veas</p></Card>
}


type RoscoState = "pending" | "active" | "ok" | "bad" | "pass";
type RoscoQuestion = { q: string; a: string; mode?: "starts" | "contains" };
const ROSCO_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","Ñ","O","P","Q","R","S","T","U","V","W","X","Y","Z"] as const;
const ROSCO_BANK: Record<string, RoscoQuestion[]> = {
  A:[{q:"Con A: comunidad autónoma del norte de España cuya capital es Oviedo.",a:"Asturias"},{q:"Con A: momento en que empieza a salir el sol.",a:"amanecer"}],
  B:[{q:"Con B: zona de una ciudad con identidad y vida vecinal propia.",a:"barrio"},{q:"Con B: lugar donde se prestan y consultan libros.",a:"biblioteca"}],
  C:[{q:"Con C: bebida preparada con granos tostados y agua caliente.",a:"cafe"},{q:"Con C: conjunto de conocimientos, costumbres y expresiones de una sociedad.",a:"cultura"}],
  D:[{q:"Con D: comida que se toma normalmente al empezar el día.",a:"desayuno"},{q:"Con D: entretenimiento o pasatiempo que produce alegría.",a:"diversion"}],
  E:[{q:"Con E: lugar al que van los niños y jóvenes para aprender.",a:"escuela"},{q:"Con E: astro que vemos como un punto luminoso en el cielo nocturno.",a:"estrella"}],
  F:[{q:"Con F: celebración popular con música, gente y actividades.",a:"fiesta"},{q:"Con F: arte y técnica de obtener imágenes con una cámara.",a:"fotografia"}],
  G:[{q:"Con G: ciudad asturiana donde está El Coto.",a:"Gijon"},{q:"Con G: acción de conseguir la victoria en un juego.",a:"ganar"}],
  H:[{q:"Con H: relato de los acontecimientos del pasado.",a:"historia"},{q:"Con H: unidad de tiempo equivalente a sesenta minutos.",a:"hora"}],
  I:[{q:"Con I: dibujo pequeño que representa una app o función en pantalla.",a:"icono"},{q:"Con I: representación visual captada o creada de algo.",a:"imagen"}],
  J:[{q:"Con J: actividad con reglas que hacemos para divertirnos.",a:"juego"},{q:"Con J: acción de participar en un juego.",a:"jugar"}],
  K:[{q:"Con K: unidad de medida equivalente a mil gramos.",a:"kilo"},{q:"Con K: arte marcial japonés de golpes y patadas.",a:"karate"}],
  L:[{q:"Con L: satélite natural de la Tierra visible por la noche.",a:"luna"},{q:"Con L: conjunto de hojas encuadernadas para leer.",a:"libro"}],
  M:[{q:"Con M: capacidad de recordar información.",a:"memoria"},{q:"Con M: dispositivo que usamos para llamar y navegar por internet.",a:"movil"}],
  N:[{q:"Con N: parte del día comprendida entre el atardecer y el amanecer.",a:"noche"},{q:"Con N: cifra que usamos para contar.",a:"numero"}],
  Ñ:[{q:"Contiene la Ñ: fruto del castaño muy típico del otoño.",a:"castaña",mode:"contains"},{q:"Contiene la Ñ: período de doce meses.",a:"año",mode:"contains"}],
  O:[{q:"Con O: ciudad capital de Asturias.",a:"Oviedo"},{q:"Con O: algo que aparece en el camino y hay que esquivar en un juego.",a:"obstaculo"}],
  P:[{q:"Con P: galardón o recompensa que se puede ganar.",a:"premio"},{q:"Con P: documento de viaje que inspira el pasaporte de la app.",a:"pasaporte"}],
  Q:[{q:"Con Q: alimento elaborado a partir de leche cuajada.",a:"queso"},{q:"Con Q: palabra inglesa que usamos para un juego de preguntas.",a:"quiz"}],
  R:[{q:"Con R: mejor puntuación conseguida hasta el momento.",a:"record"},{q:"Con R: juego circular que gira para decidir un resultado.",a:"ruleta"}],
  S:[{q:"Con S: bebida asturiana obtenida de la manzana.",a:"sidra"},{q:"Con S: resultado de un sorteo cuando la fortuna te favorece.",a:"suerte"}],
  T:[{q:"Con T: dispositivo móvil de pantalla táctil mayor que un teléfono.",a:"tablet"},{q:"Con T: cantidad que mide cuánto dura algo.",a:"tiempo"}],
  U:[{q:"Con U: persona que utiliza una aplicación o servicio.",a:"usuario"},{q:"Con U: palabra que significa que no hay otro igual.",a:"unico"}],
  V:[{q:"Con V: desplazarse por el aire como un pájaro.",a:"volar"},{q:"Con V: persona que gana una competición.",a:"vencedor"}],
  W:[{q:"Con W: red mundial de páginas de internet.",a:"web"},{q:"Con W: conexión inalámbrica usada para acceder a internet.",a:"wifi"}],
  X:[{q:"Contiene la X: palabra que significa especial o reservado para pocos.",a:"exclusivo",mode:"contains"},{q:"Contiene la X: acción de recorrer o investigar un lugar para conocerlo.",a:"explorar",mode:"contains"}],
  Y:[{q:"Con Y: parte amarilla del huevo.",a:"yema"},{q:"Con Y: embarcación de recreo de lujo.",a:"yate"}],
  Z:[{q:"Con Z: calzado deportivo.",a:"zapatilla"},{q:"Con Z: animal asturiano de monte también llamado raposo.",a:"zorro"}],
};

// v222: banco ampliado y variado, estilo Pasapalabra. Se mezcla en cada partida.
const ROSCO_EXTRA: Record<string, RoscoQuestion[]> = {
 A:[{q:"Con A: pintor renacentista autor de La escuela de Atenas.",a:"Rafael",mode:"contains"},{q:"Con A: selección que ganó el Mundial de fútbol de 2022.",a:"Argentina"}],
 B:[{q:"Con B: compositor alemán de la Novena Sinfonía.",a:"Beethoven"},{q:"Con B: deporte en el que se encestan balones en una canasta.",a:"baloncesto"}],
 C:[{q:"Con C: autor de Don Quijote de la Mancha.",a:"Cervantes"},{q:"Con C: equipo de fútbol londinense que juega en Stamford Bridge.",a:"Chelsea"}],
 D:[{q:"Con D: pintor español asociado al surrealismo y a los relojes blandos.",a:"Dali"},{q:"Con D: capital de Irlanda.",a:"Dublin"}],
 E:[{q:"Con E: país africano de las pirámides de Guiza.",a:"Egipto"},{q:"Con E: competición europea de selecciones que España ganó en 2024.",a:"Eurocopa"}],
 F:[{q:"Con F: artista español autor de La maja desnuda.",a:"Francisco de Goya"},{q:"Con F: ciudad italiana considerada cuna del Renacimiento.",a:"Florencia"}],
 G:[{q:"Con G: pintor de El entierro del conde de Orgaz, conocido como El...",a:"Greco"},{q:"Con G: torneo ciclista de tres semanas que se disputa en Italia.",a:"Giro"}],
 H:[{q:"Con H: héroe mitológico griego famoso por sus doce trabajos.",a:"Heracles"},{q:"Con H: país europeo cuya capital es Budapest.",a:"Hungria"}],
 I:[{q:"Con I: país cuya capital es Reikiavik.",a:"Islandia"},{q:"Con I: club italiano de fútbol de Milán cuyo nombre completo comienza por Internazionale.",a:"Inter"}],
 J:[{q:"Con J: deporte olímpico de combate originario de Japón.",a:"judo"},{q:"Con J: ciudad andaluza famosa por su circuito de motociclismo.",a:"Jerez"}],
 K:[{q:"Con K: delantero francés ganador del Mundial de 2018, Kylian...",a:"Mbappe",mode:"contains"},{q:"Con K: ciudad japonesa antigua capital imperial y famosa por sus templos.",a:"Kioto"}],
 L:[{q:"Con L: museo parisino donde se expone la Mona Lisa.",a:"Louvre"},{q:"Con L: ciudad inglesa asociada a The Beatles.",a:"Liverpool"}],
 M:[{q:"Con M: artista renacentista que pintó la bóveda de la Capilla Sixtina.",a:"Miguel Angel"},{q:"Con M: capital de la Comunidad de Madrid y de España.",a:"Madrid"}],
 N:[{q:"Con N: ciudad italiana situada a los pies del Vesubio.",a:"Napoles"},{q:"Con N: tenista español ganador de 14 Roland Garros, Rafael...",a:"Nadal"}],
 Ñ:[{q:"Contiene la Ñ: país europeo cuya capital es Madrid.",a:"España",mode:"contains"},{q:"Contiene la Ñ: competición deportiva que se celebra cada cuatro años y reúne a selecciones nacionales de fútbol.",a:"mundial",mode:"contains"}],
 O:[{q:"Con O: apellido del escritor británico autor de 1984.",a:"Orwell"},{q:"Con O: deporte de atletismo en el que se superan vallas y una barra con una pértiga.",a:"obstaculos"}],
 P:[{q:"Con P: pintor malagueño cofundador del cubismo.",a:"Picasso"},{q:"Con P: capital de Francia.",a:"Paris"}],
 Q:[{q:"Con Q: personaje de Cervantes que acompaña a Sancho Panza en el título de la novela, Don...",a:"Quijote"},{q:"Con Q: país cuya capital es Doha.",a:"Qatar"}],
 R:[{q:"Con R: competición de tenis sobre tierra batida que se disputa en París, Roland...",a:"Garros",mode:"contains"},{q:"Con R: capital de Italia.",a:"Roma"}],
 S:[{q:"Con S: pintor sevillano autor de Las meninas, Diego Velázquez nació en esta ciudad.",a:"Sevilla"},{q:"Con S: club de fútbol de San Sebastián conocido como la Real...",a:"Sociedad"}],
 T:[{q:"Con T: capital de Japón.",a:"Tokio"},{q:"Con T: museo londinense de arte moderno situado junto al Támesis, Tate...",a:"Tate"}],
 U:[{q:"Con U: país sudamericano cuya capital es Montevideo.",a:"Uruguay"},{q:"Con U: organismo europeo de fútbol que organiza la Champions League.",a:"UEFA"}],
 V:[{q:"Con V: pintor neerlandés autor de La noche estrellada, Vincent van...",a:"Gogh",mode:"contains"},{q:"Con V: ciudad italiana construida sobre canales.",a:"Venecia"}],
 W:[{q:"Con W: torneo de tenis sobre hierba disputado en Londres.",a:"Wimbledon"},{q:"Con W: compositor alemán de óperas como Tristán e Isolda, Richard...",a:"Wagner"}],
 X:[{q:"Contiene la X: instrumento musical de láminas que se golpean con baquetas.",a:"xilofono",mode:"contains"},{q:"Contiene la X: deporte de combate en el que se golpea con guantes dentro de un ring.",a:"boxeo",mode:"contains"}],
 Y:[{q:"Con Y: ciudad estadounidense famosa por el parque nacional de Yellowstone; contiene esta letra.",a:"Yellowstone"},{q:"Con Y: estilo de yoga dinámico que enlaza posturas con la respiración; contiene la Y.",a:"yoga"}],
 Z:[{q:"Con Z: ciudad española capital de Aragón.",a:"Zaragoza"},{q:"Con Z: futbolista francés ganador del Balón de Oro en 1998, Zinedine...",a:"Zidane"}],
};
Object.entries(ROSCO_EXTRA).forEach(([letter,items])=>{ ROSCO_BANK[letter]=[...(ROSCO_BANK[letter]||[]),...items]; });

function normalizeRosco(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/[^a-z0-9ñ ]/g,"").replace(/\s+/g," ")}
function buildRoscoQuestions(){
  return Object.fromEntries(ROSCO_LETTERS.map(letter=>{const list=ROSCO_BANK[letter]||[];return [letter,list[Math.floor(Math.random()*Math.max(1,list.length))]||{q:`Con ${letter}: responde correctamente.`,a:letter}] })) as Record<string,RoscoQuestion>;
}

function RoscoCoto({ setView, userId, soundOn, onToggleSound }: { setView:(v:View)=>void; userId:string|null; soundOn:boolean; onToggleSound:()=>void }){
  const [questions,setQuestions]=useState<Record<string,RoscoQuestion>>(()=>buildRoscoQuestions());
  const [states,setStates]=useState<Record<string,RoscoState>>(()=>Object.fromEntries(ROSCO_LETTERS.map(l=>[l,"pending"])));
  const [queue,setQueue]=useState<string[]>(()=>[...ROSCO_LETTERS]);
  const [current,setCurrent]=useState(ROSCO_LETTERS[0] as string);
  const [value,setValue]=useState("");
  const [seconds,setSeconds]=useState(0);
  const [running,setRunning]=useState(true);
  const [done,setDone]=useState(false);
  const [feedback,setFeedback]=useState<"ok"|"bad"|null>(null);
  const [record,setRecord]=useState(()=>{
    try {
      const raw=localStorage.getItem("exclu_records_rosco");
      if(raw) return JSON.parse(raw) as {bestScore:number;bestTime:number|null;lastScore:number;lastTime:number};
    } catch {}
    const legacy=Number(localStorage.getItem("exclu_rosco_best")||0);
    return {bestScore:legacy,bestTime:null,lastScore:0,lastTime:0};
  });
  const inputRef=useRef<HTMLInputElement|null>(null);

  // v222: el récord se sincroniza con Supabase por participante autenticado.
  useEffect(()=>{
    if(!userId) return;
    let alive=true;
    (async()=>{
      const {data,error}=await supabase.from("minigame_records")
        .select("best_score,best_time_seconds,last_score,last_time_seconds")
        .eq("user_id",userId).eq("game_key","rosco_coto").maybeSingle();
      if(!alive||error||!data) return;
      const remote={bestScore:Number(data.best_score||0),bestTime:data.best_time_seconds==null?null:Number(data.best_time_seconds),lastScore:Number(data.last_score||0),lastTime:Number(data.last_time_seconds||0)};
      setRecord(remote);
      localStorage.setItem("exclu_records_rosco",JSON.stringify(remote));
    })();
    return()=>{alive=false};
  },[userId]);

  async function saveRoscoRecord(score:number,time:number){
    if(!userId) return;
    const {error}=await supabase.rpc("save_minigame_record",{p_game_key:"rosco_coto",p_score:score,p_time_seconds:time});
    if(error) console.warn("No se pudo guardar el récord del Rosco en Supabase",error);
  }

  const correct=Object.values(states).filter(v=>v==="ok").length;
  const wrong=Object.values(states).filter(v=>v==="bad").length;
  const pending=27-correct-wrong;
  const question=questions[current];

  useEffect(()=>{
    if(!running||done)return;
    const t=window.setInterval(()=>setSeconds(s=>s+1),1000);
    return()=>window.clearInterval(t);
  },[running,done]);

  useEffect(()=>{ if(!done) setTimeout(()=>inputRef.current?.focus(),60); },[current,done]);

  function finish(nextStates:Record<string,RoscoState>){
    const score=Object.values(nextStates).filter(v=>v==="ok").length;
    setRunning(false);setDone(true);
    const previous=record;
    const isBetter = score > previous.bestScore || (score === previous.bestScore && (previous.bestTime == null || seconds < previous.bestTime));
    const nextRecord = {
      bestScore: isBetter ? score : previous.bestScore,
      bestTime: isBetter ? seconds : previous.bestTime,
      lastScore: score,
      lastTime: seconds,
    };
    setRecord(nextRecord);
    localStorage.setItem("exclu_records_rosco", JSON.stringify(nextRecord));
    localStorage.setItem("exclu_rosco_best", String(nextRecord.bestScore));
    void saveRoscoRecord(score, seconds);
    if(isBetter) sound("win");
  }

  function advance(nextStates:Record<string,RoscoState>, nextQueue:string[]){
    const unresolved=nextQueue.filter(l=>nextStates[l]!=="ok"&&nextStates[l]!=="bad");
    if(unresolved.length===0){finish(nextStates);return}
    const next=unresolved[0];
    setQueue(unresolved);
    setCurrent(next);
    setStates({...nextStates,[next]:"active"});
    setValue("");
    setFeedback(null);
  }

  useEffect(()=>{setStates(s=>({...s,[current]:"active"}))},[]);

  function answer(){
    if(done||feedback||!value.trim())return;
    const ok=normalizeRosco(value)===normalizeRosco(question.a);
    const nextStates={...states,[current]:ok?"ok":"bad" as RoscoState};
    setStates(nextStates);setFeedback(ok?"ok":"bad");sound(ok?"correct":"wrong");
    const nextQueue=queue.filter(l=>l!==current);
    window.setTimeout(()=>advance(nextStates,nextQueue),900);
  }

  function pass(){
    if(done||feedback)return;
    sound("click");
    const nextStates={...states,[current]:"pass" as RoscoState};
    setStates(nextStates);
    const nextQueue=[...queue.filter(l=>l!==current),current];
    const next=nextQueue.find(l=>l!==current && nextStates[l]!=="ok"&&nextStates[l]!=="bad");
    if(!next){setStates({...nextStates,[current]:"active"});return}
    setQueue(nextQueue);setCurrent(next);setStates({...nextStates,[next]:"active"});setValue("");
  }

  function restart(){
    const qs=buildRoscoQuestions();
    const st=Object.fromEntries(ROSCO_LETTERS.map(l=>[l,"pending"])) as Record<string,RoscoState>;
    st[ROSCO_LETTERS[0]]="active";
    setQuestions(qs);setStates(st);setQueue([...ROSCO_LETTERS]);setCurrent(ROSCO_LETTERS[0]);setValue("");setSeconds(0);setRunning(true);setDone(false);setFeedback(null);sound("click");
  }

  function go(v:View){sound("click");setView(v);window.scrollTo({top:0,behavior:"instant" as ScrollBehavior})}
  const mm=String(Math.floor(seconds/60)).padStart(2,"0"), ss=String(seconds%60).padStart(2,"0");
  const bestTimeLabel = record.bestTime == null ? "--:--" : `${String(Math.floor(record.bestTime/60)).padStart(2,"0")}:${String(record.bestTime%60).padStart(2,"0")}`;

  return <section className="rosco-v212" aria-label="Rosco del Coto">
    <div className="rosco-v212__shell">
      <div className="rosco-v212__top">
        <img className="rosco-v212__art" src={`${import.meta.env.BASE_URL}assets/rosco-coto-top-v213.png`} alt="Rosco del Coto · La Exclusiva" />
        <div className="rosco-v212__logo"><img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-full-approved.png`} alt="La Exclusiva Cafetería" /></div>
        <button className="rosco-v212__back" onClick={()=>go("games")} aria-label="Volver a EXCLU Games"><ChevronLeft/> <span>Volver</span></button>
        <button className={`rosco-v212__sound ${soundOn?"is-on":"is-off"}`} onClick={onToggleSound} aria-label={soundOn?"Desactivar sonido":"Activar sonido"}>{soundOn?<Volume2/>:<VolumeX/>}</button>

        <div className="rosco-v212__time"><small>TIEMPO</small><b>{mm}:{ss}</b></div>
        <div className="rosco-v212__score hits"><small>ACIERTOS</small><b>{correct}</b></div>
        <div className="rosco-v212__score misses"><small>FALLOS</small><b>{wrong}</b></div>
        <div className="rosco-v212__score pending"><small>PEND.</small><b>{pending}</b></div>
        <div className="rosco-v212__record"><small>RÉCORD</small><b>{record.bestScore}/27</b><em>{bestTimeLabel}</em></div>
        <div className="rosco-v212__progress"><small>PREGUNTA</small><b>{Math.min(27,correct+wrong+1)}/27</b></div>

        <div className="rosco-v212__ring" aria-label="Estado del rosco">
          {ROSCO_LETTERS.map((l,i)=>{
            const angle=(i/ROSCO_LETTERS.length)*Math.PI*2-Math.PI/2;
            const x=49.50+27.25*Math.cos(angle);
            const y=65.15+30.25*Math.sin(angle);
            const state=states[l]||"pending";
            return <span key={l} className={`rosco-v212__letter ${state}`} style={{left:`${x}%`,top:`${y}%`}}>{l}</span>
          })}
        </div>
      </div>

      {!done ? <div className="rosco-v212__play">
        <div className="rosco-v212__letter-chip">LETRA {current}</div>
        <div className="rosco-v212__question">{question?.q}</div>
        <input
          ref={inputRef}
          className="rosco-v212__input"
          value={value}
          onChange={e=>setValue(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")answer()}}
          placeholder="Escribe tu respuesta..."
          autoComplete="off"
          aria-label={`Respuesta para la letra ${current}`}
        />
        <div className="rosco-v212__actions">
          <button className="answer" onClick={answer} disabled={!value.trim()||!!feedback}>✓ RESPONDER</button>
          <button className="pass" onClick={pass} disabled={!!feedback}>» PASAPALABRA</button>
          <button className="quit" onClick={()=>go("games")}>✕ ABANDONAR</button>
        </div>
        {feedback&&<div className={`rosco-v212__feedback ${feedback}`}>{feedback==="ok"?"✓ ¡CORRECTO!":`✕ INCORRECTO · ${question.a}`}</div>}
      </div> : <div className="rosco-v212__finish">
        <h2>ROSCO TERMINADO</h2>
        <p><b>{correct}/27</b> aciertos · {wrong} fallos</p>
        <p>Tiempo: <b>{mm}:{ss}</b></p>
        <p>Récord: <b>{record.bestScore}/27</b>{record.bestTime!=null?` · ${bestTimeLabel}`:""}</p>
        <button onClick={restart}>JUGAR OTRA VEZ</button>
        <button onClick={()=>go("games")}>VOLVER A EXCLU GAMES</button>
      </div>}

      <nav className="rosco-v212__nav" aria-label="Navegación del Rosco">
        <button onClick={()=>go("home")}><Home/><span>Inicio</span></button>
        <button onClick={()=>go("passport")}><span className="passport-icon"><PassportGlyph/></span><span>Pasaporte</span></button>
        <button className="active" onClick={()=>go("games")}><Gamepad2/><span>Juegos</span></button>
        <button onClick={()=>go("photo")}><Camera/><span>Fotomatón</span></button>
      </nav>
    </div>
  </section>;

}

function SnakeExclu(){
 const [score,setScore]=useState(0),[running,setRunning]=useState(false),[pos,setPos]=useState(44),[food,setFood]=useState(22);
 useEffect(()=>{if(!running)return;const t=setInterval(()=>{setPos(p=>{const n=(p+7)%100;if(Math.abs(n-food)<8){setScore(s=>s+1);setFood(Math.floor(Math.random()*90)+5);sound("correct")}return n})},180);return()=>clearInterval(t)},[running,food]);
 return <Card tone="teal" tag="EXCLU GAMES" title="EXCLU SNAKE" sub="Recoge cafés y supera tu récord"><div className="snake-stage"><span className="snake-exclu" style={{left:`${pos}%`}}>🤖</span><span className="snake-food" style={{left:`${food}%`}}>☕</span></div><h3>Puntos: {score}</h3><button className="cta-orange" onClick={()=>setRunning(r=>!r)}>{running?"PAUSA":"JUGAR"}</button></Card>
}
type DifferenceLevel = { count: 5|10|15; label: string; tone: string };
const DIFFERENCE_LEVELS: DifferenceLevel[] = [
  {count:5,label:"FÁCIL",tone:"easy"},
  {count:10,label:"MEDIO",tone:"medium"},
  {count:15,label:"DIFÍCIL",tone:"hard"},
];
type DifferenceScene = { id:string; original:string; altered:string; spots:{x:number;y:number;s:number}[] };
const DIFFERENCE_SCENES: Record<5|10|15,DifferenceScene> = {
  5:{id:"coffee",original:`${import.meta.env.BASE_URL}assets/differences-v245-real/coffee-a.webp`,altered:`${import.meta.env.BASE_URL}assets/differences-v245-real/coffee-b.webp`,spots:[
    {x:8,y:19,s:11},{x:83,y:24,s:10},{x:78,y:76,s:12},{x:21,y:75,s:12},{x:56,y:66,s:11}
  ]},
  10:{id:"cocktail",original:`${import.meta.env.BASE_URL}assets/differences-v245-real/cocktail-a.webp`,altered:`${import.meta.env.BASE_URL}assets/differences-v245-real/cocktail-b.webp`,spots:[
    {x:22,y:16,s:10},{x:40,y:20,s:10},{x:57,y:18,s:10},{x:74,y:22,s:10},{x:86,y:54,s:10},
    {x:70,y:55,s:10},{x:51,y:58,s:10},{x:31,y:56,s:10},{x:14,y:64,s:10},{x:89,y:83,s:10}
  ]},
  15:{id:"burger",original:`${import.meta.env.BASE_URL}assets/differences-v245-real/burger-a.webp`,altered:`${import.meta.env.BASE_URL}assets/differences-v245-real/burger-b.webp`,spots:[
    {x:36,y:18,s:8},{x:51,y:19,s:8},{x:66,y:20,s:8},{x:77,y:28,s:8},{x:82,y:45,s:8},
    {x:77,y:66,s:8},{x:65,y:74,s:8},{x:53,y:76,s:8},{x:40,y:75,s:8},{x:28,y:70,s:8},
    {x:18,y:60,s:8},{x:20,y:43,s:8},{x:27,y:31,s:8},{x:49,y:49,s:9},{x:60,y:58,s:9}
  ]}
};

function SpotDifferences({setView,userId,soundOn,onToggleSound,photoCount}:{setView:(v:View)=>void;userId:string|null;soundOn:boolean;onToggleSound:()=>void;photoCount:number}){
  const [phase,setPhase]=useState<"menu"|"show"|"input"|"over">("menu");
  const [sequence,setSequence]=useState<number[]>([]);
  const [inputIndex,setInputIndex]=useState(0);
  const [score,setScore]=useState(0);
  const [streak,setStreak]=useState(0);
  const [best,setBest]=useState(()=>Number(localStorage.getItem("exclu_simon_best")||0));
  const [lit,setLit]=useState<number|null>(null);
  const [message,setMessage]=useState("Pulsa ¡A JUGAR! para comenzar");
  const timers=useRef<number[]>([]);
  const colors=["rojo","verde","cian","amarillo"];
  const go=(v:View)=>{sound("click");setView(v);window.scrollTo({top:0,behavior:"instant" as ScrollBehavior})};
  const clearTimers=()=>{timers.current.forEach(t=>window.clearTimeout(t));timers.current=[]};
  useEffect(()=>()=>clearTimers(),[]);
  function tone(i:number){
    if(localStorage.getItem("exclu_sound")==="off")return;
    try{const A=window.AudioContext||(window as any).webkitAudioContext;const c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=[330,440,550,660][i];o.type="sine";g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.16);setTimeout(()=>c.close(),300)}catch{}
  }
  function flash(i:number,d=330){setLit(i);tone(i);timers.current.push(window.setTimeout(()=>setLit(null),d))}
  function playSequence(seq:number[]){
    clearTimers();setPhase("show");setInputIndex(0);setMessage("¡Observa la secuencia!");
    const gap=seq.length>10?430:seq.length>6?500:570;
    seq.forEach((n,k)=>timers.current.push(window.setTimeout(()=>flash(n,Math.min(300,gap-120)),350+k*gap)));
    timers.current.push(window.setTimeout(()=>{setPhase("input");setMessage("Ahora repítela")},350+seq.length*gap+120));
  }
  function startGame(){const first=[Math.floor(Math.random()*4)];setSequence(first);setScore(0);setStreak(0);setInputIndex(0);playSequence(first)}
  async function saveBest(v:number){
    if(v<=best)return;setBest(v);localStorage.setItem("exclu_simon_best",String(v));
    if(userId){try{await supabase.rpc("save_minigame_record",{p_game_key:"exclu_dice",p_score:v,p_time_seconds:0})}catch{}}
  }
  function press(i:number){
    if(phase!=="input")return;flash(i,180);
    if(i!==sequence[inputIndex]){sound("wrong");setMessage("¡Ups! Secuencia incorrecta");setPhase("over");void saveBest(score);return}
    const next=inputIndex+1;
    if(next===sequence.length){
      const newScore=score+sequence.length*100;setScore(newScore);setStreak(s=>s+1);sound("correct");
      const nextSeq=[...sequence,Math.floor(Math.random()*4)];setSequence(nextSeq);setMessage("¡Bien! Siguiente ronda…");
      timers.current.push(window.setTimeout(()=>playSequence(nextSeq),700));
    }else setInputIndex(next);
  }
  return <main className="simon-v248" aria-label="EXCLU DICE">
    <div className="simon-v248__screen">
      <img className="simon-v248__art" src={phase==="menu"?`${import.meta.env.BASE_URL}assets/exclu-dice-approved-menu-v252.webp`:`${import.meta.env.BASE_URL}assets/exclu-dice-approved-game-v252.webp`} alt="" aria-hidden="true"/>
      <div className="simon-v249__nav-mask" aria-hidden="true"/>

      <header className="simon-v248__header">
        <button className="simon-v248__back" onClick={()=>phase==="menu"?go("games"):(clearTimers(),setPhase("menu"))} aria-label="Volver"><ChevronLeft/></button>
        <span className="simon-v248__logo-wrap"><img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-full-approved.png`} alt="La Exclusiva Cafetería"/></span>
        <button className="simon-v248__sound" onClick={onToggleSound} aria-label="Sonido">{soundOn?<Volume2/>:<VolumeX/>}</button>
      </header>

      {phase==="menu" ? <>
        <button className="simon-v248__hot simon-v248__play-hot" onClick={startGame} aria-label="Jugar EXCLU DICE"/>
      </> : <>
        <div className="simon-v248__stats">
          <div><small>NIVEL</small><b>{sequence.length}</b></div>
          <div><small>PUNTUACIÓN</small><b>{score}</b></div>
          <div><small>RACHA</small><b>{streak}</b></div>
        </div>
        <div className="simon-v248__pads" aria-label="Tablero EXCLU DICE">
          {[0,1,2,3].map(i=><button key={i} className={`simon-v248__pad p${i} ${lit===i?"lit":""}`} disabled={phase!=="input"} onClick={()=>press(i)} aria-label={colors[i]}/>) }
          <span className="simon-v249__center-logo" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-real-icon.png`} alt=""/></span>
        </div>
        <div className="simon-v249__scorebar">
          <div className="simon-v249__best"><span>♛ MEJOR PUNTUACIÓN</span><b>{best}</b></div>
          <button className="simon-v249__restart" onClick={startGame}><RefreshCw/><span>Reiniciar</span></button>
        </div>
        {phase==="over"&&<button className="simon-v248__again" onClick={startGame}>JUGAR OTRA VEZ</button>}
      </>}
    </div>
    <BottomNav view="differences" setView={setView} photoCount={photoCount}/>
  </main>
}

const PUZZLE_IMAGES = MEMORY_LIBRARY.filter(x=>x.id!=="logo").map(x=>({id:x.id,image:x.image}));
const PUZZLE_LEVELS = [
  {pieces:16,rows:4,cols:4,label:"FÁCIL",tone:"green"},
  {pieces:25,rows:5,cols:5,label:"MEDIO",tone:"blue"},
  {pieces:50,rows:10,cols:5,label:"DIFÍCIL",tone:"orange"},
  {pieces:100,rows:10,cols:10,label:"EXPERTO",tone:"red"},
] as const;

type PuzzleEdge = -1|0|1;
function puzzlePath(top:PuzzleEdge,right:PuzzleEdge,bottom:PuzzleEdge,left:PuzzleEdge){
  const t=top===0?"H100":`H35 C35 ${top>0?-15:15},65 ${top>0?-15:15},65 0 H100`;
  const r=right===0?"V100":`V35 C${right>0?115:85} 35,${right>0?115:85} 65,100 65 V100`;
  const b=bottom===0?"H0":`H65 C65 ${bottom>0?115:85},35 ${bottom>0?115:85},35 100 H0`;
  const l=left===0?"V0":`V65 C${left>0?-15:15} 65,${left>0?-15:15} 35,0 35 V0`;
  return `M0 0 ${t} ${r} ${b} ${l} Z`;
}
function puzzleEdges(piece:number,rows:number,cols:number):[PuzzleEdge,PuzzleEdge,PuzzleEdge,PuzzleEdge]{
  const row=Math.floor(piece/cols), col=piece%cols;
  const h=(r:number,c:number):PuzzleEdge=>((r*cols+c)%2===0?1:-1);
  const v=(r:number,c:number):PuzzleEdge=>((r*cols+c+r)%2===0?-1:1);
  const top: PuzzleEdge = row===0?0:(-h(row-1,col) as PuzzleEdge);
  const right: PuzzleEdge = col===cols-1?0:v(row,col);
  const bottom: PuzzleEdge = row===rows-1?0:h(row,col);
  const left: PuzzleEdge = col===0?0:(-v(row,col-1) as PuzzleEdge);
  return [top,right,bottom,left];
}
function puzzleShuffle(n:number){
  let a=Array.from({length:n},(_,i)=>i);
  do{for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}}while(a.every((v,i)=>v===i));
  return a;
}

function PuzzleExclu({setView,userId,soundOn,onToggleSound}:{setView:(v:View)=>void;userId:string|null;soundOn:boolean;onToggleSound:()=>void}){
  const [imageId,setImageId]=useState(PUZZLE_IMAGES[0]?.id||"excu");
  const [level,setLevel]=useState<typeof PUZZLE_LEVELS[number]>(PUZZLE_LEVELS[0]);
  const [phase,setPhase]=useState<"images"|"level"|"play"|"done">("images");
  const [tray,setTray]=useState<number[]>([]);
  const [placed,setPlaced]=useState<Set<number>>(new Set());
  const [moves,setMoves]=useState(0);
  const [seconds,setSeconds]=useState(0);
  const [running,setRunning]=useState(false);
  const [bestMoves,setBestMoves]=useState<number|null>(null);
  const [bestTime,setBestTime]=useState<number|null>(null);
  const [preview,setPreview]=useState(false);
  const [drag,setDrag]=useState<{piece:number;x:number;y:number;size:number}|null>(null);
  const [pieceFilter,setPieceFilter]=useState<"edge"|"inner">("edge");
  const boardRef=useRef<HTMLDivElement|null>(null);
  const selected=PUZZLE_IMAGES.find(x=>x.id===imageId)||PUZZLE_IMAGES[0];
  const fmt=(n:number|null)=>n==null?"--:--":`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
  const recordKey=`puzzle_${imageId}_${level.pieces}`;
  const go=(v:View)=>{sound("click");setView(v);window.scrollTo({top:0,behavior:"smooth"})};

  useEffect(()=>{if(!running||phase!=="play")return;const t=window.setInterval(()=>setSeconds(s=>s+1),1000);return()=>window.clearInterval(t)},[running,phase]);
  useEffect(()=>{
    setBestMoves(null);setBestTime(null);
    if(!userId)return;let alive=true;
    (async()=>{try{const {data}=await supabase.from("minigame_records").select("best_score,best_time_seconds").eq("user_id",userId).eq("game_key",recordKey).maybeSingle();if(!alive||!data)return;const score=Number(data.best_score||0);if(score>0)setBestMoves(Math.max(0,100000-score));if(data.best_time_seconds!=null)setBestTime(Number(data.best_time_seconds))}catch{}})();
    return()=>{alive=false};
  },[userId,recordKey]);

  function start(){setTray(puzzleShuffle(level.pieces));setPlaced(new Set());setMoves(0);setSeconds(0);setRunning(false);setPreview(false);setDrag(null);setPieceFilter("edge");setPhase("play");sound("open")}
  async function finish(finalMoves:number,finalSeconds:number){
    const better=bestMoves==null||finalMoves<bestMoves||(finalMoves===bestMoves&&(bestTime==null||finalSeconds<bestTime));
    if(better){setBestMoves(finalMoves);setBestTime(finalSeconds)}
    if(userId){try{await supabase.rpc("save_minigame_record",{p_game_key:recordKey,p_score:Math.max(1,100000-finalMoves),p_time_seconds:finalSeconds})}catch(e){console.warn("No se pudo guardar récord de Puzzle EXCLU",e)}}
  }
  function dropAt(clientX:number,clientY:number){
    if(!drag||!boardRef.current){setDrag(null);return}
    const rect=boardRef.current.getBoundingClientRect();
    const inside=clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom;
    const nextMoves=moves+1;setMoves(nextMoves);
    if(!inside){setDrag(null);sound("click");return}
    const col=Math.max(0,Math.min(level.cols-1,Math.floor((clientX-rect.left)/rect.width*level.cols)));
    const row=Math.max(0,Math.min(level.rows-1,Math.floor((clientY-rect.top)/rect.height*level.rows)));
    const target=row*level.cols+col;
    if(target!==drag.piece||placed.has(drag.piece)){
      setDrag(null);sound("click");return;
    }
    const nextPlaced=new Set(placed);nextPlaced.add(drag.piece);setPlaced(nextPlaced);setTray(t=>t.filter(x=>x!==drag.piece));setDrag(null);sound("correct");
    if(nextPlaced.size===level.pieces){setRunning(false);setPhase("done");sound("win");void finish(nextMoves,seconds)}
  }
  function pointerDown(e:any,piece:number){
    if(phase!=="play")return;if(!running)setRunning(true);
    e.preventDefault();
    const el=e.currentTarget as HTMLElement;el.setPointerCapture?.(e.pointerId);
    const board=boardRef.current?.getBoundingClientRect();
    const cellSize=board ? Math.min(board.width/level.cols,board.height/level.rows) : 88;
    const dragSize=level.pieces===100 ? Math.max(28,cellSize) : Math.min(88,Math.max(54,cellSize*1.05));
    setDrag({piece,x:e.clientX,y:e.clientY,size:dragSize});sound("click");
  }
  function pointerMove(e:any){
    if(!drag)return;
    e.preventDefault();
    setDrag(d=>d?{...d,x:e.clientX,y:e.clientY}:d)
  }
  function pointerUp(e:any){e.preventDefault();dropAt(e.clientX,e.clientY)}

  return <main className="puzzle-v231" aria-label="Puzzle EXCLU">
    <header className="puzzle-v231__header">
      <button onClick={()=>phase==="images"?go("games"):setPhase(phase==="level"?"images":"level")} className="puzzle-v231__back"><ChevronLeft/> Volver</button>
      <div className="puzzle-v231__brand"><img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-real-icon.png`} alt=""/><div><strong>La Exclusiva</strong><span>CAFETERÍA</span></div></div>
      <button onClick={onToggleSound} className="puzzle-v231__sound" aria-label={soundOn?"Desactivar sonido":"Activar sonido"}>{soundOn?<Volume2/>:<VolumeX/>}</button>
    </header>

    <section className="puzzle-v231__title"><span>🧩</span><div><h1>PUZZLE <em>EXCLU</em></h1><p>Pequeñas piezas, grandes momentos</p></div></section>

    {phase==="images"&&<section className="puzzle-v231__panel"><h2>ELIGE TU IMAGEN</h2><p>Todas las imágenes están disponibles en los cuatro niveles.</p><div className="puzzle-v231__gallery">{PUZZLE_IMAGES.map(img=><button key={img.id} className={imageId===img.id?"active":""} onClick={()=>{setImageId(img.id);sound("click")}}><img src={img.image} alt=""/></button>)}</div><button className="puzzle-v231__primary" onClick={()=>setPhase("level")}>CONTINUAR</button></section>}

    {phase==="level"&&<section className="puzzle-v231__panel"><div className="puzzle-v231__chosen"><img src={selected.image} alt="Imagen elegida"/></div><h2>ELIGE LA DIFICULTAD</h2><div className="puzzle-v231__levels">{PUZZLE_LEVELS.map(l=><button key={l.pieces} className={`${l.tone} ${level.pieces===l.pieces?"active":""}`} onClick={()=>{setLevel(l);sound("click")}}><b>{l.pieces}</b><span>PIEZAS</span><small>{l.rows} × {l.cols} · {l.label}</small></button>)}</div><button className="puzzle-v231__primary" onClick={start}>▶ COMENZAR</button></section>}

    {(phase==="play"||phase==="done")&&<section className="puzzle-v231__game">
      <div className="puzzle-v231__stats"><div><small>TIEMPO</small><b>{fmt(seconds)}</b></div><div><small>MOVIMIENTOS</small><b>{moves}</b></div><div><small>RÉCORD</small><b>{bestMoves==null?"--":`${bestMoves} mov.`}</b><em>{fmt(bestTime)}</em></div></div>
      <div className={`puzzle-v231__board ${preview?"preview":""}`} ref={boardRef} style={{aspectRatio:`${level.cols}/${level.rows}`}}>
        {preview&&<img className="puzzle-v231__preview" src={selected.image} alt="Vista previa"/>}
        {!preview&&Array.from({length:level.pieces},(_,slot)=>{const row=Math.floor(slot/level.cols),col=slot%level.cols;const isPlaced=placed.has(slot);const [top,right,bottom,left]=puzzleEdges(slot,level.rows,level.cols);const path=puzzlePath(top,right,bottom,left);return <div key={slot} className={`puzzle-v233__slot ${isPlaced?"filled":""}`} style={{left:`${col*100/level.cols}%`,top:`${row*100/level.rows}%`,width:`${100/level.cols}%`,height:`${100/level.rows}%`}}>{isPlaced&&<svg className="puzzle-v235__placed-piece" viewBox="-18 -18 136 136" preserveAspectRatio="none"><defs><clipPath id={`placed-clip-${slot}`}><path d={path}/></clipPath></defs><g clipPath={`url(#placed-clip-${slot})`}><image href={selected.image} x={-col*100} y={-row*100} width={level.cols*100} height={level.rows*100} preserveAspectRatio="none"/></g><path d={path} fill="none" stroke="#e8b838" strokeWidth="1.1" vectorEffect="non-scaling-stroke" opacity=".58"/></svg>}</div>})}
      </div>

      {phase==="play"&&<div className="puzzle-v233__tray-wrap"><div className="puzzle-v233__tray-title"><b>PIEZAS</b><span>Desliza y arrastra hasta el tablero</span><em>{tray.length} restantes</em></div><div className="puzzle-v238__filters"><button className={pieceFilter==="edge"?"active":""} onClick={()=>{setPieceFilter("edge");sound("click")}}>CON BORDE</button><button className={pieceFilter==="inner"?"active":""} onClick={()=>{setPieceFilter("inner");sound("click")}}>SIN BORDE</button></div><div className={`puzzle-v233__tray puzzle-v238__slider pieces-${level.pieces}`}>{tray.filter(piece=>{const r=Math.floor(piece/level.cols),c=piece%level.cols;const edge=r===0||c===0||r===level.rows-1||c===level.cols-1;return pieceFilter==="edge"?edge:!edge}).map(piece=>{const pr=Math.floor(piece/level.cols),pc=piece%level.cols;const [top,right,bottom,left]=puzzleEdges(piece,level.rows,level.cols);const path=puzzlePath(top,right,bottom,left);const dragging=drag?.piece===piece;return <button key={piece} className={`puzzle-v233__loose ${dragging?"dragging":""}`} onPointerDown={e=>pointerDown(e,piece)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>setDrag(null)} aria-label={`Pieza ${piece+1}`}><svg viewBox="-18 -18 136 136" preserveAspectRatio="none"><defs><clipPath id={`piececlip-${piece}`}><path d={path}/></clipPath></defs><g clipPath={`url(#piececlip-${piece})`}><image href={selected.image} x={-pc*100} y={-pr*100} width={level.cols*100} height={level.rows*100} preserveAspectRatio="none"/></g><path d={path} fill="none" stroke="#f3c64f" strokeWidth="2.3" vectorEffect="non-scaling-stroke"/></svg></button>})}</div></div>}

      {phase==="play"?<div className="puzzle-v231__tools"><button onClick={()=>setPreview(v=>!v)}>👁 {preview?"VOLVER AL PUZZLE":"VISTA PREVIA"}</button><button onClick={()=>{setTray(t=>puzzleShuffle(t.length).map(i=>t[i]));setMoves(m=>m+1);sound("click")}}>🔀 MEZCLAR</button><button onClick={start}><RefreshCw/> REINICIAR</button></div>:<div className="puzzle-v231__complete"><h2>🎉 ¡PUZZLE COMPLETADO!</h2><p>{level.pieces} piezas · {moves} movimientos · {fmt(seconds)}</p><button className="puzzle-v231__primary" onClick={start}>JUGAR OTRA VEZ</button><button className="puzzle-v231__secondary" onClick={()=>setPhase("images")}>ELEGIR OTRA IMAGEN</button></div>}
    </section>}

    {drag&&phase==="play"&&(()=>{const piece=drag.piece;const pr=Math.floor(piece/level.cols),pc=piece%level.cols;const [top,right,bottom,left]=puzzleEdges(piece,level.rows,level.cols);const path=puzzlePath(top,right,bottom,left);return <div className={`puzzle-v234__drag-ghost ${level.pieces===100?"pieces-100":""}`} style={{left:drag.x,top:drag.y,width:drag.size,height:drag.size}} aria-hidden="true"><svg viewBox="-18 -18 136 136" preserveAspectRatio="none"><defs><clipPath id="drag-piece-clip"><path d={path}/></clipPath></defs><g clipPath="url(#drag-piece-clip)"><image href={selected.image} x={-pc*100} y={-pr*100} width={level.cols*100} height={level.rows*100} preserveAspectRatio="none"/></g><path d={path} fill="none" stroke="#00eff7" strokeWidth="2.8" vectorEffect="non-scaling-stroke"/><path d={path} fill="none" stroke="#f4c94f" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/></svg></div>})()}

    <nav className="puzzle-v231__nav"><button onClick={()=>go("home")}><Home/><span>Inicio</span></button><button onClick={()=>go("passport")}><span className="passport-icon"><PassportGlyph/></span><span>Pasaporte</span></button><button className="active" onClick={()=>go("games")}><Gamepad2/><span>Juegos</span></button><button onClick={()=>go("photo")}><Camera/><span>Fotomatón</span></button></nav>
  </main>
}

function RegisterPanel({ registered, phoneMasked, phone, setPhone, accepted, setAccepted, busy, onRegister }: any) {
  return <section id="register" className={`register-panel ${registered ? "registered" : ""}`}>
    <img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU" />
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
          src={`${import.meta.env.BASE_URL}assets/roulette-popup-approved-v084.png`}
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

        {result.reward_code ? (
          <code className="roulette-prize-v084__code">{result.reward_code}</code>
        ) : result.reward_type === "raffle_tickets" ? (
          <div className="roulette-prize-v084__code">🎟️ PARTICIPACIÓN AÑADIDA</div>
        ) : null}

        <button
          className="roulette-prize-v084__ok"
          onClick={onClose}
          aria-label="Cerrar y continuar"
        />
      </div>
    </div>
  );
}

type RouletteSectorKind = "gift" | "ticket" | "star" | "coffee";

// Orden REAL de los 12 sectores de roulette-approved-wheel.png,
// empezando arriba (bajo el puntero) y avanzando en sentido horario.
const ROULETTE_SECTORS: RouletteSectorKind[] = [
  "gift",   // 0
  "ticket", // 1
  "star",   // 2
  "gift",   // 3
  "coffee", // 4
  "gift",   // 5
  "coffee", // 6
  "star",   // 7
  "ticket", // 8
  "coffee", // 9
  "gift",   // 10
  "coffee", // 11
];

// Premios físicos que harán caer la ruleta en una estrella.
const STAR_PRIZES = new Set([
  "Caja 6 copas 1906",
  "Caja 6 vasos sidra Barceló",
  "Caja 6 copas Victoria",
  "Caja 6 copas Estrella Galicia",
  "Caja tazas + platos (12 piezas)",
  "Funda móvil",
  "Camiseta Ballantine's",
  "Gorra Martini",
]);

function rouletteKindForResult(result: GameResult | null): RouletteSectorKind {
  // Si no hay premio instantáneo, el ticket representa la participación normal
  // que ya se ha guardado para la Cesta MG.
  if (!result?.won) return "ticket";

  if (result.reward_type === "raffle_tickets") return "ticket";

  if ((result.prize_name ?? "").trim().toLowerCase() === "café") {
    return "coffee";
  }

  if (STAR_PRIZES.has((result.prize_name ?? "").trim())) {
    return "star";
  }

  return "gift";
}

function randomRouletteSector(kind: RouletteSectorKind) {
  const candidates = ROULETTE_SECTORS
    .map((sector, index) => ({ sector, index }))
    .filter((item) => item.sector === kind)
    .map((item) => item.index);

  return candidates[Math.floor(Math.random() * candidates.length)];
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
      const audio = new Audio(`${import.meta.env.BASE_URL}assets/celebration-v2.wav`);
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

  async function go() {
    if (phase !== "idle" || busy) return;

    if (!registered) {
      document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (played && !ROULETTE_PREVIEW_ENABLED) return;

    setPrizePopup(null);
    setSpinMessage("");
    rouletteTick(1);
    if (navigator.vibrate) navigator.vibrate([20, 25, 20]);
    setPhase("spin");

    try {
      let gameResult: GameResult | null;
      let targetIndex: number;

      if (ROULETTE_PREVIEW_ENABLED && !FORCE_REAL_BACKEND_TEST) {
        // Preview visual: cada resultado coincide con el símbolo real donde cae la ruleta.
        const previewPrizes: Array<GameResult & { sector: RouletteSectorKind }> = [
          { won: true, day: 11, sector: "gift", prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁", reward_type: "physical" },
          { won: true, day: 11, sector: "ticket", prize_name: "+1 papeleta", prize_description: "1 participación extra para la Cesta MG", prize_icon: "🎟️", reward_type: "raffle_tickets", raffle_ticket_qty: 1 },
          { won: true, day: 11, sector: "star", prize_name: "PREMIO ESTRELLA", prize_description: "Premio especial de EXCLU FEST", prize_icon: "⭐", reward_type: "physical" },
          { won: true, day: 11, sector: "gift", prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁", reward_type: "physical" },
          { won: true, day: 11, sector: "coffee", prize_name: "Café", prize_description: "Café en Cafetería La Exclusiva", prize_icon: "☕", reward_type: "physical" },
          { won: true, day: 11, sector: "gift", prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁", reward_type: "physical" },
          { won: true, day: 11, sector: "coffee", prize_name: "Café", prize_description: "Café en Cafetería La Exclusiva", prize_icon: "☕", reward_type: "physical" },
          { won: true, day: 11, sector: "star", prize_name: "PREMIO ESTRELLA", prize_description: "Premio especial de EXCLU FEST", prize_icon: "⭐", reward_type: "physical" },
          { won: true, day: 11, sector: "ticket", prize_name: "+2 papeletas", prize_description: "2 participaciones extra para la Cesta MG", prize_icon: "🎟️", reward_type: "raffle_tickets", raffle_ticket_qty: 2 },
          { won: true, day: 11, sector: "coffee", prize_name: "Café", prize_description: "Café en Cafetería La Exclusiva", prize_icon: "☕", reward_type: "physical" },
          { won: true, day: 11, sector: "gift", prize_name: "REGALO EXCLU", prize_description: "Premio promocional de La Exclusiva", prize_icon: "🎁", reward_type: "physical" },
          { won: true, day: 11, sector: "coffee", prize_name: "Café", prize_description: "Café en Cafetería La Exclusiva", prize_icon: "☕", reward_type: "physical" },
        ];

        targetIndex = Math.floor(Math.random() * 12);
        const previewPrize = previewPrizes[targetIndex] ?? previewPrizes[0];

        gameResult = {
          ...previewPrize,
          reward_code: previewPrize.reward_type === "physical" ? makePreviewRewardCode(11) : null,
          raffle_entries: previewPrize.reward_type === "raffle_tickets" ? (previewPrize.raffle_ticket_qty ?? 0) : 0,
          message: "MODO PRUEBAS · Premio simulado",
        };
      } else {
        // En producción / prueba real manda Supabase: decide premio y stock primero.
        gameResult = await play();

        if (!gameResult) {
          setPhase("idle");
          return;
        }

        // La rueda solo representa visualmente el resultado real devuelto por Supabase.
        targetIndex = randomRouletteSector(rouletteKindForResult(gameResult));
      }

      // El puntero permanece fijo. Giramos hasta el centro exacto de un sector
      // compatible con el resultado que ya conocemos.
      const sectorAngle = 30;
      const currentNormalized = ((angleRef.current % 360) + 360) % 360;
      const desiredNormalized = (360 - targetIndex * sectorAngle) % 360;
      const correction = (desiredNormalized - currentNormalized + 360) % 360;
      const targetAngle = angleRef.current + (8 * 360) + correction;

      await animate(targetAngle, 5200);
      setPhase("saving");

      if (gameResult.won) {
        playCelebration();
        if (navigator.vibrate) navigator.vibrate([35, 35, 70, 40, 120]);
        setPrizePopup(gameResult);
      } else {
        sound("correct");
        setSpinMessage(gameResult.message || "Tu participación está registrada para el sorteo final.");
      }
    } finally {
      setPhase("idle");
    }
  }

  const label = !registered ? "REGÍSTRATE PARA JUGAR" : (played && !ROULETTE_PREVIEW_ENABLED) ? "✓ COMPLETADO" : phase!=="idle" || busy ? "¡GIRANDO!" : "¡JUGAR AHORA!";

  return <section className="roulette-approved" aria-label="Ruleta La Exclusiva">
    <img className="roulette-approved__art" src={`${import.meta.env.BASE_URL}assets/roulette-approved-screen.png`} alt="Ruleta La Exclusiva" />
<img ref={wheelRef} className={`roulette-approved__wheel ${phase!=="idle"?"is-spinning":""}`} src={`${import.meta.env.BASE_URL}assets/roulette-approved-wheel.png`} alt="" aria-hidden="true" />
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

type QuizQuestion = { id: number; question: string; options: string[]; category: string; difficulty: number; correctIndex?: number; optionMap?: number[] };

const QUIZ_PREVIEW_BANK = [
  {"id": 1, "question": "¿En qué año aparece documentado por primera vez el nombre «Coto de San Nicolás del Mar»?", "options": ["1476", "1492", "1521", "1605"], "category": "Historia", "difficulty": 3, "correctIndex": 0},
  {"id": 2, "question": "¿Qué día se fecha el primer documento conocido que menciona el Coto de San Nicolás del Mar?", "options": ["11 de noviembre de 1476", "6 de diciembre de 1492", "19 de agosto de 1500", "28 de febrero de 1476"], "category": "Historia", "difficulty": 3, "correctIndex": 0},
  {"id": 3, "question": "¿Quién figura como primer propietario de la colina de El Coto en aquella documentación?", "options": ["Juan de Gijón", "Miguel García de la Cruz", "Calixto Alvargonzález", "Alfonso Menéndez"], "category": "Historia", "difficulty": 3, "correctIndex": 0},
  {"id": 4, "question": "¿Qué zonas actuales llegó a abarcar hacia el este el antiguo Coto de San Nicolás?", "options": ["El Bibio, Viesques y La Guía", "La Calzada, Jove y Tremañes", "Cimavilla y El Natahoyo", "Roces y Montevil"], "category": "Historia", "difficulty": 2, "correctIndex": 0},
  {"id": 5, "question": "¿Hasta qué zona llegaba aproximadamente por el oeste el antiguo Coto de San Nicolás?", "options": ["La Cruz de Ceares", "El Musel", "La Calzada", "Somió"], "category": "Historia", "difficulty": 3, "correctIndex": 0},
  {"id": 6, "question": "¿De dónde procede la parte «del Mar» del antiguo nombre San Nicolás del Mar?", "options": ["De que el terreno llegaba hasta el arenal", "De una familia de marineros", "De un antiguo puerto", "Del nombre de una calle"], "category": "Historia", "difficulty": 2, "correctIndex": 0},
  {"id": 7, "question": "¿En qué año diseñaron los hermanos Menéndez-Morán la parcelación en cuadrícula de El Coto?", "options": ["1898", "1888", "1909", "1922"], "category": "Urbanismo", "difficulty": 3, "correctIndex": 0},
  {"id": 8, "question": "¿Con qué idea urbanística nació inicialmente la parcelación moderna de El Coto?", "options": ["Como ciudad jardín", "Como barrio industrial", "Como puerto comercial", "Como ensanche ferroviario"], "category": "Urbanismo", "difficulty": 2, "correctIndex": 0},
  {"id": 9, "question": "¿Qué dos grandes construcciones impulsaron especialmente la urbanización de El Coto a comienzos del siglo XX?", "options": ["El cuartel y la cárcel", "La plaza de toros y el puerto", "La universidad y el hospital", "La estación y el mercado"], "category": "Urbanismo", "difficulty": 2, "correctIndex": 0},
  {"id": 10, "question": "¿Qué servicios se extendieron en el barrio en buena medida por las necesidades del cuartel y la cárcel?", "options": ["Alcantarillado, luz y agua", "Tranvía, gas y teléfono", "Metro, fibra y gas", "Ferrocarril, puerto y telégrafo"], "category": "Urbanismo", "difficulty": 3, "correctIndex": 0},
  {"id": 11, "question": "¿Qué rasgo conserva buena parte del trazado de calles de El Coto?", "options": ["Calles paralelas y perpendiculares de anchura considerable", "Calles concéntricas muy estrechas", "Un trazado medieval irregular", "Una única avenida radial"], "category": "Urbanismo", "difficulty": 2, "correctIndex": 0},
  {"id": 12, "question": "¿Qué calle es conocida históricamente como Bulevar de La Cruz?", "options": ["Ramón y Cajal", "Quevedo", "Feijoo", "Avelino González Mallada"], "category": "Urbanismo", "difficulty": 3, "correctIndex": 0},
  {"id": 13, "question": "¿Qué avenida fue conocida como Bulevar de San José?", "options": ["Pablo Iglesias", "Constitución", "Portugal", "Schultz"], "category": "Urbanismo", "difficulty": 3, "correctIndex": 0},
  {"id": 14, "question": "¿A partir de qué década cambió fuertemente la fisonomía de El Coto con edificios de hasta seis plantas?", "options": ["Década de 1960", "Década de 1920", "Década de 1980", "Década de 2000"], "category": "Historia", "difficulty": 2, "correctIndex": 0},
  {"id": 15, "question": "¿Qué monarca colocó la primera piedra del cuartel Alfonso XIII de El Coto?", "options": ["Alfonso XIII", "Alfonso XII", "Juan Carlos I", "Amadeo I"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 16, "question": "¿Qué edad tenía Alfonso XIII cuando colocó la primera piedra del cuartel en 1900?", "options": ["14 años", "18 años", "21 años", "10 años"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 17, "question": "¿En qué fecha se colocó la primera piedra del cuartel Alfonso XIII?", "options": ["19 de agosto de 1900", "9 de agosto de 1909", "18 de julio de 1905", "8 de febrero de 1985"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 18, "question": "¿En qué año fue inaugurado el cuartel Alfonso XIII?", "options": ["1911", "1900", "1909", "1924"], "category": "Cuartel", "difficulty": 2, "correctIndex": 0},
  {"id": 19, "question": "¿En qué año abandonó el cuartel su última guarnición?", "options": ["1985", "1978", "1992", "1994"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 20, "question": "¿Qué sobrenombre tenía el Regimiento de Infantería Tarragona nº 78 acuartelado en El Coto?", "options": ["El Firme", "El Coto", "El Astur", "San Nicolás"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 21, "question": "¿Qué unidad estuvo posteriormente en el cuartel de El Coto?", "options": ["Batallón de Zapadores Minadores 8", "Regimiento Covadonga 1", "Brigada Galicia 7", "Batallón Pelayo 3"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 22, "question": "¿En qué fecha cayó el cuartel tras el asedio durante la Guerra Civil?", "options": ["16 de agosto de 1936", "18 de julio de 1936", "1 de septiembre de 1937", "19 de agosto de 1936"], "category": "Cuartel", "difficulty": 3, "correctIndex": 0},
  {"id": 23, "question": "¿Quién fue el arquitecto municipal del proyecto de la antigua cárcel de El Coto aprobado en 1905?", "options": ["Miguel García de la Cruz", "Luis Bellido", "Manuel del Busto", "Juan Miguel de la Guardia"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 24, "question": "¿En qué año comenzaron las obras de la antigua cárcel de El Coto?", "options": ["1906", "1898", "1909", "1911"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 25, "question": "¿En qué fecha fue inaugurada la antigua cárcel de El Coto?", "options": ["9 de agosto de 1909", "19 de agosto de 1900", "18 de julio de 1905", "28 de febrero de 1909"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 26, "question": "¿Quién era inicialmente propietario de la antigua cárcel de El Coto?", "options": ["El Ayuntamiento de Gijón", "El Estado", "El Ejército", "La Diputación de Oviedo"], "category": "Cárcel", "difficulty": 2, "correctIndex": 0},
  {"id": 27, "question": "¿En qué año se cedió al Estado la antigua cárcel de El Coto?", "options": ["1924", "1909", "1936", "1985"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 28, "question": "¿Qué posición llegó a ocupar la cárcel de El Coto por importancia en Asturias?", "options": ["La segunda, tras la Correccional de Oviedo", "La primera de Asturias", "La tercera, tras Avilés y Oviedo", "Nunca fue prisión provincial"], "category": "Cárcel", "difficulty": 2, "correctIndex": 0},
  {"id": 29, "question": "¿En qué año cerró definitivamente la cárcel de El Coto?", "options": ["1993", "1985", "1992", "1997"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 30, "question": "¿En qué año fue derribada la mayor parte de la antigua cárcel?", "options": ["1994", "1993", "1998", "1989"], "category": "Cárcel", "difficulty": 3, "correctIndex": 0},
  {"id": 31, "question": "¿Qué parte de la antigua cárcel de El Coto se conserva?", "options": ["El edificio de entrada", "Una torre de vigilancia", "El patio central completo", "El muro perimetral completo"], "category": "Cárcel", "difficulty": 2, "correctIndex": 0},
  {"id": 32, "question": "¿Qué uso tuvo el edificio de entrada conservado de la antigua cárcel?", "options": ["Hogar del Pensionista", "Comisaría", "Biblioteca infantil", "Museo ferroviario"], "category": "Cárcel", "difficulty": 2, "correctIndex": 0},
  {"id": 33, "question": "¿En qué año comenzó su andadura la Biblioteca Municipal de El Coto?", "options": ["1983", "1975", "1992", "1998"], "category": "Biblioteca", "difficulty": 3, "correctIndex": 0},
  {"id": 34, "question": "¿Quién impulsó inicialmente la Biblioteca Municipal de El Coto?", "options": ["La Asociación de Vecinos", "La Universidad de Oviedo", "El Ejército", "La Cámara de Comercio"], "category": "Biblioteca", "difficulty": 2, "correctIndex": 0},
  {"id": 35, "question": "¿En qué calle comenzó la Biblioteca Municipal de El Coto?", "options": ["Avelino González Mallada", "Quevedo", "Ramón y Cajal", "General Suárez Valdés"], "category": "Biblioteca", "difficulty": 3, "correctIndex": 0},
  {"id": 36, "question": "¿A qué calle se trasladó la biblioteca antes de instalarse en el Centro Municipal?", "options": ["Leopoldo Alas", "Feijoo", "San Nicolás", "Pablo Iglesias"], "category": "Biblioteca", "difficulty": 3, "correctIndex": 0},
  {"id": 37, "question": "¿En qué año se trasladó definitivamente la biblioteca al Centro Municipal Integrado de El Coto?", "options": ["1997", "1983", "1993", "2001"], "category": "Biblioteca", "difficulty": 3, "correctIndex": 0},
  {"id": 38, "question": "¿Qué fecha corresponde a la inauguración oficial de la biblioteca en su sede del Centro Municipal?", "options": ["28 de febrero de 1998", "11 de noviembre de 1997", "6 de diciembre de 1998", "9 de agosto de 1997"], "category": "Biblioteca", "difficulty": 3, "correctIndex": 0},
  {"id": 39, "question": "¿En qué plaza se encuentra el Centro Municipal Integrado de El Coto?", "options": ["Plaza de la República", "Plaza Mayor", "Plaza de Europa", "Plaza del Humedal"], "category": "Barrio", "difficulty": 2, "correctIndex": 0},
  {"id": 40, "question": "¿En qué plaza se encuentra la Piscina Municipal de El Coto?", "options": ["Plaza de la República", "Plaza de San Miguel", "Plaza del Instituto", "Plaza del Seis de Agosto"], "category": "Barrio", "difficulty": 2, "correctIndex": 0},
  {"id": 41, "question": "¿En qué calle tiene su sede la Asociación Vecinal El Coto?", "options": ["Avelino González Mallada", "Corrida", "Marqués de San Esteban", "Ezcurdia"], "category": "Barrio", "difficulty": 3, "correctIndex": 0},
  {"id": 42, "question": "¿A qué santo está dedicada la parroquia del barrio de El Coto?", "options": ["San Nicolás de Bari", "San Pedro", "San Lorenzo", "San José"], "category": "Parroquia", "difficulty": 3, "correctIndex": 0},
  {"id": 43, "question": "¿En qué año se instaló definitivamente San Nicolás de Bari en el complejo parroquial actual?", "options": ["1992", "1983", "1998", "1975"], "category": "Parroquia", "difficulty": 3, "correctIndex": 0},
  {"id": 44, "question": "¿En qué calle se encuentra el complejo parroquial de San Nicolás de Bari?", "options": ["Avelino González Mallada", "Ramón y Cajal", "Quevedo", "Leopoldo Alas"], "category": "Parroquia", "difficulty": 3, "correctIndex": 0},
  {"id": 45, "question": "¿Dónde funcionó provisionalmente la parroquia de San Nicolás de Bari antes de pasar por la calle Quevedo?", "options": ["En las instalaciones del colegio de las Dominicas", "En el antiguo cuartel", "En la biblioteca", "En la plaza de toros"], "category": "Parroquia", "difficulty": 3, "correctIndex": 0},
  {"id": 46, "question": "¿Qué reina visitó El Coto en agosto de 1900 junto a Alfonso XIII?", "options": ["María Cristina de Habsburgo-Lorena", "Victoria Eugenia de Battenberg", "Isabel II", "María de las Mercedes"], "category": "Calles", "difficulty": 3, "correctIndex": 0},
  {"id": 47, "question": "¿Qué calle del barrio recuerda a la reina María Cristina por aquella visita de 1900?", "options": ["María Cristina", "Quevedo", "Feijoo", "Leopoldo Alas"], "category": "Calles", "difficulty": 3, "correctIndex": 0},
  {"id": 48, "question": "¿En honor a quién se celebran las fiestas de septiembre de El Coto?", "options": ["San Nicolás", "San Lorenzo", "San Pedro", "Nuestra Señora de Begoña"], "category": "Fiestas", "difficulty": 2, "correctIndex": 0},
  {"id": 49, "question": "¿Qué entidad organiza las Fiestas de San Nicolás de El Coto de 2026?", "options": ["La Asociación Vecinal El Coto", "El Sporting de Gijón", "La Universidad de Oviedo", "La Autoridad Portuaria"], "category": "Fiestas", "difficulty": 2, "correctIndex": 0},
  {"id": 50, "question": "¿Qué tres días se celebran las Fiestas de San Nicolás de El Coto en 2026?", "options": ["11, 12 y 13 de septiembre", "4, 5 y 6 de septiembre", "18, 19 y 20 de septiembre", "25, 26 y 27 de septiembre"], "category": "Fiestas", "difficulty": 2, "correctIndex": 0}
] as const;


function Quiz({ busy, played, registered, onFinished }: { busy: boolean; played: boolean; registered: boolean; onFinished: (r: GameResult) => Promise<void> }) {
  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [n, setN] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{chosen:number;correctIndex:number;isCorrect:boolean} | null>(null);
  const [answers, setAnswers] = useState<{question_id:number;answer_index:number}[]>([]);
  const [locked, setLocked] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [summary, setSummary] = useState<GameResult & {score?:number;perfect?:boolean} | null>(null);
  const q = questions[n];

  useEffect(() => {
    if (!started || !q || locked || summary) return;
    setSeconds(20);
    const id = window.setInterval(() => setSeconds(v => v <= 1 ? 20 : v - 1), 1000);
    return () => window.clearInterval(id);
  }, [started, n, q?.id, locked, summary]);

  function diversifyQuestionOptions(items: QuizQuestion[]) {
    return items.map((item) => {
      const order = item.options.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return {
        ...item,
        options: order.map((i) => item.options[i]),
        optionMap: order,
        correctIndex: item.correctIndex === undefined ? undefined : order.indexOf(item.correctIndex)
      };
    });
  }

  function startLocalPreviewQuiz() {
    const shuffled=diversifyQuestionOptions([...QUIZ_PREVIEW_BANK].sort(()=>Math.random()-.5).slice(0,5).map((q,idx)=>({
      id: 100000 + idx + Math.floor(Math.random()*10000),
      question:q.question,
      options:[...q.options],
      category:q.category,
      difficulty:q.difficulty,
      correctIndex:q.correctIndex
    })));
    setAttemptId("preview-"+Date.now()); setQuestions(shuffled); setAnswers([]); setN(0); setSelected(null); setFeedback(null); setLocked(false); setStarted(true); setSummary(null); setLocalPreview(true);
  }

  async function startQuiz() {
    if (!registered) { document.getElementById("register")?.scrollIntoView({behavior:"smooth",block:"center"}); return; }
    if (played && !ROULETTE_PREVIEW_ENABLED) return;
    if (ROULETTE_PREVIEW_ENABLED && played) { sound("click"); startLocalPreviewQuiz(); return; }
    sound("click"); setLoadingQuiz(true);
    let {data,error}=await supabase.rpc("start_coto_quiz",{p_festival_slug:FESTIVAL,p_test_day:12});
    // Compatibilidad con instalaciones donde quedó la firma RPC de un solo parámetro.
    if(error && String(error.message||"").toLowerCase().includes("start_coto_quiz")){
      const retry=await supabase.rpc("start_coto_quiz",{p_festival_slug:FESTIVAL});
      data=retry.data; error=retry.error;
    }
    setLoadingQuiz(false);
    if(error){
      if(ROULETTE_PREVIEW_ENABLED){ startLocalPreviewQuiz(); return; }
      alert(friendlyError(error.message)); return;
    }
    setLocalPreview(false);
    setAttemptId(data.attempt_id); setQuestions(diversifyQuestionOptions(data.questions ?? [])); setAnswers([]); setN(0); setSelected(null); setFeedback(null); setStarted(true); setSummary(null);
  }

  async function choose(i:number){
    if(locked || !q || !attemptId) return;
    sound("click"); setSelected(i); setLocked(true);

    // Mostramos inmediatamente si la respuesta elegida es correcta y, si no,
    // marcamos también en verde la opción correcta antes de pasar a la siguiente.
    const originalAnswerIndex = q.optionMap?.[i] ?? i;
    let correctIndex = q.correctIndex;
    let isCorrect = correctIndex === i;
    if(!localPreview){
      const checked = await supabase.rpc("check_coto_quiz_answer",{
        p_festival_slug:FESTIVAL,
        p_attempt_id:attemptId,
        p_question_id:q.id,
        p_answer_index:originalAnswerIndex
      });
      if(checked.error){
        setLocked(false);
        alert("Falta instalar la comprobación de respuestas del Quiz. Ejecuta supabase/manual/SUPABASE-EJECUTAR-v192.sql una sola vez en Supabase.");
        return;
      }
      const originalCorrectIndex = Number(checked.data?.correct_index);
      correctIndex = q.optionMap ? q.optionMap.indexOf(originalCorrectIndex) : originalCorrectIndex;
      isCorrect = Boolean(checked.data?.is_correct);
    }
    if(correctIndex === undefined || Number.isNaN(correctIndex)){ setLocked(false); return; }

    setFeedback({chosen:i,correctIndex,isCorrect});
    sound(isCorrect?"correct":"wrong");
    const next=[...answers,{question_id:q.id,answer_index:originalAnswerIndex}];
    setAnswers(next);

    // Tiempo suficiente para ver claramente verde/rojo y la respuesta correcta.
    await new Promise(r=>setTimeout(r,1250));
    if(n<questions.length-1){ setN(v=>v+1); setSelected(null); setFeedback(null); setLocked(false); return; }
    if(localPreview){
      const score=next.reduce((acc,a,idx)=>acc + ((questions[idx]?.optionMap?.[questions[idx]?.correctIndex ?? -1] ?? questions[idx]?.correctIndex)===a.answer_index ? 1 : 0),0);
      const perfect=score===5; const won=perfect && Math.random()<0.65;
      const r={already_played:false,score,perfect,won,day:12,prize_name:won?"PREMIO DE PRUEBA":null,prize_description:won?"Simulación visual: no consume stock ni genera premio real.":null,prize_icon:won?"🎁":null,reward_code:null,raffle_entries:0,passport_complete:false,message:score<5?"MODO PRUEBAS · Día 12 simulado. Para optar a premio necesitas 5/5.":won?"MODO PRUEBAS · 5/5 y simulación de premio.":"MODO PRUEBAS · 5/5, pero esta vez no ha tocado."} as GameResult & {score:number;perfect:boolean};
      setSummary(r); setFeedback(null); setLocked(false); return;
    }
    const {data,error}=await supabase.rpc("finish_coto_quiz",{p_festival_slug:FESTIVAL,p_attempt_id:attemptId,p_answers:next});
    if(error){ setFeedback(null); setLocked(false); alert(friendlyError(error.message)); return; }
    const r=(data ?? {}) as GameResult & {score?:number;perfect?:boolean};
    setSummary(r); setFeedback(null); await onFinished(r); setLocked(false);
  }

  const buttonLabel=!registered?"REGÍSTRATE PARA JUGAR":loadingQuiz?"PREPARANDO...":"¡JUGAR AHORA!";
  return <section className="quiz-pattern-screen" aria-label="Quiz EXCLU · Día 12">
    {!started && <div className="quiz-v194-approved-intro">
      <img src={`${import.meta.env.BASE_URL}assets/day12-quiz-v194-intro.png`} alt="Quiz · ¿Cuánto sabes de El Coto?"/>
      <button className="quiz-v194-back-hot" onClick={()=>{sound("click");window.dispatchEvent(new CustomEvent("exclu-back-to-play"));}} aria-label="Volver"/>
      <button type="button" className="quiz-v194-start-hot" onClick={(e)=>{e.preventDefault();e.stopPropagation();startQuiz();}} disabled={loadingQuiz} aria-label={buttonLabel}/>
      {loadingQuiz && <div className="quiz-v194-loading">PREPARANDO...</div>}
    </div>}
    {started && <><button className="quiz-pattern-back" onClick={()=>{sound("click");window.dispatchEvent(new CustomEvent("exclu-back-to-play"));}} aria-label="Volver">‹</button><div className="quiz-pattern-brand"><img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-real-icon.png`} alt=""/><b>La Exclusiva</b><small>CAFETERÍA</small></div><h1>QUIZ</h1><p className="quiz-pattern-sub">¿CUÁNTO SABES DE EL COTO?</p></>}
    {started && q && !summary && <div className="quiz-live-card">
      <div className="quiz-live-head"><span>{q.category}</span><b>{n+1}/5</b></div>
      <div className="quiz-progress"><i style={{width:`${((n+1)/5)*100}%`}}/></div>
      <h2>{q.question}</h2>
      <div className="quiz-live-answers">{q.options.map((a,i)=>{
        const cls = feedback
          ? (i===feedback.correctIndex ? "answer-correct" : i===feedback.chosen ? "answer-wrong" : "")
          : (selected===i ? "selected" : "");
        return <button key={i} className={cls} disabled={locked||busy} onClick={()=>choose(i)}><span>{String.fromCharCode(65+i)}</span>{a}{feedback && i===feedback.correctIndex && <b className="answer-mark">✓</b>}{feedback && i===feedback.chosen && !feedback.isCorrect && <b className="answer-mark">✕</b>}</button>;
      })}</div>
      <small className={feedback ? (feedback.isCorrect?"quiz-feedback-ok":"quiz-feedback-bad") : ""}>{feedback ? (feedback.isCorrect ? "✓ ¡CORRECTO!" : "✕ INCORRECTO · La respuesta correcta está marcada en verde") : "Elige una respuesta."}</small>
    </div>}
    {summary && <div className="quiz-summary"><b>{summary.score}/5</b><h2>{summary.perfect?"¡QUIZ PERFECTO!":"DÍA 12 SELLADO"}</h2><p>{summary.perfect?"Has acertado las 5 y has optado al premio instantáneo.":"Tu participación cuenta para el sorteo final. Para optar al premio instantáneo había que acertar las 5."}</p><strong>{summary.won?`🎁 ${summary.prize_name ?? "¡Premio!"}`:summary.message}</strong>{ROULETTE_PREVIEW_ENABLED && <button className="quiz-pattern-cta" onClick={()=>{sound("click");startLocalPreviewQuiz();}}>PROBAR OTRA VEZ　›</button>}</div>}
  </section>;
}

function Boxes({ busy, played, registered, phoneMasked, setView, soundOn, onToggleSound, play }: { busy: boolean; played: boolean; registered: boolean; phoneMasked?: string; setView: (v: View) => void; soundOn: boolean; onToggleSound: () => void; play: (choice: string) => Promise<GameResult | null> }) {
  const [pick, setPick] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [boxResult, setBoxResult] = useState<GameResult | null>(null);

  function resetBox() {
    sound("click");
    setPick(null);
    setOpening(false);
    setBoxResult(null);
  }

  async function choose(n: number) {
    if (!registered) {
      alert("Regístrate primero para poder participar.");
      return;
    }
    if (pick !== null || busy || opening || (played && !ROULETTE_PREVIEW_ENABLED)) return;
    setPick(n);
    setOpening(true);
    setBoxResult(null);
    sound("open");
    if (navigator.vibrate) navigator.vibrate([35, 25, 55]);
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const r = await play(String(n));
      if (!r) {
        setPick(null);
        setOpening(false);
        return;
      }
      setOpening(false);
      setBoxResult(r);
      if ((r as any).won) {
        sound("win");
        if (navigator.vibrate) navigator.vibrate([80, 45, 120, 45, 180]);
      } else {
        sound("correct");
      }
    } catch {
      setPick(null);
      setOpening(false);
    }
  }

  const isLocked = played && !ROULETTE_PREVIEW_ENABLED;
  const nav = (view: View) => { sound("click"); setView(view); };

  return <section className="box13-v198" aria-label="Caja Sorpresa · Día 13">
    <div className="box13-v198-art-wrap">
      <img className="box13-v198-art" src={`${import.meta.env.BASE_URL}assets/day13-box-v198-approved.png`} alt="Caja Sorpresa · Elige una caja y descubre tu suerte" />

      <button className="box13-v198-hot back" onClick={()=>{sound("click");window.dispatchEvent(new CustomEvent("exclu-back-to-play"));}} aria-label="Volver" />
      <button className="box13-v198-hot sound" onClick={onToggleSound} aria-label={soundOn ? "Desactivar sonido" : "Activar sonido"} />
      {!soundOn && <div className="box13-v198-sound-off" aria-hidden="true"><VolumeX /></div>}

      {[1,2,3,4,5,6].map((n)=><button
        key={n}
        className={`box13-v198-hot gift gift-${n} ${pick===n?"is-picked":""}`}
        disabled={busy || opening || pick!==null || isLocked}
        onClick={()=>choose(n)}
        aria-label={`Elegir caja ${n}`}
      />)}

      <button className="box13-v198-hot nav-home" onClick={()=>nav("home")} aria-label="Inicio" />
      <button className="box13-v198-hot nav-passport" onClick={()=>nav("passport")} aria-label="Pasaporte" />
      <button className="box13-v198-hot nav-games" onClick={()=>nav("games")} aria-label="Juegos" />
      <button className="box13-v198-hot nav-photo" onClick={()=>nav("photo")} aria-label="Fotomatón" />

      <div className={`box13-v198-registration ${registered ? "is-registered" : "is-unregistered"}`}>
        {registered ? <><b>✓ YA ESTÁS REGISTRADO</b><span>{phoneMasked ?? "Tu teléfono"} · Una participación por persona y día.</span></> : <><b>PARTICIPA SIN SMS Y SIN COSTE</b><span>Regístrate desde Inicio antes de elegir tu caja.</span><button onClick={()=>nav("home")}>IR A INICIO</button></>}
      </div>

      {isLocked && <div className="box13-v198-lock">✓ YA HAS JUGADO EL DÍA 13</div>}

      {opening && <div className="box13-v198-opening"><span>🎁</span><b>ABRIENDO TU CAJA…</b><small>EXCLU está comprobando tu suerte</small></div>}

      {boxResult && <div className={`box13-v198-result ${(boxResult as any).won?"winner":"no-winner"}`}>
        <div className="box13-v198-result-icon">{(boxResult as any).won ? ((boxResult as any).prize_icon || "🎁") : "🎟️"}</div>
        <h2>{(boxResult as any).won ? "¡HAS GANADO!" : "¡PARTICIPACIÓN GUARDADA!"}</h2>
        <p>{(boxResult as any).won ? ((boxResult as any).prize_name || "Premio instantáneo") : "Esta vez no había premio instantáneo, pero el Día 13 queda sellado y tu participación cuenta para el sorteo final."}</p>
        {(boxResult as any).won && (boxResult as any).prize_description && <small>{(boxResult as any).prize_description}</small>}
        {(boxResult as any).reward_code && <code>{(boxResult as any).reward_code}</code>}
        {ROULETTE_PREVIEW_ENABLED && <button onClick={resetBox}>PROBAR OTRA VEZ　›</button>}
      </div>}
    </div>
  </section>;
}

function Passport({ status, setView }: { status: FestivalStatus; setView: (v: View) => void }) {
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
    // Durante las pruebas, cualquier participación realmente registrada en
    // Supabase debe mostrarse como sello completado.
    if (status.test_mode) return rawPlayedDays.has(day);

    if (beforeFestival) return false;
    if (afterFestival) return rawPlayedDays.has(day);
    if (year === 2026 && month === 9) {
      return rawPlayedDays.has(day) && day <= today;
    }
    return false;
  }

  function getDayState(day: 11 | 12 | 13): PassportDayState {
    if (status.test_mode) {
      if (rawPlayedDays.has(day)) return "done";
      if (forcedTestDay === day) return "open";
      return "locked";
    }

    if (beforeFestival) return "locked";
    if (isPlayedDayValidForDisplay(day)) return "done";
    if (year === 2026 && month === 9 && today === day) return "open";
    if (afterFestival || (year === 2026 && month === 9 && today > day)) return "missed";
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
  const progress = Math.round((visibleCompleted / 3) * 100);

  const dayStateText = (state: PassportDayState) => {
    if (state === "done") return "COMPLETADO";
    if (state === "open") return status.registered ? "DISPONIBLE HOY" : "REGÍSTRATE";
    if (state === "missed") return "FINALIZADO";
    return "BLOQUEADO";
  };

  return (
    <main className="passport-v176" aria-label="Tu Pasaporte La Exclusiva">
      <section className="passport-v176__visual">
        <img
          className="passport-v176__art"
          src={`${import.meta.env.BASE_URL}assets/passport-v176-approved-top.png`}
          alt="Tu Pasaporte de La Exclusiva para las fiestas de El Coto"
        />

        <button
          className="passport-v176__back-hot"
          onClick={() => { sound("click"); setView("home"); }}
          aria-label="Volver"
        />

        {dayConfig.map(({ day }) => {
          const state = getDayState(day);
          if (state === "locked") return null;
          return (
            <div
              key={day}
              className={`passport-v176__day-state passport-v176__day-state--${day} is-${state}`}
              aria-label={`Día ${day}: ${dayStateText(state)}`}
            >
              {state === "done" && <span className="passport-v176__day-check">✓</span>}
              <b>{dayStateText(state)}</b>
            </div>
          );
        })}

        {progress > 0 && (
          <span className="passport-v176__progress-fill" style={{ width: `${progress * 0.392}%` }} aria-hidden="true" />
        )}
        {(visibleCompleted > 0 || raffleEntries > 0) && (
          <>
            <b className="passport-v176__progress-count">{visibleCompleted} de 3 sellos</b>
            <b className="passport-v176__stamps-count">{visibleCompleted}/3</b>
            <b className="passport-v176__entries-count">{raffleEntries}</b>
          </>
        )}

        {passportComplete && (
          <div className="passport-v176__complete-banner">
            <Gift size={20}/>
            <div><b>¡PASAPORTE COMPLETO!</b><span>+2 participaciones extra añadidas al sorteo final</span></div>
          </div>
        )}
      </section>

      {forcedTestDay !== null && (
        <div className="passport-v176__test">MODO PRUEBAS · DÍA {forcedTestDay} HABILITADO</div>
      )}
    </main>
  );
}

function Photo({ onPhotoCreated, setView }: { onPhotoCreated: () => void; setView: (v: View) => void }){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const previewRef=useRef<HTMLDivElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const [cameraOn,setCameraOn]=useState(false);
  const [cameraActivated,setCameraActivated]=useState(false);
  const [cameraSwitching,setCameraSwitching]=useState(false);
  const [switchFrame,setSwitchFrame]=useState<string|null>(null);
  const [cameraCrossfade,setCameraCrossfade]=useState(false);
  const [cameraShutter,setCameraShutter]=useState<"idle"|"closing"|"opening">("idle");
  const [cameraZoom,setCameraZoom]=useState(1);
  const pinchStartRef=useRef<number|null>(null);
  const pinchZoomStartRef=useRef(1);
  const [photoUrl,setPhotoUrl]=useState<string|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("user");
  const [frame,setFrame]=useState("classic");
  const [sticker,setSticker]=useState<string|null>(null);
  type PlacedSticker = {
    id:string;
    kind:string;
    x:number;
    y:number;
    scale:number;
  };
  const [placedStickers,setPlacedStickers]=useState<PlacedSticker[]>([]);
  const [activeStickerId,setActiveStickerId]=useState<string|null>(null);
  const stickerGestureRef=useRef<{
    id:string;
    mode:"drag";
    startX:number;
    startY:number;
    startStickerX:number;
    startStickerY:number;
    startDistance:number;
    startScale:number;
  }|null>(null);
  const [filter,setFilter]=useState("normal");
  const [photoAction,setPhotoAction]=useState<"save"|"share"|"repeat">("share");

  const frameIds=["classic","party","selfie","cheers","good","team","asturias"];
  const approvedFrameAssets:Record<string,string>={
    party:`${import.meta.env.BASE_URL}assets/frames/retro.png`,
    selfie:`${import.meta.env.BASE_URL}assets/frames/selfie.png`,
    cheers:`${import.meta.env.BASE_URL}assets/frames/brindis.png`,
    good:`${import.meta.env.BASE_URL}assets/frames/buen-rollo.png`,
    team:`${import.meta.env.BASE_URL}assets/frames/el-coto-esta-de-fiesta.png`,
    asturias:`${import.meta.env.BASE_URL}assets/frames/asturias.png`
  };
  const stickerIds=["exclu","salud","beer","hearts","crown","glasses","confetti","heart","coffee","exclusive","selfie","fiestas"];
  const filterIds=["normal","warm","bw","party","vintage","neon"];
  const filterCss:Record<string,string>={
    normal:"none",warm:"sepia(.28) saturate(1.2)",bw:"grayscale(1)",
    party:"saturate(1.6) hue-rotate(12deg)",vintage:"sepia(.6) saturate(.8)",
    neon:"saturate(1.9) contrast(1.2) hue-rotate(-18deg)"
  };

  // 152 · Aplicación real del filtro a la foto capturada.
  // No dependemos de CanvasRenderingContext2D.filter porque en algunos móviles
  // (especialmente Safari/iOS) el vídeo puede verse filtrado pero el JPEG salir normal.
  function applyCapturedFilter(ctx:CanvasRenderingContext2D,w:number,h:number,kind:string){
    if(kind==="normal")return;
    const img=ctx.getImageData(0,0,w,h);
    const d=img.data;
    const clamp=(n:number)=>Math.max(0,Math.min(255,n));

    for(let i=0;i<d.length;i+=4){
      let r=d[i],g=d[i+1],b=d[i+2];
      const saturate=(amount:number)=>{
        const l=.2126*r+.7152*g+.0722*b;
        r=l+(r-l)*amount; g=l+(g-l)*amount; b=l+(b-l)*amount;
      };
      const sepia=(amount:number)=>{
        const sr=.393*r+.769*g+.189*b;
        const sg=.349*r+.686*g+.168*b;
        const sb=.272*r+.534*g+.131*b;
        r=r*(1-amount)+sr*amount;
        g=g*(1-amount)+sg*amount;
        b=b*(1-amount)+sb*amount;
      };
      const contrast=(amount:number)=>{
        r=(r-128)*amount+128;
        g=(g-128)*amount+128;
        b=(b-128)*amount+128;
      };

      if(kind==="bw"){
        const l=.299*r+.587*g+.114*b; r=g=b=l;
      }else if(kind==="warm"){
        saturate(1.2); sepia(.28);
      }else if(kind==="party"){
        saturate(1.6);
        // Aproximación estable al hue-rotate(12deg) del preview.
        const nr=r*1.05+g*.02;
        const ng=g*1.02+b*.015;
        const nb=b*.94+r*.015;
        r=nr;g=ng;b=nb;
      }else if(kind==="vintage"){
        sepia(.6); saturate(.8); contrast(.96);
      }else if(kind==="neon"){
        saturate(1.9); contrast(1.2);
        const nr=r*1.03+b*.025;
        const ng=g*.97+r*.015;
        const nb=b*1.08;
        r=nr;g=ng;b=nb;
      }

      d[i]=clamp(r); d[i+1]=clamp(g); d[i+2]=clamp(b);
    }
    ctx.putImageData(img,0,0);
  }

  async function stopCamera(){
    const current=streamRef.current;
    streamRef.current=null;
    current?.getTracks().forEach(track=>track.stop());
    if(videoRef.current){
      videoRef.current.pause();
      videoRef.current.srcObject=null;
    }
    setCameraOn(false);
    setCameraActivated(false);
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
      setCameraActivated(true);
    }catch(err){
      console.error("Error al abrir la cámara:",err);
      setCameraOn(false);
      alert("No se ha podido abrir la cámara. Revisa que el navegador tenga permiso para usarla.");
    }
  }

  function freezeCurrentCameraFrame(){
    const v=videoRef.current;
    if(!v || v.readyState<2 || !v.videoWidth || !v.videoHeight){
      setSwitchFrame(null);
      return null;
    }

    try{
      const vw=v.videoWidth;
      const vh=v.videoHeight;
      const previewAspect=(45.90*1024)/(40.65*1536);

      const c=document.createElement("canvas");
      const outW=720;
      const outH=Math.round(outW/previewAspect);
      c.width=outW;
      c.height=outH;

      const ctx=c.getContext("2d");
      if(!ctx)return null;

      const sourceAspect=vw/vh;
      let sx=0,sy=0,sw=vw,sh=vh;

      if(sourceAspect>previewAspect){
        sw=vh*previewAspect;
        sx=(vw-sw)/2;
      }else{
        sh=vw/previewAspect;
        sy=(vh-sh)/2;
      }

      if(cameraZoom>1){
        const baseSw=sw;
        const baseSh=sh;
        sw=baseSw/cameraZoom;
        sh=baseSh/cameraZoom;
        sx+=(baseSw-sw)/2;
        sy+=(baseSh-sh)/2;
      }

      ctx.save();
      if(facing==="user"){
        ctx.translate(outW,0);
        ctx.scale(-1,1);
      }
      ctx.filter=filterCss[filter]||"none";
      ctx.drawImage(v,sx,sy,sw,sh,0,0,outW,outH);
      ctx.restore();

      const frame=c.toDataURL("image/jpeg",0.9);
      setSwitchFrame(frame);
      return frame;
    }catch{
      setSwitchFrame(null);
      return null;
    }
  }

  function nextPaint(){
    return new Promise<void>(resolve=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()));
    });
  }

  async function switchCamera(){
    if(cameraSwitching) return;

    setCameraSwitching(true);

    const currentFacing=facing;
    const next: "user" | "environment" =
      currentFacing==="user" ? "environment" : "user";

    const previous=streamRef.current;

    try{
      // 1) Mostramos PRIMERO la transición aprobada.
      // Así nunca se ve el stream congelado ni el fondo del visor.
      setCameraShutter("closing");
      setSwitchFrame(null);
      setCameraCrossfade(false);
      await nextPaint();
      await new Promise(resolve=>setTimeout(resolve,140));

      // 2) Con la transición ya cubriendo todo el visor,
      // cerramos la cámara actual y abrimos la nueva.
      previous?.getTracks().forEach(track=>track.stop());

      const stream=await getCameraStream(next);
      streamRef.current=stream;

      const video=videoRef.current;
      if(video){
        video.srcObject=stream;
        video.muted=true;
        video.playsInline=true;

        if(video.readyState<2){
          await new Promise<void>((resolve)=>{
            let settled=false;
            const done=()=>{
              if(settled)return;
              settled=true;
              resolve();
            };
            video.addEventListener("loadeddata",done,{once:true});
            setTimeout(done,1400);
          });
        }

        await video.play();

        // Esperamos a que exista un frame real de la nueva cámara.
        if("requestVideoFrameCallback" in video){
          await new Promise<void>((resolve)=>{
            let settled=false;
            const done=()=>{
              if(settled)return;
              settled=true;
              resolve();
            };
            (video as HTMLVideoElement & {
              requestVideoFrameCallback?: (cb:()=>void)=>number
            }).requestVideoFrameCallback?.(done);
            setTimeout(done,650);
          });
        }else{
          await nextPaint();
          await new Promise(resolve=>setTimeout(resolve,80));
        }
      }

      setFacing(next);
      setCameraZoom(1);
      setCameraOn(true);
      setCameraActivated(true);
      setPhotoUrl(null);

      // 3) La nueva cámara ya está lista: abrimos el obturador.
      setCameraShutter("opening");
      await new Promise(resolve=>setTimeout(resolve,190));
      setCameraShutter("idle");

    }catch(err){
      console.error("Error al cambiar de cámara:",err);

      try{
        const recovery=await getCameraStream(currentFacing);
        streamRef.current=recovery;

        const video=videoRef.current;
        if(video){
          video.srcObject=recovery;
          video.muted=true;
          video.playsInline=true;
          await video.play();
          await nextPaint();
        }

        setFacing(currentFacing);
        setCameraOn(true);
        setCameraActivated(true);

        setCameraShutter("opening");
        await new Promise(resolve=>setTimeout(resolve,160));
        setCameraShutter("idle");
      }catch(recoveryError){
        console.error("Error al recuperar la cámara:",recoveryError);
        setCameraOn(false);
        setCameraActivated(true);
        setCameraShutter("idle");
      }
    }finally{
      setSwitchFrame(null);
      setCameraCrossfade(false);
      setCameraSwitching(false);
    }
  }
  useEffect(()=>{
    const el=previewRef.current;
    if(!el)return;

    const blockTouchMove=(ev: TouchEvent)=>{
      if(ev.touches.length>=2) ev.preventDefault();
    };
    const blockGesture=(ev: Event)=>ev.preventDefault();

    el.addEventListener("touchmove",blockTouchMove,{passive:false});
    el.addEventListener("gesturestart",blockGesture,{passive:false} as AddEventListenerOptions);
    el.addEventListener("gesturechange",blockGesture,{passive:false} as AddEventListenerOptions);
    el.addEventListener("gestureend",blockGesture,{passive:false} as AddEventListenerOptions);

    return ()=>{
      el.removeEventListener("touchmove",blockTouchMove);
      el.removeEventListener("gesturestart",blockGesture);
      el.removeEventListener("gesturechange",blockGesture);
      el.removeEventListener("gestureend",blockGesture);
    };
  },[]);

  const stickerGlyphs:Record<string,string>={
    exclu:"🤖",
    salud:"¡Salud!",
    beer:"🍻",
    hearts:"💕",
    crown:"👑",
    glasses:"🕶️",
    confetti:"🎉",
    heart:"💗",
    coffee:"☕",
    exclusive:"LA EXCLUSIVA",
    selfie:"Selfie Time ♡",
    fiestas:"FIESTAS 2026"
  };

  // Gafas como SVG propio: usamos exactamente el mismo recurso en el visor y
  // en la foto final para evitar que Safari/iOS renderice el emoji de forma distinta.
  const GLASSES_STICKER_SRC=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128">
      <defs>
        <linearGradient id="lens" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5d6166"/>
          <stop offset="0.45" stop-color="#2f3338"/>
          <stop offset="1" stop-color="#090b0d"/>
        </linearGradient>
      </defs>
      <path d="M18 22h116c19 0 30 11 30 28v8h-12c-6-7-14-11-25-11H42c-10 0-18 3-24 9V22Z" fill="#0a0b0d"/>
      <path d="M302 22H186c-19 0-30 11-30 28v8h12c6-7 14-11 25-11h85c10 0 18 3 24 9V22Z" fill="#0a0b0d"/>
      <path d="M25 45c0-9 8-16 18-16h92c12 0 21 8 21 20v17c0 33-22 55-57 55H78c-34 0-53-18-53-50V45Z" fill="url(#lens)" stroke="#050607" stroke-width="11"/>
      <path d="M295 45c0-9-8-16-18-16h-92c-12 0-21 8-21 20v17c0 33 22 55 57 55h21c34 0 53-18 53-50V45Z" fill="url(#lens)" stroke="#050607" stroke-width="11"/>
      <path d="M151 53c6-6 12-9 19-9s13 3 19 9" fill="none" stroke="#050607" stroke-width="12" stroke-linecap="round"/>
      <path d="M43 45c25-9 63-8 92 2" fill="none" stroke="#8a8f95" stroke-width="5" opacity=".34"/>
      <path d="M277 45c-25-9-63-8-92 2" fill="none" stroke="#8a8f95" stroke-width="5" opacity=".34"/>
    </svg>`)}`;

  function addSticker(kind:string){
    setSticker(null);
    const id=`${kind}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

    setPlacedStickers(prev=>{
      // El primero sale exactamente en el centro.
      // Los siguientes se separan apenas unos píxeles para que se vea
      // que se han añadido varias copias y no queden totalmente solapados.
      const n=prev.length%5;
      const offsets=[
        [0,0],
        [4,-3],
        [-4,3],
        [5,4],
        [-5,-4]
      ];
      const [ox,oy]=offsets[n];
      return [...prev,{id,kind,x:50+ox,y:50+oy,scale:1}];
    });

    setActiveStickerId(id);
    navigator.vibrate?.(25);
  }

  function updatePlacedSticker(id:string, patch:Partial<PlacedSticker>){
    setPlacedStickers(prev=>prev.map(s=>s.id===id?{...s,...patch}:s));
  }

  function removePlacedSticker(id:string){
    setPlacedStickers(prev=>prev.filter(s=>s.id!==id));
    setActiveStickerId(prev=>prev===id?null:prev);
  }

  function placedStickerTouchStart(e:React.TouchEvent<HTMLDivElement>, id:string){
    e.stopPropagation();

    // Los stickers NO usan pellizco: el pinch queda reservado a la cámara.
    if(e.touches.length!==1)return;

    const s=placedStickers.find(item=>item.id===id);
    if(!s)return;

    setActiveStickerId(id);

    const t=e.touches[0];
    stickerGestureRef.current={
      id,
      mode:"drag",
      startX:t.clientX,
      startY:t.clientY,
      startStickerX:s.x,
      startStickerY:s.y,
      startDistance:0,
      startScale:s.scale
    };
  }

  function placedStickerTouchMove(e:React.TouchEvent<HTMLDivElement>){
    const g=stickerGestureRef.current;
    if(!g || e.touches.length!==1)return;

    e.stopPropagation();
    e.preventDefault();

    const preview=previewRef.current;
    if(!preview)return;

    const rect=preview.getBoundingClientRect();
    const t=e.touches[0];
    const dx=((t.clientX-g.startX)/rect.width)*100;
    const dy=((t.clientY-g.startY)/rect.height)*100;

    updatePlacedSticker(g.id,{
      x:Math.min(96,Math.max(4,g.startStickerX+dx)),
      y:Math.min(96,Math.max(4,g.startStickerY+dy))
    });
  }

  function placedStickerTouchEnd(){
    stickerGestureRef.current=null;
  }

  function touchDistance(touches: React.TouchList){
    if(touches.length<2)return null;
    const a=touches[0],b=touches[1];
    return Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
  }

  function handleCameraTouchStart(e: React.TouchEvent<HTMLDivElement>){
    if(e.touches.length===2){
      const d=touchDistance(e.touches);
      if(d){
        pinchStartRef.current=d;
        pinchZoomStartRef.current=cameraZoom;
      }
    }
  }

  function handleCameraTouchMove(e: React.TouchEvent<HTMLDivElement>){
    if(e.touches.length!==2 || !pinchStartRef.current)return;
    e.preventDefault();
    const d=touchDistance(e.touches);
    if(!d)return;
    const next=pinchZoomStartRef.current*(d/pinchStartRef.current);
    setCameraZoom(Math.min(3,Math.max(1,next)));
  }

  function handleCameraTouchEnd(e: React.TouchEvent<HTMLDivElement>){
    if(e.touches.length<2){
      pinchStartRef.current=null;
      pinchZoomStartRef.current=cameraZoom;
    }
  }

  const photoBlobRef=useRef<Blob|null>(null);
  const [capturing,setCapturing]=useState(false);

  function waitForVideoFrame(video:HTMLVideoElement, timeoutMs=2200){
    if(video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0){
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve)=>{
      let settled=false;
      const finish=(ok:boolean)=>{
        if(settled)return;
        settled=true;
        video.removeEventListener("loadeddata",onReady);
        video.removeEventListener("canplay",onReady);
        resolve(ok);
      };
      const onReady=()=>{
        if(video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0)finish(true);
      };
      video.addEventListener("loadeddata",onReady);
      video.addEventListener("canplay",onReady);
      window.setTimeout(()=>finish(video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0),timeoutMs);
    });
  }

  function loadFrameWithTimeout(src:string, timeoutMs=1200){
    return new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      let settled=false;
      const finishOk=()=>{ if(settled)return; settled=true; resolve(img); };
      const finishError=(err:unknown)=>{ if(settled)return; settled=true; reject(err); };
      img.onload=finishOk;
      img.onerror=()=>finishError(new Error(`No se pudo cargar ${src}`));
      img.src=src;
      if(img.complete && img.naturalWidth>0)finishOk();
      window.setTimeout(()=>finishError(new Error(`Timeout cargando ${src}`)),timeoutMs);
    });
  }

  async function capture(){
    if(capturing)return;
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c)return;

    setCapturing(true);
    try{
      // En Safari/iPhone la cámara puede verse pero tardar unas décimas en exponer
      // un frame utilizable al canvas. Esperamos un poco en vez de fallar en silencio.
      if(!cameraOn){
        await startCamera();
      }
      try{ await v.play(); }catch{}
      const ready=await waitForVideoFrame(v);
      if(!ready){
        alert("La cámara todavía no está lista. Espera un segundo y vuelve a tocar el botón de foto.");
        return;
      }

      const vw=v.videoWidth||1080;
      const vh=v.videoHeight||1440;

      // Misma proporción que el visor del Fotomatón.
      const previewAspect=(45.90*1024)/(40.65*1536);
      const outW=1080;
      const outH=Math.round(outW/previewAspect);

      c.width=outW;
      c.height=outH;

      const x=c.getContext("2d",{willReadFrequently:true});
      if(!x)return;

      // Recorte "cover" idéntico al que ve el usuario en el <video>.
      const sourceAspect=vw/vh;
      let sx=0,sy=0,sw=vw,sh=vh;
      if(sourceAspect>previewAspect){
        sw=vh*previewAspect;
        sx=(vw-sw)/2;
      }else{
        sh=vw/previewAspect;
        sy=(vh-sh)/2;
      }

      if(cameraZoom>1){
        const baseSw=sw;
        const baseSh=sh;
        sw=baseSw/cameraZoom;
        sh=baseSh/cameraZoom;
        sx=sx+(baseSw-sw)/2;
        sy=sy+(baseSh-sh)/2;
      }

      x.save();
      if(facing==="user"){
        x.translate(outW,0);
        x.scale(-1,1);
      }
      x.drawImage(v,sx,sy,sw,sh,0,0,outW,outH);
      x.restore();

      applyCapturedFilter(x,outW,outH,filter);

      const border=Math.max(18,Math.round(outW*.02));
      x.strokeStyle="#f6c51c";
      x.lineWidth=border;
      x.strokeRect(border/2,border/2,outW-border,outH-border);

      // No imprimimos el nombre del marco elegido sobre la foto final.
      // El propio marco ya aporta su diseño; evitamos rótulos como RETRO/SELFIE EXCLU/etc.

      // Un marco lento jamás bloquea el disparo. Si ya está disponible se compone;
      // si el túnel tarda demasiado, la foto se genera igualmente.
      if(approvedFrameAssets[frame]){
        try{
          const frameImg=await loadFrameWithTimeout(approvedFrameAssets[frame],1200);
          if(frameImg.naturalWidth>0)x.drawImage(frameImg,0,0,outW,outH);
        }catch(err){
          console.warn("Marco no disponible a tiempo; la foto continúa:",err);
        }
      }

      // Medimos cada sticker tal y como se ve en el visor justo antes del disparo.
      // Así la foto final conserva exactamente el tamaño elegido por el usuario.
      const previewRect=previewRef.current?.getBoundingClientRect();
      const stickerMetrics=new Map<string,{
        fontSize:number;
        fontFamily:string;
        fontWeight:string;
        color:string;
        centerX:number;
        centerY:number;
        width:number;
        height:number;
      }>();

      if(previewRef.current && previewRect && previewRect.width>0 && previewRect.height>0){
        const scaleX=outW/previewRect.width;
        const scaleY=outH/previewRect.height;

        for(const ps of placedStickers){
          const glyphEl=previewRef.current.querySelector(
            `[data-sticker-id="${ps.id}"] [data-sticker-glyph="true"]`
          ) as HTMLElement | null;
          if(!glyphEl)continue;

          const cs=window.getComputedStyle(glyphEl);
          const cssFontSize=parseFloat(cs.fontSize)||32;
          const glyphRect=glyphEl.getBoundingClientRect();

          stickerMetrics.set(ps.id,{
            fontSize:cssFontSize*ps.scale*scaleX,
            fontFamily:cs.fontFamily||"sans-serif",
            fontWeight:cs.fontWeight||"400",
            color:cs.color||"#ffd329",
            centerX:((glyphRect.left+glyphRect.width/2)-previewRect.left)*scaleX,
            centerY:((glyphRect.top+glyphRect.height/2)-previewRect.top)*scaleY,
            width:glyphRect.width*scaleX,
            height:glyphRect.height*scaleY
          });
        }
      }

      const glassesImg=placedStickers.some(ps=>ps.kind==="glasses")
        ? await loadFrameWithTimeout(GLASSES_STICKER_SRC,1200).catch(()=>null)
        : null;

      for(const ps of placedStickers){
        const glyph=stickerGlyphs[ps.kind]||ps.kind;
        const isText=["salud","exclusive","selfie","fiestas"].includes(ps.kind);
        const measured=stickerMetrics.get(ps.id);
        const px=measured?.centerX ?? (ps.x/100)*outW;
        const py=measured?.centerY ?? (ps.y/100)*outH;

        // Las gafas se dibujan como imagen, con el MISMO ancho, alto y centro
        // medidos en el visor. Así no dependen del emoji de Safari.
        if(ps.kind==="glasses" && glassesImg){
          const w=measured?.width ?? outW*.24*ps.scale;
          const h=measured?.height ?? w*.4;
          x.drawImage(glassesImg,px-w/2,py-h/2,w,h);
          continue;
        }

        const fallbackBase=isText?outW*.048:outW*.095;
        const finalFontSize=Math.max(10,Math.round(measured?.fontSize ?? fallbackBase*ps.scale));
        x.save();
        x.font=`${isText ? "700" : (measured?.fontWeight||"400")} ${finalFontSize}px ${measured?.fontFamily||"sans-serif"}`;
        x.textAlign="center";
        x.textBaseline="middle";
        x.fillStyle=isText ? (measured?.color||"#ffd329") : "#ffd329";
        x.fillText(glyph,px,py);
        x.restore();
      }

      // El diseño sorpresa NO se añade aquí.
      // La foto previa queda limpia; la composición aprobada se aplica solo al Guardar/Compartir.

      const dataUrl=c.toDataURL("image/jpeg",.92);
      setPhotoAction("share");
      setPhotoUrl(dataUrl);

      // Dejamos el Blob preparado AHORA. Así Compartir/Guardar en iPhone se ejecutan
      // directamente desde el toque del usuario y Safari no pierde la autorización.
      const blob=await new Promise<Blob|null>((resolve)=>c.toBlob(resolve,"image/jpeg",.92));
      photoBlobRef.current=blob;

      onPhotoCreated();
      navigator.vibrate?.(60);
    }catch(err){
      console.error("Error al hacer la foto:",err);
      alert("No se ha podido hacer la foto. Comprueba el permiso de cámara e inténtalo de nuevo.");
    }finally{
      setCapturing(false);
    }
  }

  async function makeFinalSurpriseBlob():Promise<Blob|null>{
    if(!photoUrl)return null;

    const base=await loadFrameWithTimeout(photoUrl,2500).catch(()=>null);
    if(!base)return photoBlobRef.current;

    const c=document.createElement("canvas");
    c.width=base.naturalWidth||base.width;
    c.height=base.naturalHeight||base.height;
    const x=c.getContext("2d");
    if(!x)return photoBlobRef.current;

    // Foto ya terminada: filtro + stickers + marco elegido.
    x.drawImage(base,0,0,c.width,c.height);

    // SORPRESA FINAL:
    // Esta imagen PNG ya contiene el brochazo + tipografías + corazón.
    // NO se dibuja durante la edición; únicamente aquí, al Guardar/Compartir.
    const banner=await loadFrameWithTimeout(`${import.meta.env.BASE_URL}photo-final-banner-APROBADO-SIN-GRACIAS.png`,2500).catch(()=>null);
    if(banner){
      const naturalW=banner.naturalWidth||banner.width;
      const naturalH=banner.naturalHeight||banner.height;

      // Ocupa casi todo el ancho, manteniendo exactamente la proporción del PNG.
      const drawW=c.width*.96;
      const drawH=drawW*(naturalH/naturalW);
      const drawX=(c.width-drawW)/2;
      const bottomMargin=c.height*.012;
      const drawY=c.height-drawH-bottomMargin;

      x.drawImage(banner,drawX,drawY,drawW,drawH);
    }

    return await new Promise<Blob|null>((resolve)=>c.toBlob(resolve,"image/jpeg",.94));
  }

  function makePhotoFile(blob:Blob|null){
    return blob ? new File([blob],`la-exclusiva-fiestas-coto-2026-${Date.now()}.jpg`,{type:"image/jpeg"}) : null;
  }

  function downloadBlob(blob:Blob|null){
    if(!blob)return;
    const href=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=href;
    a.download=`la-exclusiva-fiestas-coto-2026-${Date.now()}.jpg`;
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(href),1500);
  }

  async function save(){
    setPhotoAction("save");
    if(!photoUrl)return;

    const finalBlob=await makeFinalSurpriseBlob();
    const file=makePhotoFile(finalBlob);
    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);

    if(isIOS && file && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      try{
        await navigator.share({title:"Cafetería La Exclusiva · Fiestas del Coto 2026",files:[file]});
        return;
      }catch(err:any){
        if(err?.name==="AbortError")return;
        console.warn("No se pudo abrir Guardar en iPhone:",err);
      }
    }

    downloadBlob(finalBlob);
  }

  async function share(){
    setPhotoAction("share");
    if(!photoUrl)return;

    const finalBlob=await makeFinalSurpriseBlob();
    const file=makePhotoFile(finalBlob);
    try{
      if(file && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
        await navigator.share({
          title:"Cafetería La Exclusiva · Fiestas del Coto 2026",
          text:"Yo estuve en las Fiestas del Coto 2026 ❤️",
          files:[file]
        });
        return;
      }
      downloadBlob(finalBlob);
    }catch(err:any){
      if(err?.name!=="AbortError")console.warn("Compartir no disponible:",err);
    }
  }

  async function repeatPhoto(){
    if(!photoUrl)return;

    // Repetir = empezar de cero: limpiamos TODO lo añadido por el usuario
    // y volvemos a los valores iniciales del fotomatón.
    setPhotoUrl(null);
    photoBlobRef.current=null;
    setPlacedStickers([]);
    setActiveStickerId(null);
    setSticker(null);
    setFilter("normal");
    setFrame("classic");
    setCameraZoom(1);
    pinchStartRef.current=null;
    pinchZoomStartRef.current=1;
    setPhotoAction("share");

    // Si iOS ha suspendido el stream al abrir Compartir/Guardar, lo recuperamos.
    const live=streamRef.current?.getVideoTracks().some(t=>t.readyState==="live");
    if(!live){
      setCameraOn(false);
      await startCamera(facing);
    }else{
      setCameraOn(true);
      setCameraActivated(true);
      try{await videoRef.current?.play();}catch{}
    }
  }
  useEffect(()=>()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); },[]);

  return <main className="photo112">
    <div className="photo112-stage" data-facing={facing}>
      <img className="photo112-art" src={`${import.meta.env.BASE_URL}assets/fotomaton-definitivo-aprobado.png`} alt="Fotomatón La Exclusiva"/>
      <div className="p112-frame-visible-label p112-frame-visible-label-party" aria-hidden="true">Fiestas Retro</div>
      <div className="p112-frame-visible-label p112-frame-visible-label-team" aria-hidden="true">El Coto de Fiesta</div>
      <button className="p112-back" onClick={()=>{stopCamera();setView("home")}} aria-label="Volver"/>

      <div ref={previewRef} className={`p112-preview ${cameraActivated?"camera-active":""} ${cameraCrossfade?"camera-crossfade":""}`} onTouchStart={handleCameraTouchStart} onTouchMove={handleCameraTouchMove} onTouchEnd={handleCameraTouchEnd} onClick={()=>setActiveStickerId(null)}>
        {cameraShutter!=="idle"&&
          <div className={`p112-camera-shutter ${cameraShutter}`} aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}assets/camera-aperture-transition.png`} alt="" />
          </div>
        }
        {cameraActivated&&!photoUrl&&<div className="p112-live-bg" aria-hidden="true"/>}
      <div className="p112-zoom-indicator" aria-live="polite">{cameraZoom.toFixed(1)}×</div>
        {!cameraActivated&&!photoUrl&&<button className="p112-start" onClick={()=>startCamera()} aria-label="Activar cámara"/>}
        <video ref={videoRef} playsInline muted className={cameraActivated&&!photoUrl?"show":""} style={{filter:filterCss[filter], "--camera-zoom": cameraZoom} as React.CSSProperties}/>
        {photoUrl&&<img src={photoUrl} alt="Tu foto" className="p112-result"/>}
        {!photoUrl&&approvedFrameAssets[frame]&&
          <img src={approvedFrameAssets[frame]} alt="" className="p112-selected-frame" aria-hidden="true"/>
        }
        {!photoUrl&&
          <div className="p112-sticker-layer" aria-label="Stickers colocados">
            {placedStickers.map((ps)=>{
          const glyph=stickerGlyphs[ps.kind]||ps.kind;
          const isText=["salud","exclusive","selfie","fiestas"].includes(ps.kind);
          return <div
            key={ps.id}
            data-sticker-id={ps.id}
            className={`p112-placed-sticker ${activeStickerId===ps.id?"active":""} ${isText?"textual":""}`}
            style={{
              left:`${ps.x}%`,
              top:`${ps.y}%`,
              transform:`translate(-50%,-50%) scale(${ps.scale})`,
              outline:"none",
              borderColor:"transparent",
              boxShadow:"none"
            }}
            onTouchStart={(e)=>placedStickerTouchStart(e,ps.id)}
            onTouchMove={placedStickerTouchMove}
            onTouchEnd={placedStickerTouchEnd}
            onClick={(e)=>{e.stopPropagation();setActiveStickerId(ps.id)}}
          >
            {ps.kind==="glasses"
              ? <img data-sticker-glyph="true" src={GLASSES_STICKER_SRC} alt="" draggable={false} style={{width:"2.2em",height:"auto",display:"block",pointerEvents:"none"}}/>
              : <span data-sticker-glyph="true">{glyph}</span>}
            {activeStickerId===ps.id&&<>
              <button
                className="p112-sticker-size p112-sticker-smaller"
                onTouchStart={(e)=>e.stopPropagation()}
                onClick={(e)=>{
                  e.stopPropagation();
                  updatePlacedSticker(ps.id,{scale:Math.max(.35,ps.scale-.18)});
                }}
                aria-label="Hacer sticker más pequeño"
              >−</button>
              <button
                className="p112-sticker-size p112-sticker-bigger"
                onTouchStart={(e)=>e.stopPropagation()}
                onClick={(e)=>{
                  e.stopPropagation();
                  updatePlacedSticker(ps.id,{scale:Math.min(3.25,ps.scale+.18)});
                }}
                aria-label="Hacer sticker más grande"
              >+</button>
              <button
                className="p112-sticker-delete"
                onTouchStart={(e)=>e.stopPropagation()}
                onClick={(e)=>{e.stopPropagation();removePlacedSticker(ps.id)}}
                aria-label="Eliminar sticker"
              >×</button>
            </>}
          </div>
        })}
          </div>
        }
      </div>

      <div className="p112-frames">
        {frameIds.map((id,i)=>{
          const labels:Record<string,string>={
            classic:"Clásico EXCLU",
            party:"Retro",
            selfie:"Selfie EXCLU",
            cheers:"Brindis",
            good:"Buen Rollo",
            team:"El Coto de Fiesta",
            asturias:"Asturias"
          };
          return <button key={id} className={frame===id?"active":""} style={{top:`${i*14.2857}%`}} onClick={()=>setFrame(id)} aria-label={`Marco ${labels[id]}`}/>;
        })}
      </div>
      <div className="p112-stickers">
        {stickerIds.map((id,i)=><button key={id} className={sticker===id?"active":""} style={{left:`${(i%2)*50}%`,top:`${Math.floor(i/2)*16.6667}%`}} onClick={()=>addSticker(id)} aria-label={`Añadir sticker ${id}`}/>)}
      </div>
      <div className="p112-filters">
        {filterIds.map((id,i)=><button key={id} className={filter===id?"active":""} style={{left:`${(i%2)*50}%`,top:`${Math.floor(i/2)*33.3333}%`}} onClick={()=>setFilter(id)} aria-label={`Filtro ${id}`}/>)}
      </div>

      <button className={`p112-switch ${cameraSwitching?"switching":""}`} onClick={switchCamera} disabled={cameraSwitching} aria-label={facing==="user"?"Cambiar a cámara trasera":"Cambiar a cámara frontal"}/>
      <button
        className={`p112-shot ${capturing?"capturing":""}`}
        onClick={async ()=>{
          if(cameraSwitching||capturing)return;
          if(!cameraActivated||!cameraOn){
            await startCamera();
            return;
          }
          await capture();
        }}
        disabled={cameraSwitching||capturing}
        aria-label={capturing?"Procesando foto":"Hacer foto"}
      />
      <button className={`p112-save p112-photo-action ${photoAction==="save"?"selected":""}`} onClick={save} aria-label="Guardar"><Download className="p112-action-icon"/><span>Guardar</span></button>
      <button className={`p112-share p112-photo-action ${photoAction==="share"?"selected":""}`} onClick={share} aria-label="Compartir"><Share2 className="p112-action-icon"/><span>Compartir</span></button>
      <button className={`p112-repeat p112-photo-action ${photoAction==="repeat"?"selected":""}`} onClick={repeatPhoto} aria-label="Repetir"><RefreshCw className="p112-action-icon"/><span>Repetir</span></button>

      {/* 148 · Hotspots reales sobre la navegación que forma parte del arte del fotomatón.
          El diseño no cambia: estos botones transparentes dan funcionalidad a los 4 iconos. */}
      <button className="p112-nav-home" onClick={()=>{sound("click");stopCamera();setView("home")}} aria-label="Inicio"/>
      <button className="p112-nav-passport" onClick={()=>{sound("click");stopCamera();setView("passport")}} aria-label="Pasaporte"/>
      <button className="p112-nav-games" onClick={()=>{sound("click");stopCamera();setView("games")}} aria-label="Juegos"/>
      <button className="p112-nav-photo" onClick={()=>sound("click")} aria-label="Fotomatón"/>

      <canvas ref={canvasRef} hidden/>
    </div>
  </main>;
}

function Card({ tone, tag, title, sub, children }: any) {
  return <section className={`card ${tone}`}><span className="tag">{tag}</span><h1>{title}</h1><p>{sub}</p>{children}<img className="robot" src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU" /></section>;
}

function Prizes({ status, setView }: { status: FestivalStatus; setView: (v: View) => void }) {
  const rewards = status.rewards ?? [];
  const raffleEntries = status.raffle_entries ?? 0;
  return <section className="prizes-final" aria-label="Mis premios">
    <div className="prizes-final-shell">
      <header className="prizes-final-header">
        <div className="prizes-final-brand" aria-label="La Exclusiva Cafetería">
          <img src={`${import.meta.env.BASE_URL}assets/logo-la-exclusiva-real-icon.png`} alt="Logo La Exclusiva" />
          <div><strong>La Exclusiva</strong><span>CAFETERÍA</span></div>
        </div>
        <h1>MIS PREMIOS</h1>
        <p>Aquí puedes ver todos tus premios y participaciones.</p>
      </header>

      <div className="prizes-final-hero" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}assets/prizes-hero-approved.png`} alt="" />
      </div>

      <div className="prizes-final-summary">
        <div className="raffle"><Ticket/><b>{raffleEntries}</b><span>participaciones<br/>sorteo</span></div>
        <div className="instant"><Gift/><b>{rewards.length}</b><span>premios<br/>instantáneos</span></div>
      </div>

      <div className="prizes-final-list">
        {rewards.length === 0 ? (
          <div className="prizes-final-empty">
            <div className="prizes-final-empty-icon"><Gift/></div>
            <b>Todavía no tienes premios</b>
            <p>Cuando consigas un premio en la ruleta, aparecerá aquí con su código para canjearlo en La Exclusiva.</p>
            <button className="prizes-final-play" onClick={()=>{sound("click");setView("games")}}>
              <Gamepad2/><span><strong>¡Sigue jugando!</strong><small>Cada día tienes nuevas oportunidades de conseguir premios increíbles.</small></span>
            </button>
          </div>
        ) : rewards.map((r) => (
          <div className="prizes-final-row" key={r.reward_code}>
            <span className="prizes-final-row-icon">{r.icon}</span>
            <div className="prizes-final-row-copy"><b>{r.name}</b><small>Código de canje</small><code>{r.reward_code}</code></div>
            <em className={r.status}>{r.status === "redeemed" ? "CANJEADO" : "PENDIENTE"}</em>
          </div>
        ))}
      </div>
    </div>
  </section>;
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
      <img className="celebration-robot" src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU celebrando"/>
      <div className="prize-burst">
        <strong>{result.prize_icon ? `${result.prize_icon} ` : ""}{result.prize_name || result.message || "Tu participación ha quedado registrada."}</strong>
        {result.prize_description && <small>{result.prize_description}</small>}
      </div>
      {result.reward_code && <div className="reward-code-card"><span className="code-label">TU CÓDIGO DE PREMIO</span><code>{result.reward_code}</code><div style={{background:"#fff",padding:12,borderRadius:16,width:184,maxWidth:"100%",margin:"12px auto"}}><QRCode value={result.reward_code} size={160} level="M"/></div><p>Enséñalo al personal de La Exclusiva para canjearlo.</p></div>}
      <div className="result-ticket"><Ticket/> {result.raffle_entries ?? 0} participaciones para el sorteo final de la Cesta de La Alacena de MG</div>
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

type AdminDayPrize = {
  prize_name: string;
  icon: string;
  generated: number;
  pending: number;
  redeemed: number;
};

type AdminDayParticipant = {
  phone_masked: string;
  played_at: string;
  game_type: string;
};

type AdminDayStats = {
  day: number;
  event_date: string;
  game_type: string;
  participants: number;
  plays: number;
  raffle_entries: number;
  prizes_generated: number;
  prizes_pending: number;
  prizes_redeemed: number;
  prizes: AdminDayPrize[];
  participant_list: AdminDayParticipant[];
};

type AdminInventoryRow = {
  id: string;
  name: string;
  icon: string;
  stock_total: number;
  stock_remaining: number;
  active: boolean;
  adjudicated: number;
  pending: number;
  redeemed: number;
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


function QuickRedeem() {
  const scannerId = "exclu-quick-redeem-scanner";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<RewardLookup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void boot();
    return () => { void stopScanner(); };
  }, []);

  async function boot() {
    setReady(false);
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      let uid = sessionData.session?.user?.id ?? null;
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = data.user?.id ?? null;
      }
      setUserId(uid);
      const { data: allowed, error } = await supabase.rpc("is_admin");
      if (error) throw error;
      setAdmin(Boolean(allowed));
    } catch (e: any) {
      setMessage(e?.message || "No se pudo abrir el canje rápido.");
    } finally {
      setReady(true);
    }
  }

  async function stopScanner() {
    const instance = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!instance) return;
    try {
      if (instance.isScanning) await instance.stop();
    } catch {}
    try { await instance.clear(); } catch {}
  }

  async function startScanner() {
    if (busy || scanning) return;
    setLookup(null);
    setMessage(null);
    setCode("");
    try {
      const instance = new Html5Qrcode(scannerId);
      scannerRef.current = instance;
      setScanning(true);
      await instance.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        async (decodedText) => {
          const clean = String(decodedText || "").trim().toUpperCase();
          if (!clean) return;
          await stopScanner();
          setCode(clean);
          await lookupCode(clean);
        },
        () => {}
      );
    } catch (e: any) {
      await stopScanner();
      setMessage("No pude abrir la cámara. Puedes introducir el código manualmente.");
    }
  }

  async function lookupCode(forced?: string) {
    const clean = (forced ?? code).trim().toUpperCase();
    if (!clean || busy) return;
    setBusy(true);
    setMessage(null);
    setLookup(null);
    try {
      const { data, error } = await supabase.rpc("admin_lookup_reward", { p_reward_code: clean });
      if (error) throw error;
      const result = (data ?? { found: false }) as RewardLookup;
      setLookup(result);
      if (!result.found) setMessage(result.message || "Código no encontrado.");
    } catch (e: any) {
      setMessage(e?.message || "No se pudo comprobar el premio.");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!lookup?.reward_code || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc("redeem_reward", { p_reward_code: lookup.reward_code });
      if (error) throw error;
      if (!data?.valid) {
        setMessage(data?.message || "Este premio no se puede canjear.");
        await lookupCode(lookup.reward_code);
        return;
      }
      setMessage(`✓ ${data.prize_name} CANJEADO`);
      setLookup({ ...lookup, status: "redeemed", redeemed_at: new Date().toISOString() });
      navigator.vibrate?.([80,40,120]);
    } catch (e: any) {
      setMessage(e?.message || "No se pudo canjear el premio.");
    } finally {
      setBusy(false);
    }
  }

  function nextCustomer() {
    setLookup(null);
    setCode("");
    setMessage(null);
    void startScanner();
  }

  if (!ready) return <div style={{minHeight:"100vh",background:"#020706",color:"#fff",display:"grid",placeItems:"center",padding:24}}><b>Abriendo canje rápido…</b></div>;

  if (!admin) {
    const sql = userId ? `insert into public.admin_users(user_id) values ('${userId}') on conflict do nothing;` : "";
    return <div style={{minHeight:"100vh",background:"#020706",color:"#fff",padding:24,display:"grid",placeItems:"center"}}>
      <div style={{maxWidth:520,width:"100%",border:"1px solid #17413a",borderRadius:20,padding:22,background:"#07100e"}}>
        <h1 style={{marginTop:0}}>CANJE RÁPIDO</h1>
        <p>Este móvil todavía no está autorizado como administrador.</p>
        <small>ID de esta sesión</small>
        <code style={{display:"block",wordBreak:"break-all",margin:"8px 0 14px"}}>{userId ?? "Sin sesión"}</code>
        <textarea readOnly value={sql} style={{width:"100%",minHeight:100,background:"#000",color:"#fff",border:"1px solid #28584f",borderRadius:12,padding:10}}/>
        <button onClick={()=>navigator.clipboard?.writeText(sql)} style={{width:"100%",marginTop:10,padding:14,border:0,borderRadius:12,fontWeight:900}}>COPIAR SQL DE ACCESO</button>
        <button onClick={boot} style={{width:"100%",marginTop:10,padding:14,border:"1px solid #2dd3be",background:"transparent",color:"#fff",borderRadius:12,fontWeight:900}}>YA HE DADO ACCESO</button>
      </div>
    </div>;
  }

  const alreadyRedeemed = lookup?.status === "redeemed";

  return <div style={{minHeight:"100vh",background:"#020706",color:"#fff",padding:"18px 14px 28px",fontFamily:"inherit"}}>
    <div style={{maxWidth:620,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14}}>
        <div><small style={{color:"#f4b31a",fontWeight:900}}>LA EXCLUSIVA</small><h1 style={{margin:"4px 0 0",fontSize:28}}>CANJE RÁPIDO</h1></div>
        <a href="#/admin" style={{color:"#fff",textDecoration:"none",border:"1px solid #28584f",padding:"9px 12px",borderRadius:10}}>Admin</a>
      </header>

      {message && <div style={{padding:14,borderRadius:14,marginBottom:12,background:message.startsWith("✓")?"#093b31":"#3a1616",border:`1px solid ${message.startsWith("✓")?"#2dd3be":"#b94a4a"}`,fontWeight:800}}>{message}</div>}

      {!lookup && <>
        <div style={{border:"1px solid #17413a",borderRadius:20,padding:14,background:"#07100e"}}>
          <div id={scannerId} style={{width:"100%",overflow:"hidden",borderRadius:16,background:"#000"}}/>
          {!scanning && <button onClick={startScanner} disabled={busy} style={{width:"100%",padding:"18px 14px",marginTop:10,border:0,borderRadius:14,fontWeight:950,fontSize:19,background:"#16b8a6",color:"#00120f"}}>📷 ESCANEAR PREMIO</button>}
          {scanning && <button onClick={()=>void stopScanner()} style={{width:"100%",padding:13,marginTop:10,border:"1px solid #b94a4a",borderRadius:12,background:"transparent",color:"#fff",fontWeight:800}}>CERRAR CÁMARA</button>}
        </div>

        <div style={{margin:"14px 0",textAlign:"center",opacity:.6,fontWeight:800}}>— O CÓDIGO MANUAL —</div>
        <div style={{display:"flex",gap:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter") void lookupCode();}} placeholder="EXC-12-ABC123" autoCapitalize="characters" style={{flex:1,minWidth:0,padding:15,borderRadius:12,border:"1px solid #28584f",background:"#000",color:"#fff",fontSize:18}}/>
          <button onClick={()=>void lookupCode()} disabled={busy || !code.trim()} style={{padding:"0 16px",border:0,borderRadius:12,fontWeight:900,background:"#e2a214",color:"#111"}}>BUSCAR</button>
        </div>
      </>}

      {lookup?.found && <div style={{border:`2px solid ${alreadyRedeemed?"#b94a4a":"#2dd3be"}`,borderRadius:22,padding:20,background:"#07100e",textAlign:"center"}}>
        <div style={{fontSize:46,marginBottom:6}}>{lookup.prize_icon || "🎁"}</div>
        <small style={{opacity:.65}}>PREMIO</small>
        <h2 style={{fontSize:30,margin:"4px 0 10px"}}>{lookup.prize_name}</h2>
        <div style={{display:"grid",gap:7,textAlign:"left",background:"#020706",padding:14,borderRadius:14}}>
          <div><small style={{opacity:.6}}>CÓDIGO</small><strong style={{display:"block",fontSize:19}}>{lookup.reward_code}</strong></div>
          <div><small style={{opacity:.6}}>CLIENTE</small><strong style={{display:"block"}}>{lookup.phone_masked || "Teléfono protegido"}</strong></div>
          <div><small style={{opacity:.6}}>ESTADO</small><strong style={{display:"block",color:alreadyRedeemed?"#ff7373":"#54e3c8"}}>{alreadyRedeemed ? "YA CANJEADO" : "PENDIENTE"}</strong></div>
          {lookup.redeemed_at && <div><small style={{opacity:.6}}>CANJEADO</small><strong style={{display:"block"}}>{new Date(lookup.redeemed_at).toLocaleString("es-ES")}</strong></div>}
        </div>

        {!alreadyRedeemed ? <button onClick={()=>void redeem()} disabled={busy} style={{width:"100%",padding:"20px 14px",marginTop:14,border:0,borderRadius:14,fontWeight:950,fontSize:21,background:"#20c9a9",color:"#00130f"}}>✅ CANJEAR AHORA</button> :
        <div style={{marginTop:14,padding:16,borderRadius:14,background:"#3a1616",fontWeight:950}}>⛔ ESTE PREMIO YA FUE CANJEADO</div>}

        <button onClick={nextCustomer} disabled={busy} style={{width:"100%",padding:"16px 14px",marginTop:10,border:"1px solid #e2a214",borderRadius:14,fontWeight:900,background:"transparent",color:"#fff"}}>📷 ESCANEAR SIGUIENTE</button>
      </div>}
    </div>
  </div>;
}

function AdminPanel() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview>({});
  const [dailyStats, setDailyStats] = useState<AdminDayStats[]>([]);
  const [inventoryRows, setInventoryRows] = useState<AdminInventoryRow[]>([]);
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
    const [{ data, error }, daily, inventory] = await Promise.all([
      supabase.rpc("admin_overview", { p_festival_slug: FESTIVAL }),
      supabase.rpc("admin_daily_stats", { p_festival_slug: FESTIVAL }),
      supabase.rpc("admin_inventory_detail", { p_festival_slug: FESTIVAL }),
    ]);
    if (error) throw error;
    if (daily.error) throw daily.error;
    if (inventory.error) throw inventory.error;
    setOverview((data ?? {}) as AdminOverview);
    setDailyStats(Array.isArray(daily.data) ? (daily.data as AdminDayStats[]) : []);
    setInventoryRows(Array.isArray(inventory.data) ? (inventory.data as AdminInventoryRow[]) : []);
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

  async function drawRaffle() {
    setShowRaffleConfirm(false);
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.rpc("draw_final_raffle_mg", { p_festival_slug: FESTIVAL });
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

  if (!ready) return <div className="admin admin-loading"><div><img src={`${import.meta.env.BASE_URL}assets/exclu-approved-photobooth.png`} alt="EXCLU"/><p>Abriendo el panel…</p></div></div>;

  if (!admin) {
    const sql = userId ? `insert into public.admin_users(user_id) values ('${userId}') on conflict do nothing;` : "";
    return <div className="admin admin-access"><div className="admin-access-card"><LockKeyhole size={42}/><h1>EXCLU FEST · ADMIN</h1><p>Este navegador todavía no tiene permiso de administrador.</p>{message && <div className="admin-alert error">{message}</div>}<small>ID de esta sesión</small><code>{userId ?? "Sin sesión"}</code><p className="admin-help">Para autorizar este navegador, copia esta línea en <b>Supabase → SQL Editor</b>, ejecútala y vuelve aquí.</p><textarea readOnly value={sql}/><button onClick={() => navigator.clipboard?.writeText(sql)}>COPIAR SQL</button><button className="admin-secondary" onClick={bootAdmin}>YA HE DADO ACCESO</button><a href="/">← Volver a EXCLU FEST</a></div></div>;
  }

  const prizes = (overview.prizes ?? []).filter((p) => p.active);
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

      <section className="admin-panel">
        <div className="admin-panel-title"><div><span>INVENTARIO REAL</span><h2>Premios físicos</h2></div><Gift/></div>
        <p style={{opacity:.72,marginTop:0}}>Lectura rápida: qué había, qué ha adjudicado la app, qué falta recoger y qué queda disponible.</p>
        <div className="stock-list">
          {inventoryRows.filter((p)=>p.active && !/^\+\d+\s+papeleta/i.test(p.name)).map((p)=>
            <div className="stock-row" key={p.id} style={{alignItems:"flex-start"}}>
              <span className="stock-icon">{p.icon}</span>
              <div className="stock-name" style={{width:"100%"}}>
                <b>{p.name}</b>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6,marginTop:8}}>
                  <div><small>INICIAL</small><strong style={{display:"block"}}>{p.stock_total}</strong></div>
                  <div><small>ADJUDICADOS</small><strong style={{display:"block"}}>{p.adjudicated}</strong></div>
                  <div><small>PENDIENTES</small><strong style={{display:"block",color:"#f5b544"}}>{p.pending}</strong></div>
                  <div><small>CANJEADOS</small><strong style={{display:"block",color:"#54e3c8"}}>{p.redeemed}</strong></div>
                  <div><small>QUEDAN</small><strong style={{display:"block",fontSize:20}}>{p.stock_remaining}</strong></div>
                </div>
                <div className="stock-bar" style={{marginTop:8}}><i style={{width:`${p.stock_total ? (p.stock_remaining/p.stock_total)*100 : 0}%`}}/></div>
              </div>
            </div>)}
        </div>

        <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.08)"}}>
          <div className="admin-panel-title"><div><span>SORTEO</span><h2>Participaciones extra</h2></div><Ticket/></div>
          <p style={{opacity:.72,marginTop:0}}>Estas no son productos físicos y por eso aparecen separadas.</p>
          <div className="stock-list">
            {inventoryRows.filter((p)=>p.active && /^\+\d+\s+papeleta/i.test(p.name)).map((p)=>
              <div className="stock-row" key={p.id}>
                <span className="stock-icon">{p.icon}</span>
                <div className="stock-name"><b>{p.name}</b><small>Adjudicadas: {p.adjudicated} · Quedan: {p.stock_remaining} de {p.stock_total}</small></div>
              </div>)}
          </div>
        </div>
      </section>
    </div>

    <section className="admin-panel" style={{marginTop:22}}>
      <div className="admin-panel-title"><div><span>ESTADÍSTICAS POR DÍA</span><h2>11 · 12 · 13 de septiembre</h2></div><BarChart3/></div>
      <p style={{opacity:.72}}>Datos históricos reales calculados desde Supabase. No modifica ningún registro.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
        {dailyStats.map((d)=><details key={d.day} open style={{border:"1px solid rgba(45,211,190,.22)",borderRadius:16,padding:14,background:"rgba(3,14,12,.55)"}}>
          <summary style={{cursor:"pointer",fontWeight:800,fontSize:18}}>DÍA {d.day} · {d.game_type?.toUpperCase()}</summary>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
            <div><small>PARTICIPANTES</small><b style={{display:"block",fontSize:24}}>{d.participants}</b></div>
            <div><small>JUGADAS</small><b style={{display:"block",fontSize:24}}>{d.plays}</b></div>
            <div><small>PREMIOS</small><b style={{display:"block",fontSize:24}}>{d.prizes_generated}</b></div>
            <div><small>PENDIENTES</small><b style={{display:"block",fontSize:24}}>{d.prizes_pending}</b></div>
            <div><small>CANJEADOS</small><b style={{display:"block",fontSize:24}}>{d.prizes_redeemed}</b></div>
            <div><small>ENTRADAS SORTEO</small><b style={{display:"block",fontSize:24}}>{d.raffle_entries}</b></div>
          </div>
          <div style={{marginTop:14}}>
            <b>Premios entregados</b>
            {(d.prizes ?? []).length===0 ? <p style={{opacity:.65}}>Sin premios registrados.</p> :
              <div style={{marginTop:8,display:"grid",gap:6}}>{d.prizes.map((p)=><div key={p.prize_name} style={{display:"flex",justifyContent:"space-between",gap:10,borderBottom:"1px solid rgba(255,255,255,.07)",padding:"6px 0"}}><span>{p.icon} {p.prize_name}</span><span><b>{p.generated}</b> · {p.pending} pend. · {p.redeemed} canj.</span></div>)}</div>}
          </div>
          <details style={{marginTop:14}}>
            <summary style={{cursor:"pointer",fontWeight:700}}>Ver participantes del día ({d.participant_list?.length ?? 0})</summary>
            <div style={{maxHeight:240,overflow:"auto",marginTop:8}}>
              {(d.participant_list ?? []).map((p,i)=><div key={`${p.phone_masked}-${p.played_at}-${i}`} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}><span>{p.phone_masked || "Teléfono oculto"}</span><small>{new Date(p.played_at).toLocaleString("es-ES")}</small></div>)}
            </div>
          </details>
        </details>)}
      </div>
    </section>

    <div className="admin-columns admin-bottom-grid">
      <section className="admin-panel"><div className="admin-panel-title"><div><span>ACTIVIDAD</span><h2>Últimos premios</h2></div><RefreshCw/></div><div className="claims-table">{claims.length === 0 ? <p className="empty-admin">Todavía no hay premios generados.</p> : claims.map((c)=><div className="claim-row" key={c.reward_code}><span>{c.icon}</span><div><b>{c.prize_name}</b><code>{c.reward_code}</code><small>{c.phone_masked}</small></div><em className={c.status}>{c.status === "redeemed" ? "CANJEADO" : "PENDIENTE"}</em></div>)}</div></section>

      <section className="admin-panel raffle-panel"><div className="admin-panel-title"><div><span>SORTEO FINAL</span><h2>Cesta de La Alacena de MG</h2></div><Trophy/></div>{winners.length > 0 ? <div className="winner-list">{winners.map((w)=><div className="winner-row" key={w.position}><b>#{w.position}</b><div><strong>{w.phone_masked || "Participante"}</strong><small>{w.entries} participaciones en el sorteo</small></div><Trophy/></div>)}</div> : <><p>El sorteo utiliza todas las participaciones acumuladas y selecciona 1 persona ganadora. Cuantas más participaciones tenga, más opciones tendrá.</p><button className="raffle-button" onClick={()=>setShowRaffleConfirm(true)} disabled={busy || (overview.raffle_entries ?? 0) === 0}><Trophy/> REALIZAR SORTEO FINAL</button><small className="raffle-warning">Una vez realizado, los ganadores quedan guardados y el sorteo no se repite.</small></>}</section>
    </div>

    {overview.test_mode && <section className="admin-test-tools">
      <div className="admin-panel-title"><div><span>LABORATORIO</span><h2>Herramientas de prueba</h2></div><RefreshCw/></div>
      <p>Solo aparecen mientras el festival está en <b>MODO PRUEBAS</b>. No borran el participante ni la configuración del festival.</p>
      <div className="test-tool-grid">
        <article><h3>Repetir circuito del dispositivo</h3><p>Conserva el teléfono registrado, pero borra las jugadas, entradas de sorteo y premios generados por <b>este navegador</b>. El stock consumido por esos premios se devuelve automáticamente.</p><button disabled={busy} onClick={()=>setTestAction("participant")}><RefreshCw size={17}/> RESET PARTICIPANTE DE PRUEBA</button></article>
        <article><h3>Repetir sorteo final</h3><p>Borra únicamente el sorteo de prueba y sus ganadores. Las participaciones acumuladas permanecen intactas para poder volver a comprobar el ganador.</p><button disabled={busy || winners.length===0} onClick={()=>setTestAction("raffle")}><Trophy size={17}/> RESET SORTEO DE PRUEBA</button></article>
      </div>
      <small className="test-safety">🔒 Estas funciones quedan bloqueadas automáticamente cuando <code>test_mode=false</code>.</small>
    </section>}

    {showRaffleConfirm && <div className="admin-modal"><div><Trophy size={42}/><h2>¿Realizar el sorteo final?</h2><p>Se seleccionará 1 ganador de la Cesta de La Alacena de MG entre todas las participaciones guardadas.</p><button className="raffle-button" onClick={drawRaffle}>SÍ, REALIZAR SORTEO</button><button className="admin-secondary" onClick={()=>setShowRaffleConfirm(false)}>CANCELAR</button></div></div>}

    {testAction && <div className="admin-modal"><div><RefreshCw size={42}/><h2>{testAction === "participant" ? "¿Resetear este participante de prueba?" : "¿Resetear el sorteo de prueba?"}</h2><p>{testAction === "participant" ? "Se borrarán las jugadas, premios y entradas del sorteo de este navegador. El teléfono seguirá registrado y podrá volver a jugar desde el día 11." : "Se borrarán únicamente los ganadores y el sorteo realizado. Las entradas del sorteo seguirán guardadas."}</p><button className="test-confirm" onClick={testAction === "participant" ? resetTestParticipant : resetTestRaffle}>{testAction === "participant" ? "SÍ, RESET PARTICIPANTE" : "SÍ, RESET SORTEO"}</button><button className="admin-secondary" onClick={()=>setTestAction(null)}>CANCELAR</button></div></div>}
  </div>;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="admin-stat"><span>{icon}</span><div><b>{value.toLocaleString("es-ES")}</b><small>{label}</small></div></div>;
}
