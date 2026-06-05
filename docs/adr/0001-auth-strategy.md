# ADR 0001: Authentication Strategy

## Status
Proposed

## Context
The application needs a robust authentication system that supports Walailak University emails (@wu.ac.th) and integrates with the existing Google Sheets backend (Master_Users). The current implementation uses a dummy token system.

## Decision
Implement **better-auth** as the core authentication framework.

### Key Components:
1. **Provider**: Google OAuth (restricted to @wu.ac.th domain).
2. **Session Management**: JWT-based sessions stored in HttpOnly cookies.
3. **Source of Truth**:
   - Initial authentication via Google.
   - Authorization/Roles fetched from the `Master_Users` sheet in Google Sheets.
4. **Mock Mode**: Provide a `VITE_MOCK_AUTH` flag for local development to bypass Google OAuth and use a mock user from the sheet.

### Why better-auth?
- Type-safe out of the box.
- Framework agnostic but works great with React/Vite.
- Supports multi-session and advanced security patterns easily.

## Consequences
- Requires a backend proxy or serverless function to handle the OAuth flow and session validation (since Google Apps Script has limitations with direct OAuth redirection headers for SPAs).
- May need a lightweight Node.js/Edge function layer (e.g., Vercel Functions) to sit between the PWA and Google Apps Script for Auth processing.
