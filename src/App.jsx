import { useState, useEffect, useRef } from "react";

const LORENZ = { sigma: 10, rho: 28, beta: 8/3 };

function lorenzStep(x, y, z, dt = 0.005) {
  const dx = LORENZ.sigma * (y - x);
  const dy = x * (LORENZ.rho - z) - y;
  const dz = x * y - LORENZ.beta * z;
  return [x + dx * dt, y + dy * dt, z + dz * dt];
}

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
};

export default function EmiyaUI() {
  const [data, setData]           = useState(null);
  const [emiyaMsg, setEmiyaMsg]   = useState(null);
  const [msgVisible, setMsgVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("monitor");
  const [glitch, setGlitch]       = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText]     = useState("");
  const canvasRef  = useRef(null);
  const wsRef      = useRef(null);
  const chatEndRef = useRef(null);

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current) return;
    const text = inputText.trim();
    setInputText("");
    setChatHistory(h => [...h, { role: "user", content: text }]);
    wsRef.current.send(JSON.stringify({ type: "user_message", text }));
  };

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
        if (packet.emiya) {
          setChatHistory(h => [...h, { role: "assistant", content: packet.emiya.message }]);
          setEmiyaMsg(packet.emiya.message);
          setMsgVisible(true);
          setTimeout(() => setMsgVisible(false), 8000);
        }
      };
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // Lorenz canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let state = [0.1, 0, 0];
    let animId;
    const draw = () => {
      ctx.fillStyle = "rgba(5,5,5,0.04)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 3; i++) state = lorenzStep(...state);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const alpha = 0.3 + Math.abs(state[2] / 60) * 0.4;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(229,231,235,${alpha})`;
      ctx.lineWidth = 0.7;
      ctx.moveTo(cx + state[0] * 4,       cy + state[2] * 3 - 80);
      ctx.lineTo(cx + state[0] * 4 + 0.5, cy + state[2] * 3 - 80);
      ctx.stroke();
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // автоскролл
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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

  const apps   = data?.apps   || [];
  const states = data?.states || [];
  const cpu    = data?.cpu    || 0;
  const ram    = data?.ram    || 0;

  const stateColor = (s) => {
    if (s === "grinding" || s === "late_night") return C.danger;
    if (s === "scattered" || s === "idle_loop") return C.warn;
    return C.textSec;
  };

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
          <span style={{ fontSize: 12, letterSpacing: 8, color: C.active, fontWeight: "bold" }}>
            EMIYA
          </span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 3 }}>SYS_v2.0</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 10, letterSpacing: 2, alignItems: "center" }}>
          {data?.active_min !== undefined && (
            <span style={{ color: C.textDim }}>
              SESSION <span style={{ color: C.textSec }}>{data.active_min}m</span>
            </span>
          )}
          <span style={{
            color: connected ? C.ok : C.danger,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: connected ? C.ok : C.danger,
              display: "inline-block",
              boxShadow: connected ? `0 0 6px ${C.ok}` : "none",
            }} />
            {connected ? "ONLINE" : "OFFLINE"}
          </span>
          <span style={{ color: C.textDim }}>{data?.time || "--:--:--"}</span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 260px",
        height: "calc(100vh - 45px)",
      }}>

        {/* LEFT PANEL */}
        <div style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>

          {/* TABS */}
          <div style={{ borderBottom: `1px solid ${C.border}`, display: "flex", background: C.panel }}>
            {["monitor", "patterns", "log"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: "none", border: "none",
                borderRight: `1px solid ${C.border}`,
                borderBottom: activeTab === tab
                  ? `2px solid ${C.active}`
                  : "2px solid transparent",
                color: activeTab === tab ? C.active : C.textDim,
                fontFamily: "inherit",
                fontSize: 10,
                letterSpacing: 3,
                padding: "12px 24px",
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "color 0.2s",
              }}>{tab}</button>
            ))}
          </div>

          {/* MONITOR TAB */}
          {activeTab === "monitor" && (
            <div style={{ flex: 1, padding: "20px 24px", overflow: "auto" }}>

              {/* Active Windows */}
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14 }}>
                ACTIVE WINDOWS
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 56px",
                fontSize: 11,
                marginBottom: 28,
              }}>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6 }}>PROCESS</span>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6 }}>TYPE</span>
                <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 2, paddingBottom: 6, textAlign: "right" }}>TIME</span>
                <div style={{ gridColumn: "1/-1", height: 1, background: C.border, marginBottom: 10 }} />
                {apps.length === 0 && (
                  <span style={{ color: C.textDim, fontSize: 10, gridColumn: "1/-1", opacity: 0.5 }}>
                    нет данных
                  </span>
                )}
                {apps.map((app, i) => (
                  <>
                    <span key={`n${i}`} style={{
                      color: i === 0 ? C.active : C.textSec,
                      padding: "5px 0",
                      fontSize: 11,
                      letterSpacing: 0.5,
                    }}>
                      {i === 0 ? "▶ " : "  "}{app.app}
                    </span>
                    <span key={`c${i}`} style={{ color: C.textDim, padding: "5px 0", fontSize: 10 }}>
                      {app.category}
                    </span>
                    <span key={`t${i}`} style={{ color: C.textSec, padding: "5px 0", textAlign: "right", fontSize: 10 }}>
                      {app.minutes}m
                    </span>
                  </>
                ))}
              </div>

              {/* System */}
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14 }}>
                SYSTEM
              </div>
              {[["CPU", cpu], ["RAM", ram]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, width: 36, color: C.textDim, letterSpacing: 2 }}>{label}</span>
                  <div style={{ flex: 1, height: 3, background: C.borderSoft, borderRadius: 1 }}>
                    <div style={{
                      width: `${val}%`, height: "100%",
                      background: val > 80 ? C.danger : val > 60 ? C.warn : C.textSec,
                      borderRadius: 1,
                      transition: "width 1s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: C.textSec, width: 36, textAlign: "right" }}>{val}%</span>
                </div>
              ))}

              {/* State */}
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 14, marginTop: 28 }}>
                DETECTED STATE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {states.length === 0
                  ? <span style={{ fontSize: 10, color: C.textDim, opacity: 0.4 }}>—</span>
                  : states.map(s => (
                    <span key={s} style={{
                      fontSize: 9,
                      letterSpacing: 2,
                      padding: "4px 10px",
                      border: `1px solid ${stateColor(s)}40`,
                      color: stateColor(s),
                      background: `${stateColor(s)}08`,
                    }}>{s.toUpperCase()}</span>
                  ))
                }
              </div>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
                активно:{" "}
                <span style={{ color: C.textSec }}>{data?.active_min || 0} мин</span>
                {"  ·  "}
                <span style={{ color: C.textDim }}>{data?.time_of_day || "—"}</span>
              </div>
            </div>
          )}

          {activeTab === "patterns" && (
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 16 }}>
                BEHAVIORAL PATTERNS
              </div>
              <div style={{ color: C.textDim, fontSize: 10, opacity: 0.5 }}>
                накапливается... нужно больше данных
              </div>
            </div>
          )}

          {activeTab === "log" && (
            <div style={{ padding: "20px 24px", flex: 1, overflow: "auto" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: C.textDim, marginBottom: 16 }}>
                TRIGGER LOG
              </div>
              <div style={{ color: C.textDim, fontSize: 10, opacity: 0.5 }}>
                лог триггеров появится здесь
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", background: C.panel }}>

          {/* Lorenz */}
          <div style={{
            position: "relative",
            height: 190,
            borderBottom: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            <canvas ref={canvasRef} width={260} height={190} style={{ display: "block" }} />
            <div style={{
              position: "absolute", top: 10, left: 12,
              fontSize: 8, letterSpacing: 4, color: C.textDim,
            }}>LORENZ · STATE</div>
          </div>

          {/* Models */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 12 }}>MODELS</div>
            {[
              ["L-meta", "ORCH", "active",  C.ok],
              ["L0",     "BASE", "active",  C.ok],
              ["L1",     "MID",  "standby", C.warn],
              ["L2",     "DEEP", "offline", C.textDim],
            ].map(([id, role, status, col]) => (
              <div key={id} style={{
                display: "flex", alignItems: "center",
                gap: 8, marginBottom: 8,
              }}>
                <span style={{ fontSize: 9, color: C.textDim, width: 40, letterSpacing: 1 }}>{id}</span>
                <span style={{ fontSize: 9, color: C.textSec, flex: 1, letterSpacing: 1 }}>{role}</span>
                <span style={{
                  fontSize: 8, color: col, letterSpacing: 1,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: col, display: "inline-block",
                    boxShadow: status === "active" ? `0 0 4px ${col}` : "none",
                  }} />
                  {status}
                </span>
              </div>
            ))}
          </div>

          {/* Emiya dialog */}
<div style={{
  flex: 1, padding: "14px",
  display: "flex", flexDirection: "column",
}}>
  <div style={{ fontSize: 8, letterSpacing: 4, color: C.textDim, marginBottom: 12 }}>
    EMIYA
  </div>

  {/* история сообщений */}
  <div style={{
    flex: 1, overflowY: "auto",
    display: "flex", flexDirection: "column",
    gap: 10, marginBottom: 12,
    maxHeight: "300px",
  }}>
    {chatHistory.map((msg, i) => (
      <div key={i} style={{
        fontSize: 11,
        color: msg.role === "assistant" ? C.active : C.textSec,
        lineHeight: 1.7,
        borderLeft: msg.role === "assistant"
          ? `2px solid ${C.textDim}`
          : `2px solid ${C.borderSoft}`,
        paddingLeft: 10,
        fontStyle: msg.role === "assistant" ? "italic" : "normal",
      }}>
        {msg.content}
      </div>
    ))}
    <div ref={chatEndRef} />

    {!chatHistory.length && !msgVisible && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.35, marginTop: "auto" }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: C.textDim, animation: "pulse 2.5s infinite",
        }} />
        <span style={{ fontSize: 9, letterSpacing: 3, color: C.textDim }}>наблюдает</span>
      </div>
    )}
  </div>

  {/* поле ввода */}
  <div style={{
    display: "flex", gap: 8,
    borderTop: `1px solid ${C.borderSoft}`,
    paddingTop: 10,
  }}>
    <input
      value={inputText}
      onChange={e => setInputText(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
      placeholder="написать Emiya..."
      style={{
        flex: 1,
        background: "none",
        border: "none",
        borderBottom: `1px solid ${C.border}`,
        color: C.textMain,
        fontFamily: "inherit",
        fontSize: 10,
        padding: "4px 0",
        outline: "none",
        letterSpacing: 1,
      }}
    />
    <button onClick={sendMessage} style={{
      background: "none", border: "none",
      color: C.textDim, fontFamily: "inherit",
      fontSize: 9, letterSpacing: 2, cursor: "pointer",
      padding: "4px 8px",
    }}>→</button>
  </div>
</div>

          {/* Bottom status */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            padding: "8px 16px",
            fontSize: 8,
            color: C.textDim,
            letterSpacing: 2,
            display: "flex",
            justifyContent: "space-between",
          }}>
            <span>{connected ? "connected" : "reconnecting..."}</span>
            <span>:7474</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50%       { opacity: 0.8; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}