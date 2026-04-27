import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg:         "#050505",
  panel:      "#0A0A0A",
  textMain:   "#E5E7EB",
  textSec:    "#9CA3AF",
  textDim:    "#6B7280",
  border:     "#1F2937",
  borderSoft: "#111827",
  active:     "#FFFFFF",
  accent:     "#E5E7EB",
  danger:     "#EF4444",
  warn:       "#F59E0B",
  ok:         "#6EE7B7",
  amber:      "#FFB000",
};

// ── ASCII палитра для trail (от старого к новому) ──────────────────────────
const ASCII_TRAIL = ["·", "∙", "•", "●"];
const ASCII_COLS  = 40;
const ASCII_ROWS  = 20;

// ── локальная Lorenz симуляция (fallback пока нет данных с сервера) ─────────
function lorenzStepRK4(x, y, z, sigma, rho, beta, dt = 0.01) {
  const d = (x, y, z) => [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ];
  const [k1x, k1y, k1z] = d(x, y, z);
  const [k2x, k2y, k2z] = d(x + dt/2*k1x, y + dt/2*k1y, z + dt/2*k1z);
  const [k3x, k3y, k3z] = d(x + dt/2*k2x, y + dt/2*k2y, z + dt/2*k2z);
  const [k4x, k4y, k4z] = d(x + dt*k3x,   y + dt*k3y,   z + dt*k3z);
  return [
    x + dt/6*(k1x + 2*k2x + 2*k3x + k4x),
    y + dt/6*(k1y + 2*k2y + 2*k3y + k4y),
    z + dt/6*(k1z + 2*k2z + 2*k3z + k4z),
  ];
}

// ── Canvas renderer ────────────────────────────────────────────────────────
function drawCanvas(ctx, trail, localState, W, H) {
  ctx.fillStyle = "rgba(5,5,5,0.06)";
  ctx.fillRect(0, 0, W, H);

  const pts = trail.length > 0 ? trail : null;
  const cx = W / 2;
  const cy = H / 2;

  if (pts && pts.length > 1) {
    // рисуем trail с сервера
    const len = pts.length;
    for (let i = 1; i < len; i++) {
      const t     = i / len;
      const alpha = t * 0.6;
      const pt    = pts[i];
      const prev  = pts[i - 1];
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,176,0,${alpha})`;
      ctx.lineWidth   = t > 0.85 ? 1.2 : 0.5;
      ctx.moveTo(cx + prev.x * 4, cy + prev.z * 3 - 80);
      ctx.lineTo(cx + pt.x   * 4, cy + pt.z   * 3 - 80);
      ctx.stroke();
    }
    // текущая точка — пульсирует
    const last = pts[pts.length - 1];
    const px   = cx + last.x * 4;
    const py   = cy + last.z * 3 - 80;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 6);
    glow.addColorStop(0, "rgba(255,176,0,0.9)");
    glow.addColorStop(1, "rgba(255,176,0,0)");
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#FFB000";
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // локальная симуляция пока нет данных с сервера
    const alpha = 0.3 + Math.abs(localState[2] / 60) * 0.4;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(229,231,235,${alpha})`;
    ctx.lineWidth   = 0.7;
    ctx.moveTo(cx + localState[0] * 4,       cy + localState[2] * 3 - 80);
    ctx.lineTo(cx + localState[0] * 4 + 0.5, cy + localState[2] * 3 - 80);
    ctx.stroke();
  }
}

// ── ASCII renderer ──────────────────────────────────────────────────────────
function buildAsciiGrid(trail) {
  const grid = Array.from({ length: ASCII_ROWS }, () =>
    Array(ASCII_COLS).fill({ ch: " ", age: -1 })
  );

  if (!trail || trail.length === 0) return grid;

  // нормализуем точки trail в сетку
  const xs = trail.map(p => p.x);
  const zs = trail.map(p => p.z);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  const xR   = xMax - xMin || 1;
  const zR   = zMax - zMin || 1;

  trail.forEach((pt, i) => {
    const col = Math.floor(((pt.x - xMin) / xR) * (ASCII_COLS - 1));
    const row = Math.floor(((pt.z - zMin) / zR) * (ASCII_ROWS - 1));
    const age = i / trail.length; // 0=старый 1=новый
    const ch  = ASCII_TRAIL[Math.floor(age * (ASCII_TRAIL.length - 1))];
    if (row >= 0 && row < ASCII_ROWS && col >= 0 && col < ASCII_COLS) {
      if (grid[row][col].age < age) {
        grid[row][col] = { ch, age };
      }
    }
  });

  // последняя точка — всегда ●
  if (trail.length > 0) {
    const last = trail[trail.length - 1];
    const col  = Math.floor(((last.x - xMin) / xR) * (ASCII_COLS - 1));
    const row  = Math.floor(((last.z - zMin) / zR) * (ASCII_ROWS - 1));
    if (row >= 0 && row < ASCII_ROWS && col >= 0 && col < ASCII_COLS) {
      grid[row][col] = { ch: "●", age: 2 };
    }
  }

  return grid;
}

