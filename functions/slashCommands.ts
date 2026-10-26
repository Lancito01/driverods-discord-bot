import {
    ActionRowBuilder,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";
import {
    addAdmin,
    databaseEntry,
    getAllAdmins,
    getCustomVehiclesCount,
    getCustomVehiclesPaged,
    getSetting,
    getUserCarPreference,
    isAdmin,
    removeAdmin,
    removeSetting,
    removeUserCarPreference,
    saveCustomVehicle,
    saveUserCarPreference,
    setSetting
} from "./db";
import {
    beginVehicleNicknameSync,
    getModelsArrayForMake,
    getVehicleDisplayName,
    getVehicleForMakeAndModelId,
    getVehicleFromPreference,
    updateMemberNicknameWithVehiclePreference
} from "./utils";
import {config} from "dotenv"

config();

export async function autocompleteSet(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
    const apiLink = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{}?format=json";

    switch (interaction.options.getSubcommand()) {
        case "car": {
            if (focusedOption.name != "model") return; //? only autocomplete for model
            //? not required here: Discord omits "make" from autocomplete payloads until the user fills it in
            const makeLookup = interaction.options.getString("make")?.trim();
            if (!makeLookup) {
                await interaction.respond([]);
                return;
            }
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

            const vehicle = await getVehicleFromPreference(preferences);

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
        return interaction.reply({content: "This command is reserved for the developer.", ephemeral: true});
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
        const userId = interaction.options.getString("user_id", true);
        addAdmin(userId);
        return interaction.reply(`Added <@${userId}> as an admin.`);
    } else if (subcommand === "remove") {
        const userId = interaction.options.getString("user_id", true);
        removeAdmin(userId);
        return interaction.reply(`Removed <@${userId}> as an admin.`);
    } else if (subcommand === "list") {
        const admins = getAllAdmins();
        if (admins.length === 0) {
            return interaction.reply("No admins found.");
        }

        const adminList = admins.map((id: any) => `<@${id}>`).join(", ");

        const rows = [];
        for (let i = 0; i < admins.length; i += 5) {
            const chunk = admins.slice(i, i + 5);
            const buttons = chunk.map((id: any) =>
                new ButtonBuilder()
                    .setCustomId(`admin_remove_${id}`)
                    .setLabel(`Remove <@${id}>`)
                    .setStyle(ButtonStyle.Danger)
            );
            rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
        }

        if (rows.length > 5) {
            return interaction.reply({
                content: `Too many admins to list with buttons (${admins.length}). Please use \`/admin remove <userId>\`.`,
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `**Current Admins:**\n${adminList}`,
            components: rows,
            ephemeral: true
        });
    } else if (subcommand === "channel") {
        const channelId = interaction.options.getChannel('channel')?.id;
        if (channelId) {
            setSetting('submission_channel', channelId);
            return interaction.reply(`Submission channel set to <#${channelId}>.`);
        } else {
            removeSetting('submission_channel');
            return interaction.reply(`Submission channel cleared. Defaulting to developer DMs.`);
        }
    }
}

export async function commandSubmit(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "car") {
        await interaction.deferReply({ephemeral: true});

        const make = interaction.options.getString("make", true);
        const model = interaction.options.getString("model", true);

        try {
            // Check for existing car in NHTSA API
            const models = await getModelsArrayForMake(make);
            const exactMatch = models?.find(v => v.Model_Name.toLowerCase() === model.toLowerCase());

            if (exactMatch) {
                return interaction.editReply({
                    content: `The car ${getVehicleDisplayName(exactMatch)} already exists in the database! You can use \`/set car\` to select it.`,
                });
            }

            // If not found, submit for review
            const requestId = saveCustomVehicle(make, model, interaction.user.id);

            // Determine where to send the request
            const channelId = getSetting('submission_channel');
            let target: any;

            if (channelId) {
                target = await interaction.client.channels.fetch(channelId).catch(() => null);
            }

            if (!target) {
                target = await interaction.client.users.fetch(process.env.ANDY_DISCORD_ID!).catch(() => null);
            }

            if (!target) {
                return interaction.editReply({content: "Failed to locate a destination for the submission request. Please contact the developer."});
            }

            const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`car_approve_${requestId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`car_deny_${requestId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`car_modify_${requestId}`).setLabel('Modify').setStyle(ButtonStyle.Primary),
            );

            await target.send({
                content: `🚗 **New Car Submission**\n**User:** <@${interaction.user.id}>\n**Make:** ${make}\n**Model:** ${model}\n**Request ID:** ${requestId}`,
                components: [rowButtons]
            }).catch((err: any) => console.error("Failed to send review request:", err));

            return interaction.editReply({content: "Your car submission has been sent to the admins for review!"});
        } catch (err) {
            console.error("Error in commandSubmit:", err);
            return interaction.editReply({content: "An error occurred while processing your submission. Please try again later."});
        }
    } else if (subcommand === "list") {
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({content: "This command is reserved for admins.", ephemeral: true});
        }

        const makeFilter = interaction.options.getString("make") ?? undefined;
        const page = 1;
        const limit = 25;

        const vehicles = getCustomVehiclesPaged(page, limit, makeFilter);
        const total = getCustomVehiclesCount(makeFilter);

        if (vehicles.length === 0) {
            return interaction.reply({content: "No custom vehicles found.", ephemeral: true});
        }

        const {StringSelectMenuBuilder} = require('discord.js');
        const selectMenu = new ActionRowBuilder<any>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`submit_manage_${makeFilter || 'all'}`)
                .setPlaceholder('Select a vehicle to manage...')
                .addOptions(
                    vehicles.map((v: any) => ({
                        label: `${v.make} ${v.model}`,
                        description: `ID: ${v.id} | Status: ${v.status}`,
                        value: v.id.toString()
                    }))
                )
        );

        const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`submit_list_prev_${page}_${makeFilter || 'all'}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId(`submit_list_next_${page}_${makeFilter || 'all'}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(vehicles.length < limit)
        );

        return interaction.reply({
            content: `**Custom Vehicle List** ${makeFilter ? `(Filter: ${makeFilter})` : ''}\nPage ${page} | Total: ${total}`,
            components: [selectMenu, rowButtons],
            ephemeral: true
        });
    }
}
