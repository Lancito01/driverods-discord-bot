import {config} from 'dotenv';
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    GatewayIntentBits,
    Guild,
    GuildMember,
    InteractionType,
    Message,
    OAuth2Scopes,
    PartialGuildMember,
    Partials,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuInteraction,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} from 'discord.js';
import {consumeVehicleNicknameSync, logger, updateMemberNicknameWithVehiclePreference} from './functions/utils';
import {execSync} from 'child_process';
import * as SlashCommands from './functions/slashCommands';
import {databaseEntry, getUserCarPreference, saveUserCarPreference, updateCustomVehicleStatus, updateCustomVehicleData, getCustomVehicleRequest, removeAdmin, isAdmin} from "./functions/db";

config();

const client = new Client({
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
    ]
})

let isRunning: { [key: string]: boolean } = {};
let MessagesBuffer: { [key: string]: Message[] } = {};

client.on('interactionCreate', async (interaction) => {
    const {type} = interaction;
    switch (type) {
        case InteractionType.ApplicationCommand: {
            const commandInteraction = interaction as ChatInputCommandInteraction;

            switch (commandInteraction.commandName) {
                case 'set':
                    return SlashCommands.commandSet(commandInteraction);
                case 'get':
                    return SlashCommands.commandGet(commandInteraction);
                case 'clear':
                    return SlashCommands.commandClear(commandInteraction);
                case 'restart':
                    return SlashCommands.commandRestart(commandInteraction);
                case 'admin':
                    return SlashCommands.commandAdmin(commandInteraction);
                case 'submit':
                    return SlashCommands.commandSubmit(commandInteraction);
                default:
                    return;
            }
        }

        case InteractionType.ApplicationCommandAutocomplete: {
            const autocompleteInteraction = interaction as AutocompleteInteraction;
            const focusedOption = interaction.options.getFocused(true);

            switch (autocompleteInteraction.commandName) {
                case 'set':
                    return SlashCommands.autocompleteSet(autocompleteInteraction, focusedOption);
                default:
                    return;
            }
        }

        case InteractionType.MessageComponent: {
            const componentInteraction = interaction as any;
            const customId = componentInteraction.customId;

            if (customId.startsWith('car_approve_') || customId.startsWith('car_deny_') || customId.startsWith('car_modify_')) {
                if (!isAdmin(componentInteraction.user.id)) {
                    return componentInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }
            }

            if (customId.startsWith('submit_manage_')) {
                if (!isAdmin(componentInteraction.user.id)) {
                    return componentInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }
                const vehicleId = componentInteraction.values[0];
                const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`submit_modify_${vehicleId}`).setLabel('Modify').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`submit_delete_${vehicleId}`).setLabel('Delete').setStyle(ButtonStyle.Danger),
                );

                await componentInteraction.reply({
                    content: `Managing vehicle #${vehicleId}. Choose an action:`,
                    components: [rowButtons],
                    ephemeral: true
                });
                return;
            }

            if (customId.startsWith('submit_list_prev_') || customId.startsWith('submit_list_next_')) {
                if (!isAdmin(componentInteraction.user.id)) {
                    return componentInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }

                const [,, action, pageStr, make] = customId.split('_');
                const page = Number(pageStr);
                const newPage = action === 'prev' ? page - 1 : page + 1;
                const limit = 25;

                const vehicles = require('./functions/db').getCustomVehiclesPaged(newPage, limit, make === 'all' ? undefined : make);
                const total = require('./functions/db').getCustomVehiclesCount(make === 'all' ? undefined : make);

                if (vehicles.length === 0 && newPage > 1) {
                    return componentInteraction.reply({ content: "No more vehicles found.", ephemeral: true });
                }

                const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`submit_manage_${make}`)
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
                        .setCustomId(`submit_list_prev_${newPage}_${make}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`submit_list_next_${newPage}_${make}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(vehicles.length < limit)
                );

                await componentInteraction.update({
                    content: `**Custom Vehicle List** ${make !== 'all' ? `(Filter: ${make})` : ''}\nPage ${newPage} | Total: ${total}`,
                    components: [selectMenu, rowButtons],
                    ephemeral: true
                });
                return;
            }

            if (customId.startsWith('submit_delete_')) {
                if (!isAdmin(componentInteraction.user.id)) {
                    return componentInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }
                const vehicleId = Number(customId.split('_')[2]);
                require('./functions/db').deleteCustomVehicle(vehicleId);
                await componentInteraction.reply({ content: `Deleted custom vehicle #${vehicleId}.`, ephemeral: true });
                await componentInteraction.message.delete().catch((err: any) => console.error("Failed to delete management message:", err));
                return;
            }

            if (customId.startsWith('submit_modify_')) {
                if (!isAdmin(componentInteraction.user.id)) {
                    return componentInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }
                const vehicleId = Number(customId.split('_')[2]);
                const request = require('./functions/db').getCustomVehicleRequest(vehicleId);

                if (!request) return componentInteraction.reply({ content: "Request not found.", ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(`submit_modify_submit_${vehicleId}`)
                    .setTitle('Modify Custom Vehicle');

                const makeInput = new TextInputBuilder()
                    .setCustomId('make')
                    .setLabel('Make')
                    .setValue(request.make)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const modelInput = new TextInputBuilder()
                    .setCustomId('model')
                    .setLabel('Model')
                    .setValue(request.model)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(makeInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput)
                );

                await componentInteraction.showModal(modal);
                return;
            }

            if (customId.startsWith('car_approve_')) {
                const requestId = Number(customId.split('_')[2]);
                const request = getCustomVehicleRequest(requestId);

                if (!request) return componentInteraction.reply({ content: "Request not found.", ephemeral: true });

                updateCustomVehicleStatus(requestId, 'approved');
                saveUserCarPreference(request.submitter_id, null, null, requestId);

                // Try to find the user in a guild to update nickname
                const member = await componentInteraction.client.guilds.cache.find((g: Guild) => g.members.cache.has(request.submitter_id))?.members.fetch(request.submitter_id);

                if (member) {
                    await updateMemberNicknameWithVehiclePreference({
                        user_id: request.submitter_id,
                        make_id: null,
                        model_id: null,
                        custom_id: requestId
                    }, member as GuildMember, undefined);
                }

                await componentInteraction.reply({ content: `Approved car request #${requestId} for <@${request.submitter_id}>.`, ephemeral: true });
                await componentInteraction.client.users.fetch(request.submitter_id).then((user: any) => user.send(`🎉 Your custom car request for ${request.make} ${request.model} has been approved!`));

                await componentInteraction.message.delete().catch((err: any) => console.error("Failed to delete request message:", err));
                return;
            }

            if (customId.startsWith('car_deny_')) {
                const requestId = Number(customId.split('_')[2]);
                const request = getCustomVehicleRequest(requestId);

                if (!request) return componentInteraction.reply({ content: "Request not found.", ephemeral: true });

                updateCustomVehicleStatus(requestId, 'rejected');
                await componentInteraction.reply({ content: `Denied car request #${requestId}.`, ephemeral: true });
                await componentInteraction.client.users.fetch(request.submitter_id).then((user: any) => user.send(`❌ Your custom car request for ${request.make} ${request.model} was denied.`));

                await componentInteraction.message.delete().catch((err: any) => console.error("Failed to delete request message:", err));
                return;
            }

            if (customId.startsWith('admin_remove_')) {
                const adminId = customId.split('_')[2];
                removeAdmin(adminId);
                await componentInteraction.reply({ content: `Removed <@${adminId}> as an admin.`, ephemeral: true });
                return;
            }

            if (customId.startsWith('car_modify_')) {
                const requestId = Number(customId.split('_')[2]);
                const request = getCustomVehicleRequest(requestId);

                if (!request) return componentInteraction.reply({ content: "Request not found.", ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(`car_modify_submit_${requestId}`)
                    .setTitle('Modify Car Submission');

                const makeInput = new TextInputBuilder()
                    .setCustomId('make')
                    .setLabel('Make')
                    .setValue(request.make)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const modelInput = new TextInputBuilder()
                    .setCustomId('model')
                    .setLabel('Model')
                    .setValue(request.model)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(makeInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput)
                );

                await componentInteraction.showModal(modal);
                return;
            }

            return;
        }

        case InteractionType.ModalSubmit: {
            const modalInteraction = interaction as any;
            const customId = modalInteraction.customId;

            if (customId.startsWith('submit_modify_submit_')) {
                if (!isAdmin(modalInteraction.user.id)) {
                    return modalInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }
                const vehicleId = Number(customId.split('_')[3]);
                const make = modalInteraction.fields.getTextInputValue('make');
                const model = modalInteraction.fields.getTextInputValue('model');

                require('./functions/db').updateCustomVehicleData(vehicleId, make, model);
                await modalInteraction.reply({ content: `Updated custom vehicle #${vehicleId} to ${make} ${model}.`, ephemeral: true });
                return;
            }

            if (customId.startsWith('car_modify_submit_')) {
                if (!isAdmin(modalInteraction.user.id)) {
                    return modalInteraction.reply({ content: "You are not authorized to perform this action.", ephemeral: true });
                }

                const requestId = Number(customId.split('_')[3]);
                const make = modalInteraction.fields.getTextInputValue('make');
                const model = modalInteraction.fields.getTextInputValue('model');

                updateCustomVehicleData(requestId, make, model);
                updateCustomVehicleStatus(requestId, 'approved');

                const request = getCustomVehicleRequest(requestId);
                if (request) {
                    saveUserCarPreference(request.submitter_id, null, null, requestId);
                    const member = await modalInteraction.client.guilds.cache.find((g: Guild) => g.members.cache.has(request.submitter_id))?.members.fetch(request.submitter_id);
                    if (member) {
                        await updateMemberNicknameWithVehiclePreference({
                            user_id: request.submitter_id,
                            make_id: null,
                            model_id: null,
                            custom_id: requestId
                        }, member as GuildMember, undefined);
                    }
                    await modalInteraction.client.users.fetch(request.submitter_id).then((user: any) => user.send(`🎉 Your custom car request for ${make} ${model} has been modified and approved!`));
                }

                await modalInteraction.reply({ content: `Modified and approved car request #${requestId}.`, ephemeral: true });
                return;
            }

            return;
        }

        default:
            return;
    }
})

