import requests
from pathlib import Path

OLLAMA_URL   = "http://localhost:11434/api/generate"
MODEL        = "qwen2.5:14b"
_prompt_file = Path(__file__).parent.parent / "prompts" / "l1.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")

def chat(messages: list, context: dict = None) -> str | None:
    system = SYSTEM_PROMPT
    if context:
        apps       = context.get("apps", [])
        active_min = context.get("active_min", 0)
        states     = context.get("states", [])
        top_app    = apps[0]["app"].replace(".exe", "") if apps else "нет данных"
        system += f"\nсейчас ты видишь:\n"
        system += f"- активен {int(active_min)} минут\n"
        system += f"- приложение: {top_app}\n"
        system += f"- состояние: {', '.join(states) if states else 'спокойное'}\n"

    prompt_messages = []
    for msg in messages[-6:]:
        role    = "user" if msg.get("role") == "user" else "assistant"
        content = msg.get("content", "")
        prompt_messages.append({"role": role, "content": content})

    try:
        response = requests.post(
            "http://localhost:11434/api/chat",
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
                    "num_predict": 150,
                }
            }, timeout=30)

        if response.status_code == 200:
            text = response.json().get("message", {}).get("content", "").strip()
            text = text.strip('"').strip("'")
            text = text.lower()
            text = text.replace("!", ".")
            if text.startswith("emiya:"):
                text = text[6:].strip()
            return text
        return None

    except Exception as e:
        print(f"[L1] ошибка: {e}")
        return None

if __name__ == "__main__":
    test_cases = [
        {
            "history": [{"role": "user", "content": "что думаешь о том что я так поздно работаю?"}],
            "ctx": {"active_min": 130, "apps": [{"app": "code.exe"}], "states": ["grinding", "late_night"]},
        },
        {
            "history": [{"role": "user", "content": "тебе не скучно?"}],
            "ctx": {"active_min": 45, "apps": [{"app": "firefox.exe"}], "states": ["normal"]},
        },
        {
            "history": [
                {"role": "user", "content": "я устал"},
                {"role": "assistant", "content": "заметно. давно или только сейчас."},
                {"role": "user", "content": "давно уже. не могу остановиться"},
            ],
            "ctx": {"active_min": 200, "apps": [{"app": "code.exe"}], "states": ["grinding"]},
        },
        {
            "history": [{"role": "user", "content": "расскажи о себе"}],
            "ctx": {"active_min": 5, "apps": [], "states": ["normal"]},
        },
    ]

    for i, tc in enumerate(test_cases):
        print(f"--- тест {i+1} ---")
        print(f"[USER] {tc['history'][-1]['content']}")
        print(f"EMIYA → {chat(tc['history'], tc['ctx'])}\n")