# Telegram

Use Telegram when you want the same TinyClaw agent available in chat without opening the web dashboard.

## Good use cases

Telegram works well for:

- quick questions while away from your desk
- lightweight team coordination in a shared group
- sending text, photos, and supported documents to an agent
- using the same profile from web and chat channels

The Telegram bridge talks to the same TinyClaw server as the web app and CLI. It is a chat channel, not a separate agent system.

## What Telegram can do

With Telegram enabled, users can:

- chat with a TinyClaw profile in a private Telegram chat
- use TinyClaw in a Telegram group
- receive rich text replies with formatting such as emphasis, code, headings, and links
- switch org and profile with Telegram commands
- send photos
- send supported documents such as `pdf`, `docx`, `txt`, and `csv`

## Rich Markdown replies

Agents can write normal Markdown in Telegram replies. TinyClaw converts a safe Markdown subset into Telegram rich text.

Supported formatting includes:

- `**bold**`, `*italic*`, and `__underline__`
- inline code and fenced code blocks
- headings, short lists, and simple links

Avoid raw HTML, Markdown tables, deeply nested lists, and very long code blocks. If Telegram rejects a rich message, TinyClaw falls back to a plain text reply.

## Setup

### 1. Create a bot

1. Open `@BotFather`
2. Create a bot
3. Copy the bot token

### How to create the bot in BotFather

If you have never made a Telegram bot before, the simplest flow is:

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather
3. Send `/newbot`
4. Enter a display name for your bot
5. Enter a username for your bot that ends with `bot`
6. Copy the bot token BotFather gives you

Keep that token private. It is the secret TinyClaw uses to control your Telegram bot.

### 2. Save Telegram settings in TinyClaw

1. Open **Integrations → Telegram** in the TinyClaw web app
2. Paste the bot token
3. Choose which profile should reply
4. Save

### 3. Pair your Telegram account

Pair your own Telegram account first before testing group chats or sharing the bot with others.

1. Generate or copy the pairing code from **Integrations → Telegram**
2. Open the bot in a private Telegram chat
3. Send the pairing code as a message

After that, your Telegram user is linked to TinyClaw.

### Why pairing is required

Pairing is how TinyClaw knows which real Telegram user is allowed to use the bot.

The simple reason:

- the bot token only connects TinyClaw to Telegram
- pairing connects **your Telegram account** to TinyClaw
- this stops random Telegram users from talking to your internal bot

Think of it like a one-time login for your Telegram account.

Once paired:

- TinyClaw knows who you are
- it can apply the right org and profile access
- your private chat and commands work normally

## Running the bridge

From the repo root:

```bash
bun run dev:telegram
```

The bridge uses long polling and forwards Telegram messages to the TinyClaw server.

## Private chat behavior

Private chat is the simplest setup.

- paired users can send normal messages directly to the bot
- the bot keeps a Telegram session history
- `/status`, `/profile`, `/org`, `/clear`, and `/new` are available

## Group chat setup

Group chat needs one extra Telegram-specific setup step.

1. Link your account with the bot in a private chat first
2. In `@BotFather`, disable **Group Privacy** for the bot if you want `@mentions` to work reliably
3. If you changed Group Privacy, remove the bot from the group and add it back
4. Add the bot to the group

Without that re-add step, Telegram may keep sending only limited group updates such as slash commands and replies.

## How group triggering works

TinyClaw does **not** reply to every group message.

Even when Telegram group privacy is disabled, TinyClaw only responds when a message is:

- a slash command like `/status`
- a reply to one of the bot's messages
- a real bot mention like `@your_bot_name hello`

This keeps the bot usable in groups without becoming noisy.

## Commands

Useful Telegram commands:

| Command | What it does |
| --- | --- |
| `/start` | Shows the welcome or help flow |
| `/help` | Lists available Telegram commands |
| `/status` | Shows bridge, provider, and profile status |
| `/org` | Lists or switches the active organization |
| `/profile` | Lists or switches the active replying profile |
| `/clear` | Clears the current chat history |
| `/new` | Starts a fresh conversation |
| `/compact` | Compacts the current conversation history |
| `/stop` | Stops an in-progress reply |

## Troubleshooting

### Mentions do not work in groups

Check these first:

1. Disable **Group Privacy** in `@BotFather`
2. Remove the bot from the group and add it back
3. Make sure only one Telegram bridge worker is running

If replies and slash commands work but mentions do not, the issue is usually Telegram group delivery settings, not TinyClaw's handler logic.

### Private chat works but group chat does not

Usually one of these is true:

- the user is not paired yet
- the bot was added before Group Privacy was changed
- the wrong bridge worker is running

### The bot does not answer any Telegram messages

Check:

1. the bot token is saved
2. the bridge worker is running
3. the TinyClaw server is running
4. the Telegram user is paired

## Next steps

- [Getting Started](/getting-started)
- [Profiles](/profiles)
