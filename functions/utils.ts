import {GuildMember} from "discord.js";
import { getApprovedCustomVehiclesByMake, getCustomVehicleById, databaseEntry } from "./db";

type VehicleNicknameSyncState = {
    remainingEvents: number;
    timeout: ReturnType<typeof setTimeout>;
}

const vehicleNicknameUpdateStates = new Map<string, VehicleNicknameSyncState>();

export function beginVehicleNicknameSync(memberId: string, remainingEvents: number = 2): void {
    const existingState = vehicleNicknameUpdateStates.get(memberId);
    if (existingState) {
        clearTimeout(existingState.timeout);
    }

    const timeout = setTimeout(() => {
        vehicleNicknameUpdateStates.delete(memberId);
    }, 10_000);

    vehicleNicknameUpdateStates.set(memberId, {
        remainingEvents,
        timeout,
    });
}

export function consumeVehicleNicknameSync(memberId: string): boolean {
    const state = vehicleNicknameUpdateStates.get(memberId);
    if (!state) return false;

    state.remainingEvents -= 1;
    if (state.remainingEvents <= 0) {
        clearTimeout(state.timeout);
        vehicleNicknameUpdateStates.delete(memberId);
    }

    return true;
}

export function logger(
    str: string,
    color: string | undefined = undefined,
    type: string | undefined = undefined
): void {
    switch (color) {
        case "red":
            str = `\x1b[31m${str}`;
            break;
        case "green":
            str = `\x1b[32m${str}`;
            break;
        case "yellow":
            str = `\x1b[33m${str}`;
            break;
        case "blue":
            str = `\x1b[34m${str}`;
            break;
        case "magenta":
            str = `\x1b[35m${str}`;
            break;
        case "cyan":
            str = `\x1b[36m${str}`;
            break;
        case "white":
            str = `\x1b[37m${str}`;
            break;
    }
    switch (type) {
        case "bold":
            str = `[1m${str}`;
            break;
        case "underline":
            str = `[4m${str}`;
            break;
        case "inverse":
            str = `[7m${str}`;
            break;
        case "strikethrough":
            str = `[9m${str}`;
            break;
    }
    str += "\x1b[0m";
    console.log(str);
    return;
}

export type vehicle = {
    Make_ID: number
    Make_Name: string
    Model_ID: number
    Model_Name: string
}

export async function getModelsArrayForMake(make: string): Promise<vehicle[]> {
    try {
        const [apiResults, customResults] = await Promise.all([
            fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${make}?format=json`)
                .then(res => res.json())
                .then(result => result.Results || []),
            getApprovedCustomVehiclesByMake(make)
        ]);

        return [...apiResults, ...customResults];
    } catch (err) {
        console.error(err);
        return [];
    }
}

export async function getModelsForMakeId(makeId: number): Promise<vehicle[]> {
    return await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`)
        .then(res => res.json())
        .then(result => result.Results)
        .catch(err => {
            console.error(err);
            return [];
        });
}

export async function getVehicleForMakeAndModelId(makeId: number, modelId: number): Promise<vehicle | undefined> {
    const models: vehicle[] = await getModelsForMakeId(makeId);
    return models.find((model: vehicle) => model.Model_ID === modelId);
}

export function getVehicleDisplayName(vehicle: vehicle): string {
    return `${vehicle.Make_Name} ${vehicle.Model_Name}`;
}

/**
 * Update a guild member's nickname based on their vehicle preference.
 * Resets the nickname to null, then sets it to displayName + [vehicle].
 * @param preference User's car preference from DB
 * @param guildMember GuildMember to update
 * @param nickname Custom nickname to use instead of displayName
 */
export async function updateMemberNicknameWithVehiclePreference(
    preference: databaseEntry,
    guildMember: GuildMember,
    nickname: string | undefined
): Promise<void> {
    beginVehicleNicknameSync(guildMember.id);

    let vehicle: vehicle | undefined;
    if (preference.custom_id) {
        vehicle = getCustomVehicleById(preference.custom_id);
    } else if (preference.make_id && preference.model_id) {
        vehicle = await getVehicleForMakeAndModelId(preference.make_id, preference.model_id);
    }

    if (!vehicle) return undefined;

    if (!nickname)
        await guildMember.setNickname(null)
            .catch(err => console.error(err));

    const newNickname = `${nickname || guildMember.displayName} [${getVehicleDisplayName(vehicle)}]`;

    await guildMember.setNickname(newNickname, "Updating nickname with vehicle preference")
        .catch(err => console.error(err));

    logger(`Updated nickname for ${guildMember.user.tag} to "${newNickname}"`, "green");
}

export function levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
