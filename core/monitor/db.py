import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'emiya.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()

    # сессии
    c.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            started   TEXT NOT NULL,
            ended     TEXT,
            duration  INTEGER
        )
    ''')

    # лог окон
    c.execute('''
        CREATE TABLE IF NOT EXISTS window_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  TEXT NOT NULL,
            app_name   TEXT NOT NULL,
            category   TEXT NOT NULL,
            session_id INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    ''')

    # лог состояний
    c.execute('''
        CREATE TABLE IF NOT EXISTS state_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  TEXT NOT NULL,
            state      TEXT NOT NULL,
            session_id INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    ''')

    # лог триггеров Emiya
    c.execute('''
        CREATE TABLE IF NOT EXISTS trigger_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  TEXT NOT NULL,
            trigger    TEXT NOT NULL,
            message    TEXT NOT NULL,
            feedback   INTEGER DEFAULT 0,
            session_id INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    ''')

    conn.commit()
    conn.close()
    print("[DB] инициализирована")

def start_session():
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("INSERT INTO sessions (started) VALUES (?)", (now,))
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"[DB] сессия #{session_id} начата")
    return session_id

def end_session(session_id):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute(
        "UPDATE sessions SET ended=?, duration=(strftime('%s',?) - strftime('%s',started)) WHERE id=?",
        (now, now, session_id)
    )
    conn.commit()
    conn.close()
    print(f"[DB] сессия #{session_id} завершена")

def log_window(app_name, category, session_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO window_log (timestamp, app_name, category, session_id) VALUES (?,?,?,?)",
        (datetime.now().isoformat(), app_name, category, session_id)
    )
    conn.commit()
    conn.close()

def log_state(state, session_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO state_log (timestamp, state, session_id) VALUES (?,?,?)",
        (datetime.now().isoformat(), state, session_id)
    )
    conn.commit()
    conn.close()

def log_trigger(trigger, message, session_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO trigger_log (timestamp, trigger, message, session_id) VALUES (?,?,?,?)",
        (datetime.now().isoformat(), trigger, message, session_id)
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    sid = start_session()
    log_window("VS Code", "code", sid)
    log_state("deep_work", sid)
    log_trigger("grinding", "три часа. что держит?", sid)
    print("[DB] тест прошёл успешно")