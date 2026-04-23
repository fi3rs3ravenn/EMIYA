import psutil
import time

class SystemTracker:
    def __init__(self, interval=30):
        self.interval = interval
        self.running = False

    def get_snapshot(self):
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        top = sorted(
            [p.info for p in psutil.process_iter(['name', 'cpu_percent', 'memory_percent'])
             if p.info['cpu_percent'] and p.info['cpu_percent'] > 0.5],
            key=lambda x: x['cpu_percent'], reverse=True
        )[:5]

        return {
            "cpu_percent":  cpu,
            "ram_percent":  ram.percent,
            "ram_used_gb":  round(ram.used / 1024**3, 1),
            "ram_total_gb": round(ram.total / 1024**3, 1),
            "top_processes": [
                {"name": p["name"], "cpu": p["cpu_percent"],
                 "ram": round(p["memory_percent"], 1)}
                for p in top
            ]
        }

    def start(self, callback=None):
        self.running = True
        print("[SystemTracker] запущен")
        while self.running:
            snapshot = self.get_snapshot()
            if callback:
                callback(snapshot)
            else:
                print(f"[SYS] CPU: {snapshot['cpu_percent']}% | "
                      f"RAM: {snapshot['ram_percent']}% "
                      f"({snapshot['ram_used_gb']}/{snapshot['ram_total_gb']} GB)")
                for p in snapshot["top_processes"]:
                    print(f"      {p['name']:30} cpu:{p['cpu']}% ram:{p['ram']}%")
            time.sleep(self.interval)

    def stop(self):
        self.running = False
        print("[SystemTracker] остановлен")

if __name__ == "__main__":
    tracker = SystemTracker(interval=5)
    print("мониторим систему (Ctrl+C для остановки)...")
    try:
        tracker.start()
    except KeyboardInterrupt:
        tracker.stop()