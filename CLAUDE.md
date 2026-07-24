# CLAUDE.md

Guidance for Claude Code when working in this workspace.

## Working with the Obsidian design vault

This project's design thinking lives in an Obsidian vault (design notes, ADRs, problem
statements, prior art), heavily cross-linked with `[[wikilinks]]`.

When you read a design / ADR / problem / prior-art note to answer a question:

- **Follow its links — one hop, relevance-gated.** Resolve and read the linked notes that
  bear on the question (especially those under a note's `## Links` section). Do **not**
  walk the full transitive graph — stop at directly-linked notes, and skip links clearly
  unrelated to the question.
- **Enumerate links with the tools.** Use `obsidian_get_note` with `includeLinks: true` to
  list a note's outgoing links, then open the relevant targets with `obsidian_get_note`.
- **Wikilinks are name-based.** Resolve `[[Note Name]]` by filename across the whole vault
  (Obsidian doesn't store the path), not by folder.
- **Flag broken links.** If a `[[wikilink]]` doesn't resolve to a real note, say so rather
  than silently skipping it.
- **External links** (`[text](https://…)`) are web links — fetch those via the web, not the
  vault.

## Session checkpointing (so future sessions can pick up context)

Chat sessions are ephemeral and degrade as the context window fills. Preserve the durable
parts in the vault so a future session can reference them via wikilinks. Use the **existing**
convention — do not invent a parallel one:

- **Where:** `95 - Journal/Conversations/YYYY-MM-DD - topic/`, with `00 - Session summary.md`
  plus numbered exchange notes (`prev:` / `next:` in frontmatter). Follow
  `[[Template - Session Log]]`.
- **Index it:** add the session to `[[Sessions MOC]]` as `[[Session — YYYY-MM-DD — Topic]]`,
  and link outward to every concept / component / ADR / decision it touched. Notes produced
  during the session should link back to the session.
- **Write incrementally, not only at the end.** Checkpoint at milestones (a decision made, a
  task finished) so the record survives even if the session is lost or hard-compacted. An
  end-only ritual loses everything if the session degrades first.
- **Context-window trigger (collaborative).** I can't read my own context usage to the
  percent, so: the user watches the Claude Code context meter and asks to "checkpoint the
  session" around ~50–60% full; and I proactively suggest a checkpoint at natural boundaries
  when the conversation is getting long, rather than claiming a precise number.
- **On resume:** a new session should read the latest `00 - Session summary.md` (and its
  linked notes, one hop) before continuing work.
