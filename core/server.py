import asyncio
import json
import threading
import websockets
from datetime import datetime
from monitor.db import init_db, start_session, end_session, log_state
from monitor.window_tracker import WindowTracker, get_app_time, get_switch_count
from monitor.session_tracker import SessionTracker
from monitor.system_tracker import SystemTracker
from monitor.trigger_engine import TriggerEngine

HOST = "localhost"
PORT = 7474

GRINDING_MINUTES   = 120
SCATTERED_SWITCHES = 5
LATE_NIGHT_START   = 23
LATE_NIGHT_END     = 5

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
        self.last_sys        = {}
        self.clients         = set()
        self.pending_message = None
        self.chat_history    = []
        self._l1             = None

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

    def on_emiya_speak(self, trigger, message):
        self.pending_message = {"trigger": trigger, "message": message}
        self.chat_history.append({"role": "assistant", "content": message})
        print(f"\n[EMIYA] {message}\n")

    def on_system_update(self, snapshot):
        self.last_sys = snapshot

    def handle_user_message(self, text):
        """обрабатывает сообщение от пользователя через L1"""
        self.chat_history.append({"role": "user", "content": text})

        l1 = self.get_l1()
        if l1:
            context = self.build_state_packet()
            try:
                response = l1(self.chat_history[-10:], context)
                if response:
                    self.chat_history.append({"role": "assistant", "content": response})
                    return response
            except Exception as e:
                print(f"[L1] ошибка: {e}")

        return "..."

    def build_state_packet(self):
        stats  = self.session_tracker.get_stats()
        states = self.analyze_state()
        apps   = get_app_time(self.session_id, minutes=30)

        packet = {
            "type":        "state_update",
            "time":        datetime.now().strftime("%H:%M:%S"),
            "time_of_day": stats["time_of_day"],
            "active_min":  stats["active_minutes"],
            "is_afk":      stats["is_afk"],
            "states":      list(states),
            "apps":        apps[:5],
            "cpu":         self.last_sys.get("cpu_percent", 0),
            "ram":         self.last_sys.get("ram_percent", 0),
            "emiya":       self.pending_message,
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
                    response = self.handle_user_message(text)
                    await websocket.send(json.dumps({
                        "type":    "emiya_reply",
                        "message": response,
                    }))

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

    async def loop(self):
        while True:
            self.session_tracker.ping()
            states = self.analyze_state()
            stats  = self.session_tracker.get_stats()
            for s in states:
                log_state(s, self.session_id)
            self.trigger_engine.check(states, stats)
            packet = self.build_state_packet()
            await self.broadcast(packet)
            await asyncio.sleep(5)

    async def main(self):
        self.run_trackers()
        print(f"[EMIYA] сервер → ws://{HOST}:{PORT}")
        async with websockets.serve(self.handler, HOST, PORT):
            await self.loop()

if __name__ == "__main__":
    server = EmiyaServer()
    asyncio.run(server.main())