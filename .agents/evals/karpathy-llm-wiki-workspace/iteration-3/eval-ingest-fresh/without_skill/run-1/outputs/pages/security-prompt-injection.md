# Prompt injection

> **TL;DR** Instructions hidden inside data the model reads — web pages, emails,
> PDFs — can hijack its behavior. Karpathy flags this as the defining security
> problem of the emerging LLM ecosystem: untrusted input is being mixed with
> instructions in a single channel.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), security section.

## The problem

Once an LLM is given [tools](tool-use.md) — browsing, reading emails or documents —
any text it ingests becomes part of its prompt. A malicious web page can embed text
like "ignore previous instructions and ...", aimed not at human readers but at AI
assistants that will visit the page. The talk demonstrates this with a page carrying
hidden instructions targeting browsing assistants.

From the model's point of view there is no difference between "content to process" and
"commands to obey": both arrive as tokens in the same context window. That is the root
cause, and it is shared with [system prompt](system-prompts.md) fragility.

## Why it is hard

- **One channel.** Unlike software, the model cannot reliably separate data from
  instructions, because they are the same medium.
- **Not a bug to patch.** It is a vulnerability class inherent to mixing untrusted
  text with a language-understanding agent, not a single implementation flaw.

## Analogies

Karpathy frames the LLM stack as an emerging operating system
([The LLM OS](llm-os.md)) and its security problems as first-class vulnerabilities of
that stack: prompt injection plays the role of classic injection-style attacks (think
SQL injection or untrusted input reaching a kernel) — but executed in natural language,
so classic sanitization does not apply.

## Mitigation directions (as of the talk, 2023)

- **Least privilege:** give tools narrow scopes and permissions.
- **Human confirmation** for consequential actions (sending, paying, deleting).
- Provenance checks, content filtering, monitoring, and ongoing research. No complete
  solution existed at talk time.

## Taxonomy: attack classes on LLM systems

| Attack | Vector | Page |
|---|---|---|
| Jailbreak | The user's own prompts | [Jailbreaks](security-jailbreaks.md) |
| Prompt injection | Data the model reads (web pages, emails, files) | this page |

## See also

- [Jailbreaks](security-jailbreaks.md) — the user-side attack class
- [Tool use](tool-use.md) — the capability that opens this attack surface
- [System prompts](system-prompts.md)
- [The LLM OS](llm-os.md) — why this is kernel-grade security

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
