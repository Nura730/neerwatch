/**
 * NEERWATCH IndexedDB — src/db/db.js
 *
 * Dexie.js database for offline-first observation storage.
 * Database: NeerWatchDB
 * Table: observations
 *
 * syncStatus values: pending | syncing | synced | failed | duplicate
 */

import Dexie from 'dexie';

export const db = new Dexie('NeerWatchDB');

db.version(1).stores({
  /**
   * observations table schema.
   * Indexed fields: ++id (auto), clientId (unique), syncStatus, wardId, testedAt
   * Non-indexed fields are stored but not indexed.
   */
  observations: '++id, &clientId, syncStatus, wardId, testedAt, createdAt',
});

export default db;
