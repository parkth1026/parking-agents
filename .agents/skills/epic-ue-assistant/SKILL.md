---
name: epic-ue-assistant
description: |
  Query Epic Games' official UE AI assistant (dev.epicgames.com) for authoritative
  answers about UE5 compilation errors, engine features, and APIs.

  **Use this skill when:**
  (1) User asks about a UE5/UE4 compilation, linker, or C++ error code (C2061, LNK2019, etc.)
  (2) User wants to look up UE5 engine features, APIs, or best practices
  (3) Another skill needs official Epic guidance on an error
  (4) User mentions "ask Epic", "UE docs", or "Unreal documentation"
---

# Epic UE Assistant

Query Epic Games' official UE5 AI assistant to get authoritative answers with references to official documentation and learning resources.

## How It Works

The skill calls Epic's community assistant API at `dev.epicgames.com`. The API uses SSE (Server-Sent Events) streaming and returns:
- A detailed answer (markdown or HTML)
- References to official Epic documentation and learning resources
- A conversation ID for follow-up questions

## Usage

### Node CLI

The core logic lives in `scripts/epic-assistant.mjs`. API endpoints are read from `config.json` in the skill directory — no hardcoded URLs in the script.

```bash
# Simple: just get the answer text (markdown, falls back to HTML)
node <skill-dir>/scripts/epic-assistant.mjs answer --question "How to fix LNK2019 in a UE5 plugin?"

# Full: get answer + references + conversation ID (outputs JSON)
node <skill-dir>/scripts/epic-assistant.mjs ask --question "What causes C4430 with Slate widgets?"
# AgentAnswer    — markdown answer (preferred, not always present)
# HtmlAnswer     — HTML answer (always present)
# References     — array of {Title, Url, Description, Type}
# ConversationId — for follow-up questions

# Follow-up question in the same conversation
node <skill-dir>/scripts/epic-assistant.mjs ask --question "Show me an example" --conversation-id <ConversationId>

# Debug: fetch a CSRF token only
node <skill-dir>/scripts/epic-assistant.mjs csrf
```

Optional flags: `--config <path>` (default: `../config.json` relative to the script), `--timeout <sec>` (default 120), `--app <application>` (default `unreal_engine`).

### Direct curl (fallback when Node is unavailable)

Two-step process (replace `{baseUrl}`/`{origin}`/`{referer}` with the values from `config.json`):

```bash
# Step 1: Get CSRF token (save cookies)
CSRF=$(curl -s -c /tmp/epic_cookies.txt \
  "{baseUrl}/csrf_protection/token.json" \
  -X POST \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  -H "Content-Type: application/json" \
  -H "Origin: {origin}" \
  -d '{"create_csrf_token_request":"true"}' | grep -o '"public_csrf_token":"[^"]*"' | cut -d'"' -f4)

# Step 2: Ask question (SSE stream; -D saves response headers — grab Cb-Guest-Id for follow-ups)
curl -s -b /tmp/epic_cookies.txt -D /tmp/epic_headers.txt \
  "{baseUrl}/assistant/questions" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Origin: {origin}" \
  -H "PUBLIC-CSRF-TOKEN: $CSRF" \
  -d '{"content":"your question here","application":"unreal_engine","format":"html"}' \
  --max-time 120
# For follow-up questions add: -H "Cb-Guest-Id: <value from /tmp/epic_headers.txt>" and
# "conversation_id":"<ConversationId>" (uppercase) in the JSON body.
```

## Technical Constraints

These constraints were discovered through reverse engineering and testing. They are non-negotiable:

1. **curl.exe under the hood, not Node fetch** — Cloudflare blocks non-browser HTTP fingerprints but allows curl with a browser User-Agent. The mjs script spawns `curl.exe` for every request. This is the single most common failure mode.
2. **UTF-8 without BOM** — The request body is piped to curl via stdin; never write it to a file with a BOM. BOM bytes cause a JSON parse error on the server.
3. **120+ second timeout** — The assistant takes 15-60 seconds to generate a response. Default timeout must be at least 120 seconds.
4. **Browser User-Agent** — Required to pass Cloudflare. The module uses a Chrome UA string.
5. **CSRF flow** — Every question requires a fresh CSRF token. The token comes from a POST to `/csrf_protection/token.json` and must be sent as a `PUBLIC-CSRF-TOKEN` header on the question request, along with the cookies from the token response.
6. **Guest ID binds conversations** — The server assigns a guest ID via the `Cb-Guest-Id` **response header**; follow-up questions (`--conversation-id`) only work when the same value is sent back as a `Cb-Guest-Id` request header. The web app stores it in `localStorage.cbGuestId`; the mjs script captures it automatically from every response and caches it in `%TEMP%\epic_assistant_guest_id.txt`. Deleting that file (or a different machine/user) loses follow-up access to past conversations — the API then answers `{"error":"conversation does not exist"}`.

## Error Behavior

Server-side errors (rate limit, Cloudflare challenge page, nonexistent conversation, `Invalid CSRF Token`, …) arrive as **non-SSE bodies** — plain JSON like `{"error":"..."}`, short text, or HTML. The script detects any event-less response, surfaces it in the `Error` field, and exits non-zero (exit 1). A zero exit code therefore reliably means "answer present". The same applies to SSE streams that carry an `error` event.

## Response Format

The API returns an SSE stream. Key events in order:

| Event | Data | Notes |
|-------|------|-------|
| `conversation_loaded` | `{id, name}` | Conversation ID for follow-ups |
| `reference` | `{content(url), title, description, type}` | 0-N official doc/learning links |
| `agent_code` | `{content}` | Markdown answer — not always present |
| `answer_update` | `{content}` | HTML answer — always present |
| `end` | `{}` | Stream complete |

The script prefers `agent_code` (clean markdown) over `answer_update` (HTML with escaped entities).

## Cross-Skill Integration

Other skills can call the CLI directly. For example, `jenkins-log-auto-learning` can enrich its knowledge base:

```bash
# From another skill's context
node <epic-skill-dir>/scripts/epic-assistant.mjs answer --question "How to fix error $errorCode in UE5?"
```

## Rate Limits

The API has rate limits for unauthenticated users. The module does not currently handle rate limit errors — if you get a 429, wait a minute and retry. For batch queries (e.g., from jenkins-log-auto-learning), add a delay between requests.

Check limits before querying:
```
GET {baseUrl}/assistant/questions/check_limit
```
