# Product Overview

## zev-mud

A browser-based Multi-User Dungeon (MUD) game built with Ranvier as the server engine. The project creates a modern web interface for traditional MUD gameplay, allowing players to connect through web browsers instead of telnet clients.

## Core Features

- **Web-based gameplay**: Browser terminal interface using WebSocket connections
- **Character persistence**: Account creation and progress saving
- **Classic MUD mechanics**: Room navigation, inventory management, NPC interaction, turn-based combat
- **Small-scope world**: 6-12 interconnected rooms with basic items and NPCs
- **Real-time multiplayer**: Multiple players can interact in the same game world

## Target Audience

Players who enjoy text-based RPG games but prefer modern web interfaces over traditional telnet clients.

## Architecture Approach

Three-tier system: Browser client → WebSocket-Telnet proxy → Ranvier game server, designed to bridge modern web technologies with traditional MUD server architecture.