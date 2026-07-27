import {AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction, GuildMember} from "discord.js";
import {databaseEntry, getUserCarPreference, saveUserCarPreference} from "./db";
import {
    getModelsArrayForMake,
    getVehicleDisplayName,
    getVehicleForMakeAndModelId,
    updateMemberNicknameWithVehiclePreference,
    vehicle
} from "./utils";

export async function autocompleteSet(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
    const apiLink = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{}?format=json";

    switch (interaction.options.getSubcommand()) {
        case "car": {
            if (focusedOption.name != "model") return; //? only autocomplete for model
            const makeLookup = interaction.options.getString("make", true);
            const models = await getModelsArrayForMake(makeLookup);

            const suggestions: any[] = (models ?? []) //* ?? is used over || because models can be an empty array, which is falsy, but we still want to use it
                .filter((result: any) => result?.Model_Name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .map((vehicle: any) => ({
                    name: getVehicleDisplayName(vehicle), // just the display name for autocomplete
                    value: `${vehicle.Make_ID}&${vehicle.Model_ID}`
                }))
                .slice(0, 25);

            await interaction.respond(suggestions);
            return;
        }
        default:
            return;
    }
}

export async function commandSet(interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
        case "car": {
            const rawSelection = interaction.options.getString("model", true);
            const [makeIdStr, modelIdStr] = rawSelection.split("&");
            const makeId = Number.parseInt(makeIdStr, 10);
            const modelId = Number.parseInt(modelIdStr, 10);

            if (Number.isNaN(makeId) || Number.isNaN(modelId)) {
                await interaction.reply("That selection is invalid.");
                return;
            }

            const vehicle = await getVehicleForMakeAndModelId(makeId, modelId);
            if (!vehicle) {
                await interaction.reply("Failed to fetch model.")
                return;
            }

            saveUserCarPreference(interaction.user.id, makeId, modelId);

            await updateMemberNicknameWithVehiclePreference(makeId, modelId, interaction.member as GuildMember);

            await interaction.reply(`Saved car preference: ${getVehicleDisplayName(vehicle)}`);

            return;
        }
        default:
            return;
    }
}

export async function commandGet(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
        case "car": {
            const preferences: databaseEntry | undefined = getUserCarPreference(interaction.user.id);

            if (!preferences) {
                await interaction.reply("No car preference found.");
                return;
            }

            const vehicle: vehicle | undefined = await getVehicleForMakeAndModelId(preferences.make_id, preferences.model_id);

            if (!vehicle) {
                await interaction.reply("Failed to fetch vehicle information.");
                return;
            }

            await interaction.reply(getVehicleDisplayName(vehicle));
            await updateMemberNicknameWithVehiclePreference(preferences.make_id, preferences.model_id, interaction.member as GuildMember);
            return;
        }
        default:
            return;
    }
}