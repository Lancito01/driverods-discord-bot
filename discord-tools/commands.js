const {
    SlashCommandBuilder,
    InteractionContextType,
} = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('set')
        .setDescription('Sets account information.')
        .setContexts(
            InteractionContextType.Guild
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('car')
                .setDescription('Sets the user\'s car\'s make and model.')
                .addStringOption(
                    (opt) => opt
                        .setName('make')
                        .setDescription('The make of the car.')
                        .setRequired(true)
                        .setAutocomplete(false)
                )
                .addStringOption(
                    (opt) => opt
                        .setName('model')
                        .setDescription('The model of the car.')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    new SlashCommandBuilder()
        .setName('get')
        .setDescription('Gets account information.')
        .setContexts(
            InteractionContextType.Guild
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('car')
                .setDescription('Gets the user\'s car\'s make and model.')
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear user settings.")
        .setContexts(
            InteractionContextType.Guild
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('car')
                .setDescription('Clears the user\'s car\'s make and model.')
        ),

    new SlashCommandBuilder()
        .setName("restart")
        .setDescription("Restarts the bot.")
        .setContexts(
            InteractionContextType.Guild
        ),

    new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Administrative commands.")
        .setContexts(
            InteractionContextType.Guild
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('add')
                .setDescription('Adds a user as an admin.')
                .addStringOption(
                    (opt) => opt
                        .setName('user_id')
                        .setDescription('The Discord ID of the user.')
                        .setRequired(true)
                )
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('remove')
                .setDescription('Removes a user as an admin.')
                .addStringOption(
                    (opt) => opt
                        .setName('user_id')
                        .setDescription('The Discord ID of the user.')
                        .setRequired(true)
                )
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('list')
                .setDescription('Lists all current admins.')
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('channel')
                .setDescription('Sets the channel for car submissions.')
                .addChannelOption(
                    (opt) => opt
                        .setName('channel')
                        .setDescription('The channel to send submissions to. Leave blank to default to DMs.')
                        .setRequired(false)
                )
        ),

    new SlashCommandBuilder()
        .setName("submit")
        .setDescription("Custom vehicle submissions.")
        .setContexts(
            InteractionContextType.Guild
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('car')
                .setDescription('Submit a custom car for review.')
                .addStringOption(
                    (opt) => opt
                        .setName('make')
                        .setDescription('The make of the car.')
                        .setRequired(true)
                )
                .addStringOption(
                    (opt) => opt
                        .setName('model')
                        .setDescription('The model of the car.')
                        .setRequired(true)
                )
        )
        .addSubcommand(
            (cmd) => cmd
                .setName('list')
                .setDescription('Lists and manages custom vehicle entries. (Admin only)')
                .addStringOption(
                    (opt) => opt
                        .setName('make')
                        .setDescription('Filter by make.')
                        .setRequired(false)
                )
        ),
];

module.exports = commands;
