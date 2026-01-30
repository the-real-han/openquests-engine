# OpenQuests – Game Mechanics (v1)

This document defines the **v1 gameplay loop, systems, and UI scope** for OpenQuests. It serves as a practical roadmap rather than a rigid spec.

---

## Core Concept

OpenQuests is a **GitHub-native, asynchronous multiplayer RPG**.

* Players interact through a web UI and GitHub Issues
* The world advances once per day via a deterministic "tick"
* Progress is social (clans), narrative (world logs), and persistent

The game is designed to remain playable with **dozens or hundreds of players**, without real-time interaction.

---

## World Overview

### Locations (6 Total)

* **5 Clan Bases**

  * Red Clan
  * Blue Clan
  * Yellow Clan
  * Purple Clan
  * Black Clan

* **1 Neutral Location**

  * Monster-infested zone (PvE, bosses)

Locations are static in v1. There is no free roaming.

---

## Clans

* Each clan has:

  * A base location
  * Shared resource pool
  * Population (players)

### Clan Resources

* **Food** – Required for survival
* **Wood** – Reserved for future features
* **Gold** – Reserved for future features

If a clan’s **food reaches 0**, the clan is considered **destroyed**.

Destroyed clan players become **Refugees** and are reassigned to a surviving clan on the next tick.

---

## Player Characters

### On First Login

Players choose:

* Character name
* Class
* Optional backstory

Players are assigned to a **random clan** during the daily tick.

### Classes (Flavor + PvP modifiers only)

* Warrior
* Lancer
* Archer
* Monk
* Adventurer (no bonuses or penalties)

Class advantages apply **only** to clan-vs-clan combat.

---

## Player Actions (1 per day)

### 1. Gather

* Choose: food | wood | gold
* Adds resources to **clan pool**
* Base yield: 1–3 (modified by player level)

### 2. Explore

* Possible outcomes:

  * Gain XP
  * Find resources
  * Trigger a trap (lose next action)
  * Rare narrative event (later)

### 3. Attack Clan

* Choose a target clan
* System selects a random defender
* Outcome based on:

  * Dice roll
  * Class advantage / disadvantage

Successful attacks steal **food** from the target clan.

### 4. Attack Monsters (Neutral Location)

* Always targets PvE enemies
* Rewards:

  * XP
  * Small resources
* Risk:

  * Injury (skip next action)

Occasionally, **boss monsters** may appear (future milestone-triggered feature).

---

## Leveling System

* XP gained from PvE and exploration
* Levels do **not** affect PvP combat success

### Level Effects

Each level increases:

* Max resources gathered per action
* Max resources stolen on successful clan attack
* Max loot gained from monsters

Levels represent **capacity**, not combat strength.

---

## Titles (Character Legacy)

Titles are permanent, cosmetic achievements earned through play.

Examples:

* **Goblin Slayer** – Kill 5 monsters
* **Head Hunter** – Win 5 clan attacks
* **Explorer** – Complete 5 successful explores
* **Provider** – Gather 20 food
* **Survivor** – Live through clan destruction

Titles:

* Appear on character sheet
* May be referenced in world or location logs
* Enable future narrative triggers

---

## World Progression

### Daily Tick

Each day the system:

1. Processes all submitted player actions
2. Resolves combat and exploration
3. Updates clan resources and populations
4. Assigns titles
5. Generates logs

All outcomes are **deterministic** given the same inputs.

---

## Logs

### World Log (Global)

Published daily:

* Current day
* Atmospheric flavor text
* Clan populations
* Major events (raids, clan destruction)

### Location Log (Per Location)

Shown when viewing a location:

* Location description
* Clan-specific flavor
* Population
* Resource totals
* Notable milestones (later)

---

## Game UI (v1 Scope)

### Home Page

* World Log (latest day)
* World Map (6 locations)
* Login with GitHub (placeholder initially)

### Location Page

* Location description
* Clan or neutral status
* Population list
* Resource totals
* Location-specific log

### Leaderboard Page

* Clan rankings (by food, population)
* Notable players (titles only)

### Authenticated UI (Future Step)

When logged in:

* Avatar menu replaces login button
* "Start an Adventure" (first login)
* "Go to My Character"
* Character sheet view

---

## Design Principles

* Asynchronous by default
* Social progression over individual power
* Deterministic systems
* Simple rules, expandable systems
* Narrative emerges from player behavior

---

This document defines **v1**. Complexity should be added only when it meaningfully improves play.
