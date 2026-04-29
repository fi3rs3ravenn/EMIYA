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

// ASCII палитра для trail (от старого к новому)
const ASCII_TRAIL = ["░", "▒", "▓", "█"];
const ASCII_COLS  = 40;
const ASCII_ROWS  = 20;
const MOOD_CANVAS_SIZE = 240;

// локальная Lorenz симуляция (fallback пока нет данных с сервера)
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

// Canvas renderer 
function projectPoint(pt) {
  const x = Number(pt.x ?? pt.raw_x ?? 0);
  const y = Number(pt.y ?? pt.raw_y ?? 0);
  const z = Number(pt.z ?? pt.raw_z ?? 0);
  return {
    u: (x - y) * 0.62,
    v: z * 0.78 - (x + y) * 0.18,
  };
}

function normalizeProjected(points, W, H) {
  const padding = 18;
  const projected = points.map(projectPoint);
  const us = projected.map(p => p.u);
  const vs = projected.map(p => p.v);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const uSpan = uMax - uMin;
  const vSpan = vMax - vMin;
  const uRange = uSpan || 1;
  const vRange = vSpan || 1;

  return projected.map(p => ({
    x: uSpan < 1e-6 ? W / 2 : padding + ((p.u - uMin) / uRange) * (W - padding * 2),
    y: vSpan < 1e-6 ? H / 2 : H - padding - ((p.v - vMin) / vRange) * (H - padding * 2),
  }));
}

