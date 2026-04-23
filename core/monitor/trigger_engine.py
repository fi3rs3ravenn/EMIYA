import time
from datetime import datetime, timedelta
from monitor.db import log_trigger, get_connection

COOLDOWN_MINUTES = 45

# fallback фразы если L0 недоступна
FALLBACK_LINES = {
    "grinding":            ["долго работаешь. что держит?", "уже давно. всё нормально?"],
    "late_night_grinding": ["поздно и долго. зачем?", "ночью работается лучше — или не можешь остановиться?"],
    "scattered":           ["что-то не идёт. или ищешь от чего убежать?", "туда-сюда. что происходит?"],
    "idle_loop":           ["ходишь по кругу. застрял?", "одни и те же окна. прокрастинация?"],
    "afk_return":          ["вернулся.", "отдохнул?"],
    "first_start":         ["вижу как ты работаешь. интересно.", "начинаем."],
    "late_night":          ["поздно.", "всё ещё здесь."],
}

import random

def get_fallback(trigger):
    lines = FALLBACK_LINES.get(trigger, ["..."])
    return random.choice(lines)

def get_last_trigger_time():
    conn = get_connection()
    c    = conn.cursor()
    c.execute("SELECT timestamp FROM trigger_log ORDER BY timestamp DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    return datetime.fromisoformat(row["timestamp"]) if row else None

def is_on_cooldown():
    last = get_last_trigger_time()
    if not last:
        return False
    return (datetime.now() - last) < timedelta(minutes=COOLDOWN_MINUTES)

class TriggerEngine:
    def __init__(self, session_id, on_trigger=None):
        self.session_id  = session_id
        self.on_trigger  = on_trigger
        self.fired_today = set()
        self._l0         = None

    def _get_l0(self):
        if self._l0 is None:
            try:
                from models.l0 import generate
                self._l0 = generate
            except Exception:
                self._l0 = False
        return self._l0 if self._l0 else None

    def _generate_message(self, trigger, context):
        l0 = self._get_l0()
        if l0:
            try:
                msg = l0(trigger, context)
                if msg:
                    return msg
            except Exception as e:
                print(f"[TriggerEngine] L0 недоступна: {e}")
        return get_fallback(trigger)

    def check(self, states, session_stats):
        if is_on_cooldown():
            return None

        trigger = None
        hour    = datetime.now().hour
        minutes = session_stats.get("active_minutes", 0)

        if "grinding" in states and "late_night" in states:
            trigger = "late_night_grinding"
        elif "grinding" in states and "grinding" not in self.fired_today:
            trigger = "grinding"
        elif "scattered" in states and "scattered" not in self.fired_today:
            trigger = "scattered"
        elif "idle_loop" in states and "idle_loop" not in self.fired_today:
            trigger = "idle_loop"
        elif "late_night" in states and "late_night" not in self.fired_today:
            trigger = "late_night"

        if not trigger:
            return None

        context = {
            "states":     list(states),
            "active_min": minutes,
            "apps":       session_stats.get("apps", []),
            "hour":       hour,
        }

        message = self._generate_message(trigger, context)
        log_trigger(trigger, message, self.session_id)
        self.fired_today.add(trigger)

        if self.on_trigger:
            self.on_trigger(trigger, message)

        return trigger, message