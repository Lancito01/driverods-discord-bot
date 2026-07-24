#!/usr/bin/env node

const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const commandBuilders = require('./commands');
const {
    createRestClient,
    deleteSlashCommand,
    deploySlashCommands,
    listSlashCommands,
} = require('./slash-commands');

const commands = commandBuilders.map((command) =>
    typeof command.toJSON === 'function' ? command.toJSON() : command,
);

function showCommands(registeredCommands) {
    if (registeredCommands.length === 0) {
        console.log('No slash commands are registered in this scope.');
        return;
    }

    console.table(registeredCommands.map(({ id, name, description, type }) => ({
        id,
        name,
        description: description || '(no description)',
        type,
    })));
}

async function chooseScope(prompt) {
    while (true) {
        console.log('\nChoose where to manage commands:');
        console.log('1. Global application commands');
        console.log('2. Commands for one server (guild)');
        console.log('0. Cancel');

        const choice = (await prompt('> ')).trim();
        if (choice === '1') return undefined;
        if (choice === '0') return null;
        if (choice === '2') {
            const guildId = (await prompt('Enter the server (guild) ID: ')).trim();
            if (guildId) return guildId;
            console.log('A guild ID is required.');
            continue;
        }

        console.log('Please enter 0, 1, or 2.');
    }
}

async function requireConfirmation(prompt, instruction, confirmation) {
    const answer = (await prompt(`${instruction}\nType ${confirmation} to continue: `)).trim();
    return answer === confirmation;
}

async function deploy(prompt, rest, applicationId) {
    const guildId = await chooseScope(prompt);
    if (guildId === null) return;

    const scope = guildId ? `guild ${guildId}` : 'global application';
    console.log(`\nThe registry contains ${commands.length} command(s):`);
    console.dir(commands, { depth: null });

    if (commands.length === 0) {
        const confirmed = await requireConfirmation(
            prompt,
            `This will remove every slash command in the ${scope} scope.`,
            'CLEAR',
        );
        if (!confirmed) {
            console.log('Deployment cancelled.');
            return;
        }
    } else {
        const confirmed = await requireConfirmation(
            prompt,
            `Deploy these ${commands.length} command(s) to the ${scope} scope?`,
            'DEPLOY',
        );
        if (!confirmed) {
            console.log('Deployment cancelled.');
            return;
        }
    }

    const deployedCommands = await deploySlashCommands(rest, applicationId, commands, guildId);
    console.log(`Deployed ${deployedCommands.length} slash command(s) to the ${scope} scope.`);
}

async function list(prompt, rest, applicationId) {
    const guildId = await chooseScope(prompt);
    if (guildId === null) return;

    showCommands(await listSlashCommands(rest, applicationId, guildId));
}

async function remove(prompt, rest, applicationId) {
    const guildId = await chooseScope(prompt);
    if (guildId === null) return;

    const scope = guildId ? `guild ${guildId}` : 'global application';
    const registeredCommands = await listSlashCommands(rest, applicationId, guildId);
    showCommands(registeredCommands);
    if (registeredCommands.length === 0) return;

    const commandId = (await prompt('\nEnter the ID of the command to delete (or leave blank to cancel): ')).trim();
    if (!commandId) return;

    const command = registeredCommands.find(({ id }) => id === commandId);
    if (!command) {
        console.log('That command ID is not registered in the selected scope.');
        return;
    }

    const confirmed = await requireConfirmation(
        prompt,
        `Delete /${command.name} from the ${scope} scope?`,
        'DELETE',
    );
    if (!confirmed) {
        console.log('Deletion cancelled.');
        return;
    }

    await deleteSlashCommand(rest, applicationId, commandId, guildId);
    console.log(`Deleted /${command.name}.`);
}

async function main() {
    const readline = createInterface({ input: stdin, output: stdout });
    const prompt = (question) => readline.question(question);

    try {
        console.log('DRIVERODS Slash Command Manager');
        console.log('Commands are read from discord-tools/commands.js.');
        console.log('\n1. Deploy command registry');
        console.log('2. List registered commands');
        console.log('3. Delete one registered command');
        console.log('0. Exit');

        const action = (await prompt('\nChoose an option: ')).trim();
        if (action === '0') return;
        if (!['1', '2', '3'].includes(action)) {
            console.log('No action selected.');
            return;
        }

        const rest = createRestClient(process.env.DISCORD_TOKEN);
        const applicationId = process.env.DISCORD_APPLICATION_ID;

        if (action === '1') await deploy(prompt, rest, applicationId);
        if (action === '2') await list(prompt, rest, applicationId);
        if (action === '3') await remove(prompt, rest, applicationId);
    } finally {
        readline.close();
    }
}

main().catch((error) => {
    console.error(`Slash-command operation failed: ${error.message}`);
    process.exitCode = 1;
});
