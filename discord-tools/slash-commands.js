const { REST, Routes } = require('discord.js');

/**
 * Creates the REST client used to manage this application's slash commands.
 * The token is deliberately supplied by the caller so scripts never need to
 * read or print environment values themselves.
 *
 * @param {string} token Discord bot token.
 * @returns {REST}
 */
function createRestClient(token) {
    if (!token) {
        throw new Error('DISCORD_TOKEN is required. Add it to .env or the environment.');
    }

    return new REST({ version: '10' }).setToken(token);
}

/**
 * Validates an application ID and returns the Discord route for its commands.
 * Supplying a guild ID makes the operation guild-scoped, which is useful for
 * development because guild commands update almost immediately.
 *
 * @param {string} applicationId Discord application ID.
 * @param {string | undefined} guildId Optional Discord guild ID.
 * @returns {string}
 */
function commandRoute(applicationId, guildId) {
    if (!applicationId) {
        throw new Error('DISCORD_APPLICATION_ID is required.');
    }

    return guildId
        ? Routes.applicationGuildCommands(applicationId, guildId)
        : Routes.applicationCommands(applicationId);
}

/**
 * Replaces every command in the chosen scope with the supplied definitions.
 * Discord's bulk-overwrite endpoint is intentional: it makes the deployed
 * state exactly match the version-controlled command registry.
 *
 * @param {REST} rest Authenticated Discord REST client.
 * @param {string} applicationId Discord application ID.
 * @param {Array<object>} commands JSON-ready Discord command definitions.
 * @param {string | undefined} guildId Optional Discord guild ID.
 * @returns {Promise<Array<object>>}
 */
async function deploySlashCommands(rest, applicationId, commands, guildId) {
    if (!Array.isArray(commands)) {
        throw new TypeError('commands must be an array of Discord command definitions.');
    }

    return rest.put(commandRoute(applicationId, guildId), { body: commands });
}

/**
 * Returns the commands currently registered in the chosen scope.
 *
 * @param {REST} rest Authenticated Discord REST client.
 * @param {string} applicationId Discord application ID.
 * @param {string | undefined} guildId Optional Discord guild ID.
 * @returns {Promise<Array<object>>}
 */
async function listSlashCommands(rest, applicationId, guildId) {
    return rest.get(commandRoute(applicationId, guildId));
}

/**
 * Deletes one command from the chosen scope.
 *
 * @param {REST} rest Authenticated Discord REST client.
 * @param {string} applicationId Discord application ID.
 * @param {string} commandId Discord application-command ID.
 * @param {string | undefined} guildId Optional Discord guild ID.
 * @returns {Promise<void>}
 */
async function deleteSlashCommand(rest, applicationId, commandId, guildId) {
    if (!commandId) {
        throw new Error('A command ID is required.');
    }

    const route = guildId
        ? Routes.applicationGuildCommand(applicationId, guildId, commandId)
        : Routes.applicationCommand(applicationId, commandId);

    await rest.delete(route);
}

module.exports = {
    createRestClient,
    deleteSlashCommand,
    deploySlashCommands,
    listSlashCommands,
};
