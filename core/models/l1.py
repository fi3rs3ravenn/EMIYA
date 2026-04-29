import requests
from pathlib import Path
from models.response_utils import split_thinking, strip_speaker_prefix

MODEL        = "qwen3:14b"
OLLAMA_URL   = "http://localhost:11434/api/chat"
_prompt_file = Path(__file__).parent.parent / "prompts" / "l1.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")


def _build_system(context: dict | None) -> str:
    system = SYSTEM_PROMPT

    if context and "mood" in context:
        try:
            from mood.modifiers import mood_to_prompt_fragment
            from mood.lorenz import MoodVector

            m = context["mood"]
            mood_vec = MoodVector(
                energy   = m.get("energy", 0.5),
                focus    = m.get("focus", 0.5),
                openness = m.get("openness", 0.5),
                raw_x=0, raw_y=0, raw_z=0,
            )
            mood_block = mood_to_prompt_fragment(mood_vec)
            system = mood_block + "\n\n" + system
        except Exception as e:
            print(f"[L1] mood injection ошибка: {e}")

    if context:
        apps       = context.get("apps", [])
        active_min = context.get("active_min", 0)
        states     = context.get("states", [])
        top_app    = apps[0]["app"].replace(".exe", "") if apps else "нет данных"

        system += "\nсейчас ты видишь:\n"
        system += f"- активен {int(active_min)} минут\n"
        system += f"- приложение: {top_app}\n"
        system += f"- состояние: {', '.join(states) if states else 'спокойное'}\n"

    return system


def _clean(text: str) -> str:
    text = strip_speaker_prefix(text)
    text = text.lower()
    text = text.replace("!", ".")
    return text


def chat(messages: list, context: dict = None, return_metadata: bool = False) -> str | dict | None:
    system = _build_system(context)

    prompt_messages = []
    for msg in messages[-6:]:
        role    = "user" if msg.get("role") == "user" else "assistant"
        content = msg.get("content", "")
        prompt_messages.append({"role": role, "content": content})


    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model":  MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    *prompt_messages
                ],
                "stream": False,
                "options": {
                    "temperature": 0.8,
                    "top_p":       0.9,
                    "num_predict": 2000,
                    "thinking": False
                }
            }, timeout=90)   # qwen3:14b может думать дольше

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
        print(f"[L1] ошибка: {e}")
        return None


if __name__ == "__main__":
    test_cases = [
        {
            "history": [{"role": "user", "content": "что думаешь о том что я так поздно работаю?"}],
            "ctx": {
                "active_min": 130,
                "apps": [{"app": "code.exe"}],
                "states": ["grinding", "late_night"],
                "mood": {"energy": 0.2, "focus": 0.8, "openness": 0.1},
            },
        },
        {
            "history": [{"role": "user", "content": "тебе не скучно?"}],
            "ctx": {
                "active_min": 45,
                "apps": [{"app": "firefox.exe"}],
                "states": ["normal"],
                "mood": {"energy": 0.7, "focus": 0.5, "openness": 0.8},
            },
        },
    ]

    for i, tc in enumerate(test_cases):
        print(f"--- тест {i+1} ---")
        mood = tc["ctx"]["mood"]
        print(f"mood: energy={mood['energy']} focus={mood['focus']} openness={mood['openness']}")
        print(f"[USER] {tc['history'][-1]['content']}")
        print(f"EMIYA → {chat(tc['history'], tc['ctx'])}\n")
