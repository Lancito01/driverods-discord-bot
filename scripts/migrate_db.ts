import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'driverods.sqlite');
const backupPath = path.join(process.cwd(), 'data', 'driverods_backup.sqlite');

async function migrate() {
    console.log('Starting database migration...');

    const db = new Database(dbPath);

    try {
        // 1. Backup current data to a temporary table
        db.exec(`CREATE TABLE IF NOT EXISTS user_car_preferences_old AS SELECT * FROM user_car_preferences`);

        // 2. Drop the old table
        db.exec(`DROP TABLE user_car_preferences`);

        // 3. Recreate the table with the new schema (removing NOT NULL constraints)
        db.exec(`
            CREATE TABLE user_car_preferences (
                user_id TEXT PRIMARY KEY,
                make_id INTEGER,
                model_id INTEGER,
                custom_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Migrate data back
        // We need to handle the fact that the old table might not have custom_id
        const oldData = db.prepare(`SELECT * FROM user_car_preferences_old`).all();

        const insert = db.prepare(`
            INSERT INTO user_car_preferences (user_id, make_id, model_id, custom_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((data) => {
            for (const row of data) {
                insert.run(
                    row.user_id,
                    row.make_id,
                    row.model_id,
                    row.custom_id || null,
                    row.created_at,
                    row.updated_at
                );
            }
        });

        transaction(oldData);

        // 5. Cleanup
        db.exec(`DROP TABLE user_car_preferences_old`);

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        db.close();
    }
}

migrate();
