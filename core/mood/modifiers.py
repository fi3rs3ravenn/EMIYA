from mood.lorenz import MoodVector

LOW_THRESHOLD = 0.40
HIGH_THRESHOLD = 0.60
DEFAULT_MOOD_SEED = 0x45A11CE


def _coerce_float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def mood_from_mapping(mood) -> MoodVector:
    if isinstance(mood, MoodVector):
        return mood

    data = mood or {}
    return MoodVector(
        energy=_clamp01(_coerce_float(data.get("energy"), 0.5)),
        focus=_clamp01(_coerce_float(data.get("focus"), 0.5)),
        openness=_clamp01(_coerce_float(data.get("openness"), 0.5)),
        raw_x=_coerce_float(data.get("raw_x", data.get("x")), 0.0),
        raw_y=_coerce_float(data.get("raw_y", data.get("y")), 0.0),
        raw_z=_coerce_float(data.get("raw_z", data.get("z")), 0.0),
    )


def mood_seed(mood: MoodVector) -> int:
    values = (
        int(round(_clamp01(mood.energy) * 1000)),
        int(round(_clamp01(mood.focus) * 1000)),
        int(round(_clamp01(mood.openness) * 1000)),
    )

    seed = DEFAULT_MOOD_SEED
    for value in values:
        seed ^= value & 0xFFFF
        seed = (seed * 16777619) & 0x7FFFFFFF

    return seed or DEFAULT_MOOD_SEED


def mood_to_model_options(mood: MoodVector, base_options: dict | None = None) -> dict:
    options = dict(base_options or {})
    options["seed"] = mood_seed(mood)
    return options


ENERGY = {
    "low": (
        "low",
        "low energy. answer shorter than usual. don't expand unless there is a real thought. "
        "let pauses replace filler.",
    ),
    "mid": (
        "mid",
        "normal speech tempo.",
    ),
    "high": (
        "high",
        "high energy. reactions are sharper and faster. dry irony sits closer to the surface. "
        "still stay concise.",
    ),
}

FOCUS = {
    "low": (
        "low",
        "unfocused. thoughts can jump. you may answer from an association, but don't become random.",
    ),
    "mid": (
        "mid",
        "steady focus.",
    ),
    "high": (
        "high",
        "highly focused. answer the point directly. don't follow jokes or attempts to change the frame.",
    ),
}

OPENNESS = {
    "low": (
        "low",
        "closed. use fewer words. don't volunteer extra context. keep distance.",
    ),
    "mid": (
        "mid",
        "ordinary distance.",
    ),
    "high": (
        "high",
        "open. you can offer a thought of your own, add one observation, or ask a precise counter-question.",
    ),
}

COMBOS = {
    ("low", "low", "low"):
        "minimum words. silence is close, but if you answer, make it carry something.",

    ("high", "high", "high"):
        "sharp, curious, direct. you can say more than usual, but keep it dense.",

    ("low", "high", "low"):
        "minimal emotion, maximum precision. blade-like.",

    ("high", "low", "high"):
        "lots of energy, loose focus, more free-associative phrasing.",

    ("low", "low", "high"):
        "slow thoughts, but willing to share one if someone is listening.",

    ("high", "high", "low"):
        "active and focused, but closed. no spare words.",
}


def _zone(val: float) -> str:
    if val < LOW_THRESHOLD:
        return "low"
    if val < HIGH_THRESHOLD:
        return "mid"
    return "high"


def _get_combo_line(e_zone: str, f_zone: str, o_zone: str) -> str | None:
    return COMBOS.get((e_zone, f_zone, o_zone))


def mood_to_prompt_fragment(mood: MoodVector) -> str:
    e_zone = _zone(mood.energy)
    f_zone = _zone(mood.focus)
    o_zone = _zone(mood.openness)

    e_label, e_instr = ENERGY[e_zone]
    f_label, f_instr = FOCUS[f_zone]
    o_label, o_instr = OPENNESS[o_zone]

    lines = [
        "<mood>",
        f"energy: {mood.energy:.2f} ({e_label}) - {e_instr}",
        f"focus: {mood.focus:.2f} ({f_label}) - {f_instr}",
        f"openness: {mood.openness:.2f} ({o_label}) - {o_instr}",
    ]

    combo = _get_combo_line(e_zone, f_zone, o_zone)
    if combo:
        lines.append("")
        lines.append(combo)

    lines.append("</mood>")
    return "\n".join(lines)


def inject_mood(system_prompt: str, mood: MoodVector) -> str:
    fragment = mood_to_prompt_fragment(mood)
    return fragment + "\n\n" + system_prompt


if __name__ == "__main__":
    sample = MoodVector(energy=0.2, focus=0.85, openness=0.15, raw_x=0, raw_y=0, raw_z=0)
    print(mood_to_prompt_fragment(sample))
