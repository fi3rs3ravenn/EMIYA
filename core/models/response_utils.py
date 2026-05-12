from html import unescape
import re


GENERATION_STOP_MARKERS = ("<|im_end|>", "<|eot_id|>", "<|end_of_text|>")

ARTIFACT_MARKERS = (
    *GENERATION_STOP_MARKERS,
    "|<im_end|>",
    "<im_end>",
    "|<im_end>",
    "<|im_end>",
    "```",
    "\nThis AI model",
    "\nThis model",
    "\ndef ",
    "\nBANNED_PHRASES",
)


def split_thinking(text: str) -> tuple[str, str | None]:
    raw = text.strip()
    lower = raw.lower()
    start = lower.find("<think>")
    end = lower.find("</think>")

    if start == -1 or end == -1 or end < start:
        return raw, None

    thought = raw[start + len("<think>"):end].strip()
    visible = (raw[:start] + raw[end + len("</think>"):]).strip()
    return visible, thought or None


def strip_speaker_prefix(text: str) -> str:
    cleaned = text.strip().strip('"').strip("'")
    if cleaned.lower().startswith("emiya:"):
        cleaned = cleaned[6:].strip()
    return cleaned


def strip_generation_artifacts(text: str) -> str:
    cleaned = unescape(text or "")
    stop_positions = [cleaned.find(marker) for marker in ARTIFACT_MARKERS if marker in cleaned]
    if stop_positions:
        cleaned = cleaned[:min(stop_positions)]
    for marker in ARTIFACT_MARKERS:
        cleaned = cleaned.replace(marker, "")
    return cleaned.strip()


def take_sentence_prefix(text: str, max_sentences: int = 2, fallback_terminal: str = ".") -> str:
    chunks = [chunk.strip() for chunk in re.findall(r"[^.!?\n]+[.!?]?", text.strip()) if chunk.strip()]
    result = " ".join(chunks[:max_sentences]).strip()
    if result and result[-1] not in ".!?":
        result += fallback_terminal
    return result
