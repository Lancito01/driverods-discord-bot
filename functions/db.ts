import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { vehicle } from "./utils";

const dbDirectory = path.resolve(process.cwd(), "data");
const dbPath = path.join(dbDirectory, "driverods.sqlite");

if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, {recursive: true});
}

const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS user_car_preferences (
        user_id TEXT PRIMARY KEY,
        make_id INTEGER,
        model_id INTEGER,
        custom_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
        admin_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS custom_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        submitter_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nhtsa_cache (
        make_id INTEGER,
        make_name TEXT,
        model_id INTEGER,
        model_name TEXT,
        PRIMARY KEY (make_id, model_id)
    );
`);

// Ensure custom_id exists in user_car_preferences for existing installations
try {
    db.prepare("ALTER TABLE user_car_preferences ADD COLUMN custom_id INTEGER").run();
} catch (e) {
    // Column already exists
}

export function saveUserCarPreference(userId: string, makeId: number | null, modelId: number | null, customId: number | null = null): void {
    const stmt = db.prepare(`
        INSERT INTO user_car_preferences (user_id, make_id, model_id, custom_id, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            make_id = excluded.make_id,
            model_id = excluded.model_id,
            custom_id = excluded.custom_id,
            updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(userId, makeId, modelId, customId);
}

export function removeUserCarPreference(userId: string): void {
    const stmt = db.prepare(`
        DELETE FROM user_car_preferences WHERE user_id = ?
    `);
    stmt.run(userId);
}

export type databaseEntry = {
    user_id: string;
    make_id: number | null;
    model_id: number | null;
    custom_id: number | null;
}

export function getUserCarPreference(userId: string): databaseEntry | undefined {
    return db.prepare(
        "SELECT user_id, make_id, model_id, custom_id FROM user_car_preferences WHERE user_id = ?"
    ).get(userId) as databaseEntry | undefined;
}

// Admin Helpers
export function isAdmin(userId: string): boolean {
    const result = db.prepare("SELECT 1 FROM admins WHERE admin_id = ?").get(userId);
    return !!result;
}

export function addAdmin(userId: string): void {
    db.prepare("INSERT OR IGNORE INTO admins (admin_id) VALUES (?)").run(userId);
}

export function removeAdmin(userId: string): void {
    db.prepare("DELETE FROM admins WHERE admin_id = ?").run(userId);
}

// Custom Vehicle Helpers
export function saveCustomVehicle(make: string, model: string, userId: string): number {
    const result = db.prepare(
        "INSERT INTO custom_vehicles (make, model, submitter_id) VALUES (?, ?, ?)"
    ).run(make, model, userId);
    return result.lastInsertRowid;
}

export function updateCustomVehicleStatus(id: number, status: string): void {
    db.prepare("UPDATE custom_vehicles SET status = ? WHERE id = ?").run(status, id);
}

export function updateCustomVehicleData(id: number, make: string, model: string): void {
    db.prepare("UPDATE custom_vehicles SET make = ?, model = ? WHERE id = ?").run(make, model, id);
}

export function getApprovedCustomVehiclesByMake(make: string): vehicle[] {
    const rows = db.prepare(
        "SELECT make as Make_Name, model as Model_Name FROM custom_vehicles WHERE make = ? AND status = 'approved'"
    ).all() as any[];

    return rows.map(row => ({
        Make_ID: -1, // Custom vehicles don't have NHTSA IDs
        Make_Name: row.Make_Name,
        Model_ID: -1,
        Model_Name: row.Model_Name
    }));
}

export function getCustomVehicleById(id: number): vehicle | undefined {
    const row = db.prepare(
        "SELECT make as Make_Name, model as Model_Name FROM custom_vehicles WHERE id = ?"
    ).get(id) as any | undefined;

    if (!row) return undefined;

    return {
        Make_ID: -1,
        Make_Name: row.Make_Name,
        Model_ID: -1,
        Model_Name: row.Model_Name
    };
}

export function getCustomVehicleRequest(id: number): any | undefined {
    return db.prepare(
        "SELECT * FROM custom_vehicles WHERE id = ?"
    ).get(id) as any | undefined;
}

export function saveNhtsaCache(makeId: number, makeName: string, modelId: number, modelName: string): void {
    db.prepare(
        "INSERT OR REPLACE INTO nhtsa_cache (make_id, make_name, model_id, model_name) VALUES (?, ?, ?, ?)"
    ).run(makeId, makeName, modelId, modelName);
}

export function getCachedModelsForMake(makeId: number): vehicle[] {
    const rows = db.prepare(
        "SELECT make_name as Make_Name, model_name as Model_Name, make_id as Make_ID, model_id as Model_ID FROM nhtsa_cache WHERE make_id = ?"
    ).all() as any[];

    return rows.map(row => ({
        Make_ID: row.Make_ID,
        Make_Name: row.Make_Name,
        Model_ID: row.Model_ID,
        Model_Name: row.Model_Name
    }));
}