function drawMoodCanvas(ctx, trail, currentPoint, W, H, timeMs) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  const points = (trail || []).filter(pt =>
    Number.isFinite(Number(pt.x ?? pt.raw_x)) &&
    Number.isFinite(Number(pt.y ?? pt.raw_y)) &&
    Number.isFinite(Number(pt.z ?? pt.raw_z))
  ).slice(-200);

  if (points.length === 0) return;

  const renderPoints = currentPoint ? [...points, currentPoint] : points;
  const projected = normalizeProjected(renderPoints, W, H);
  const trailProjected = projected.slice(0, points.length);
  const len = trailProjected.length;

  ctx.strokeStyle = "rgba(255,176,0,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  for (let i = 1; i < len; i++) {
    const t = i / Math.max(1, len - 1);
    const prev = trailProjected[i - 1];
    const pt = trailProjected[i];
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,176,0,${0.08 + t * 0.58})`;
    ctx.lineWidth = t > 0.88 ? 1.25 : 0.6;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  const head = projected[projected.length - 1];
  const pulse = 4.5 + Math.sin(timeMs / 180) * 1.5;
  const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12);
  glow.addColorStop(0, "rgba(255,176,0,0.9)");
  glow.addColorStop(0.38, "rgba(255,176,0,0.32)");
  glow.addColorStop(1, "rgba(255,176,0,0)");
  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(head.x, head.y, pulse + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#FFB000";
  ctx.arc(head.x, head.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

// ASCII renderer
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

// Mood Bar
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

function ChatMessage({ msg, compact = false }) {
  const isAssistant = msg.role === "assistant";
  return (
    <div style={{
      alignSelf: isAssistant ? "flex-start" : "flex-end",
      width: compact ? "100%" : "min(78%, 760px)",
      borderLeft: isAssistant ? `2px solid ${C.amber}` : `2px solid ${C.border}`,
      borderRight: isAssistant ? "none" : `2px solid ${C.border}`,
      padding: compact ? "0 0 0 9px" : "10px 14px",
      color: isAssistant ? C.active : C.textSec,
      fontSize: compact ? 11 : 13,
      lineHeight: compact ? 1.65 : 1.75,
      fontStyle: isAssistant ? "italic" : "normal",
      background: compact ? "transparent" : isAssistant ? "rgba(255,176,0,0.025)" : "rgba(255,255,255,0.015)",
      userSelect: "text",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    }}>
      {msg.content}
    </div>
  );
}

function ChatPanel({
  chatHistory,
  inputText,
  setInputText,
  sendMessage,
  connected,
  chatEndRef,
}) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "18px 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: C.bg,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 7 }}>EMIYA</div>
          <div style={{ fontSize: 12, color: C.textSec, letterSpacing: 2 }}>
            {connected ? "dialogue channel open" : "waiting for backend"}
          </div>
        </div>
        <span style={{
          fontSize: 9,
          letterSpacing: 2,
          color: connected ? C.ok : C.danger,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: connected ? C.ok : C.danger,
            display: "inline-block",
            boxShadow: connected ? `0 0 6px ${C.ok}` : "none",
          }} />
          {connected ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 0,
      }}>
        {chatHistory.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}
        {!chatHistory.length && (
          <div style={{
            margin: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: C.textDim,
            opacity: 0.42,
            fontSize: 10,
            letterSpacing: 3,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.textDim, animation: "pulse 2.5s infinite" }} />
            наблюдает
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: "14px 20px 18px",
        display: "grid",
        gridTemplateColumns: "1fr 48px",
        gap: 12,
        background: C.panel,
      }}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="написать emiya..."
          rows={3}
          style={{
            resize: "none",
            width: "100%",
            background: "#050505",
            border: `1px solid ${C.border}`,
            color: C.textMain,
            fontFamily: "inherit",
            fontSize: 13,
            lineHeight: 1.6,
            padding: "10px 12px",
            outline: "none",
            letterSpacing: 0,
            userSelect: "text",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !inputText.trim()}
          style={{
            background: "none",
            border: `1px solid ${connected && inputText.trim() ? C.amber : C.border}`,
            color: connected && inputText.trim() ? C.amber : C.textDim,
            fontFamily: "inherit",
            fontSize: 16,
            cursor: connected && inputText.trim() ? "pointer" : "default",
            alignSelf: "stretch",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}


export default function EmiyaUI() {
  const [data, setData]               = useState(null);
  const [connected, setConnected]     = useState(false);
  const [activeTab, setActiveTab]     = useState("chat");
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
  const fallbackTrailRef = useRef([]);
  const targetPointRef   = useRef(null);
  const displayPointRef  = useRef(null);
  // параметры аттрактора — синкаются с сервером
  const lorenzParams = useRef({ sigma: 10, rho: 28, beta: 8/3 });
  const animRef     = useRef(null);
  const trailRef    = useRef([]);  // серверный trail (для ASCII режима)

  // WebSocket
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
        if (packet.mood) {
          setMood(packet.mood);
          if (
            Number.isFinite(Number(packet.mood.x)) &&
            Number.isFinite(Number(packet.mood.y)) &&
            Number.isFinite(Number(packet.mood.z))
          ) {
            targetPointRef.current = {
              x: Number(packet.mood.x),
              y: Number(packet.mood.y),
              z: Number(packet.mood.z),
            };
            if (!displayPointRef.current) {
              displayPointRef.current = targetPointRef.current;
            }
          }
        }

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

  // Canvas animation loop — серверный trail + offline fallback
  useEffect(() => {
    if (asciiMode) { cancelAnimationFrame(animRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;
    const MAX_FALLBACK_TRAIL = 200;

    const draw = () => {
      const serverTrail = trailRef.current;

      if (serverTrail.length > 0 && targetPointRef.current) {
        const current = displayPointRef.current || targetPointRef.current;
        const target = targetPointRef.current;
        displayPointRef.current = {
          x: current.x + (target.x - current.x) * 0.09,
          y: current.y + (target.y - current.y) * 0.09,
          z: current.z + (target.z - current.z) * 0.09,
        };
        drawMoodCanvas(ctx, serverTrail, displayPointRef.current, W, H, performance.now());
      } else {
        const { sigma, rho, beta } = lorenzParams.current;
        localState.current = lorenzStepRK4(...localState.current, sigma, rho, beta);
        const [x, y, z] = localState.current;
        fallbackTrailRef.current.push({ x, y, z });
        if (fallbackTrailRef.current.length > MAX_FALLBACK_TRAIL) {
          fallbackTrailRef.current.shift();
        }
        drawMoodCanvas(
          ctx,
          fallbackTrailRef.current,
          fallbackTrailRef.current[fallbackTrailRef.current.length - 1],
          W,
          H,
          performance.now()
        );
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [asciiMode]);

  // Локальные часы — тикают каждую секунду
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

  // Glitch
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.08) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 80);
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, activeTab]);

  // Mood Tuner send
  const sendTuner = useCallback((params) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "mood_params", ...params }));
  }, []);

  const sendPreset = useCallback((name) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "mood_preset", name }));
  }, []);

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;
    const text = inputText.trim();
    setInputText("");
    setChatHistory(h => [...h, { role: "user", content: text }]);
    wsRef.current.send(JSON.stringify({ type: "user_message", text }));
  };

  const apps   = data?.apps   || [];
  const states = data?.states || [];
  const cpu    = data?.cpu    || 0;
  const ram    = data?.ram    || 0;
  const latestAssistant = [...chatHistory].reverse().find(msg => msg.role === "assistant");

  const stateColor = (s) => {
    if (s === "grinding" || s === "late_night") return C.danger;
    if (s === "scattered" || s === "idle_loop") return C.warn;
    return C.textSec;
  };

  // ASCII grid
  const asciiGrid = asciiMode ? buildAsciiGrid(trail) : null;

  const PRESETS = [
    { name: "calm",          label: "[calm]" },
    { name: "standard",      label: "[std]" },
    { name: "edge_of_chaos", label: "[edge]" },
    { name: "storm",         label: "[storm]" },
  ];

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
            {["monitor", "chat", "patterns", "log"].map(tab => (
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

          {activeTab === "chat" && (
            <ChatPanel
              chatHistory={chatHistory}
              inputText={inputText}
              setInputText={setInputText}
              sendMessage={sendMessage}
              connected={connected}
              chatEndRef={chatEndRef}
            />
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
              <canvas
                ref={canvasRef}
                width={MOOD_CANVAS_SIZE}
                height={MOOD_CANVAS_SIZE}
                style={{ display: "block", margin: "0 auto" }}
              />
            )}

            {/* ASCII mode */}
            {asciiMode && (
              <div style={{
                width: MOOD_CANVAS_SIZE, height: MOOD_CANVAS_SIZE,
                margin: "0 auto",
                padding: "24px 6px 8px",
                fontFamily: "'Courier New', monospace",
                fontSize: 7,
                lineHeight: 1.55,
                color: C.amber,
                overflow: "hidden",
                letterSpacing: 0,
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

          {/* Mood Tuner */}
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

          {/* Chat status */}
          <div style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", minHeight: 160 }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 12 }}>EMIYA</div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
              {latestAssistant ? (
                <ChatMessage msg={latestAssistant} compact />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.35, marginTop: "auto" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.textDim, animation: "pulse 2.5s infinite" }} />
                  <span style={{ fontSize: 9, letterSpacing: 3, color: C.textDim }}>наблюдает</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setActiveTab("chat")}
              style={{
                marginTop: 12,
                background: "none",
                border: `1px solid ${activeTab === "chat" ? `${C.amber}70` : C.border}`,
                color: activeTab === "chat" ? C.amber : C.textDim,
                fontFamily: "inherit",
                fontSize: 8,
                letterSpacing: 2,
                padding: "6px 8px",
                cursor: "pointer",
              }}
            >
              CHAT
            </button>
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
