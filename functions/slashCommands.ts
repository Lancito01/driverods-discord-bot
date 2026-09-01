import {AutocompleteFocusedOption, AutocompleteInteraction, ChatInputCommandInteraction, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";
import {databaseEntry, getUserCarPreference, removeUserCarPreference, saveUserCarPreference, isAdmin, addAdmin, removeAdmin, saveCustomVehicle} from "./db";
import {
    beginVehicleNicknameSync,
    getModelsArrayForMake,
    getVehicleDisplayName,
    getVehicleForMakeAndModelId,
    updateMemberNicknameWithVehiclePreference,
    vehicle,
    levenshteinDistance
} from "./utils";
import {config} from "dotenv"

config();

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

            await updateMemberNicknameWithVehiclePreference({
                user_id: interaction.user.id,
                make_id: makeId,
                model_id: modelId,
                custom_id: null
            }, interaction.member as GuildMember, undefined);

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

            const vehicle: vehicle | undefined = await getVehicleForMakeAndModelId(preferences.make_id || 0, preferences.model_id || 0);

            if (!vehicle) {
                await interaction.reply("Failed to fetch vehicle information.");
                return;
            }

            await interaction.reply(getVehicleDisplayName(vehicle));
            await updateMemberNicknameWithVehiclePreference(preferences, interaction.member as GuildMember, undefined);
            return;
        }
        default:
            return;
    }
}

export async function commandClear(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
        case "car": {
            removeUserCarPreference(interaction.user.id);

            const member = interaction.member as GuildMember;

            if (!member)
                return;

            beginVehicleNicknameSync(member.id, 1);
            await member.setNickname(null, "Clearing car preference.")
                .catch(err => console.error(err));
            await interaction.reply("Cleared car preference.");
            return;
        }
        default:
            return;
    }
}

export async function commandRestart(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id != process.env.ANDY_DISCORD_ID) return;

    await interaction.reply("> Restarting bot...");
    process.exit(0);
}

export async function commandAdmin(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.ANDY_DISCORD_ID) {
        return interaction.reply({ content: "This command is reserved for the developer.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.options.getString("user_id", true);

    if (subcommand === "add") {
        addAdmin(userId);
        return interaction.reply(`Added <@${userId}> as an admin.`);
    } else if (subcommand === "remove") {
        removeAdmin(userId);
        return interaction.reply(`Removed <@${userId}> as an admin.`);
    }
}

export async function commandSubmitCar(interaction: ChatInputCommandInteraction) {
    const make = interaction.options.getString("make", true);
    const model = interaction.options.getString("model", true);

    // Check for existing car in NHTSA API
    const models = await getModelsArrayForMake(make);
    const exactMatch = models?.find(v => v.Model_Name.toLowerCase() === model.toLowerCase());

    if (exactMatch) {
        return interaction.reply({
            content: `The car ${getVehicleDisplayName(exactMatch)} already exists in the database! You can use \`/set car\` to select it.`,
            ephemeral: true
        });
    }

    // If not found, submit for review
    const requestId = saveCustomVehicle(make, model, interaction.user.id);

    const devUser = await interaction.client.users.fetch(process.env.ANDY_DISCORD_ID!);

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`car_approve_${requestId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`car_deny_${requestId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`car_modify_${requestId}`).setLabel('Modify').setStyle(ButtonStyle.Primary),
    );

    await devUser.send({
        content: `🚗 **New Car Submission**\n**User:** <@${interaction.user.id}>\n**Make:** ${make}\n**Model:** ${model}\n**Request ID:** ${requestId}`,
        components: [rowButtons]
    });

    return interaction.reply({ content: "Your car submission has been sent to the admins for review!", ephemeral: true });
}
