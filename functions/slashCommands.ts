import {AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction} from "discord.js";
import {saveUserCarPreference} from "./db";
import {getModelForModelsAndModelId, getModelsArrayForMake, getModelsForMakeId, vehicle} from "./utils";

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
                    name: `${vehicle.Make_Name} ${vehicle.Model_Name}`, // just the display name for autocomplete
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
            const [makeIdRaw, modelIdRaw] = rawSelection.split("&");
            const makeId = Number.parseInt(makeIdRaw, 10);
            const modelId = Number.parseInt(modelIdRaw, 10);

            if (Number.isNaN(makeId) || Number.isNaN(modelId)) {
                await interaction.reply("That selection is invalid.");
                return;
            }

            const models: vehicle[] = await getModelsForMakeId(makeId);
            const model: vehicle | undefined = getModelForModelsAndModelId(models, modelId);

            if (!model) {
                await interaction.reply("Failed to fetch model.");
                return;
            }

            saveUserCarPreference(interaction.user.id, makeId, modelId);
            await interaction.reply(`Saved car preference: ${model.Make_Name} ${model.Model_Name}`);

            return;
        }
        default:
            return;
    }
}