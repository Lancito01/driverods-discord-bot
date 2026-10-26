import {escapeMarkdown, GuildMember} from "discord.js";
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
            fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`)
                .then(res => res.json())
                .then(result => result.Results || []),
            getApprovedCustomVehiclesByMake(make)
        ]);

        return [...customResults, ...apiResults];
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
    if (makeId === -1) {
        return getCustomVehicleById(modelId);
    }
    const models: vehicle[] = await getModelsForMakeId(makeId);
    return models.find((model: vehicle) => model.Model_ID === modelId);
}

export async function getVehicleFromPreference(preference: databaseEntry): Promise<vehicle | undefined> {
    if (preference.custom_id) {
        return getCustomVehicleById(preference.custom_id);
    } else if (preference.make_id && preference.model_id) {
        return await getVehicleForMakeAndModelId(preference.make_id, preference.model_id);
    }
    return undefined;
}

export function getVehicleDisplayName(vehicle: vehicle): string {
    return `${vehicle.Make_Name} ${vehicle.Model_Name}`;
}

export const NICKNAME_MAX_LENGTH = 32; //? Discord's hard limit
const NICKNAME_MIN_NAME_LENGTH = 10; //? never shorten the member's name below this to make room for the car
const ELLIPSIS = "…";
const VEHICLE_TAG_PATTERN = /\s*\[[^\[\]]*\]$/;

/**
 * Shortens a string to fit within maxLength, ending it with "…" when cut.
 * Cuts on whole characters so emoji and other multi-unit characters are never split.
 */
function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;

    const chars = Array.from(str);
    while (chars.length > 0 && chars.join("").trimEnd().length + ELLIPSIS.length > maxLength) {
        chars.pop();
    }
    return chars.join("").trimEnd() + ELLIPSIS;
}

/**
 * The member's name without the bot's " [vehicle]" tag.
 * Keeps their server nickname if they have one; falls back to their account name
 * if there is none, or if the bot previously had to shorten it.
 */
export function getBaseName(guildMember: GuildMember): string {
    const base = guildMember.nickname?.replace(VEHICLE_TAG_PATTERN, "").trim();
    if (!base || base.endsWith(ELLIPSIS)) return guildMember.user.displayName;
    return base;
}

/**
 * Builds "Name [Make Model]" within Discord's 32 character limit.
 * Shortening order, stopping at the first that fits:
 *   1. Name [Make Model]
 *   2. Name [Model]             (only if the model name has letters, so "Mazda 3" never becomes "[3]")
 *   3. Na… [Make Model]         (name kept at least NICKNAME_MIN_NAME_LENGTH long)
 *   4. Na… [Model]
 *   5. Na… [Mod…]               (last resort for very long model names)
 */
export function buildVehicleNickname(baseName: string, vehicle: vehicle): { nickname: string, shortened: boolean } {
    const fullTag = getVehicleDisplayName(vehicle);
    const modelTag = vehicle.Model_Name;
    const tagCandidates = /[a-z]/i.test(modelTag) && modelTag !== fullTag ? [fullTag, modelTag] : [fullTag];

    const format = (name: string, tag: string) => `${name} [${tag}]`;
    const fits = (nickname: string) => nickname.length <= NICKNAME_MAX_LENGTH;

    for (const tag of tagCandidates) {
        const nickname = format(baseName, tag);
        if (fits(nickname)) return {nickname, shortened: tag !== fullTag};
    }

    for (const tag of tagCandidates) {
        const nameBudget = NICKNAME_MAX_LENGTH - format("", tag).length;
        if (nameBudget >= NICKNAME_MIN_NAME_LENGTH) {
            return {nickname: format(truncate(baseName, nameBudget), tag), shortened: true};
        }
    }

    const name = truncate(baseName, NICKNAME_MIN_NAME_LENGTH);
    const tagBudget = NICKNAME_MAX_LENGTH - format(name, "").length;
    return {nickname: format(name, truncate(tagCandidates.at(-1)!, tagBudget)), shortened: true};
}

export type NicknameUpdateResult =
    | { ok: true, nickname: string, shortened: boolean }
    | { ok: false, reason: "no-vehicle" | "not-manageable" | "error" };

/**
 * Sets a guild member's nickname to "Name [vehicle]", shortened to fit Discord's limit if needed.
 * @param guildMember GuildMember to update
 * @param vehicle Vehicle to show in the nickname
 */
export async function applyVehicleNickname(guildMember: GuildMember, vehicle: vehicle): Promise<NicknameUpdateResult> {
    //? the bot can't rename the server owner or anyone with a role above its own
    if (!guildMember.manageable) return {ok: false, reason: "not-manageable"};

    const {nickname, shortened} = buildVehicleNickname(getBaseName(guildMember), vehicle);
    if (guildMember.nickname === nickname) return {ok: true, nickname, shortened};

    beginVehicleNicknameSync(guildMember.id, 1);
    try {
        await guildMember.setNickname(nickname, "Updating nickname with vehicle preference");
    } catch (err) {
        consumeVehicleNicknameSync(guildMember.id); //? no update event is coming, don't swallow the member's next change
        console.error(err);
        return {ok: false, reason: "error"};
    }

    logger(`Updated nickname for ${guildMember.user.tag} to "${nickname}"`, "green");
    return {ok: true, nickname, shortened};
}

/**
 * Update a guild member's nickname based on their vehicle preference.
 * @param preference User's car preference from DB
 * @param guildMember GuildMember to update
 */
export async function updateMemberNicknameWithVehiclePreference(
    preference: databaseEntry,
    guildMember: GuildMember
): Promise<NicknameUpdateResult> {
    const vehicle = await getVehicleFromPreference(preference);
    if (!vehicle) return {ok: false, reason: "no-vehicle"};

    return applyVehicleNickname(guildMember, vehicle);
}

/**
 * A short, member-facing note about what happened to their nickname, or an empty string if nothing needs saying.
 */
export function describeNicknameResult(result: NicknameUpdateResult): string {
    if (result.ok) {
        if (!result.shortened) return "";
        return `\nDiscord nicknames can be at most ${NICKNAME_MAX_LENGTH} characters, so your nickname was shortened to **${escapeMarkdown(result.nickname)}**.`;
    }

    switch (result.reason) {
        case "not-manageable":
            return "\nI couldn't update your nickname: I can't change nicknames for the server owner or members with a higher role than mine.";
        case "error":
            return "\nI couldn't update your nickname right now. Please try again later.";
        default:
            return "";
    }
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
