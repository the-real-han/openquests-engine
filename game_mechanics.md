# Game Mechanics & Roadmap

This document describes the **overall game mechanics and technical approach** for a GitHub-native, asynchronous, multiplayer fantasy game. It is intentionally written as a **roadmap**, not a rigid specification. The goal is to guide incremental development while keeping the system simple, extensible, and fun.

---

## High-Level Concept

- A persistent fantasy world that progresses **once per day** via GitHub Actions
- Players participate asynchronously using **GitHub Issues and Comments**
- The game state lives entirely inside the repository (files + issues)
- AI is used only for **narrative presentation**, never for game logic

Core pillars:
- Deterministic mechanics
- Public, auditable state
- Collective progression
- Low-friction participation

---

## 1. Core GitHub-Based Game Mechanics

### 1.1 Player Representation

- Each player is represented by **one GitHub Issue**
- The issue acts as the player’s:
  - Character sheet
  - Action log
  - Chronicle
- The issue remains open while the character is active

**Rules:**
- One issue per player
- The **last comment before the daily tick** is the player’s action for that day
- If no valid action is found, the player is considered idle

---

### 1.2 Actions

- Actions are submitted as plain text comments
- Example actions:
  - `MOVE forest`
  - `ATTACK goblin`
  - `WAIT`

Action parsing is:
- Strict
- Deterministic
- Based on predefined verbs only

Invalid actions resolve as `WAIT`.

---

### 1.3 Daily Tick (Game Loop)

- A GitHub Action runs on a fixed schedule (e.g. once per day)
- The tick performs the following steps:

1. Load current world state from repository files
2. Read all open player issues
3. Extract each player’s last action comment
4. Group players by current location
5. Resolve actions **by location**, not by individual
6. Update world state deterministically
7. Record results back to:
   - World state files
   - Player issues (as a daily result comment)
8. Generate a narrative summary input for AI storytelling

The daily tick is the **only authority** that can mutate the world state.

---

### 1.4 World State

- Stored as versioned JSON/YAML files in the repository
- Includes:
  - Locations and their states
  - Enemies and counters
  - Global progression counters

World state must be:
- Fully reproducible from repo history
- Human-readable
- Stable across refactors

---

### 1.5 AI Storytelling (Core Constraint)

- AI never receives raw player input
- AI only receives **structured outcomes** from the daily tick
- AI output is purely narrative

Example AI input:
```json
{
  "day": 12,
  "events": [
    "3 goblins defeated in Forest",
    "New path discovered",
    "Player123 earned title Goblin Bane"
  ]
}
```

AI output is posted as:
- A daily world story
- Optional flavor text in player results

---

## 2. Game UI (GitHub Pages)

### 2.1 Purpose

The UI exists to:
- Visualize the world state
- Make the story feel alive
- Lower the cognitive load of reading raw JSON or issues

The UI is **not** the source of truth.

---

### 2.2 Hosting

- Served via **GitHub Pages**
- Static frontend (HTML/CSS/JS)
- Reads world state from committed files or build artifacts

---

### 2.3 Initial UI Scope (Minimal)

Early versions should be **read-only**:
- Current day’s story
- World map with known locations
- Current location states

No login or actions required at first.

---

### 2.4 Player Interaction (Later Phase)

Later, the UI may support:
- GitHub OAuth login
- Action buttons (Move, Attack, Wait, etc.)
- Submitting actions by creating GitHub comments via API

Important:
- UI actions must map 1:1 to valid text actions
- The backend logic remains unchanged

---

### 2.5 Visual Style

- Background image per location
- “Scroll” or panel showing today’s story
- Simple, atmospheric presentation

The UI should feel like a **living chronicle**, not a game dashboard.

---

## 3. Long-Term Goals & Progression

### 3.1 Character Legacy (Titles)

Players accumulate lifetime metrics such as:
- Enemies defeated
- Days survived
- Quests completed
- Participation in major events

Reaching milestones grants **Titles**:
- Permanent
- Public
- Narrative-first (no direct stat buffs by default)

Example titles:
- Goblin Bane
- Pioneer
- Defender of the Old Road

Titles may unlock **narrative or event hooks** when present in a location.

---

### 3.2 World State Change

The world evolves permanently based on collective actions.

Locations may:
- Change state (stable → threatened → ruined → restored)
- Unlock new adjacent or hidden locations

Examples:
- A forest path unlocks after **1,000 goblins** are defeated globally
- An ancient door opens if **30 players** are present in one location on the same day

Unlocked locations remain available permanently.

---

### 3.3 Quests

Quests provide structured, multi-day objectives beyond basic actions.

Types:
- **Location Quests** (collective progress)
- **Personal Quests** (individual goals, usually for titles)

Quests:
- Are predefined
- Progress incrementally per daily tick
- Often trigger world changes when completed

---

### 3.4 Meta-Narrative (Future)

The system should allow for future expansion into:
- World ages or arcs
- Global threats
- Factions and ideological conflicts

No concrete mechanics are required initially, but the architecture should not block them.

---

## Minimum Playable Loop (MPL)

The Minimum Playable Loop defines the smallest complete cycle that allows a player to meaningfully participate in the game world. All features must support or extend this loop.

1. Player Joins the World
A player creates a GitHub Issue using the Player Join issue template.
The issue represents the player’s identity.
On the next daily tick:
If the issue is new, a Player entry is created in gamestate.json.
The player is assigned:
A unique playerId
A starting location
A character class (from allowed defaults or template selection)
The system posts a welcome comment confirming successful entry.
2. Player Submits an Action
A player submits an action by commenting on their Issue.
Only the latest valid comment before the daily tick is considered.
Supported actions are parsed deterministically (e.g. MOVE forest, WAIT).
Invalid or unrecognized input resolves to a safe default (WAIT).
3. Daily Tick Resolution
A scheduled GitHub Action runs once per day.
The tick performs the following steps in order:
Load the current gamestate.json
Fetch all active player issues
Parse each player’s latest action
Resolve all actions simultaneously using processTick
Advance the world day by 1
Persist the updated game state
4. World State Updates
The game state is the single source of truth.
State changes may include:
Player location changes
Status updates
World events triggered by actions
Resolution is deterministic and reproducible from inputs.
5. Player Feedback
After resolution, the system posts a comment to each player’s Issue:
Acknowledging the resolved action
Optionally providing narrative or status feedback
No real-time interaction exists; all feedback is asynchronous.
6. Loop Repeats
Players read the outcome.
Players submit a new action.
The next daily tick resolves it.
This loop repeats indefinitely and constitutes the core gameplay of OpenQuests.

---

## Development Philosophy

- Start with the smallest playable loop
- Prefer working code over perfect specs
- Lock in mechanics only after they prove fun
- Use specs as guardrails, not handcuffs

This document serves as a **shared mental model and roadmap**, not a final design contract.

