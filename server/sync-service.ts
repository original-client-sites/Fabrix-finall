// This file is no longer needed as the application now uses a single database
// The dual database sync functionality has been replaced with a single database approach

export class DatabaseSync {
  async syncFromMysqlToSqlite() {
    console.log('Database sync is disabled - using single database');
  }

  startPeriodicSync(intervalMinutes: number = 5) {
    console.log('Database sync is disabled - using single database');
  }

  stopPeriodicSync() {
    console.log('Database sync is disabled - using single database');
  }
}

export const dbSync = new DatabaseSync();