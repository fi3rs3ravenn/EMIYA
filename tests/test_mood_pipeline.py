import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))

from models import l0, l1
from mood.engine import MoodEngine
from mood.modifiers import mood_from_mapping, mood_seed, mood_to_model_options


class FakeResponse:
    status_code = 200

    def json(self):
        return {"message": {"content": "тихо."}}


class MoodPipelineTests(unittest.TestCase):
    def test_mood_seed_is_stable_and_changes_with_mood(self):
        low = mood_from_mapping({"energy": 0.2, "focus": 0.8, "openness": 0.1})
        same_low = mood_from_mapping({"energy": 0.2, "focus": 0.8, "openness": 0.1})
        high = mood_from_mapping({"energy": 0.8, "focus": 0.2, "openness": 0.9})

        self.assertEqual(mood_seed(low), mood_seed(same_low))
        self.assertNotEqual(mood_seed(low), mood_seed(high))

    def test_mood_model_options_preserve_base_options_and_add_seed(self):
        mood = mood_from_mapping({"energy": 0.34, "focus": 0.81, "openness": 0.22})
        options = mood_to_model_options(mood, {"temperature": 0.8, "num_predict": 100})

        self.assertEqual(options["temperature"], 0.8)
        self.assertEqual(options["num_predict"], 100)
        self.assertEqual(options["seed"], mood_seed(mood))

    def test_l0_prompt_and_request_options_are_regenerated_from_current_mood(self):
        low_mood = {"energy": 0.2, "focus": 0.8, "openness": 0.1}
        high_mood = {"energy": 0.8, "focus": 0.2, "openness": 0.9}

        low_system = l0._build_system(low_mood)
        high_system = l0._build_system(high_mood)

        self.assertTrue(low_system.startswith("<mood>"))
        self.assertIn("energy: 0.20", low_system)
        self.assertIn("energy: 0.80", high_system)
        self.assertNotEqual(low_system, high_system)

        payloads = []

        def fake_post(url, json, timeout):
            payloads.append(json)
            return FakeResponse()

        with patch.object(l0.requests, "post", side_effect=fake_post):
            l0.generate("first_start", {"hour": 10, "apps": [], "mood": low_mood})
            l0.generate("first_start", {"hour": 10, "apps": [], "mood": high_mood})

        self.assertEqual(payloads[0]["options"]["seed"], mood_seed(mood_from_mapping(low_mood)))
        self.assertEqual(payloads[1]["options"]["seed"], mood_seed(mood_from_mapping(high_mood)))
        self.assertNotEqual(payloads[0]["options"]["seed"], payloads[1]["options"]["seed"])

    def test_l1_request_options_are_regenerated_from_current_mood(self):
        low_context = {
            "active_min": 10,
            "apps": [],
            "states": ["normal"],
            "mood": {"energy": 0.2, "focus": 0.8, "openness": 0.1},
        }
        high_context = {
            "active_min": 10,
            "apps": [],
            "states": ["normal"],
            "mood": {"energy": 0.8, "focus": 0.2, "openness": 0.9},
        }
        payloads = []

        def fake_post(url, json, timeout):
            payloads.append(json)
            return FakeResponse()

        with patch.object(l1.requests, "post", side_effect=fake_post):
            l1.chat([{"role": "user", "content": "ты здесь?"}], low_context)
            l1.chat([{"role": "user", "content": "ты здесь?"}], high_context)

        self.assertIn("energy: 0.20", payloads[0]["messages"][0]["content"])
        self.assertIn("energy: 0.80", payloads[1]["messages"][0]["content"])
        self.assertEqual(
            payloads[0]["options"]["seed"],
            mood_seed(mood_from_mapping(low_context["mood"])),
        )
        self.assertEqual(
            payloads[1]["options"]["seed"],
            mood_seed(mood_from_mapping(high_context["mood"])),
        )
        self.assertNotEqual(payloads[0]["options"]["seed"], payloads[1]["options"]["seed"])

    def test_mood_engine_logs_initial_and_interval_ticks(self):
        engine = MoodEngine(log_interval_ticks=2)

        with patch("builtins.print") as mocked_print:
            engine._tick()
            engine._tick()
            engine._tick()

        lines = [call.args[0] for call in mocked_print.call_args_list]
        self.assertEqual(len(lines), 2)
        self.assertTrue(all(line.startswith("[Mood] t=") for line in lines))
        self.assertIn("e=", lines[0])
        self.assertIn("params=", lines[0])


if __name__ == "__main__":
    unittest.main()
