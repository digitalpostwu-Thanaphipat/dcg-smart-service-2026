# PRD: WUS Track DCG (v1.0.0)

## 1. Executive Summary
WUS Track DCG is a Progressive Web App (PWA) designed for Walailak University to digitize and optimize postal operations. It replaces manual paper tracking with a real-time, offline-capable digital system using Google Sheets as a low-cost, flexible database.

## 2. Objectives
- **Digital Transformation**: Eliminate paper logs for internal and external mail.
- **Operational Efficiency**: Speed up data entry with Smart Search and Recent shortcuts.
- **Data Integrity**: Ensure accurate tracking of budgets and mail volumes.
- **Executive Visibility**: Provide real-time dashboards for management decisions.

## 3. Target Users
- **Postal Staff**: Day-to-day users recording mail movements.
- **Admins**: Manage users, units, and system configurations.
- **Executives**: Review budget usage and operational volume via dashboards.

## 4. Functional Requirements

### 4.1 Internal Mail (Run 🚚)
- Select walking route (Route A, B, etc.).
- Select shift (Morning/Afternoon).
- Check-in at departments and record quantity of envelopes.
- Real-time total calculation.

### 4.2 Mail Sorting (Sort ✉️)
- Search for recipient department (Smart Search).
- Categorize as Regular or Registered mail.
- Basket-style entry for batch confirmation.

### 4.3 External Postage (External 📦)
- Record sender department.
- Select service type (EMS, Registered, etc.).
- Select budget source (University, Enterprise, Project).
- Record price, quantity, and tracking number.
- Batch confirmation with digital receipt generation.

### 4.4 Reporting & Analytics
- Daily operation log with date/unit filters.
- Record deletion (with audit trail considerations).
- **Executive Dashboard**:
    - Budget summary (Mother-Daughter aggregation).
    - Top 5 budget spenders.
    - Top 5 volume active units.
- **LINE Integration**: Copy formatted summary for status reports.

## 5. Non-Functional Requirements
- **PWA**: Installable on Android, iOS, and Desktop. Standalone mode.
- **Offline-First**: Reliable data entry in areas with poor connectivity; sync when back online.
- **Accessibility**: WCAG 2.2 AA compliance (Contrast, Semantic HTML, Screen Reader).
- **Performance**: Instant UI feedback (Optimistic updates).
- **Security**: @wu.ac.th email authentication.
- **Scalability**: Handle annual budget cycles with Auto-Archive on Oct 1st.

## 6. Technical Stack
- **Frontend**: React + Vite + TypeScript.
- **Styling**: Tailwind CSS + Shadcn UI (Radix UI).
- **State Management**: Zustand.
- **Database**: Google Sheets (via Google Apps Script).
- **Offline Storage**: IndexedDB (via Dexie or similar).
- **Animations**: Framer Motion for premium feel.

## 7. Success Metrics
- 100% adoption by postal staff.
- Zero data loss during offline operations.
- Reduction in time taken for monthly budget reconciliation by 50%.