// ── Mood Bar ────────────────────────────────────────────────────────────────
function MoodBar({ label, value }) {
  const pct   = Math.round((value ?? 0) * 100);
  const color = value > 0.66 ? C.ok : value > 0.33 ? C.amber : C.textDim;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 8, letterSpacing: 2, color: C.textDim }}>{label}</span>
        <span style={{ fontSize: 8, color, letterSpacing: 1 }}>{pct}</span>
      </div>
      <div style={{ height: 2, background: C.borderSoft, borderRadius: 1 }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color, borderRadius: 1,
          transition: "width 1.5s ease, background 1.5s ease",
          boxShadow: value > 0.66 ? `0 0 4px ${color}` : "none",
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function EmiyaUI() {
  const [data, setData]               = useState(null);
  const [connected, setConnected]     = useState(false);
  const [activeTab, setActiveTab]     = useState("monitor");
  const [glitch, setGlitch]           = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText]     = useState("");
  const [asciiMode, setAsciiMode]     = useState(false);
  const [trail, setTrail]             = useState([]);
  const [mood, setMood]               = useState({ energy: 0.5, focus: 0.5, openness: 0.5 });
  const [tuner, setTuner]             = useState({ sigma: 10, rho: 28, beta: 2.667 });
  const [localTime, setLocalTime]     = useState("");  // ← локальные часы

  const canvasRef   = useRef(null);
  const wsRef       = useRef(null);
  const chatEndRef  = useRef(null);
  // локальная симуляция для плавной анимации — всегда работает на 60fps
  const localState  = useRef([0.1, 0, 0]);
  // параметры аттрактора — синкаются с сервером
  const lorenzParams = useRef({ sigma: 10, rho: 28, beta: 8/3 });
  const animRef     = useRef(null);
  const trailRef    = useRef([]);  // серверный trail (для ASCII режима)

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket("ws://localhost:7474");
      wsRef.current = ws;
      ws.onopen    = () => setConnected(true);
      ws.onmessage = (e) => {
        const packet = JSON.parse(e.data);

        if (packet.type === "emiya_reply") {
          setChatHistory(h => [...h, { role: "assistant", content: packet.message }]);
          return;
        }

        setData(packet);

        // trail — только для ASCII режима
        if (packet.trail) { trailRef.current = packet.trail; setTrail(packet.trail); }

        // mood — плавное обновление через CSS transition (не прыгает)
        if (packet.mood) setMood(packet.mood);

        // синкаем параметры аттрактора в ref — canvas подхватит на следующем кадре
        if (packet.mood?.sigma) {
          lorenzParams.current = {
            sigma: packet.mood.sigma,
            rho:   packet.mood.rho,
            beta:  packet.mood.beta,
          };
          setTuner({
            sigma: packet.mood.sigma,
            rho:   packet.mood.rho,
            beta:  +packet.mood.beta.toFixed(3),
          });
        }

        if (packet.emiya) {
          setChatHistory(h => [...h, { role: "assistant", content: packet.emiya.message }]);
        }
      };
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // ── Canvas animation loop — 60fps локальная симуляция ────────────────────
  // серверный trail не используется для canvas — он только для ASCII
  // параметры (sigma/rho/beta) синкаются с сервером через lorenzParams ref
  useEffect(() => {
    if (asciiMode) { cancelAnimationFrame(animRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H / 2;

    // ring buffer для локального trail (последние 300 точек)
    const localTrail = [];
    const MAX_TRAIL  = 300;

    const draw = () => {
      const { sigma, rho, beta } = lorenzParams.current;

      // шаг симуляции
      localState.current = lorenzStepRK4(...localState.current, sigma, rho, beta);
      const [x, , z] = localState.current;

      // добавляем точку в локальный trail
      localTrail.push({ x, z });
      if (localTrail.length > MAX_TRAIL) localTrail.shift();

      // fade background
      ctx.fillStyle = "rgba(5,5,5,0.04)";
      ctx.fillRect(0, 0, W, H);

      // рисуем trail
      const len = localTrail.length;
      for (let i = 1; i < len; i++) {
        const t     = i / len;
        const alpha = t * 0.7;
        const pt    = localTrail[i];
        const prev  = localTrail[i - 1];
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,176,0,${alpha})`;
        ctx.lineWidth   = t > 0.85 ? 1.2 : 0.5;
        ctx.moveTo(cx + prev.x * 4, cy + prev.z * 3 - 80);
        ctx.lineTo(cx + pt.x   * 4, cy + pt.z   * 3 - 80);
        ctx.stroke();
      }

      // текущая точка — glow
      if (localTrail.length > 0) {
        const last = localTrail[localTrail.length - 1];
        const px   = cx + last.x * 4;
        const py   = cy + last.z * 3 - 80;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 5);
        glow.addColorStop(0, "rgba(255,176,0,0.9)");
        glow.addColorStop(1, "rgba(255,176,0,0)");
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#FFB000";
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [asciiMode]);

  // ── Локальные часы — тикают каждую секунду ───────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLocalTime(
        now.toTimeString().slice(0, 8)  // "HH:MM:SS"
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Glitch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.08) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 80);
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Autoscroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── Mood Tuner send ───────────────────────────────────────────────────────
  const sendTuner = useCallback((params) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "mood_params", ...params }));
  }, []);

  const sendPreset = useCallback((name) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "mood_preset", name }));
  }, []);

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current) return;
    const text = inputText.trim();
    setInputText("");
    setChatHistory(h => [...h, { role: "user", content: text }]);
    wsRef.current.send(JSON.stringify({ type: "user_message", text }));
  };

  const apps   = data?.apps   || [];
  const states = data?.states || [];
  const cpu    = data?.cpu    || 0;
  const ram    = data?.ram    || 0;

  const stateColor = (s) => {
    if (s === "grinding" || s === "late_night") return C.danger;
    if (s === "scattered" || s === "idle_loop") return C.warn;
    return C.textSec;
  };

  // ── ASCII grid ────────────────────────────────────────────────────────────
  const asciiGrid = asciiMode ? buildAsciiGrid(trail) : null;

  const PRESETS = [
    { name: "calm",          label: "[calm]" },
    { name: "standard",      label: "[std]" },
    { name: "edge_of_chaos", label: "[edge]" },
    { name: "storm",         label: "[storm]" },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      fontFamily: "'Courier New', Courier, monospace",
      color: C.textMain,
      overflow: "hidden",
      userSelect: "none",
      fontSize: 13,
    }}>
      {/* scanlines */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 49, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
      }} />

      {/* HEADER */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: C.panel,
        filter: glitch ? "brightness(1.4) saturate(0)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 12, letterSpacing: 8, color: C.active, fontWeight: "bold" }}>EMIYA</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 3 }}>SYS_v2.0</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 10, letterSpacing: 2, alignItems: "center" }}>
          {data?.active_min !== undefined && (
            <span style={{ color: C.textDim }}>
              SESSION <span style={{ color: C.textSec }}>{data.active_min}m</span>
            </span>
          )}
          <span style={{ color: connected ? C.ok : C.danger, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: connected ? C.ok : C.danger,
              display: "inline-block",
              boxShadow: connected ? `0 0 6px ${C.ok}` : "none",
            }} />
            {connected ? "ONLINE" : "OFFLINE"}
          </span>
          <span style={{ color: C.textDim }}>{localTime || "--:--:--"}</span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 260px",
        height: "calc(100vh - 45px)",
        overflow: "hidden",
      }}>

        {/* LEFT PANEL */}
        <div style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

          {/* TABS */}
          <div style={{ borderBottom: `1px solid ${C.border}`, display: "flex", background: C.panel }}>
            {["monitor", "patterns", "log"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: "none", border: "none",
                borderRight: `1px solid ${C.border}`,
                borderBottom: activeTab === tab ? `2px solid ${C.active}` : "2px solid transparent",
                color: activeTab === tab ? C.active : C.textDim,
                fontFamily: "inherit", fontSize: 10, letterSpacing: 3,
                padding: "12px 24px", cursor: "pointer",
                textTransform: "uppercase", transition: "color 0.2s",
              }}>{tab}</button>
            ))}
          </div>

          {/* MONITOR TAB */}
          {activeTab === "monitor" && (
            <div style={{ flex: 1, padding: "20px 24px", overflow: "auto" }}>

              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14 }}>ACTIVE WINDOWS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 56px", fontSize: 11, marginBottom: 28 }}>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6 }}>PROCESS</span>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6 }}>TYPE</span>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6, textAlign: "right" }}>TIME</span>
                <div style={{ gridColumn: "1/-1", height: 1, background: C.border, marginBottom: 10 }} />
                {apps.length === 0 && (
                  <span style={{ color: C.textDim, fontSize: 10, gridColumn: "1/-1", opacity: 0.5 }}>нет данных</span>
                )}
                {apps.map((app, i) => (
                  <>
                    <span key={`n${i}`} style={{ color: i === 0 ? C.active : C.textSec, padding: "5px 0", fontSize: 11, letterSpacing: 0.5 }}>
                      {i === 0 ? "▶ " : "  "}{app.app}
                    </span>
                    <span key={`c${i}`} style={{ color: C.textDim, padding: "5px 0", fontSize: 10 }}>{app.category}</span>
                    <span key={`t${i}`} style={{ color: C.textSec, padding: "5px 0", textAlign: "right", fontSize: 10 }}>{app.minutes}m</span>
                  </>
                ))}
              </div>

              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14 }}>SYSTEM</div>
              {[["CPU", cpu], ["RAM", ram]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, width: 36, color: C.textDim, letterSpacing: 2 }}>{label}</span>
                  <div style={{ flex: 1, height: 3, background: C.borderSoft, borderRadius: 1 }}>
                    <div style={{
                      width: `${val}%`, height: "100%",
                      background: val > 80 ? C.danger : val > 60 ? C.warn : C.textSec,
                      borderRadius: 1, transition: "width 1s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: C.textSec, width: 36, textAlign: "right" }}>{val}%</span>
                </div>
              ))}

              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14, marginTop: 28 }}>DETECTED STATE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {states.length === 0
                  ? <span style={{ fontSize: 10, color: C.textDim, opacity: 0.4 }}>—</span>
                  : states.map(s => (
                    <span key={s} style={{
                      fontSize: 9, letterSpacing: 2, padding: "4px 10px",
                      border: `1px solid ${stateColor(s)}40`,
                      color: stateColor(s), background: `${stateColor(s)}08`,
                    }}>{s.toUpperCase()}</span>
                  ))
                }
              </div>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
                активно: <span style={{ color: C.textSec }}>{data?.active_min || 0} мин</span>
                {"  ·  "}
                <span style={{ color: C.textDim }}>{data?.time_of_day || "—"}</span>
              </div>
            </div>
          )}

          {activeTab === "patterns" && (
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 16 }}>BEHAVIORAL PATTERNS</div>
              <div style={{ color: C.textDim, fontSize: 10, opacity: 0.5 }}>накапливается... нужно больше данных</div>
            </div>
          )}

          {activeTab === "log" && (
            <div style={{ padding: "20px 24px", flex: 1, overflow: "auto" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 16 }}>TRIGGER LOG</div>
              <div style={{ color: C.textDim, fontSize: 10, opacity: 0.5 }}>лог триггеров появится здесь</div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", background: C.panel, minHeight: 0, overflowY: "auto" }}>

          {/* ── Lorenz canvas / ASCII ── */}
          <div style={{ position: "relative", borderBottom: `1px solid ${C.border}`, overflow: "hidden" }}>

            {/* canvas mode */}
            {!asciiMode && (
              <canvas ref={canvasRef} width={260} height={190} style={{ display: "block" }} />
            )}

            {/* ASCII mode */}
            {asciiMode && (
              <div style={{
                width: 260, height: 190,
                padding: "8px 6px",
                fontFamily: "'Courier New', monospace",
                fontSize: 7.5,
                lineHeight: 1.45,
                color: C.amber,
                overflow: "hidden",
                letterSpacing: "0.05em",
              }}>
                {asciiGrid && asciiGrid.map((row, ri) => (
                  <div key={ri} style={{ whiteSpace: "pre" }}>
                    {row.map((cell, ci) => (
                      <span key={ci} style={{
                        color: cell.ch === "●" ? "#FFFFFF"
                             : cell.age > 0.7  ? C.amber
                             : cell.age > 0.3  ? "#A07000"
                             : cell.age >= 0   ? "#604000"
                             : "transparent",
                        textShadow: cell.ch === "●" ? `0 0 6px ${C.amber}` : "none",
                      }}>{cell.ch}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* header + ASCII toggle */}
            <div style={{
              position: "absolute", top: 8, left: 12, right: 12,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 8, letterSpacing: 4, color: C.textDim }}>LORENZ · STATE</span>
              <button onClick={() => setAsciiMode(m => !m)} style={{
                background: "none", border: `1px solid ${C.border}`,
                color: asciiMode ? C.amber : C.textDim,
                fontFamily: "inherit", fontSize: 7, letterSpacing: 2,
                padding: "2px 6px", cursor: "pointer",
                transition: "color 0.2s, border-color 0.2s",
                borderColor: asciiMode ? `${C.amber}60` : C.border,
              }}>ASCII</button>
            </div>
          </div>

          {/* ── Mood bars ── */}
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
            <MoodBar label="ENERGY"   value={mood.energy} />
            <MoodBar label="FOCUS"    value={mood.focus} />
            <MoodBar label="OPENNESS" value={mood.openness} />
          </div>

          {/* ── Mood Tuner ── */}
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 8 }}>MOOD TUNER</div>

            {/* пресеты */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {PRESETS.map(p => (
                <button key={p.name} onClick={() => sendPreset(p.name)} style={{
                  background: "none", border: `1px solid ${C.border}`,
                  color: C.textDim, fontFamily: "inherit",
                  fontSize: 7, letterSpacing: 1,
                  padding: "2px 6px", cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.target.style.color = C.amber; e.target.style.borderColor = `${C.amber}60`; }}
                onMouseLeave={e => { e.target.style.color = C.textDim; e.target.style.borderColor = C.border; }}
                >{p.label}</button>
              ))}
            </div>

            {/* слайдеры — компактно */}
            {[
              { key: "sigma", label: "σ", min: 2,   max: 20, step: 0.5 },
              { key: "rho",   label: "ρ", min: 10,  max: 55, step: 0.5 },
              { key: "beta",  label: "β", min: 0.5, max: 5,  step: 0.1 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 8, color: C.textDim, width: 10 }}>{label}</span>
                <input type="range" min={min} max={max} step={step}
                  value={tuner[key]}
                  onChange={e => {
                    const val = +e.target.value;
                    const next = { ...tuner, [key]: val };
                    setTuner(next);
                    sendTuner(next);
                  }}
                  style={{ flex: 1, accentColor: C.amber, cursor: "pointer", height: 2 }}
                />
                <span style={{ fontSize: 8, color: C.amber, width: 30, textAlign: "right" }}>{tuner[key]}</span>
              </div>
            ))}
          </div>

          {/* ── Models ── */}
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 10 }}>MODELS</div>
            {[
              ["L-meta", "ORCH", "active",  C.ok],
              ["L0",     "BASE", "active",  C.ok],
              ["L1",     "MID",  "standby", C.warn],
              ["L2",     "DEEP", "offline", C.textDim],
            ].map(([id, role, status, col]) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 9, color: C.textDim, width: 40, letterSpacing: 1 }}>{id}</span>
                <span style={{ fontSize: 9, color: C.textSec, flex: 1, letterSpacing: 1 }}>{role}</span>
                <span style={{ fontSize: 8, color: col, letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    width: 4, height: 4, borderRadius: "50%", background: col, display: "inline-block",
                    boxShadow: status === "active" ? `0 0 4px ${col}` : "none",
                  }} />
                  {status}
                </span>
              </div>
            ))}
          </div>

          {/* ── Chat ── */}
          <div style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", minHeight: 180 }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 10 }}>EMIYA</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{
                  fontSize: 11, color: msg.role === "assistant" ? C.active : C.textSec,
                  lineHeight: 1.7,
                  borderLeft: msg.role === "assistant" ? `2px solid ${C.textDim}` : `2px solid ${C.borderSoft}`,
                  paddingLeft: 10,
                  fontStyle: msg.role === "assistant" ? "italic" : "normal",
                }}>{msg.content}</div>
              ))}
              <div ref={chatEndRef} />
              {!chatHistory.length && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.35, marginTop: "auto" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.textDim, animation: "pulse 2.5s infinite" }} />
                  <span style={{ fontSize: 9, letterSpacing: 3, color: C.textDim }}>наблюдает</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 8 }}>
              <input value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="написать Emiya..."
                style={{
                  flex: 1, background: "none", border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  color: C.textMain, fontFamily: "inherit",
                  fontSize: 10, padding: "4px 0", outline: "none", letterSpacing: 1,
                }}
              />
              <button onClick={sendMessage} style={{
                background: "none", border: "none", color: C.textDim,
                fontFamily: "inherit", fontSize: 9, letterSpacing: 2,
                cursor: "pointer", padding: "4px 8px",
              }}>→</button>
            </div>
          </div>

          {/* Bottom status */}
          <div style={{
            borderTop: `1px solid ${C.border}`, padding: "7px 16px",
            fontSize: 8, color: C.textDim, letterSpacing: 2,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>{connected ? "connected" : "reconnecting..."}</span>
            <span>:7474</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        * { box-sizing: border-box; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: ${C.borderSoft}; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: ${C.amber}; cursor: pointer; }
      `}</style>
    </div>
  );
}