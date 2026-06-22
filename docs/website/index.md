---
layout: home

hero:
  name: TinyClaw
  text: Self-hosted AI agents
  tagline: Deploy your own AI Agent platform as easily as spinning up WordPress.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Architecture
      link: /architecture
    - theme: alt
      text: View on GitHub
      link: https://github.com/ahmadrosid/tinyclaw

features:
  - title: Multi-tenant by design
    details: One server, many orgs — isolated profiles, sessions, member invites, and roles built in.
  - title: One agent runtime
    details: Web, CLI, Telegram, and WhatsApp are thin clients on a single HTTP server. No duplicated agent logic.
  - title: Configurable souls
    details: Each profile has identity, style, instructions, and continuity memory via soul files.
  - title: Tool allowlists
    details: Builtin tools, bash, JavaScript, and MCP servers — scoped per profile with native LLM function calling.
  - title: Self-hosted
    details: Bun + TypeScript monorepo. Run locally, in Docker, or on your own infrastructure.
  - title: OpenAPI-first
    details: The HTTP surface is generated from route registration and served at /openapi.json.
---

Inspired by [OpenClaw](https://github.com/openclaw/openclaw) and [Hermes Agent](https://github.com/nousresearch/hermes-agent) — same self-hosted agent idea (tools, channels, soul, automations) — but **multi-tenant by design**. Those projects target one operator on one machine; TinyClaw is one server, many orgs.
