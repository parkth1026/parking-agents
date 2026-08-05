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

### PowerShell Module

The core logic lives in `scripts/EpicAssistant.psm1`. Import it and call the functions:

```powershell
Import-Module "<skill-dir>/scripts/EpicAssistant.psm1" -Force

# Simple: just get the answer text
$answer = Get-EpicUEAnswer -Question "How to fix LNK2019 in a UE5 plugin?"

# Full: get answer + references + conversation ID
$result = Invoke-EpicAssistantQuery -Question "What causes C4430 with Slate widgets?"
# $result.AgentAnswer    — markdown answer (preferred, not always present)
# $result.HtmlAnswer     — HTML answer (always present)
# $result.References     — array of {Title, Url, Description, Type}
# $result.ConversationId — for follow-up questions

# Follow-up question in the same conversation
$followUp = Invoke-EpicAssistantQuery -Question "Show me an example" -ConversationId $result.ConversationId
```

### Direct curl (for non-PowerShell contexts)

Two-step process:

```bash
# Step 1: Get CSRF token (save cookies)
CSRF=$(curl -s -c /tmp/epic_cookies.txt \
  "https://dev.epicgames.com/community/api/csrf_protection/token.json" \
  -X POST \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  -H "Content-Type: application/json" \
  -H "Origin: https://dev.epicgames.com" \
  -d '{"create_csrf_token_request":"true"}' | grep -o '"public_csrf_token":"[^"]*"' | cut -d'"' -f4)

# Step 2: Ask question (SSE stream)
curl -s -b /tmp/epic_cookies.txt \
  "https://dev.epicgames.com/community/api/assistant/questions" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Origin: https://dev.epicgames.com" \
  -H "PUBLIC-CSRF-TOKEN: $CSRF" \
  -d '{"content":"your question here","application":"unreal_engine","format":"html"}' \
  --max-time 120
```

## Technical Constraints

These constraints were discovered through reverse engineering and testing. They are non-negotiable:

1. **Use curl.exe, not Invoke-WebRequest** — Cloudflare blocks PowerShell's HTTP client but allows curl with a browser User-Agent. This is the single most common failure mode.
2. **UTF-8 without BOM** — When writing the request body to a temp file for curl's `@file` syntax, use `UTF8Encoding($false)` in PowerShell. BOM bytes cause a JSON parse error on the server.
3. **120+ second timeout** — The assistant takes 15-60 seconds to generate a response. Default timeout must be at least 120 seconds.
4. **Browser User-Agent** — Required to pass Cloudflare. The module uses a Chrome UA string.
5. **CSRF flow** — Every question requires a fresh CSRF token. The token comes from a POST to `/csrf_protection/token.json` and must be sent as a `PUBLIC-CSRF-TOKEN` header on the question request, along with the cookies from the token response.

## Response Format

The API returns an SSE stream. Key events in order:

| Event | Data | Notes |
|-------|------|-------|
| `conversation_loaded` | `{id, name}` | Conversation ID for follow-ups |
| `reference` | `{content(url), title, description, type}` | 0-N official doc/learning links |
| `agent_code` | `{content}` | Markdown answer — not always present |
| `answer_update` | `{content}` | HTML answer — always present |
| `end` | `{}` | Stream complete |

The module prefers `agent_code` (clean markdown) over `answer_update` (HTML with escaped entities).

## Cross-Skill Integration

Other skills can import and call the module directly. For example, `jenkins-log-auto-learning` can enrich its knowledge base:

```powershell
# From another skill's context
$epicModule = Join-Path $PSScriptRoot "../../epic-ue-assistant/scripts/EpicAssistant.psm1"
Import-Module $epicModule -Force
$epicAnswer = Get-EpicUEAnswer -Question "How to fix error $errorCode in UE5?"
```

## Rate Limits

The API has rate limits for unauthenticated users. The module does not currently handle rate limit errors — if you get a 429, wait a minute and retry. For batch queries (e.g., from jenkins-log-auto-learning), add a delay between requests.

Check limits before querying:
```
GET https://dev.epicgames.com/community/api/assistant/questions/check_limit
```
