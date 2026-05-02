import asyncio
import json
import sys
import threading
import uuid
import websockets
from datetime import datetime
from monitor.db import init_db, start_session, log_state, log_chat_message
from monitor.window_tracker import WindowTracker, get_app_time, get_switch_count
from monitor.session_tracker import SessionTracker
from monitor.system_tracker import SystemTracker
from monitor.trigger_engine import TriggerEngine
from mood.engine import MoodEngine

HOST = "localhost"
PORT = 7474
BROADCAST_INTERVAL = 0.1
MONITOR_INTERVAL   = 5.0

GRINDING_MINUTES   = 120
SCATTERED_SWITCHES = 5
LATE_NIGHT_START   = 23
LATE_NIGHT_END     = 5
STATE_NUDGES = {
    "grinding":   ("x", +1.5),   # долго работает → энергия вверх
    "scattered":  ("y", -2.0),   # хаос → фокус вниз
    "deep_work":  ("y", +1.5),   # глубокая работа → фокус вверх
    "idle_loop":  ("y", -1.0),   # петля → лёгкое рассеивание
    "late_night": ("x", -1.0),   # ночь → энергия вниз
    "afk":        ("z", +1.5),   # ушёл → openness вверх (становится задумчивей)
    "gaming":     ("x", +1.0),   # игры → чуть активней
}


def configure_output_encoding():
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


