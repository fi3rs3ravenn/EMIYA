from pathlib import Path

import requests

from models.response_utils import split_thinking, strip_speaker_prefix


MODEL = "qwen3:4b"
OLLAMA_URL = "http://localhost:11434/api/chat"

_prompt_file = Path(__file__).parent.parent / "prompts" / "l0.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")
BASE_OPTIONS = {
    "temperature": 0.85,
    "top_p": 0.9,
    "num_predict": 100,
    "thinking": False,
}


def _build_system(mood: dict | None, traits: dict | None = None) -> str:
    blocks = []

    if mood:
        try:
            from mood.modifiers import mood_from_mapping, mood_to_prompt_fragment

            blocks.append(mood_to_prompt_fragment(mood_from_mapping(mood)))
        except Exception as e:
            print(f"[L0] mood injection error: {e}")

    try:
        from personality.modifiers import traits_to_prompt_fragment
        from personality.traits import load_traits

        traits = traits or load_traits().to_dict()
        blocks.append(traits_to_prompt_fragment(traits))
    except Exception as e:
        print(f"[L0] traits injection error: {e}")

    return "\n\n".join([*blocks, SYSTEM_PROMPT]) if blocks else SYSTEM_PROMPT


def _build_options(mood: dict | None) -> dict:
    options = dict(BASE_OPTIONS)

    try:
        from mood.modifiers import mood_from_mapping, mood_to_model_options

        return mood_to_model_options(mood_from_mapping(mood), options)
    except Exception as e:
        print(f"[L0] mood options error: {e}")
        return options


def build_user_prompt(trigger: str, context: dict) -> str:
    active_min = context.get("active_min", 0)
    apps = context.get("apps", [])
    hour = context.get("hour", 0)
    top_app = apps[0]["app"].replace(".exe", "") if apps else "unknown"

    situations = {
        "grinding": f"пользователь работает уже {int(active_min)} минут без перерыва. приложение: {top_app}.",
        "late_night_grinding": f"сейчас {hour}:00 ночи. работает уже {int(active_min)} минут. приложение: {top_app}.",
        "scattered": f"хаотично переключается между приложениями уже {int(active_min)} минут.",
        "idle_loop": "ходит по кругу между одними и теми же окнами.",
        "late_night": f"сейчас {hour}:00 ночи. всё ещё за компьютером.",
        "afk_return": "вернулся после перерыва.",
        "first_start": "только что начал сессию.",
    }

    situation = situations.get(trigger, "наблюдает за пользователем.")
    return f"ситуация: {situation}\nскажи что-нибудь. одно-два предложения, не больше. /no_think"


def _clean(text: str) -> str:
    text = strip_speaker_prefix(text)
    text = text.lower().replace("!", ".")
    sentences = [sentence.strip() for sentence in text.split(".") if sentence.strip()]
    result = ". ".join(sentences[:2])
    if result and not result.endswith("."):
        result += "."
    return result


def generate(trigger: str, context: dict, return_metadata: bool = False) -> str | dict | None:
    mood = context.get("mood")
    traits = context.get("traits")
    system = _build_system(mood, traits)
    options = _build_options(mood)

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": build_user_prompt(trigger, context)},
                ],
                "stream": False,
                "options": options,
            },
            timeout=20,
        )

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
                    "mood_seed": options.get("seed"),
                    "system_prompt": system,
                }
            return cleaned
        return None

    except Exception as e:
        print(f"[L0] error: {e}")
        return None


if __name__ == "__main__":
    ctx = {
        "active_min": 0,
        "apps": [],
        "hour": 10,
        "mood": {"energy": 0.5, "focus": 0.5, "openness": 0.5},
    }
    print(generate("first_start", ctx))