client.on('messageCreate', async (originalMessage: Message) => {
    if (originalMessage.author.bot) return;
    // if (originalMessage.guild && !originalMessage.mentions.users.has(client.user!.id)) return;

    MessagesBuffer[originalMessage.channel.id] = [
        ...(MessagesBuffer[originalMessage.channel.id] || []),
        originalMessage
    ];

    if (isRunning[originalMessage.channel.id]) {
        console.log("> Client already running...");
        return;
    }

    isRunning[originalMessage.channel.id] = true;

    while (MessagesBuffer[originalMessage.channel.id].length > 0) {
        let message: Message | undefined = MessagesBuffer[originalMessage.channel.id].shift(); // gets first message in buffer
        if (!message) continue;

        //? body
        if (message.content == "!test") {
            await message.reply("Test");
        }

        isRunning[originalMessage.channel.id] = false;
    }
})

//* Event listeners
//* For more information on all events: https://discord.js.org/docs/packages/discord.js/main/ClientEvents:Interface
process.on('uncaughtException', (err: Error /*, origin*/): void => {
    client.users.fetch(process.env.ANDY_DISCORD_ID!.toString()).then(user => user.send(`❌ An uncaught exception occured. 🥲\nPlease see error information for more details:\n\`\`\`\n${err}\n\`\`\``))
    console.log(err);
});

