const {
    ApplicationIntegrationType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const commands = [
    // Sample command: this shows the common builder methods you can tweak later.
    //
    // A few notes:
    // - Command names must be lowercase, match Discord's rules, and stay within length limits.
    // - `setContexts` and `setIntegrationTypes` are available in discord.js v14.27.
    // - `setDMPermission(false)` is the older way to say “not usable in DMs”; it is kept here
    //   as an example because your installed version still exposes it.
    /*

    new SlashCommandBuilder()
        .setName('set')
        .setDescription('Set account details.')
        // .setNameLocalization('es-ES', '')
        // .setDescriptionLocalization(
        //     'es-ES',
        //     'Comando de ejemplo que muestra la mayoría de los parámetros de SlashCommandBuilder.',
        // )
        // .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        // .setNSFW(true)
        .setContexts(
            // InteractionContextType.Guild,
            InteractionContextType.BotDM,
            // InteractionContextType.PrivateChannel,
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            // ApplicationIntegrationType.UserInstall,
        )
        .addSubcommandGroup((group) =>
            group
                .setName('demo')
                .setDescription('Subcommands that demonstrate the different option builders.')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('all-options')
                        .setDescription('Shows one example of every option type.')
                        .addStringOption((option) =>
                            option
                                .setName('text')
                                .setDescription('A plain string value.')
                                .setRequired(true)
                                .setMinLength(3)
                                .setMaxLength(50),
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('count')
                                .setDescription('A whole number.')
                                .setMinValue(1)
                                .setMaxValue(10),
                        )
                        .addNumberOption((option) =>
                            option
                                .setName('ratio')
                                .setDescription('A decimal number.')
                                .setMinValue(0)
                                .setMaxValue(1),
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('enabled')
                                .setDescription('A true/false flag.'),
                        )
                        .addUserOption((option) =>
                            option
                                .setName('user')
                                .setDescription('A Discord user.'),
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('A Discord role.'),
                        )
                        .addMentionableOption((option) =>
                            option
                                .setName('mentionable')
                                .setDescription('A user, role, or other mentionable item.'),
                        )
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setDescription('A channel restricted to selected channel types.')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
                        )
                        .addAttachmentOption((option) =>
                            option
                                .setName('file')
                                .setDescription('A file attachment.'),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('autocomplete')
                        .setDescription('Shows how autocomplete is enabled on a string option.')
                        .addStringOption((option) =>
                            option
                                .setName('model')
                                .setDescription('Type here and your bot can provide suggestions.')
                                .setAutocomplete(true)
                                .setRequired(true),
                        ),
                ),
        ),
     */
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

];

module.exports = commands;
