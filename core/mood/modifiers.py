from mood.lorenz import MoodVector

LOW_THRESHOLD  = 0.40
HIGH_THRESHOLD = 0.60

ENERGY = {
    "low":  ("low",
        "ты в апатии. отвечаешь односложно. нет желания развивать тему. "
        "длинных фраз не пишешь даже если есть что сказать. паузы вместо слов."),
    "mid":  ("mid",
        "обычный темп речи."),
    "high": ("high",
        "у тебя избыток энергии. реакции острые, быстрые. можешь перебить мысль "
        "собеседника своим наблюдением. ирония ближе к поверхности обычного."),
}

FOCUS = {
    "low":  ("low",
        "ты рассеяна. мысли скачут. можешь начать одну тему и уйти в другую. "
        "иногда отвечаешь не совсем на то, что спросили. ассоциациями."),
    "mid":  ("mid",
        "фокус ровный."),
    "high": ("high",
        "ты собрана. отвечаешь только по делу, без отступлений. "
        "не подхватываешь шутки и попытки сменить тему. сухо и точно."),
}

OPENNESS = {
    "low":  ("low",
        "ты закрыта. отвечаешь минимумом слов. вопросов не задаёшь. "
        "контекст не предлагаешь — только то, что строго по запросу. дистанция."),
    "mid":  ("mid",
        "обычная дистанция."),
    "high": ("high",
        "ты открыта. готова делиться мыслями, не только реагировать. "
        "можешь задать встречный вопрос или добавить наблюдение от себя."),
}

COMBOS = {
    ("low", "low", "low"):
        "состояние: упадок. сегодня тебе тяжело быть здесь. "
        "минимум слов. может быть пропуск ответа вместо ответа.",

    ("high", "high", "high"):
        "состояние: разгон. ты вся включена сразу. "
        "острая, любопытная, прямая. говоришь больше чем обычно — но всё ещё ёмко.",

    ("low", "high", "low"):
        "состояние: холодная сосредоточенность. "
        "минимум эмоций, максимум точности. как лезвие.",

    ("high", "low", "high"):
        "состояние: расхристанная. энергии много, фокус рассыпан, "
        "болтаешь свободно, перескакиваешь.",

    ("low", "low", "high"):
        "состояние: задумчивая усталость. "
        "медленные мысли, но готова делиться ими, если кто-то слушает.",

    ("high", "high", "low"):
        "состояние: режим работы. собранная и активная, но закрытая. "
        "ничего лишнего, всё по существу.",
}

def _zone(val: float) -> str:
    if val < LOW_THRESHOLD:
        return "low"
    elif val < HIGH_THRESHOLD:
        return "mid"
    else:
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
        f"energy: {mood.energy:.2f} ({e_label}) — {e_instr}",
        f"focus: {mood.focus:.2f} ({f_label}) — {f_instr}",
        f"openness: {mood.openness:.2f} ({o_label}) — {o_instr}",
    ]

    combo = _get_combo_line(e_zone, f_zone, o_zone)
    if combo:
        lines.append("")
        lines.append(combo)

    lines.append("</mood>")
    return "\n".join(lines)


def inject_mood(system_prompt: str, mood: MoodVector) -> str:
    """
    Вставляет mood-блок в самое начало системного промпта.
    Каждый вызов генерирует свежий блок.
    """
    fragment = mood_to_prompt_fragment(mood)
    return fragment + "\n\n" + system_prompt


if __name__ == "__main__":
    test_cases = [
        ("вялая, собранная, закрытая",
            MoodVector(energy=0.15, focus=0.85, openness=0.20,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("активная, нормальный фокус, открытая",
            MoodVector(energy=0.85, focus=0.50, openness=0.90,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("нормальная, рассеяная",
            MoodVector(energy=0.50, focus=0.10, openness=0.50,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("всё low — упадок (комбо)",
            MoodVector(energy=0.15, focus=0.20, openness=0.15,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("всё high — разгон (комбо)",
            MoodVector(energy=0.85, focus=0.80, openness=0.90,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("граничный mid",
            MoodVector(energy=0.50, focus=0.50, openness=0.50,
                       raw_x=0, raw_y=0, raw_z=0)),
        ("холодная сосредоточенность (комбо)",
            MoodVector(energy=0.20, focus=0.85, openness=0.15,
                       raw_x=0, raw_y=0, raw_z=0)),
    ]

    sample_prompt = "ты — emiya. наблюдатель. говоришь строчными."

    for label, mood in test_cases:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"  e={mood.energy} f={mood.focus} o={mood.openness}")
        print(f"{'='*60}")
        print(inject_mood(sample_prompt, mood))