client.on('clientReady', async function (): Promise<void> {
    console.log();
    logger(`${client.user!.tag} has successfully logged in!`, "green", "bold");
    console.log("Invite Link:");
    console.log( // * Generating invite link (thanks Chloe)
        client.generateInvite({
            permissions: ["Administrator"],
            scopes: [OAuth2Scopes.ApplicationsCommands, OAuth2Scopes.Bot],
        })
    );

    //? Log the commit hash
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    logger(`Running commit: ${commit}`, "cyan", "bold");
});

client.on('guildCreate', async function (guild: Guild): Promise<void> {
    client.users.fetch(process.env.ANDY_DISCORD_ID!.toString()).then(async user => user.send(
        `🎉 I have been added to a new server! 🎉\n- Server name: ${guild.name}\n- Server ID: ${guild.id}\n- Server owner: ${await guild.fetchOwner().then(guildMember => {
            return guildMember.user.tag
        })}`
    ))
});

client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> => {
    if (consumeVehicleNicknameSync(newMember.id)) return;
    if (oldMember.nickname === newMember.nickname) return;
    logger(
        `Detected nickname change by ${newMember.displayName}\n${oldMember.displayName} => ${newMember.displayName}`,
        "yellow"
    );

    const dbEntry: databaseEntry | undefined = getUserCarPreference(newMember.user.id);
    if (!dbEntry) return;

    await updateMemberNicknameWithVehiclePreference(dbEntry, newMember, newMember.displayName);
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("> Logging in...")); //? Log the bot into discord
