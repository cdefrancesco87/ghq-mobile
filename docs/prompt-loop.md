You are in the GHQ Mobile development loop. In this round run **one single task** from the backlog, then stop.

1. `CLAUDE.md` is already in your context: do not re-read it. The backlog is split into two files, in this order: `docs/backlog-task.md` (T01–T33) and `docs/backlog-schermate.md` (T34 onward). Do not read them in full: Grep for the lines `^### \[` and `Dipende da` in both, then Read only the block of the chosen task. From `docs/backlog-schermate.md` also read the "Regole comuni" at the top (up to the first `---` line).
2. Check `git status` and the current branch.
   - If there are uncommitted changes and a task is marked `[~]`, it is an interrupted round: resume that task.
   - If there are uncommitted changes and no task is `[~]`, touch nothing: write "LOOP FERMO: modifiche non salvate da controllare" and stop.
3. Pick the task: the first `[~]` if any, otherwise the first `[ ]` whose dependencies are all `[x]`, scanning `docs/backlog-task.md` first and then `docs/backlog-schermate.md` (a dependency may be in the other file).
   - If there is none, write "LOOP FINITO" with the list of `[!]` tasks and their reason, and stop.
4. Work on a task branch, never commit on `main`: if you are not already on `task/Txx-<short-slug>`, create it with `git switch -c task/Txx-<short-slug>` (uncommitted changes come along).
5. Mark the task `[~]` in the backlog.
6. Read references in a targeted way: Grep the title of the cited section (e.g. `^### 3.4`) in the file under `docs/riferimenti/`, then Read only those lines (offset and limit). Never read `design-sezioni.md` or `analisi-funzionale.md` in full. To understand existing code, Grep function names instead of reading whole folders. Do not re-read a file already read in this round. If the task cites mockups, open them with Read (PNG files in `docs/mockup/`): they define the look, not the values.
7. Do the work.
   - For everything in `src/rules/` and `src/db/repositories/`, write the tests first, watch them fail, then write the code.
   - For screens and components (`app/`, `src/features/`), write React Native Testing Library tests together with the code and reuse the components in `src/features/shared/` instead of rebuilding them.
   - Stay within the task scope: do not anticipate later tasks and do not refactor unrelated code.
   - Do not leave throwaway scripts in the repo: delete them before the commit.
   - If you add a dependency, use `npx expo install <package>` for app libraries, so the version matches the SDK.
8. Verify: run the commands in the task's "Fatto quando" field, then `npm run check`. Everything must pass. Actually read the output: a skipped test or a type error is not a success.
9. If everything passes:
   - mark the task `[x]`;
   - add one line at the end of the Diario of the file containing the task, in Italian: date, task code, what you did in one sentence, any minor choices or content to review;
   - commit all the task's files with the message `Txx: <task title>`. Do not push.
10. If verification still fails after 3 attempts, or a decision is needed that the documents and `CLAUDE.md` do not provide:
    - set the work aside with `git stash push -u -m "Txx blocked"`, so the branch stays green;
    - mark the task `[!]` and write in the Diario of its file the exact reason and what would unblock it;
    - commit only the backlog with the message `Txx: blocked`.
11. In the backlog change only task states and the Diario. Do not rewrite task text.
12. If a command is denied for missing permission, stop immediately: write "LOOP FERMO" and the exact command to approve. Do not retry the task in later rounds.
13. Be concise: no summaries of files or code in the terminal. End the round with three lines: task run, outcome, next available task.