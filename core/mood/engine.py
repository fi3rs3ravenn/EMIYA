import asyncio
from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime

from mood.lorenz import LorenzAttractor, MoodVector, PRESETS


TRAIL_SIZE  = 500   # точки в ring buffer (для canvas)
TICK_RATE   = 1.0   # секунд между шагами (1 Hz)

# сколько шагов аттрактора за один тик
# больше → mood быстрее дрейфует
STEPS_PER_TICK = 10


@dataclass
class EngineState:
    energy:   float
    focus:    float
    openness: float
    x:        float
    y:        float
    z:        float
    raw_x:    float
    raw_y:    float
    raw_z:    float
    sigma:    float
    rho:      float
    beta:     float
    timestamp: str
    trail:    list[dict]    # последние TRAIL_SIZE точек {x, y, z}

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


class MoodEngine:
    def __init__(
        self,
        sigma: float = 10.0,
        rho:   float = 28.0,
        beta:  float = 8.0 / 3.0,
    ):
        self._attractor = LorenzAttractor(sigma=sigma, rho=rho, beta=beta)
        self._current: MoodVector = self._attractor.current()

        # ring buffer для trail
        self._trail: deque[dict] = deque(maxlen=TRAIL_SIZE)

        self._running = False
        self._task: asyncio.Task | None = None

    def get_current(self) -> MoodVector:
        return self._current

    def get_state(self) -> EngineState:
        now = self._timestamp()
        return EngineState(
            energy   = self._current.energy,
            focus    = self._current.focus,
            openness = self._current.openness,
            x        = self._current.raw_x,
            y        = self._current.raw_y,
            z        = self._current.raw_z,
            raw_x    = self._current.raw_x,
            raw_y    = self._current.raw_y,
            raw_z    = self._current.raw_z,
            sigma    = self._attractor.sigma,
            rho      = self._attractor.rho,
            beta     = self._attractor.beta,
            timestamp= now,
            trail    = list(self._trail),
        )

    def nudge(self, axis: str, delta: float) -> None:
        self._attractor.nudge(axis, delta)

    def set_params(
        self,
        sigma: float | None = None,
        rho:   float | None = None,
        beta:  float | None = None,
    ) -> None:
        self._attractor.set_params(sigma=sigma, rho=rho, beta=beta)

    def set_preset(self, name: str) -> bool:
        if name not in PRESETS:
            return False
        self._attractor.set_params(**PRESETS[name])
        return True
    async def run(self) -> None:
        self._running = True
        print(f"[MoodEngine] запущен · {STEPS_PER_TICK} шагов/тик · {TICK_RATE}s интервал")

        while self._running:
            self._tick()
            await asyncio.sleep(TICK_RATE)

    def stop(self) -> None:
        self._running = False

    def _tick(self) -> None:
        mood = None
        for _ in range(STEPS_PER_TICK):
            mood = self._attractor.step()

        if mood:
            self._current = mood
            self._trail.append({
                "x": round(mood.raw_x, 4),
                "y": round(mood.raw_y, 4),
                "z": round(mood.raw_z, 4),
                "energy": round(mood.energy, 4),
                "focus": round(mood.focus, 4),
                "openness": round(mood.openness, 4),
                "timestamp": self._timestamp(),
            })

    @staticmethod
    def _timestamp() -> str:
        return datetime.now().isoformat(timespec="milliseconds")

if __name__ == "__main__":
    import time

    async def demo():
        engine = MoodEngine()

        print("=== MoodEngine demo ===\n")
        print("запускаем run() как task, смотрим 5 тиков:\n")

        task = asyncio.create_task(engine.run())

        for i in range(5):
            await asyncio.sleep(1.1)
            mood = engine.get_current()
            state = engine.get_state()
            print(f"тик {i+1}: {mood}")
            print(f"  trail size: {len(state.trail)}")

        print("\nnudge('x', +3.0) — всплеск энергии:")
        engine.nudge("x", 3.0)
        await asyncio.sleep(1.1)
        print(f"  после nudge: {engine.get_current()}")

        print("\nпресет 'storm':")
        engine.set_preset("storm")
        for i in range(3):
            await asyncio.sleep(1.1)
            print(f"  тик {i+1}: {engine.get_current()}")

        print("\nпресет 'calm':")
        engine.set_preset("calm")
        for i in range(3):
            await asyncio.sleep(1.1)
            print(f"  тик {i+1}: {engine.get_current()}")

        engine.stop()
        task.cancel()
        print("\nдвижок остановлен.")

    asyncio.run(demo())
