import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(process.cwd(), 'data/driverods.sqlite');
const PROGRESS_FILE = path.resolve(process.cwd(), '.nhtsa_progress');
const db = new Database(DB_PATH);

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cloneNhtsa() {
    console.log('Starting NHTSA database cloning...');

    try {
        const makesResponse = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json');
        const makesData = await makesResponse.json();
        const makes = makesData.Results;

        let startIdx = 0;
        if (fs.existsSync(PROGRESS_FILE)) {
            startIdx = parseInt(fs.readFileSync(PROGRESS_FILE, 'utf8'), 10) || 0;
            console.log(`Resuming from make index ${startIdx}...`);
        }

        for (let i = startIdx; i < makes.length; i++) {
            const make = makes[i];
            const makeId = make.Make_ID;
            const makeName = make.Make_Name;

            console.log(`Fetching models for ${makeName} (${makeId}) [${i+1}/${makes.length}]...`);

            try {
                const modelsResponse = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`);
                const modelsData = await modelsResponse.json();
                const models = modelsData.Results || [];

                const insert = db.prepare(
                    "INSERT OR REPLACE INTO nhtsa_cache (make_id, make_name, model_id, model_name) VALUES (?, ?, ?, ?)"
                );

                const transaction = db.transaction((modelsList: any[]) => {
                    for (const model of modelsList) {
                        insert.run(makeId, makeName, model.Model_ID, model.Model_Name);
                    }
                });

                transaction(models);
            } catch (err) {
                console.error(`Failed to fetch models for ${makeName}:`, err);
            }

            fs.writeFileSync(PROGRESS_FILE, (i + 1).toString());
            await delay(100); // Respect rate limits
        }

        fs.unlinkSync(PROGRESS_FILE);
        console.log('Successfully cloned NHTSA database!');
    } catch (err) {
        console.error('Fatal error during cloning:', err);
    }
}

cloneNhtsa();
