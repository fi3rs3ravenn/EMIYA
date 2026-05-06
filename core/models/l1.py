from pathlib import Path

import requests

from models.response_utils import split_thinking, strip_speaker_prefix


MODEL = "qwen3:8b"
OLLAMA_URL = "http://localhost:11434/api/chat"
_prompt_file = Path(__file__).parent.parent / "prompts" / "l1.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")
BASE_OPTIONS = {
    "temperature": 0.8,
    "top_p": 0.9,
    "num_predict": 2000,
    "thinking": False,
}


def _build_system(context: dict | None) -> str:
    blocks = []

    if context and "mood" in context:
        try:
            from mood.modifiers import mood_from_mapping, mood_to_prompt_fragment

            mood_vec = mood_from_mapping(context["mood"])
            blocks.append(mood_to_prompt_fragment(mood_vec))
        except Exception as e:
            print(f"[L1] mood injection error: {e}")

    try:
        from personality.modifiers import traits_to_prompt_fragment
        from personality.traits import load_traits

        traits = context.get("traits") if context else None
        traits = traits or load_traits().to_dict()
        blocks.append(traits_to_prompt_fragment(traits))
    except Exception as e:
        print(f"[L1] traits injection error: {e}")

    if context and ("recent_memory" in context or "relevant_memory" in context):
        try:
            from memory.retriever import build_memory_prompt_blocks

            blocks.append(
                build_memory_prompt_blocks(
                    context.get("recent_memory", []),
                    context.get("relevant_memory", []),
                )
            )
        except Exception as e:
            print(f"[L1] memory injection error: {e}")

    system = "\n\n".join([*blocks, SYSTEM_PROMPT]) if blocks else SYSTEM_PROMPT

    if context:
        apps = context.get("apps", [])
        active_min = context.get("active_min", 0)
        states = context.get("states", [])
        top_app = apps[0]["app"].replace(".exe", "") if apps else "нет данных"

        system += "\nсейчас ты видишь:\n"
        system += f"- активен {int(active_min)} минут\n"
        system += f"- приложение: {top_app}\n"
        system += f"- состояние: {', '.join(states) if states else 'спокойное'}\n"

    return system


def _build_options(context: dict | None) -> dict:
    options = dict(BASE_OPTIONS)
    mood = context.get("mood") if context else None

    try:
        from mood.modifiers import mood_from_mapping, mood_to_model_options

        return mood_to_model_options(mood_from_mapping(mood), options)
    except Exception as e:
        print(f"[L1] mood options error: {e}")
        return options


def _clean(text: str) -> str:
    text = strip_speaker_prefix(text)
    text = text.lower()
    return text.replace("!", ".")


def chat(messages: list, context: dict = None, return_metadata: bool = False) -> str | dict | None:
    system = _build_system(context)
    options = _build_options(context)

    prompt_messages = []
    for msg in messages[-6:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        content = msg.get("content", "")
        prompt_messages.append({"role": role, "content": content})

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    *prompt_messages,
                ],
                "stream": False,
                "options": options,
            },
            timeout=90,
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
        print(f"[L1] error: {e}")
        return None


if __name__ == "__main__":
    ctx = {
        "active_min": 10,
        "apps": [{"app": "code.exe"}],
        "states": ["normal"],
        "mood": {"energy": 0.5, "focus": 0.6, "openness": 0.4},
    }
    print(chat([{"role": "user", "content": "ты здесь?"}], ctx))
