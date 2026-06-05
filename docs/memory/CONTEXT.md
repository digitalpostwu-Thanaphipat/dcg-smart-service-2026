# Project Context: WUS Track DCG

## Overview
Enterprise-grade PWA for postal tracking at Walailak University.

## Business Logic (Summarized from Manual)
- **Login**: @wu.ac.th email.
- **Modules**:
  - **Run**: Internal mail collection (Route-based).
  - **Sort**: Incoming mail sorting.
  - **External**: Outgoing mail (Thailand Post/Private).
- **Backend**: Google Sheets database with auto-archive on Oct 1st.

## Tech Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS.
- **PWA**: Offline-first via IndexedDB, Optimistic UI.
- **Auth**: better-auth.
- **Database**: Google Sheets (via Google Apps Script).

## Standards
- **Accessibility**: WCAG 2.2 AA (Contrast 4.5:1).
- **Architecture**: Scout-Judge-Worker-Verify loop.
- **Team Roles**:
  - PM/Strategist (@goal-buddy)
  - Knowledge Manager (@agent-memory)
  - Accessibility Specialist (@access-audit)
  - Design Engineer (@awesome-design-md)

## Design Decisions (ADRs)
1. **Offline-First**: Use IndexedDB as primary data source.
2. **Immediate Sync**: Background sync when network is restored.
3. **Optimistic UI**: Reflect changes immediately, handle errors via background retry/notification.
