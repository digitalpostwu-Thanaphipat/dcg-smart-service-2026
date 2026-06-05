# WUS Track DB - Project Instructions

## 🛠 Tech Stack
- **Frontend**: Vite + React + TypeScript + TailwindCSS + Shadcn UI
- **Backend**: Google Apps Script (Google Sheets as Database)
- **Design**: PWA Compliance + Pixel Perfect UI

## 📋 Core Rules (Mandatory)
1. **Prefer Skills**: Always activate relevant skills (`@goal-buddy`, `@access-audit`, etc.) before starting tasks.
2. **Modular Code**: Small, pure functions. Clear folder structure in `src/`.
3. **Verify Before Implementing**: Search existing components in `src/components/` before creating new ones.
4. **Accessibility First (WCAG 2.2 AA)**: Mandatory use of `@access-audit`. Minimum contrast 4.5:1.
5. **Pixel Perfect**: Use meaningful transitions (Framer Motion). Follow `@awesome-design-md`.
6. **PWA Compliance**: Evaluate every feature for offline capability. Config `manifest.json`.
7. **GGSheet Protocol**: Treat Google Sheets with strict schema. Use `google-sheets-automation` (Standalone OAuth) as the primary sync tool. Mandatory: All sync operations must be wrapped in a connection guard using `python scripts/auth.py status` to ensure active token validity before execution. Maintain schema tracking via `@agent-memory`.
8. **State Handover (MANDATORY)**: A task is NEVER complete until `goal.md` is explicitly updated. You MUST write the outcome, check off completed items, and outline Next Actions in `goal.md` before stopping your work or returning control to the user.

## 🚀 Team Workflow (4-Phase Lifecycle)

### Phase 1: Plan (The Strategist)
- **Action**: `@goal-buddy` maps repository + reads `คู่มือการใช้งานระบบบริหารงานไปรษณีย์.docx`.
- **Validation**: `@grill-me` challenges the plan. `@multi-agent-brainstorming` finds the best path.
- **Output**: `goal.md` and `PRD.md` at root.

### Phase 2: Design (The Architect)
- **Action**: `@grill-with-docs` creates ADR (Architecture Decision Record).
- **Design**: `@awesome-design-md` defines tokens and components in `DESIGN.md`.
- **Security**: `@better-auth-expert` (mapped to `auth-implementation-patterns`) plans security.

### Phase 3: Build & Test (The Worker)
- **Implementation**: Follow TDD patterns (`@tdd`). Write modular code.
- **Data Sync**: Use `google-sheets-automation` for backend data verification and initial sheet setup.
- **QA**: Run `@access-audit` for UI compliance.
- **Verification**: `@playwright-tester` (mapped to `playwright-skill`) runs real-world scenario tests.

### Phase 4: Document (The Librarian)
- **Knowledge Base**: `@agent-memory` updates `memory.json` or `notes/`.
- **Final Handover**: `@obsidian-markdown` summarizes work for user review.

---
*Note: This file is the foundational mandate for all AI agents in this project.*
