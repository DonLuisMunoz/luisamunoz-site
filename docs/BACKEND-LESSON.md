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

## Common misconceptions this code corrects

- *"The frontend reads the database."* No — it calls the API, which reads the database.
- *"`if token:` is enough auth."* No — you must compare against the real secret, safely.
- *"I can put the token in config.js."* No — that file ships to every visitor. Secrets live
  server-side only.
- *"PUT and POST are the same."* POST creates a new thing; PUT updates an existing one by id.

## Where the work lives

Every concept above has a real issue attached to it. See **#12** for order and blockers.

| Concepts | Issue |
|----------|-------|
| 9, 10, 11, 12 — CORS, secrets, containers, the tunnel | #6 Deploy the API to dockerHost |
| 5, 6, 8 — validation, bearer auth, parameterised queries | #7 API test suite in CI |
| 1, 9 — client/server split, CORS | #8 Contact form posts to the API |
| 2, 3, 4, 11 — verbs, routes, params, volumes | #10 Versioned resume |
| 9, 10 — why a secret can't ship to the browser | #9 Real GitHub commit streak |

#6 blocks #8, #9 and #10, and needs you at the homelab terminal. #7 does not — write the tests
before you deploy, not after.

## Next: run the quiz

Tell me **"start the backend quiz"** and I'll go Phase 2 → active recall, one question at a time,
grading 0–10 with corrections, then trace-the-code, a hands-on exercise, and a mastery score.
