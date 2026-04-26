from collections import deque
from dataclasses import dataclass

DEFAULT_SIGMA = 10.0
DEFAULT_RHO   = 28.0
DEFAULT_BETA  = 8.0 / 3.0

DEFAULT_DT    = 0.01
HISTORY_SIZE  = 1000

@dataclass
class MoodVector:
    energy:   float   # [0, 1]
    focus:    float   # [0, 1]
    openness: float   # [0, 1]
    raw_x:    float   # сырые координаты аттрактора
    raw_y:    float
    raw_z:    float

    def __repr__(self):
        return (
            f"MoodVector("
            f"energy={self.energy:.3f}, "
            f"focus={self.focus:.3f}, "
            f"openness={self.openness:.3f})"
        )

class LorenzAttractor:
    def __init__(
        self,
        sigma: float = DEFAULT_SIGMA,
        rho:   float = DEFAULT_RHO,
        beta:  float = DEFAULT_BETA,
        dt:    float = DEFAULT_DT,
        x0: float = 0.1, y0: float = 0.0, z0: float = 0.0,
    ):
        self.sigma = sigma
        self.rho   = rho
        self.beta  = beta
        self.dt    = dt

        self.x = x0
        self.y = y0
        self.z = z0

        self._hist_x: deque[float] = deque(maxlen=HISTORY_SIZE)
        self._hist_y: deque[float] = deque(maxlen=HISTORY_SIZE)
        self._hist_z: deque[float] = deque(maxlen=HISTORY_SIZE)
        self._warmup(200)

    def _derivatives(self, x: float, y: float, z: float):
        dx = self.sigma * (y - x)
        dy = x * (self.rho - z) - y
        dz = x * y - self.beta * z
        return dx, dy, dz

    def step(self, dt: float | None = None) -> MoodVector:
        """
        Один шаг интегрирования RK4.
        Возвращает MoodVector с нормализованными [0,1] значениями.
        """
        h = dt if dt is not None else self.dt
        x, y, z = self.x, self.y, self.z

        k1x, k1y, k1z = self._derivatives(x, y, z)
        k2x, k2y, k2z = self._derivatives(
            x + h/2 * k1x,
            y + h/2 * k1y,
            z + h/2 * k1z,
        )
        k3x, k3y, k3z = self._derivatives(
            x + h/2 * k2x,
            y + h/2 * k2y,
            z + h/2 * k2z,
        )
        k4x, k4y, k4z = self._derivatives(
            x + h * k3x,
            y + h * k3y,
            z + h * k3z,
        )

        self.x += h/6 * (k1x + 2*k2x + 2*k3x + k4x)
        self.y += h/6 * (k1y + 2*k2y + 2*k3y + k4y)
        self.z += h/6 * (k1z + 2*k2z + 2*k3z + k4z)

        self._hist_x.append(self.x)
        self._hist_y.append(self.y)
        self._hist_z.append(self.z)

        return self._to_mood()

    def _normalize(self, val: float, hist: deque) -> float:
        if len(hist) < 2:
            return 0.5
        lo, hi = min(hist), max(hist)
        if hi == lo:
            return 0.5
        return max(0.0, min(1.0, (val - lo) / (hi - lo)))

    def _to_mood(self) -> MoodVector:
        return MoodVector(
            energy   = self._normalize(self.x, self._hist_x),
            focus    = self._normalize(self.y, self._hist_y),
            openness = self._normalize(self.z, self._hist_z),
            raw_x    = self.x,
            raw_y    = self.y,
            raw_z    = self.z,
        )

    def nudge(self, axis: str, delta: float) -> None:
        if axis == "x":
            self.x += delta
        elif axis == "y":
            self.y += delta
        elif axis == "z":
            self.z += delta

    def _warmup(self, steps: int) -> None:
        for _ in range(steps):
            self.step()

    def current(self) -> MoodVector:
        return self._to_mood()

    def set_params(
        self,
        sigma: float | None = None,
        rho:   float | None = None,
        beta:  float | None = None,
    ) -> None:
        if sigma is not None:
            self.sigma = float(sigma)
        if rho is not None:
            self.rho = float(rho)
        if beta is not None:
            self.beta = float(beta)


PRESETS = {
    "calm":         {"sigma": 4.0,  "rho": 20.0, "beta": 8/3},
    "standard":     {"sigma": 10.0, "rho": 28.0, "beta": 8/3},
    "edge_of_chaos":{"sigma": 13.0, "rho": 35.0, "beta": 8/3},
    "storm":        {"sigma": 16.0, "rho": 45.0, "beta": 8/3},
}


if __name__ == "__main__":
    import time

    print("=== LorenzAttractor test ===\n")

    att = LorenzAttractor()

    print("прогон 20 шагов:")
    for i in range(20):
        mood = att.step()
        print(f"  step {i+1:02d}: {mood}")

    print("\nnudge x +3.0:")
    att.nudge("x", 3.0)
    for i in range(5):
        mood = att.step()
        print(f"  step {i+1:02d}: {mood}")

    print("\nсмена на пресет 'storm':")
    att.set_params(**PRESETS["storm"])
    for i in range(5):
        mood = att.step()
        print(f"  step {i+1:02d}: {mood}")

    print("\nдетерминизм — два аттрактора с одним seed должны давать одинаковый результат:")
    a1 = LorenzAttractor(x0=1.0, y0=0.5, z0=0.5)
    a2 = LorenzAttractor(x0=1.0, y0=0.5, z0=0.5)
    for _ in range(50):
        a1.step()
        a2.step()
    m1, m2 = a1.current(), a2.current()
    print(f"  a1: {m1}")
    print(f"  a2: {m2}")
    match = abs(m1.energy - m2.energy) < 1e-9
    print(f"  детерминизм: {'✓' if match else '✗ ОШИБКА'}")