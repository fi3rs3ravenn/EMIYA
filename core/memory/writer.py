from typing import Any

from .store import MemoryStore


class MemoryWriter:
    def __init__(self, store: MemoryStore | None = None):
        self.store = store or MemoryStore()

    def write_conversation(
        self,
        user_text: str,
        assistant_text: str,
        mood_snapshot: dict[str, Any] | None = None,
        importance: float = 0.5,
        tags: list[str] | None = None,
    ) -> int:
        content = f"user: {user_text.strip()}\nemiya: {assistant_text.strip()}"
        return self.store.add(
            "conversation",
            content,
            mood_snapshot=mood_snapshot,
            importance=importance,
            tags=["chat", *(tags or [])],
        )

    def write_observation(
        self,
        content: str,
        mood_snapshot: dict[str, Any] | None = None,
        importance: float = 0.35,
        tags: list[str] | None = None,
    ) -> int:
        return self.store.add(
            "observation",
            content,
            mood_snapshot=mood_snapshot,
            importance=importance,
            tags=["monitor", *(tags or [])],
        )

    def write_trigger_event(
        self,
        trigger: str,
        message: str,
        mood_snapshot: dict[str, Any] | None = None,
        importance: float = 0.6,
    ) -> int:
        content = f"trigger: {trigger.strip()}\nemiya: {message.strip()}"
        return self.store.add(
            "trigger_event",
            content,
            mood_snapshot=mood_snapshot,
            importance=importance,
            tags=["l0", trigger],
        )
