# ADR 0002: Offline-First Database Strategy

## Status
Proposed

## Context
The PWA must function in areas with poor or no connectivity (e.g., mail delivery routes). Data must be captured locally and synced when online.

## Decision
Enhance the **IndexedDB (idb)** implementation to act as a robust local cache and queue.

### Storage Schema:
1. **logs**: Stores transactional data (Run, Sort, External) with a `syncStatus` ('pending', 'syncing', 'synced').
2. **master_data**: Caches `Master_Users`, `Master_Departments`, and `Master_Services` for offline dropdown population.
3. **sync_queue**: A dedicated store for failed operations that need retry logic.

### Synchronization Flow:
1. **Write**: Always write to IndexedDB first (Optimistic UI).
2. **Sync**:
   - If online: Trigger background sync to Google Apps Script.
   - If offline: Wait for `online` event or service worker periodic sync.
3. **Conflict Resolution**: Last-Write-Wins (LWW) based on client-side timestamps, as most operations are append-only logs.

### PWA Integration:
- Use `vite-plugin-pwa` for service worker management.
- Use `Background Sync API` where supported.

## Consequences
- Increased complexity in state management (handling 'pending' UI states).
- Need for robust error handling and user notification for failed syncs.
- Local storage limits must be monitored (though postal logs are lightweight).
