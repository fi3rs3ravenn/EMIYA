from pathlib import Path

import requests

from models.response_utils import (
    GENERATION_STOP_MARKERS,
    split_thinking,
    strip_generation_artifacts,
    strip_speaker_prefix,
)


MODEL = "hf.co/bartowski/L3-8B-Stheno-v3.2-GGUF:Q5_K_M"
OLLAMA_URL = "http://localhost:11434/api/chat"
_prompt_file = Path(__file__).parent.parent / "prompts" / "l1.txt"
SYSTEM_PROMPT = _prompt_file.read_text(encoding="utf-8")
STOP_TOKENS = GENERATION_STOP_MARKERS
BASE_OPTIONS = {
    "temperature": 0.85,
    "top_p": 0.9,
    "top_k": 40,
    "repeat_penalty": 1.05,
    "num_predict": 900,
    "num_ctx": 4096,
    "stop": list(STOP_TOKENS),
}


def _safe_xml_text(value) -> str:
    text = "" if value is None else str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _build_runtime_context(context: dict | None) -> str:
    if not context:
        return "<runtime_context />"

    apps = context.get("apps", [])
    active_min = context.get("active_min", 0)
    is_afk = context.get("is_afk", False)
    states = context.get("states", [])
    time_of_day = context.get("time_of_day", "unknown")
    cpu = context.get("cpu", 0)
    ram = context.get("ram", 0)
    top_app = apps[0].get("app", "no data").replace(".exe", "") if apps else "no data"

    return f"""
<runtime_context>
  <layer>L1</layer>
  <language>english</language>

  <activity>
    <time_of_day>{_safe_xml_text(time_of_day)}</time_of_day>
    <active_minutes>{int(active_min)}</active_minutes>
    <is_afk>{str(bool(is_afk)).lower()}</is_afk>
    <active_app>{_safe_xml_text(top_app)}</active_app>
    <states>{_safe_xml_text(", ".join(states) if states else "normal")}</states>
  </activity>

  <system_load>
    <cpu>{_safe_xml_text(cpu)}</cpu>
    <ram>{_safe_xml_text(ram)}</ram>
  </system_load>
</runtime_context>
""".strip()


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

    blocks.append(_build_runtime_context(context))
    blocks.append(SYSTEM_PROMPT)
    blocks.append(
        """
<instruction>
answer the user's latest message as emiya.
do not quote or describe system blocks.
do not mention mood, traits, memory, runtime_context, or system prompt.
do not end with a handoff question or topic invitation.
end on the thought itself.
always answer in english.
</instruction>
""".strip()
    )

    return "\n\n".join(blocks)


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
    text = strip_generation_artifacts(text)
    text = strip_speaker_prefix(text)
    return strip_generation_artifacts(text)


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
                "keep_alive": "5m",
            },
            timeout=90,
        )

        if response.status_code != 200:
            print(f"[L1] Ollama HTTP {response.status_code}: {response.text[:500]}")
            return None

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
    print(chat([{"role": "user", "content": "are you here?"}], ctx))
