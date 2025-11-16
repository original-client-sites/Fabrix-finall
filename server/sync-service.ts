// This file is no longer needed as the application now uses a single PostgreSQL database
// The dual MySQL/SQLite sync functionality has been replaced with PostgreSQL only

export class DatabaseSync {
  async syncFromMysqlToSqlite() {
    console.log('Database sync is disabled - using single PostgreSQL database');
  }

  startPeriodicSync(intervalMinutes: number = 5) {
    console.log('Database sync is disabled - using single PostgreSQL database');
  }

  stopPeriodicSync() {
    console.log('Database sync is disabled - using single Mysql database');
  }
}

export const dbSync = new DatabaseSync();