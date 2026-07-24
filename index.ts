import {config} from 'dotenv';
import {
    Client,
    GatewayIntentBits,
    Message,
    Partials,
    OAuth2Scopes,
    Guild,
    InteractionType,
    ChatInputCommandInteraction,
    AutocompleteInteraction
} from 'discord.js';

config();

import {logger} from './functions/utils';
import {execSync} from 'child_process';

const client = new Client({
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ],
    intents: [
        GatewayIntentBits.Guilds,
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

import * as SlashCommands from './functions/slashCommands';

client.on('interactionCreate', async (interaction) => {
    const {type} = interaction;
    switch (type) {
        case InteractionType.ApplicationCommand: {
            const commandInteraction = interaction as ChatInputCommandInteraction;

            switch (commandInteraction.commandName) {
                case 'set':
                    return SlashCommands.commandSet(commandInteraction);
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

client.on('ready', async function (): Promise<void> {
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
    client.users.fetch(process.env.ANDY_DISCORD_ID!.toString()).then(async user => user.send(`🎉 I have been added to a new server! 🎉\n- Server name: ${guild.name}\n- Server ID: ${guild.id}\n- Server owner: ${await guild.fetchOwner().then(guildMember => {
        return guildMember.user.tag
    })}`))
});

client.login(process.env.DISCORD_TOKEN); //? Log the bot into discord
