export type SyncStatus =
  | 'idle'        // No remote configured
  | 'synced'      // HEAD matches remote
  | 'pending'     // Uncommitted local changes
  | 'pushing'     // Push in progress
  | 'pulling'     // Pull/fetch in progress
  | 'behind'      // Remote has commits we don't have (after fetch)
  | 'conflict'    // Non-FF merge attempted — Conflict Resolver open
  | 'auth_error'; // 401/403 from remote
