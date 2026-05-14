# Backlog

## Sprint 2 candidates

- Refactor Activity Monitor state labels into prose context hints before L1 sees them.
  Raw labels like `scattered`, `grinding`, `idle_loop`, and `normal` should not be present in `<runtime_context>`. Use a mapper similar to `mood_to_prompt_fragment`, for example `scattered -> he keeps switching windows. no settled focus.`

- Consider migrating memory from turn-pair records to per-message records.
  Current conversation memories store `user:` and `emiya:` in one content field, so prompt-safety filtering has to split assistant-side text manually. Per-message records with `role` would make retrieval filtering cleaner and safer.

- Keep post-tag L1 polish out of Sprint 1.5.
  New voice regressions found after `v0.1-sprint1.5` should be recorded here unless they are severe enough to block Sprint 2.
