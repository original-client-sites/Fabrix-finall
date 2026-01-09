
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connectionString = process.env.DATABASE_URL || '';

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connect with IST timezone
const connection = await mysql.createConnection({
  ...parseConnectionString(connectionString),
  timezone: '+05:30', // IST timezone
});

// Set session timezone to IST
try {
  await connection.execute('SET time_zone = "+05:30"');
} catch (error) {
  console.warn('Could not set database timezone to IST:', error);
}

export const db = drizzle(connection);

// Helper function to parse connection string
function parseConnectionString(connectionString: string) {
  // Parse the connection string to extract individual components
  const url = new URL(connectionString);
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove leading slash
  };
}
