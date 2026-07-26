import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbDirectory = path.resolve(process.cwd(), "data");
const dbPath = path.join(dbDirectory, "driverods.sqlite");

if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS user_car_preferences (
        user_id TEXT PRIMARY KEY,
        make_id INTEGER NOT NULL,
        model_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

export function saveUserCarPreference(userId: string, makeId: number, modelId: number): void {
    const stmt = db.prepare(`
        INSERT INTO user_car_preferences (user_id, make_id, model_id, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            make_id = excluded.make_id,
            model_id = excluded.model_id,
            updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(userId, makeId, modelId);
}

export function getUserCarPreference(userId: string): { user_id: string; make_id: number; model_id: number } | undefined {
    return db.prepare(
        "SELECT user_id, make_id, model_id FROM user_car_preferences WHERE user_id = ?"
    ).get(userId) as { user_id: string; make_id: number; model_id: number } | undefined;
}
