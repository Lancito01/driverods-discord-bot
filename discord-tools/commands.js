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
        )
];

module.exports = commands;
