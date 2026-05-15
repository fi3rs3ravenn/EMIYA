STATE_HINTS = {
    "afk": "he has been away from the computer.",
    "deep_work": "he has stayed with one task for a while.",
    "gaming": "a game is active.",
    "grinding": "he has been working for a long stretch without a real break.",
    "idle_loop": "he keeps circling the same windows.",
    "late_night": "it is late and he is still at the computer.",
    "normal": "nothing unusual in the activity pattern.",
    "scattered": "he keeps switching windows; no settled focus.",
}

STATE_PRIORITY = (
    "afk",
    "late_night",
    "grinding",
    "deep_work",
    "scattered",
    "idle_loop",
    "gaming",
    "normal",
)


def states_to_activity_hints(states: set[str] | list[str] | tuple[str, ...] | None) -> list[str]:
    states = set(states or [])
    if not states:
        states = {"normal"}

    hints = [
        STATE_HINTS[state]
        for state in STATE_PRIORITY
        if state in states and state in STATE_HINTS
    ]
    return hints or [STATE_HINTS["normal"]]
