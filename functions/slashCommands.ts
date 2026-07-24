import {AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction} from "discord.js";

export async function autocompleteSet(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
    const apiLink = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{}?format=json";

    switch (interaction.options.getSubcommand()) {
        case "car": {
            if (focusedOption.name != "model") return;
            const makeLookup = interaction.options.getString("make", true);
            const result = await fetch(
                apiLink.replace("{}", makeLookup)
            )
                .then((res) => res.json())
                .catch((err) => console.error(err));

            const suggestions = (result?.Results ?? [])
                .filter((result: any) => result?.Model_Name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .map((vehicle: any) => ({
                    name: `${vehicle.Make_Name} ${vehicle.Model_Name}`, // just the display name for autocomplete
                    value: `${vehicle.Model_ID}` // this is the actual data that gets saved to the option
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
            const make = interaction.options.getString("make", true);
            const model = interaction.options.getString("model", true);
            console.log(`Car saved: ${make} ${model}`);
            await interaction.reply(`Saved car: ${make} ${model}`);
            return;
        }
        default:
            return;
    }
}