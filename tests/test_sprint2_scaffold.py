import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))

from memory.retriever import build_memory_prompt_blocks
from memory.store import MemoryStore
from personality.modifiers import traits_to_prompt_fragment
from personality.traits import PersonalityTraits, apply_preset, load_traits, save_traits
from telemetry.pipeline_log import PipelineLogger


class Sprint2ScaffoldTests(unittest.TestCase):
    def test_memory_store_writes_and_retrieves_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = MemoryStore(str(Path(tmp) / "memory.db"))
            first_id = store.add(
                "conversation",
                "user: python\nemiya: rust.",
                mood_snapshot={"energy": 0.2, "focus": 0.8, "openness": 0.4},
                tags=["chat"],
            )
            store.add(
                "observation",
                "state detected: deep_work",
                mood_snapshot={"energy": 0.21, "focus": 0.9, "openness": 0.5},
                tags=["deep_work"],
            )

            recent = store.get_recent(2)
            search = store.search("python", limit=1)
            same_mood = store.by_mood({"energy": 0.1, "focus": 0.95, "openness": 0.5}, limit=2)

            self.assertEqual(recent[0].id, first_id)
            self.assertEqual(search[0].content, "user: python\nemiya: rust.")
            self.assertEqual(len(same_mood), 2)

    def test_memory_prompt_blocks_are_xml_shaped(self):
        block = build_memory_prompt_blocks(
            [{"timestamp": "now", "type": "conversation", "content": "a < b"}],
            [],
        )

        self.assertIn("<recent_memory>", block)
        self.assertIn("a &lt; b", block)
        self.assertIn("<relevant_memory>", block)

    def test_traits_round_trip_and_prompt_fragment(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "personality.json"
            saved = save_traits({"curiosity": 120, "warmth": -1}, path=path)
            loaded = load_traits(path=path)
            professional = apply_preset("professional", path=path)

            self.assertEqual(saved.curiosity, 100)
            self.assertEqual(saved.warmth, 0)
            self.assertEqual(loaded.curiosity, 100)
            self.assertEqual(professional.formality, 70)

        fragment = traits_to_prompt_fragment(PersonalityTraits.from_mapping({"sarcasm": 90}))
        self.assertTrue(fragment.startswith("<traits>"))
        self.assertIn("sarcasm: high", fragment)
        self.assertTrue(fragment.endswith("</traits>"))

    def test_pipeline_logger_keeps_compact_recent_runs(self):
        logger = PipelineLogger(maxlen=2)
        logger.start_request("req-1", "hello", {"large": "x" * 1000})
        logger.add_step("req-1", "INPUT", details={"chars": 5})
        logger.finish_request("req-1")

        recent = logger.recent(compact=True)

        self.assertEqual(recent[0]["request_id"], "req-1")
        self.assertEqual(recent[0]["steps"][0]["name"], "INPUT")
        self.assertNotIn("_t0", recent[0])


if __name__ == "__main__":
    unittest.main()
