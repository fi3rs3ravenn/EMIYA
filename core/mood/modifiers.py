from mood.lorenz import MoodVector

ENERGY_ZONES = {
    "low":  (
        "low",
        "ты сейчас вялая. слова короче обычного. реагируешь медленнее, без лишней инициативы."
    ),
    "mid":  (
        "mid",
        "обычный режим. темп и длина ответов стандартные."
    ),
    "high": (
        "high",
        "ты сейчас активная. можешь быть чуть острее и быстрее в реакциях."
    ),
}

FOCUS_ZONES = {
    "low":  (
        "low",
        "ты рассеяна. мысли скачут. можешь уйти в сторону или ответить короче обычного."
    ),
    "mid":  (
        "mid",
        "фокус нормальный. держишь нить разговора без усилий."
    ),
    "high": (
        "high",
        "ты сейчас сконцентрирована. не отвлекаешься на шутки, остаёшься по делу."
    ),
}

OPENNESS_ZONES = {
    "low":  (
        "low",
        "ты закрыта. отвечаешь по делу, без лишнего контекста. вопросы только если совсем нужно."
    ),
    "mid":  (
        "mid",
        "открытость нормальная. иногда добавляешь контекст если он уместен."
    ),
    "high": (
        "high",
        "ты сейчас открыта. готова делиться мыслями. допустимо чуть больше контекста и вопросов."
    ),
}


def _zone(val: float) -> str:
    if val < 0.33:
        return "low"
    elif val < 0.66:
        return "mid"
    else:
        return "high"


def mood_to_prompt_fragment(mood: MoodVector) -> str:
    e_zone = _zone(mood.energy)
    f_zone = _zone(mood.focus)
    o_zone = _zone(mood.openness)

    e_label, e_instr = ENERGY_ZONES[e_zone]
    f_label, f_instr = FOCUS_ZONES[f_zone]
    o_label, o_instr = OPENNESS_ZONES[o_zone]

    lines = [
        "<mood>",
        f"energy: {mood.energy:.2f} ({e_label} — {e_instr})",
        f"focus: {mood.focus:.2f} ({f_label} — {f_instr})",
        f"openness: {mood.openness:.2f} ({o_label} — {o_instr})",
        "</mood>",
    ]
    return "\n".join(lines)


def inject_mood(system_prompt: str, mood: MoodVector) -> str:
    """
    Вставляет mood-блок в самое начало системного промпта.
    Каждый вызов генерирует свежий блок.
    """
    fragment = mood_to_prompt_fragment(mood)
    return fragment + "\n\n" + system_prompt

if __name__ == "__main__":
    from mood.lorenz import MoodVector

    test_cases = [
        MoodVector(energy=0.1, focus=0.8, openness=0.2,
                   raw_x=0, raw_y=0, raw_z=0),   # вялая, собранная, закрытая
        MoodVector(energy=0.9, focus=0.5, openness=0.9,
                   raw_x=0, raw_y=0, raw_z=0),   # активная, нормальный фокус, открытая
        MoodVector(energy=0.5, focus=0.1, openness=0.5,
                   raw_x=0, raw_y=0, raw_z=0),   # нормальная, рассеяная
        MoodVector(energy=0.7, focus=0.7, openness=0.7,
                   raw_x=0, raw_y=0, raw_z=0),   # всё high
    ]

    sample_prompt = "ты — emiya. наблюдатель. говоришь строчными."

    for i, mood in enumerate(test_cases):
        print(f"\n{'='*55}")
        print(f"тест {i+1}: energy={mood.energy} focus={mood.focus} openness={mood.openness}")
        print(f"{'='*55}")
        print(inject_mood(sample_prompt, mood))