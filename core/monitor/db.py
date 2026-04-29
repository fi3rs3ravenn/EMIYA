import sqlite3
import os
import json
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

    # лог диалогов и сырых thinking-блоков моделей
    c.execute('''
        CREATE TABLE IF NOT EXISTS chat_log (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp      TEXT NOT NULL,
            session_id     INTEGER,
            turn_id        TEXT,
            role           TEXT NOT NULL,
            source         TEXT NOT NULL,
            content        TEXT NOT NULL,
            thought        TEXT,
            raw_response   TEXT,
            model          TEXT,
            trigger        TEXT,
            mood_energy    REAL,
            mood_focus     REAL,
            mood_openness  REAL,
            metadata       TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    ''')

    c.execute("CREATE INDEX IF NOT EXISTS idx_chat_log_session ON chat_log(session_id, id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_chat_log_turn ON chat_log(turn_id)")

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

def log_chat_message(
    session_id,
    role,
    content,
    source,
    turn_id=None,
    thought=None,
    raw_response=None,
    model=None,
    trigger=None,
    mood=None,
    metadata=None,
):
    mood = mood or {}
    metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata else None

    conn = get_connection()
    c = conn.cursor()
    c.execute(
        '''
        INSERT INTO chat_log (
            timestamp, session_id, turn_id, role, source, content,
            thought, raw_response, model, trigger,
            mood_energy, mood_focus, mood_openness, metadata
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''',
        (
            datetime.now().isoformat(),
            session_id,
            turn_id,
            role,
            source,
            content,
            thought,
            raw_response,
            model,
            trigger,
            mood.get("energy"),
            mood.get("focus"),
            mood.get("openness"),
            metadata_json,
        )
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    sid = start_session()
    log_window("VS Code", "code", sid)
    log_state("deep_work", sid)
    log_trigger("grinding", "три часа. что держит?", sid)
    log_chat_message(sid, "user", "ты здесь?", "user", turn_id="demo")
    log_chat_message(
        sid,
        "assistant",
        "здесь.",
        "l1",
        turn_id="demo",
        thought="короткий ответ лучше.",
        model="qwen3:14b",
    )
    print("[DB] тест прошёл успешно")
