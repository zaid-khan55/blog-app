# Fieldnotes: a simple blog application

A full-stack blog built with **Flask**, **SQLite** and a **vanilla JavaScript** single-page UI. No build step, and Flask is the only dependency.

## Features
- Create, read, edit and delete posts
- Tags with click-to-filter, plus live search across title, body and author
- Server-side validation with inline error messages
- Responsive layout, light and dark mode, keyboard-friendly
- Two sample posts are added on first run

## Project structure
```
blog/
├── app.py            # Flask app, REST API and SQLite setup
├── requirements.txt
├── blog.db           # created automatically on first run
└── static/
    ├── index.html    # app shell
    ├── style.css
    └── app.js        # hash-routed UI (list, post, new, edit)
```

## Run it
Requires Python 3.9+.

```bash
cd blog
python -m venv venv
source venv/bin/activate        # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000

## REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts?q=&tag=` | List posts, optionally filtered |
| GET | `/api/posts/<id>` | Get one post |
| POST | `/api/posts` | Create a post |
| PUT | `/api/posts/<id>` | Update a post |
| DELETE | `/api/posts/<id>` | Delete a post |
| GET | `/api/tags` | Tags with post counts |

Example body for POST and PUT:
```json
{ "title": "Hello", "author": "Zaid", "tags": "intro, notes", "body": "First paragraph.\n\nSecond paragraph." }
```

## Notes
- The page loads the Source Serif font from Google Fonts and falls back to Georgia when offline.
- This is a development setup with no authentication, so anyone who can reach the server can edit posts. Add login before deploying publicly.
- For production, run with `gunicorn app:app` rather than `debug=True`.

## Ideas to extend
User accounts, Markdown rendering, comments, image uploads, pagination.
