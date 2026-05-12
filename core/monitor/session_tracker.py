import time
from datetime import datetime
from monitor.db import get_connection, log_state

AFK_THRESHOLD = 300  # 5 minutes without activity = AFK

class SessionTracker:
    def __init__(self, session_id):
        self.session_id = session_id
        self.session_start = datetime.now()
        self.last_active = datetime.now()
        self.is_afk = False
        self.afk_start = None
        self.total_afk_seconds = 0

    def ping(self):
        """Called when activity is detected by WindowTracker."""
        now = datetime.now()
        if self.is_afk:
            afk_duration = (now - self.afk_start).seconds
            self.total_afk_seconds += afk_duration
            self.is_afk = False
            self.afk_start = None
            print(f"[SessionTracker] returned after {afk_duration}s AFK")
        self.last_active = now

    def check_afk(self):
        """Check whether the user went AFK."""
        now = datetime.now()
        idle_seconds = (now - self.last_active).seconds
        if idle_seconds >= AFK_THRESHOLD and not self.is_afk:
            self.is_afk = True
            self.afk_start = now
            print("[SessionTracker] AFK detected")
            return True
        return False

    def get_active_duration(self):
        """Active session time in minutes, excluding AFK."""
        total = (datetime.now() - self.session_start).seconds
        active = total - self.total_afk_seconds
        return round(active / 60, 1)

    def get_time_of_day(self):
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 18:
            return "day"
        elif 18 <= hour < 23:
            return "evening"
        else:
            return "night"

    def get_stats(self):
        return {
            "session_start":    self.session_start.isoformat(),
            "active_minutes":   self.get_active_duration(),
            "is_afk":           self.is_afk,
            "total_afk_min":    round(self.total_afk_seconds / 60, 1),
            "time_of_day":      self.get_time_of_day(),
        }

if __name__ == "__main__":
    from db import init_db, start_session
    init_db()
    sid = start_session()
    tracker = SessionTracker(session_id=sid)

    print("simulating session...")
    print(f"[stats] {tracker.get_stats()}")

    # Simulate activity.
    for i in range(3):
        tracker.ping()
        time.sleep(1)

    print(f"[stats] {tracker.get_stats()}")
    print(f"[time_of_day] {tracker.get_time_of_day()}")
    print("[SessionTracker] test passed")
