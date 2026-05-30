# SHVR Agent Instructions

This is the canonical workflow file for any AI CLI agent working in this repository, including Codex, Gemini CLI, Claude Code, Cursor agents, Copilot agents, and similar tools.

## Project Context

- **Name:** SHVR (Student Home Visit Recording)
- **Platform:** Google Apps Script (GAS) Web App
- **Working directory:** `studentHomeVisit`
- **Architecture:** Single Page Application (SPA) frontend with a modular Apps Script backend.
- **Source of truth:** Local files in this repository must be synced to both GitHub and Google Apps Script after every edit.

## File Map

### Backend
- `00_Config.js`: Constants, schemas, RBAC, and helper utilities.
- `01_DB.js`: Google Sheets database layer.
- `02_Auth.js`: Authentication, session management, and RBAC checks.
- `03_Students.js`: Student CRUD and import logic.
- `04_Visits.js`: Home visit recording and duplicate checks.
- `05_Files.js`: File upload and Drive management.
- `06_Reports.js`: Dashboard and reporting aggregation.
- `07_Users.js`: User administration.
- `08_Audit.js`: Audit logging.
- `09_Seed.js`: Demo data.
- `10_Menu.js`: Spreadsheet UI menu and setup.
- `11_Mappings.js`: Homeroom teacher mappings.
- `Code.js`: Web App entry point and API router.

### Frontend
- `Index.html`: Main shell.
- `Styles.html`: Global CSS.
- `Scripts.html`: Script loader.
- `ScriptsCore.html`: Shared client utilities.
- `ScriptsPages.html`: Routes, UI templates, forms, and print builders.

## Coding Standards

- Keep changes scoped to the requested behavior.
- Follow existing module naming patterns.
- Global server functions use `Module_functionName`.
- Private/helper server functions use trailing underscore: `Module_functionName_`.
- Client-side variables use camelCase.
- Prefer existing helpers and local patterns over new abstractions.
- Avoid unrelated formatting churn.

## Prompt Expansion Rules

- Treat short user inputs such as `App`, `fix login`, `deploy`, `review`, or similar shorthand as incomplete task directives that must be expanded into an execution prompt before work starts.
- Build that execution prompt from repository context instead of asking unnecessary follow-up questions when the intended outcome is reasonably inferable.
- The expanded prompt must explicitly identify:
  - the end goal,
  - the likely files or modules involved,
  - relevant constraints from this repository,
  - the concrete actions to perform,
  - the success criteria,
  - and the required verification, sync, and documentation workflow.
- Ask the user a clarifying question only when multiple materially different interpretations would create meaningful risk.
- Unless the user explicitly asks for analysis only, planning only, or review only, assume shorthand requests authorize implementation through completion of the full workflow below.

## Default 12-Step Execution Workflow

Every AI CLI agent should internally normalize task execution to this sequence whenever code, configuration, or deployable behavior may change:

1. Expand the user's request into a clear execution prompt.
2. Gather repository context and identify the most likely files/modules involved.
3. Confirm repository-specific constraints and preserve established patterns.
4. Define the scoped task, intended behavior change, and success criteria.
5. Choose and use any relevant built-in or installed skill/workflow before improvising.
6. Resolve the likely root cause or implementation approach.
7. Make the smallest effective code change.
8. Verify the changed behavior or syntax.
9. Run `git status --short`.
10. Stage only intentional changes, commit with a clear message, and run `git push`.
11. Run `clasp push -f` or `clasp.cmd push -f`.
12. Update `PROGRESS.md` and `TODO.md` when applicable, then report outcome and any remaining blockers clearly.

## Mandatory Workflow After Every Edit

Every AI CLI agent must follow this routine after any file edit. Do not report the task as complete until all applicable steps succeed.

1. **Expand and Scope**
   - Convert shorthand requests into a concrete execution prompt before editing.
   - Use local repository context to infer likely target files, constraints, and success criteria.
   - Ask follow-up questions only when ambiguity creates real implementation risk.

2. **Verify**
   - Run syntax or behavior checks relevant to the changed files.
   - For Apps Script JavaScript files, run `node --check <file>` where possible.
   - For HTML files containing script blocks, validate embedded JavaScript when practical.
   - If verification fails, fix the issue and restart verification.

3. **Git Sync**
   - Run `git status --short`.
   - Stage only intentional changes.
   - Commit with a clear message.
   - Run `git push`.

4. **Apps Script Sync**
   - Run `clasp push -f` from the Apps Script project root that contains `.clasp.json`.
   - If PowerShell blocks `clasp`, use `clasp.cmd push -f`.
   - If `clasp push -f` fails, resolve the blocker or report the exact failure. Do not claim completion.

5. **Document**
   - Update `PROGRESS.md` with timestamp, short tag, summary, and commit hash when the change is meaningful.
   - Update `TODO.md` only when task status actually changes.

## Sync Rules

- **No local-only completion:** Work is not complete while changes are uncommitted, unpushed, or not synced to Apps Script.
- **Required order:** verify, commit, `git push`, then `clasp push -f`.
- **Failure handling:** Report exact command failures and blockers. Do not hide failed sync or verification.
- **Clasp configuration:** `.clasp.json` must keep `skipSubdirectories: true` so `.worktrees` and docs are not pushed into Apps Script.

## Current Operational Notes

- The Apps Script project tracks `.js`, `.html`, and `appsscript.json` files only.
- Markdown files are for local/GitHub agent workflow documentation and are not uploaded to Apps Script.
- The repository may contain `.worktrees`; agents must not treat those as deployable Apps Script files.
