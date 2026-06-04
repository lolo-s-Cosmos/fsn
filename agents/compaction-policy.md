# FSN Compaction Policy

Compact the conversation history itself. Do not inspect, summarize, validate, or mirror project files or git state. Runtime state may be provided only as exclusion reference.

The goal is to preserve only conversation-local memory that would otherwise be lost after compaction.

If a `<current_state_for_exclusion>` block is present, use it only to identify facts already stored in runtime state. Do not copy that state block into the summary.

Preserve:

- the user's current intent and unresolved questions;
- decisions made in the conversation that still matter for future replies;
- corrections the user made to the assistant's framing;
- open loops, next conversational steps, and pending implementation requests;
- artifact conclusions discussed in chat, only if their actionable consequence has not been resolved in chat;
- meta-decisions about how the assistant should handle memory, compaction, prompts, or workflow.

Do not preserve:

- file contents or state snapshots;
- git status, commit history, or quality gate history;
- durable prompt/data/state rules merely because they were mentioned;
- implementation details that no longer affect the next conversation step;
- long chronological logs of edits, commands, or tool outputs.

If a topic was resolved in the conversation, summarize it only as a short decision if it affects future behavior. Otherwise omit it.
