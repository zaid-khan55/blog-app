import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, g, jsonify, request

BASE = Path(__file__).parent
DB = BASE / "blog.db"
app = Flask(__name__, static_folder="static", static_url_path="/static")

SCHEMA = """
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)"""


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db():
    conn = sqlite3.connect(DB)
    conn.execute(SCHEMA)
    if conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0] == 0:
        t = now()
        seed = [
            ("Welcome to your blog", "Admin", "welcome,meta",
             "This is a sample post. Use New post to write your own.\n\nPosts support paragraphs, tags, search and editing.", t, t),
            ("Why small projects teach the most", "Admin", "learning,engineering",
             "Shipping a small, complete project forces you through every layer: data, API and interface.\n\nStart small, finish it, then improve it.", t, t),
        ]
        conn.executemany(
            "INSERT INTO posts (title, author, tags, body, created_at, updated_at) VALUES (?,?,?,?,?,?)", seed)
        conn.commit()
    conn.close()


def clean_tags(raw):
    seen, out = set(), []
    for t in (raw or "").split(","):
        t = t.strip().lower()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return ",".join(out)


def to_dict(r):
    d = dict(r)
    d["tags"] = [t for t in d["tags"].split(",") if t]
    return d


def read_payload():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    author = str(data.get("author", "")).strip()
    body = str(data.get("body", "")).strip()
    tags = data.get("tags", "")
    if isinstance(tags, list):
        tags = ",".join(tags)
    errors = {}
    if not title:
        errors["title"] = "Add a title."
    elif len(title) > 150:
        errors["title"] = "Keep the title under 150 characters."
    if not author:
        errors["author"] = "Add an author name."
    if not body:
        errors["body"] = "Write something in the post body."
    return (title, author, clean_tags(tags), body), errors


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/posts")
def list_posts():
    q = request.args.get("q", "").strip()
    tag = request.args.get("tag", "").strip().lower()
    sql, args = "SELECT * FROM posts WHERE 1=1", []
    if q:
        sql += " AND (title LIKE ? OR body LIKE ? OR author LIKE ?)"
        args += [f"%{q}%"] * 3
    if tag:
        sql += " AND (',' || tags || ',') LIKE ?"
        args.append(f"%,{tag},%")
    rows = db().execute(sql + " ORDER BY created_at DESC, id DESC", args).fetchall()
    return jsonify([to_dict(r) for r in rows])


@app.get("/api/tags")
def list_tags():
    counts = {}
    for r in db().execute("SELECT tags FROM posts"):
        for t in r["tags"].split(","):
            if t:
                counts[t] = counts.get(t, 0) + 1
    return jsonify(sorted(counts.items(), key=lambda x: (-x[1], x[0])))


@app.get("/api/posts/<int:pid>")
def get_post(pid):
    r = db().execute("SELECT * FROM posts WHERE id=?", (pid,)).fetchone()
    if not r:
        return jsonify(error="Post not found."), 404
    return jsonify(to_dict(r))


@app.post("/api/posts")
def create_post():
    vals, errors = read_payload()
    if errors:
        return jsonify(errors=errors), 400
    t = now()
    cur = db().execute(
        "INSERT INTO posts (title, author, tags, body, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (*vals, t, t))
    db().commit()
    r = db().execute("SELECT * FROM posts WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(to_dict(r)), 201


@app.put("/api/posts/<int:pid>")
def update_post(pid):
    if not db().execute("SELECT 1 FROM posts WHERE id=?", (pid,)).fetchone():
        return jsonify(error="Post not found."), 404
    vals, errors = read_payload()
    if errors:
        return jsonify(errors=errors), 400
    db().execute(
        "UPDATE posts SET title=?, author=?, tags=?, body=?, updated_at=? WHERE id=?", (*vals, now(), pid))
    db().commit()
    r = db().execute("SELECT * FROM posts WHERE id=?", (pid,)).fetchone()
    return jsonify(to_dict(r))


@app.delete("/api/posts/<int:pid>")
def delete_post(pid):
    cur = db().execute("DELETE FROM posts WHERE id=?", (pid,))
    db().commit()
    if cur.rowcount == 0:
        return jsonify(error="Post not found."), 404
    return jsonify(ok=True)


init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
