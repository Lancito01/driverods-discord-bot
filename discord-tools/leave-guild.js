#!/usr/bin/env node

const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Client, GatewayIntentBits } = require('discord.js');

function showGuilds(guilds) {
    if (guilds.size === 0) {
        console.log('The bot is not a member of any guilds.');
        return;
    }

    console.table([...guilds.values()].map(({ id, name }) => ({ id, name })));
}

async function connect() {
    if (!process.env.DISCORD_TOKEN) {
        throw new Error('DISCORD_TOKEN is required. Add it to the application .env file.');
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    if (!client.isReady()) {
        await new Promise((resolve) => client.once('ready', resolve));
    }

    return client;
}

async function main() {
    const readline = createInterface({ input: stdin, output: stdout });
    const prompt = (question) => readline.question(question);
    let client;

    try {
        console.log('DRIVERODS Guild Manager');
        console.log('\n1. List servers containing the bot');
        console.log('2. Leave a server');
        console.log('0. Exit');

        const action = (await prompt('\nChoose an option: ')).trim();
        if (action === '0') return;
        if (!['1', '2'].includes(action)) {
            console.log('No action selected.');
            return;
        }

        client = await connect();
        const guilds = await client.guilds.fetch();

        if (action === '1') {
            showGuilds(guilds);
            return;
        }

        showGuilds(guilds);
        if (guilds.size === 0) return;

        const guildId = (await prompt('\nEnter the ID of the server to leave (or leave blank to cancel): ')).trim();
        if (!guildId) return;

        const guild = guilds.get(guildId);
        if (!guild) {
            console.log('That server ID is not in the bot\'s guild list.');
            return;
        }

        const answer = (await prompt(`Leave "${guild.name}" (${guildId})? Type LEAVE to continue: `)).trim();
        if (answer !== 'LEAVE') {
            console.log('Leaving the server cancelled.');
            return;
        }

        const fullGuild = await client.guilds.fetch(guildId);
        await fullGuild.leave();
        console.log(`Left guild "${guild.name}" (${guildId}).`);
    } finally {
        if (client) client.destroy();
        readline.close();
    }
}

main().catch((error) => {
    console.error(`Guild operation failed: ${error.message}`);
    process.exitCode = 1;
});
