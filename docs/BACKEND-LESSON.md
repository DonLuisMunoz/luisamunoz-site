# Backend, the learning way

You asked to *learn* the API/backend, not just paste it. So this file is **Phase 1** of the
reinforcement-coach method: the concepts to actually understand in `api/main.py`. Read it, then
ask me to run the active-recall quiz (Phases 2–8) in chat — I'll grade you one question at a time.

The goal isn't to feel like you get it. It's to verify you actually do.

## Must-Know concepts (from your own backend)

1. **Client / server split.** The browser (`site/`) is the *client*; `api/main.py` is the
   *server*. They're separate programs that talk over HTTP. The client never touches the
   database directly — it asks the server.

2. **HTTP methods = verbs.** `GET` reads, `POST` creates, `PUT` updates, `DELETE` removes. Your
   four `/api/projects` routes map one-to-one onto these. This pattern is called **REST**.

3. **A route / endpoint.** A URL + method the server answers, e.g. `GET /api/projects`. In
   FastAPI it's a function with a decorator: `@app.get("/api/projects")`.

4. **Request body vs. path param.** `/api/projects/{pid}` — `pid` is a *path parameter* (which
   project). The JSON you send with POST/PUT is the *body* (the new data).

5. **Schema / validation (Pydantic).** `ProjectIn(BaseModel)` declares what a valid project
   looks like. FastAPI rejects bad input automatically — you never hand-check types.

6. **Auth with a bearer token.** Admin routes require `Authorization: Bearer <token>`. The
   server compares it to `ADMIN_TOKEN`. `secrets.compare_digest` is used so the comparison
   can't be cracked by timing how long it takes.

7. **Persistence with SQLite.** Data is saved in a *file* (`portfolio.db`) so it survives
   restarts. `CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE` are the SQL verbs — note how
   they mirror the HTTP verbs.

8. **Parameterized queries.** `execute("... WHERE id=?", (pid,))` — the `?` placeholder is how
   you avoid **SQL injection**. Never build SQL by string-concatenating user input.

9. **CORS.** Browsers block a page on domain A from calling an API on domain B unless the API
   says it's allowed. `CORSMiddleware` + `ALLOWED_ORIGINS` is that permission list.

10. **Environment variables / secrets.** `ADMIN_TOKEN`, SMTP creds come from `.env`, never from
    code. Code is public (GitHub); secrets are not.

11. **Containerization (Docker).** The `Dockerfile` packages Python + deps + your app into one
    image that runs identically on your laptop and your homelab. A *volume* keeps the database
    file outside the container so rebuilds don't wipe it.

12. **The tunnel.** `cloudflared` makes an *outbound* connection to Cloudflare, which then routes
    public traffic back down it. That's why you don't open any ports.

13. **Which IP is "the visitor"?** — *PR #27*. Behind the Cloudflare tunnel, every request
    reaches the container from Cloudflare's address. A rate limit keyed on the socket IP would
    count every visitor as one person and lock the whole site out after five messages. The
    throttle keys on the `CF-Connecting-IP` header Cloudflare adds, and a test proves two
    different visitors get separate limits. Infrastructure changes what "the client" means.

14. **Code that runs at import time shapes how you test it** — *PR #27*. `main.py` reads
    `ADMIN_TOKEN` and `DB_PATH` and creates the database the moment it's imported, so the
    tests have to set the environment *before* the first `import main`. That's why
    `tests/conftest.py` imports inside a fixture. If a module is awkward to test, the
    awkwardness usually points at where its configuration lives.

15. **Same question, same answer** — *PR #27*. `PUT` on a missing id said 404; `DELETE` on the
    same id said 200 `{"ok": true}`. Neither crashed, so nothing looked broken — until a test
    asked both routes the same question. Consistency between endpoints is a property you only
    see by testing them side by side.

## Common misconceptions this code corrects

- *"The frontend reads the database."* No — it calls the API, which reads the database.
- *"`if token:` is enough auth."* No — you must compare against the real secret, safely.
- *"I can put the token in config.js."* No — that file ships to every visitor. Secrets live
  server-side only.
- *"PUT and POST are the same."* POST creates a new thing; PUT updates an existing one by id.

## Reading list, then your turn

**PR #27** (the API test suite) is the best single read for this lesson: each test names a
concept above and proves it. Start with `tests/conftest.py`, then the auth tests, then the
rate-limit pair.

| Concepts | Read or do |
|----------|------------|
| 5, 6, 8, 13, 14, 15 — validation, auth, injection, visitor IP, import time | PR #27 — read |
| 9, 10, 11, 12 — CORS, secrets, containers, the tunnel | #6 Deploy the API — do (needs the homelab) |
| 1, 9 — client/server split, CORS | #8 Contact form posts to the API — do, after #6 |
| 2, 3, 4, 11 — verbs, routes, params, volumes | #10 Versioned resume — do, after #6 |
| 9, 10 — why a secret can't ship to the browser | #9 Real GitHub commit streak — do, after #6 |

#6 blocks #8, #9 and #10, and needs you at the homelab terminal. The tests now run in CI, so
you'll be deploying something that's already been checked.

## Next: run the quiz

Tell me **"start the backend quiz"** and I'll go Phase 2 → active recall, one question at a time,
grading 0–10 with corrections, then trace-the-code, a hands-on exercise, and a mastery score.
