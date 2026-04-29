import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))

from mood.lorenz import LorenzAttractor, PRESETS


class LorenzAttractorTests(unittest.TestCase):
    def test_same_initial_state_is_deterministic(self):
        first = LorenzAttractor(x0=1.0, y0=0.5, z0=0.5)
        second = LorenzAttractor(x0=1.0, y0=0.5, z0=0.5)

        for _ in range(1500):
            first_mood = first.step()
            second_mood = second.step()

        first_values = (
            first_mood.energy,
            first_mood.focus,
            first_mood.openness,
            first_mood.raw_x,
            first_mood.raw_y,
            first_mood.raw_z,
        )
        second_values = (
            second_mood.energy,
            second_mood.focus,
            second_mood.openness,
            second_mood.raw_x,
            second_mood.raw_y,
            second_mood.raw_z,
        )

        for a, b in zip(first_values, second_values):
            self.assertAlmostEqual(a, b, places=12)

    def test_calm_preset_converges_to_stable_behavior(self):
        attractor = LorenzAttractor(**PRESETS["calm"])
        tail = []

        for step in range(5000):
            mood = attractor.step()
            self.assertGreaterEqual(mood.energy, 0.0)
            self.assertLessEqual(mood.energy, 1.0)
            self.assertGreaterEqual(mood.focus, 0.0)
            self.assertLessEqual(mood.focus, 1.0)
            self.assertGreaterEqual(mood.openness, 0.0)
            self.assertLessEqual(mood.openness, 1.0)
            if step >= 4500:
                tail.append((mood.raw_x, mood.raw_y, mood.raw_z))

        spans = [
            max(point[axis] for point in tail) - min(point[axis] for point in tail)
            for axis in range(3)
        ]

        for span in spans:
            self.assertLess(span, 1e-3)


if __name__ == "__main__":
    unittest.main()
