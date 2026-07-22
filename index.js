"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const discord_js_1 = require("discord.js");
(0, dotenv_1.config)();
const utils_1 = require("./functions/utils");
const child_process_1 = require("child_process");
const client = new discord_js_1.Client({
    partials: [
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.Reaction
    ],
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.GuildMessageTyping,
        discord_js_1.GatewayIntentBits.GuildPresences,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageTyping,
    ]
});
let isRunning = {};
let MessagesBuffer = {};
client.on('messageCreate', async (originalMessage) => {
    if (originalMessage.author.bot)
        return;
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
        let message = MessagesBuffer[originalMessage.channel.id].shift(); // gets first message in buffer
        if (!message)
            continue;
        //? body
        if (message.content == "!test") {
            await message.reply("Test");
        }
        isRunning[originalMessage.channel.id] = false;
    }
});
//* Event listeners
//* For more information on all events: https://discord.js.org/docs/packages/discord.js/main/ClientEvents:Interface
process.on('uncaughtException', (err /*, origin*/) => {
    client.users.fetch(process.env.ANDY_DISCORD_ID.toString()).then(user => user.send(`❌ An uncaught exception occured. 🥲\nPlease see error information for more details:\n\`\`\`\n${err}\n\`\`\``));
    console.log(err);
});
client.on('ready', async function () {
    console.log();
    (0, utils_1.logger)(`${client.user.tag} has successfully logged in!`, "green", "bold");
    console.log("Invite Link:");
    console.log(// * Generating invite link (thanks Chloe)
    client.generateInvite({
        permissions: ["Administrator"],
        scopes: [discord_js_1.OAuth2Scopes.ApplicationsCommands, discord_js_1.OAuth2Scopes.Bot],
    }));
    //? Log the commit hash
    const commit = (0, child_process_1.execSync)('git rev-parse --short HEAD').toString().trim();
    (0, utils_1.logger)(`Running commit: ${commit}`, "cyan", "bold");
});
client.on('guildCreate', async function (guild) {
    client.users.fetch(process.env.ANDY_DISCORD_ID.toString()).then(async (user) => user.send(`🎉 I have been added to a new server! 🎉\n- Server name: ${guild.name}\n- Server ID: ${guild.id}\n- Server owner: ${await guild.fetchOwner().then(guildMember => { return guildMember.user.tag; })}`));
});
client.login(process.env.DISCORD_TOKEN); //? Log the bot into discord