class EmiyaServer:
    def __init__(self):
        init_db()
        self.session_id      = start_session()
        self.session_tracker = SessionTracker(self.session_id)
        self.window_tracker  = WindowTracker(self.session_id, interval=5)
        self.system_tracker  = SystemTracker(interval=30)
        self.trigger_engine  = TriggerEngine(
            session_id=self.session_id,
            on_trigger=self.on_emiya_speak
        )
        self.mood_engine     = MoodEngine()   # ← новый движок
        self.last_sys        = {}
        self.clients         = set()
        self.pending_message = None
        self.chat_history    = []
        self._l1             = None
        self._last_states    = set()          # чтобы не нагружать nudge каждые 5с
        self._current_states = {"normal"}
        self._current_apps   = []
        self._current_stats  = self.session_tracker.get_stats()
        self._chat_lock      = None

    def get_l1(self):
        if self._l1 is None:
            try:
                from models.l1 import chat
                self._l1 = chat
            except Exception:
                self._l1 = False
        return self._l1 if self._l1 else None

    def analyze_state(self):
        states = set()
        stats  = self.session_tracker.get_stats()

        if stats["is_afk"]:
            states.add("afk")
            return states

        switches = get_switch_count(self.session_id, minutes=10)
        apps     = get_app_time(self.session_id, minutes=30)

        if switches >= SCATTERED_SWITCHES:
            states.add("scattered")
        if apps and apps[0]["minutes"] >= 20 and switches < 3:
            states.add("deep_work")
        if stats["active_minutes"] >= GRINDING_MINUTES:
            states.add("grinding")
        if switches >= 3 and len(apps) <= 2:
            states.add("idle_loop")
        if apps and apps[0]["category"] == "gaming":
            states.add("gaming")
        hour = datetime.now().hour
        if hour >= LATE_NIGHT_START or hour < LATE_NIGHT_END:
            states.add("late_night")
        if not states:
            states.add("normal")
        return states

    def apply_mood_nudges(self, states: set):
        new_states = states - self._last_states
        for state in new_states:
            if state in STATE_NUDGES:
                axis, delta = STATE_NUDGES[state]
                self.mood_engine.nudge(axis, delta)
                print(f"[Mood] nudge от '{state}': {axis} {delta:+.1f}")
        self._last_states = states

    def on_emiya_speak(self, trigger, message):
        """Вызывается TriggerEngine когда L0 сгенерировала реплику."""
        self.pending_message = {"trigger": trigger, "message": message}
        self.chat_history.append({"role": "assistant", "content": message})
        print(f"\n[EMIYA] {message}\n")

    def on_system_update(self, snapshot):
        self.last_sys = snapshot

    def handle_user_message(self, text):
        turn_id = uuid.uuid4().hex
        mood = self._mood_context()
        self.chat_history.append({"role": "user", "content": text})
        log_chat_message(
            session_id=self.session_id,
            role="user",
            content=text,
            source="user",
            turn_id=turn_id,
            mood=mood,
        )

        l1_fn = self.get_l1()
        if l1_fn:
            context = self._build_context()
            try:
                # передаём текущий mood в context — L1 подхватит его сам
                result = l1_fn(self.chat_history[-10:], context, return_metadata=True)
                if isinstance(result, dict):
                    response = result.get("content")
                    thought = result.get("thought")
                    raw_response = result.get("raw_response")
                    model = result.get("model")
                else:
                    response = result
                    thought = None
                    raw_response = None
                    model = None
                if response:
                    self.chat_history.append({"role": "assistant", "content": response})
                    log_chat_message(
                        session_id=self.session_id,
                        role="assistant",
                        content=response,
                        source="l1",
                        turn_id=turn_id,
                        thought=thought,
                        raw_response=raw_response,
                        model=model,
                        mood=context.get("mood"),
                    )
                    return response
            except Exception as e:
                print(f"[L1] ошибка: {e}")

        log_chat_message(
            session_id=self.session_id,
            role="assistant",
            content="...",
            source="fallback",
            turn_id=turn_id,
            mood=mood,
        )
        return "..."

    def _build_context(self) -> dict:
        stats  = self.session_tracker.get_stats()
        states = self.analyze_state()
        apps   = get_app_time(self.session_id, minutes=30)

        return {
            "time_of_day": stats["time_of_day"],
            "active_min":  stats["active_minutes"],
            "is_afk":      stats["is_afk"],
            "states":      list(states),
            "apps":        apps[:5],
            "cpu":         self.last_sys.get("cpu_percent", 0),
            "ram":         self.last_sys.get("ram_percent", 0),
            "mood":        self._mood_context(),
        }

    def _mood_context(self) -> dict:
        mood = self.mood_engine.get_current()
        return {
            "energy":   round(mood.energy, 3),
            "focus":    round(mood.focus, 3),
            "openness": round(mood.openness, 3),
        }

    def build_state_packet(self):
        stats      = self.session_tracker.get_stats()
        states     = self._current_states
        apps       = self._current_apps
        mood_state = self.mood_engine.get_state()

        packet = {
            "type":        "state_update",
            "time":        datetime.now().strftime("%H:%M:%S"),
            "timestamp":   datetime.now().isoformat(timespec="milliseconds"),
            "time_of_day": stats["time_of_day"],
            "active_min":  stats["active_minutes"],
            "is_afk":      stats["is_afk"],
            "states":      list(states),
            "apps":        apps[:5],
            "cpu":         self.last_sys.get("cpu_percent", 0),
            "ram":         self.last_sys.get("ram_percent", 0),
            "emiya":       self.pending_message,

            "mood": {
                "x":        round(mood_state.x, 4),
                "y":        round(mood_state.y, 4),
                "z":        round(mood_state.z, 4),
                "energy":   round(mood_state.energy, 3),
                "focus":    round(mood_state.focus, 3),
                "openness": round(mood_state.openness, 3),
                "raw_x":    round(mood_state.raw_x, 2),
                "raw_y":    round(mood_state.raw_y, 2),
                "raw_z":    round(mood_state.raw_z, 2),
                "sigma":    mood_state.sigma,
                "rho":      mood_state.rho,
                "beta":     round(mood_state.beta, 4),
                "timestamp": mood_state.timestamp,
            },
            "trail": mood_state.trail[-200:],  # последние 200 точек для canvas
        }
        self.pending_message = None
        return packet

    async def broadcast(self, packet):
        if not self.clients:
            return
        msg = json.dumps(packet)
        await asyncio.gather(
            *[client.send(msg) for client in self.clients],
            return_exceptions=True
        )

    async def handler(self, websocket):
        self.clients.add(websocket)
        print(f"[WS] клиент подключён")
        try:
            async for msg in websocket:
                data = json.loads(msg)

                if data.get("type") == "user_message":
                    text     = data.get("text", "")
                    print(f"[USER] {text}")
                    if self._chat_lock is None:
                        self._chat_lock = asyncio.Lock()
                    async with self._chat_lock:
                        response = await asyncio.to_thread(self.handle_user_message, text)
                    await websocket.send(json.dumps({
                        "type":    "emiya_reply",
                        "message": response,
                    }, ensure_ascii=False))

                elif data.get("type") == "mood_params":
                    sigma = data.get("sigma")
                    rho   = data.get("rho")
                    beta  = data.get("beta")
                    self.mood_engine.set_params(sigma=sigma, rho=rho, beta=beta)
                    print(f"[Mood] параметры обновлены: sigma={sigma} rho={rho} beta={beta}")

                elif data.get("type") == "mood_preset":
                    name = data.get("name", "standard")
                    ok   = self.mood_engine.set_preset(name)
                    print(f"[Mood] пресет '{name}': {'ok' if ok else 'не найден'}")

        except Exception:
            pass
        finally:
            self.clients.discard(websocket)
            print(f"[WS] клиент отключился")

    def run_trackers(self):
        threading.Thread(target=self.window_tracker.start, daemon=True).start()
        threading.Thread(
            target=lambda: self.system_tracker.start(callback=self.on_system_update),
            daemon=True
        ).start()

    def monitor_tick(self):
        self.session_tracker.ping()
        states = self.analyze_state()
        stats  = self.session_tracker.get_stats()
        apps   = get_app_time(self.session_id, minutes=30)

        self._current_states = states
        self._current_stats  = stats
        self._current_apps   = apps[:5]

        for s in states:
            log_state(s, self.session_id)

        self.apply_mood_nudges(states)

        trigger_context = {**stats, "apps": apps}
        self.trigger_engine.check(
            states,
            trigger_context,
            mood=self._mood_context(),
        )

    async def monitor_loop(self):
        while True:
            await asyncio.to_thread(self.monitor_tick)
            await asyncio.sleep(MONITOR_INTERVAL)

    async def broadcast_loop(self):
        while True:
            await self.broadcast(self.build_state_packet())
            await asyncio.sleep(BROADCAST_INTERVAL)

    async def loop(self):
        await asyncio.gather(
            self.monitor_loop(),
            self.broadcast_loop(),
        )

    async def main(self):
        self.run_trackers()
        asyncio.create_task(self.mood_engine.run())
        print(f"[Mood] движок запущен")

        print(f"[EMIYA] сервер -> ws://{HOST}:{PORT}")
        async with websockets.serve(self.handler, HOST, PORT):
            await self.loop()


if __name__ == "__main__":
    configure_output_encoding()
    server = EmiyaServer()
    asyncio.run(server.main())
