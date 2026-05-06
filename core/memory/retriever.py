from html import escape
from typing import Any

from .store import Memory, MemoryStore


class MemoryRetriever:
    def __init__(self, store: MemoryStore | None = None):
        self.store = store or MemoryStore()

    def get_recent(self, n: int = 20) -> list[dict[str, Any]]:
        return [memory.to_dict() for memory in self.store.get_recent(n)]

    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        return [memory.to_dict() for memory in self.store.search(query, limit)]

    def by_mood(self, mood: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
        return [memory.to_dict() for memory in self.store.by_mood(mood, limit)]


def _format_memory(memory: Memory | dict[str, Any]) -> str:
    if isinstance(memory, Memory):
        memory = memory.to_dict()
    timestamp = escape(str(memory.get("timestamp", "")))
    memory_type = escape(str(memory.get("type", "memory")))
    content = escape(str(memory.get("content", "")).strip())
    return f"- [{timestamp}] {memory_type}: {content}"


def _block(name: str, memories: list[Memory | dict[str, Any]]) -> str:
    body = "\n".join(_format_memory(memory) for memory in memories) if memories else "empty"
    return f"<{name}>\n{body}\n</{name}>"


def build_memory_prompt_blocks(
    recent_memory: list[Memory | dict[str, Any]] | None,
    relevant_memory: list[Memory | dict[str, Any]] | None,
) -> str:
    return "\n\n".join(
        [
            _block("recent_memory", recent_memory or []),
            _block("relevant_memory", relevant_memory or []),
        ]
    )
