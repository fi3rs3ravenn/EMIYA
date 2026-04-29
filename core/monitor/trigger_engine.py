import random
import uuid
from datetime import datetime, timedelta
from monitor.db import log_trigger, log_chat_message

COOLDOWN_MINUTES = 30

FALLBACK_LINES = {
    "grinding":            ["долго работаешь. что держит?", "уже давно. всё нормально?"],
    "late_night_grinding": ["поздно и долго. зачем?", "ночью работается лучше — или не можешь остановиться?"],
    "scattered":           ["что-то не идёт. или ищешь от чего убежать?", "туда-сюда. что происходит?"],
    "idle_loop":           ["ходишь по кругу. застрял?", "одни и те же окна. прокрастинация?"],
    "afk_return":          ["вернулся.", "отдохнул?"],
    "first_start":         ["вижу как ты работаешь. интересно.", "начинаем."],
    "late_night":          ["поздно.", "всё ещё здесь."],
}


def get_fallback(trigger):
    lines = FALLBACK_LINES.get(trigger, ["..."])
    return random.choice(lines)


class TriggerEngine:
    def __init__(self, session_id, on_trigger=None):
        self.session_id   = session_id
        self.on_trigger   = on_trigger
        self.fired_today  = set()
        self._l0          = None
        self._last_fired_at: datetime | None = None

    def _is_on_cooldown(self) -> bool:
        if self._last_fired_at is None:
            return False
        return (datetime.now() - self._last_fired_at) < timedelta(minutes=COOLDOWN_MINUTES)

    def _get_l0(self):
        if self._l0 is None:
            try:
                from models.l0 import generate
                self._l0 = generate
            except Exception:
                self._l0 = False
        return self._l0 if self._l0 else None

    def _generate_message(self, trigger: str, context: dict) -> dict:
        l0 = self._get_l0()
        if l0:
            try:
                result = l0(trigger, context, return_metadata=True)
                if isinstance(result, dict) and result.get("content"):
                    return {
                        "content": result["content"],
                        "thought": result.get("thought"),
                        "raw_response": result.get("raw_response"),
                        "model": result.get("model"),
                        "source": "l0_trigger",
                    }
                if isinstance(result, str) and result:
                    return {"content": result, "source": "l0_trigger"}
            except Exception as e:
                print(f"[TriggerEngine] L0 недоступна: {e}")
        return {"content": get_fallback(trigger), "source": "fallback_trigger"}

    def check(self, states: set, session_stats: dict, mood: dict | None = None):
        if self._is_on_cooldown():
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

        self._last_fired_at = datetime.now()
        self.fired_today.add(trigger)

        context = {
            "states":     list(states),
            "active_min": minutes,
            "apps":       session_stats.get("apps", []),
            "hour":       hour,
            "mood":       mood or {"energy": 0.5, "focus": 0.5, "openness": 0.5},
        }

        turn_id = uuid.uuid4().hex
        payload = self._generate_message(trigger, context)
        message = payload["content"]
        log_trigger(trigger, message, self.session_id)
        log_chat_message(
            session_id=self.session_id,
            role="assistant",
            content=message,
            source=payload.get("source", "l0_trigger"),
            turn_id=turn_id,
            thought=payload.get("thought"),
            raw_response=payload.get("raw_response"),
            model=payload.get("model"),
            trigger=trigger,
            mood=context.get("mood"),
        )

        if self.on_trigger:
            self.on_trigger(trigger, message)

        print(f"[Trigger] {trigger} → {message}")
        return trigger, message

    def reset_day(self):
        self.fired_today.clear()
