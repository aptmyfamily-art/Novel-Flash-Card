# Novel Flashcard Agent Instructions

Canonical workflow for AI coding agents in this repository.

## Project Context

- Name: Novel Flashcard
- Platform: Google Apps Script Web App + Google Sheets
- Working directory: `Novel Flashcard`
- Source of truth: local files in this repo, synced to GitHub and Apps Script

## File Map

- `Code.js`: Web app entrypoint + API router + dictionary import/lookup logic
- `00_Config.js`: constants, sheet names, schemas, helpers
- `01_DB.js`: sheet database helpers
- `Index.html`: app shell and UI layout
- `Styles.html`: global styles
- `Scripts.html`: client logic and event wiring
- `appsscript.json`: GAS runtime and scopes

## Workflow Rules

1. Expand shorthand user requests into concrete implementation goals.
2. Keep changes scoped and minimal.
3. Verify changes before sync:
   - `node --check Code.js`
   - `node --check 00_Config.js`
   - `node --check 01_DB.js`
4. Sync order after edits:
   - `git status --short`
   - `git add <intentional files>`
   - `git commit -m "<clear message>"`
   - `git push`
   - `clasp push -f` (or `clasp.cmd push -f`)
5. Update documentation:
   - `PROGRESS.md` for meaningful changes
   - `TODO.md` when status changes
6. Do not claim completion if verify/sync fails. Report exact blocker.

## Operational Notes

- Markdown files are local workflow docs; only `.js`, `.html`, and `appsscript.json` go to Apps Script.
- Keep `.clasp.json` scoped to this project when added.
