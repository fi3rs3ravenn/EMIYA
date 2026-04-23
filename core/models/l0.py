import requests
from pathlib import Path

OLLAMA_URL   = "http://localhost:11434/api/generate"
MODEL        = "qwen2.5:7b"
_prompt_file = Path(__file__).parent.parent / "prompts" / "l0.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")

def build_prompt(trigger: str, context: dict) -> str:
    active_min  = context.get("active_min", 0)
    apps        = context.get("apps", [])
    hour        = context.get("hour", 0)
    top_app     = apps[0]["app"].replace(".exe", "") if apps else "unknown"

    situations = {
        "grinding":            f"пользователь работает уже {int(active_min)} минут без перерыва. приложение: {top_app}.",
        "late_night_grinding": f"сейчас {hour}:00 ночи. работает уже {int(active_min)} минут. приложение: {top_app}.",
        "scattered":           f"хаотично переключается между приложениями уже {int(active_min)} минут.",
        "idle_loop":           f"ходит по кругу между одними и теми же окнами.",
        "late_night":          f"сейчас {hour}:00 ночи. всё ещё за компьютером.",
        "afk_return":          f"вернулся после перерыва.",
        "first_start":         f"только что начал сессию.",
    }

    situation = situations.get(trigger, f"наблюдает за пользователем.")
    return f"ситуация: {situation}\nскажи что-нибудь. одно-два предложения, не больше."

def generate(trigger: str, context: dict) -> str | None:
    try:
        response = requests.post(OLLAMA_URL, json={
            "model":  MODEL,
            "prompt": build_prompt(trigger, context),
            "system": SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.85,
                "top_p":       0.9,
                "num_predict": 50,
            }
        }, timeout=15)

        if response.status_code == 200:
            text = response.json().get("response", "").strip()
            text = text.strip('"').strip("'")
            if text.lower().startswith("emiya:"):
                text = text[6:].strip()
            text = text.lower()
            text = text.replace("!", ".")
            sentences = [s.strip() for s in text.split(".") if s.strip()]
            result = ". ".join(sentences[:2])
            if result and not result.endswith("."):
                result += "."
            return result
        return None

    except Exception as e:
        print(f"[L0] ошибка: {e}")
        return None

if __name__ == "__main__":
    tests = [
        ("grinding",            {"active_min": 130, "apps": [{"app": "code.exe"}], "hour": 2}),
        ("scattered",           {"active_min": 20,  "apps": [{"app": "firefox.exe"}], "hour": 21}),
        ("late_night_grinding", {"active_min": 95,  "apps": [{"app": "code.exe"}], "hour": 3}),
        ("late_night",          {"active_min": 10,  "apps": [], "hour": 2}),
        ("afk_return",          {"active_min": 0,   "apps": [], "hour": 14}),
        ("first_start",         {"active_min": 0,   "apps": [], "hour": 10}),
        ("idle_loop",           {"active_min": 30,  "apps": [{"app": "firefox.exe"}], "hour": 16}),
    ]
    for trigger, ctx in tests:
        print(f"[{trigger}]")
        print(f"EMIYA → {generate(trigger, ctx)}\n")