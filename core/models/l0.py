import requests
from pathlib import Path
from models.response_utils import split_thinking, strip_speaker_prefix

MODEL      = "qwen3:4b"
OLLAMA_URL = "http://localhost:11434/api/chat"

_prompt_file  = Path(__file__).parent.parent / "prompts" / "l0.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")


def _build_system(mood: dict | None) -> str:
    system = SYSTEM_PROMPT

    if mood:
        try:
            from mood.modifiers import mood_to_prompt_fragment
            from mood.lorenz import MoodVector
            mood_vec = MoodVector(
                energy   = mood.get("energy", 0.5),
                focus    = mood.get("focus", 0.5),
                openness = mood.get("openness", 0.5),
                raw_x=0, raw_y=0, raw_z=0,
            )
            system = mood_to_prompt_fragment(mood_vec) + "\n\n" + system
        except Exception as e:
            print(f"[L0] mood injection ошибка: {e}")

    return system


def build_user_prompt(trigger: str, context: dict) -> str:
    active_min = context.get("active_min", 0)
    apps       = context.get("apps", [])
    hour       = context.get("hour", 0)
    top_app    = apps[0]["app"].replace(".exe", "") if apps else "unknown"

    situations = {
        "grinding":            f"пользователь работает уже {int(active_min)} минут без перерыва. приложение: {top_app}.",
        "late_night_grinding": f"сейчас {hour}:00 ночи. работает уже {int(active_min)} минут. приложение: {top_app}.",
        "scattered":           f"хаотично переключается между приложениями уже {int(active_min)} минут.",
        "idle_loop":           f"ходит по кругу между одними и теми же окнами.",
        "late_night":          f"сейчас {hour}:00 ночи. всё ещё за компьютером.",
        "afk_return":          f"вернулся после перерыва.",
        "first_start":         f"только что начал сессию.",
    }

    situation = situations.get(trigger, "наблюдает за пользователем.")
    return f"ситуация: {situation}\nскажи что-нибудь. одно-два предложения, не больше. /no_think"


def _clean(text: str) -> str:
    """Постобработка ответа модели."""
    text = strip_speaker_prefix(text)
    text = text.lower().replace("!", ".")
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    result = ". ".join(sentences[:2])
    if result and not result.endswith("."):
        result += "."
    return result


def generate(trigger: str, context: dict, return_metadata: bool = False) -> str | dict | None:
    mood   = context.get("mood")
    system = _build_system(mood)

    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": [
                {"role": "system",  "content": system},
                {"role": "user",    "content": build_user_prompt(trigger, context)},
            ],
            "stream": False,
            "options": {
                "temperature": 0.85,
                "top_p":       0.9,
                "num_predict": 100,   # чуть больше запаса для qwen3
                "thinking": False,
            },
        }, timeout=20)

        if response.status_code == 200:
            raw_text = response.json().get("message", {}).get("content", "").strip()
            visible_text, thought = split_thinking(raw_text)
            cleaned = _clean(visible_text)
            if return_metadata:
                return {
                    "content": cleaned,
                    "thought": thought,
                    "raw_response": raw_text,
                    "model": MODEL,
                }
            return cleaned
        return None

    except Exception as e:
        print(f"[L0] ошибка: {e}")
        return None


if __name__ == "__main__":
    tests = [
        ("grinding",            {"active_min": 130, "apps": [{"app": "code.exe"}],    "hour": 2,  "mood": {"energy": 0.2, "focus": 0.8, "openness": 0.1}}),
        ("scattered",           {"active_min": 20,  "apps": [{"app": "firefox.exe"}], "hour": 21, "mood": {"energy": 0.6, "focus": 0.1, "openness": 0.5}}),
        ("late_night_grinding", {"active_min": 95,  "apps": [{"app": "code.exe"}],    "hour": 3,  "mood": {"energy": 0.1, "focus": 0.7, "openness": 0.2}}),
        ("late_night",          {"active_min": 10,  "apps": [],                        "hour": 2,  "mood": {"energy": 0.1, "focus": 0.3, "openness": 0.4}}),
        ("afk_return",          {"active_min": 0,   "apps": [],                        "hour": 14, "mood": {"energy": 0.7, "focus": 0.5, "openness": 0.8}}),
        ("first_start",         {"active_min": 0,   "apps": [],                        "hour": 10, "mood": {"energy": 0.5, "focus": 0.5, "openness": 0.5}}),
        ("idle_loop",           {"active_min": 30,  "apps": [{"app": "firefox.exe"}], "hour": 16, "mood": {"energy": 0.4, "focus": 0.2, "openness": 0.5}}),
    ]
    for trigger, ctx in tests:
        mood = ctx["mood"]
        print(f"[{trigger}] mood: e={mood['energy']} f={mood['focus']} o={mood['openness']}")
        print(f"EMIYA → {generate(trigger, ctx)}\n")
