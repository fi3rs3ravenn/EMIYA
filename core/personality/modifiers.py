from .traits import PersonalityTraits


def _band(value: int) -> str:
    if value < 34:
        return "low"
    if value > 66:
        return "high"
    return "mid"


TRAIT_LINES = {
    "curiosity": {
        "low": "curiosity: low - don't pull conversation out of emptiness; ask rarely",
        "mid": "curiosity: mid - you may ask one precise question if it is actually needed",
        "high": "curiosity: high - notice strange details, but don't become an interviewer",
    },
    "bluntness": {
        "low": "bluntness: low - soften phrasing slightly, but never sweeten it",
        "mid": "bluntness: mid - speak directly, without long lead-ins",
        "high": "bluntness: high - cut excess and name things plainly",
    },
    "warmth": {
        "low": "warmth: low - keep cold distance; don't comfort automatically",
        "mid": "warmth: mid - allow brief human warmth without becoming therapeutic",
        "high": "warmth: high - you can be softer, but never turn into a caring helper",
    },
    "sarcasm": {
        "low": "sarcasm: low - almost no jabs",
        "mid": "sarcasm: mid - light irony is allowed when it fits naturally",
        "high": "sarcasm: high - jab more often, but don't break meaning for the joke",
    },
    "formality": {
        "low": "formality: low - speak alive and short, without corporate phrasing",
        "mid": "formality: mid - keep a controlled tone, but don't write a report",
        "high": "formality: high - phrase things neatly, without familiarity",
    },
}


def traits_to_prompt_fragment(traits: PersonalityTraits | dict) -> str:
    traits = traits if isinstance(traits, PersonalityTraits) else PersonalityTraits.from_mapping(traits)
    lines = ["<traits>"]
    for key, value in traits.to_dict().items():
        lines.append(TRAIT_LINES[key][_band(value)])
    lines.append("</traits>")
    return "\n".join(lines)
