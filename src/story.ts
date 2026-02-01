import { GameState, LocationLog, LocationModifier, LocationState, Player, WorldLog } from '@openquests/schema';
import BOSS_RULES from "./rules/boss.rules.json"

export function generateSummary(
    input: WorldNarrationInput
): Pick<WorldLog, "summary" | "notes"> {
    return {
        summary: `Day ${input.day} passes without a chronicler's voice.`,
        notes: []
    }
}

export function generateLocationSummary(
    input: LocationNarrationInput
): Pick<LocationLog, "summary" | "notes"> {
    return {
        summary: `Life continues at ${input.location}.`,
        notes: []
    }
}

export type WorldNarrationInput = {
    day: number
    population: number

    bossEvents: {
        name: string
        location: string
        status: "APPEARED" | "DEFEATED" | "FAILED"
        message: string
    }[]

    locationEvents: {
        type: "WEATHER" | "INVASION" | "BLESSING" | "CURSE"
        location: string
        effects: LocationModifier["effects"]
        message: string
    }[]

    miscEvents?: {
        type: string
        location?: string
        message?: string
    }[]
}

export type LocationNarrationInput = {
    day: number
    location: string
    clan: string

    events: {
        type:
        | "LOCATION_EVENT"
        | "CLAN_DEFEATED"
        | "CLAN_CONQUERED"
        | "RESOURCE_SURGE"
        data: Record<string, any>
        message?: string
    }[]
}


export function generateWorldLog(state: GameState): WorldLog {
    // --- 1. Population ---
    const population = Object.values(state.players).length

    const currentEvents = state.worldEvents.filter(e => e.day === state.day)

    // --- 2. Boss-related events ---
    const bossEvents: WorldNarrationInput["bossEvents"] = []
    const locationEvents: WorldNarrationInput["locationEvents"] = []

    for (const e of currentEvents) {
        if (e.id.startsWith("boss_")) {
            bossEvents.push({
                name: e.data?.bossName ?? "Boss",
                location: e.location ?? "Unknown",
                status: e.type.replace("BOSS_", "") as "APPEARED" | "DEFEATED" | "FAILED",
                message: e.data?.message ?? ""
            })
        }

        if (e.id.startsWith("locmod_")) {
            locationEvents.push({
                type: e.type as "WEATHER" | "INVASION" | "BLESSING" | "CURSE",
                location: e.location ?? "Unknown",
                effects: e.data?.effects ?? [],
                message: e.data?.message ?? ""
            })
        }

    }

    // --- 5. Build AI input ---
    const narrationInput: WorldNarrationInput = {
        day: state.day,
        population,
        bossEvents,
        locationEvents
    }

    // --- 6. Generate summary (AI later) ---
    const { summary, notes } = generateSummary(narrationInput)

    // --- 7. Return WorldLog ---
    return {
        day: state.day,
        population,
        summary,
        notes
    }
}

export function generateLocationLog(
    previousState: GameState,
    state: GameState,
    location: LocationState
): LocationLog {

    const population = Object.values(state.players).filter(p => p.character.clanId === location.clanId).length
    const clanId = location.clanId
    const prevClan = clanId ? previousState.clans[clanId] : null
    const currClan = clanId ? state.clans[clanId] : null

    const events: LocationNarrationInput["events"] = []

    // --- 1. Active location modifiers ---
    const activeModifiers =
        state.locationModifiers?.filter(
            m => m.locationId === location.id
        ) ?? []

    for (const mod of activeModifiers) {
        events.push({
            type: "LOCATION_EVENT",
            data: {
                eventType: mod.type,
                effects: mod.effects
            },
            message: mod.messages?.[0]
        })
    }

    // --- 2. Clan defeated today ---
    if (
        prevClan &&
        currClan &&
        !prevClan.defeatedBy &&
        currClan.defeatedBy
    ) {
        events.push({
            type: "CLAN_DEFEATED",
            data: {
                defeatedBy: state.clans[currClan.defeatedBy].name
            }
        })
    }

    // --- 3. Clan conquered another clan today ---
    if (currClan) {
        const conquered = Object.values(state.clans).find(
            c =>
                c.defeatedBy === currClan.id &&
                !previousState.clans[c.id]?.defeatedBy
        )

        if (conquered) {
            events.push({
                type: "CLAN_CONQUERED",
                data: {
                    targetClanName: conquered.name
                }
            })
        }
    }

    // --- 4. Resource surge (largest positive delta only) ---
    if (prevClan && currClan && !currClan.defeatedBy) {
        const deltas = {
            food: currClan.food - prevClan.food,
            wood: currClan.wood - prevClan.wood,
            gold: currClan.gold - prevClan.gold
        }

        const [resource, amount] =
            Object.entries(deltas)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])[0] ?? []

        if (resource && amount >= 10) { // threshold avoids noise
            events.push({
                type: "RESOURCE_SURGE",
                data: {
                    resource,
                    amount
                }
            })
        }
    }

    // --- 5. Build narration input ---
    const narrationInput: LocationNarrationInput = {
        day: state.day,
        location: location.name,
        clan: state.clans[location.clanId]?.name,
        events
    }

    // --- 6. AI narration (stubbed) ---
    const { summary, notes } =
        generateLocationSummary(narrationInput)

    return {
        day: state.day,
        summary,
        notes,
        population
    }
}