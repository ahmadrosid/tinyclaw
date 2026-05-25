## TinyClaw — Telegram

Chat with your TinyClaw agent from Telegram. The bridge is a thin client: it forwards messages to the same HTTP server as the CLI and web app (`channel: "telegram"`).

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Ensure the TinyClaw server is configured (`~/.tinyclaw/config.ini` or env API keys).
3. Open **Settings → Telegram** in the web dashboard, save your bot token and profile, and copy the **pairing code**.
4. Run `bun run dev:telegram`, message your bot, and paste the pairing code once. Settings are stored in `~/.tinyclaw/telegram/config.ini`.

### Run

From the repo root:

```bash
bun run dev:telegram
```

The bridge auto-starts the server if it is not already running (same as the CLI).

Optional env vars:

- `TELEGRAM_BOT_TOKEN` — bot token (instead of the config file)
- `TELEGRAM_ALLOWED_USER_IDS` — skip pairing for specific numeric user IDs
- `TINYCLAW_SERVER_URL` — server base URL (default `http://127.0.0.1:4310`)
- `TINYCLAW_TELEGRAM_PROFILE_ID` — bot profile (default `profile_default`)

### Commands

| Command | Description |
|---------|-------------|
| `/help` | List commands |
| `/clear` | Clear chat history |
| `/new` | Start a new conversation |
| `/status` | Server and model status |

Private chats only. New users must paste a one-time pairing code from Settings → Telegram (unless pre-approved via allowed user IDs in Advanced settings).

Session mapping is stored in `~/.tinyclaw/telegram/chat-sessions.json`.
