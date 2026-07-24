# Discord administration tools

Standalone utilities for managing DriverODS slash commands and guild membership.
They do not start or modify the bot.

## Setup

The tools load the application's `.env` file at the project root (the parent
directory of `discord-tools`). You can also set these environment variables:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_APPLICATION_ID=your-discord-application-id
```

`DISCORD_APPLICATION_ID` is the **Application ID** from the Discord Developer
Portal. Do not use a guild/server ID for this value.

## Slash commands

The command registry lives in [`commands.js`](./commands.js). Define commands
there with Discord.js builders, then the manager serializes them before sending
them to Discord.

For example:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check whether DriverODS is online.'),
];
```

Run the manager and select each action from its menu:

```powershell
node discord-tools/manage-slash-commands.js
```

The manager asks whether to use global commands or a specific server, and
requests all IDs only when they are needed. It previews the command registry
and requires you to type `DEPLOY`, `CLEAR`, or `DELETE` before changing
Discord.

Deployment uses Discord's bulk-overwrite endpoint: the target scope will match
`commands.js` exactly. If the registry is empty, the menu requires you to
type `CLEAR` before it removes registered commands.

## Leaving a guild

```powershell
node discord-tools/leave-guild.js
```

The menu can list the bot's servers or guide you through leaving one. Leaving
requires choosing a listed server ID and typing `LEAVE` to confirm.
