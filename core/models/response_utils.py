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
