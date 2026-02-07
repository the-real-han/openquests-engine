import { GameState, LocationHistoryEntry, LocationState, WorldHistoryEntry } from '@openquests/schema';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

const genAI = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : null;

export async function generateWorldSummary(
    input: WorldHistoryEntry
): Promise<string> {
    if (!genAI) {
        return "Unable to generate world summary";
    }

    const prompt = buildWorldPrompt(input);
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
    });

    const text = response.text ?? "";
    console.log(text)
    return text.trim();
}

export async function generateLocationSummary(
    input: LocationHistoryEntry
): Promise<string> {
    if (!genAI) {
        return "Unable to generate location summary";
    }

    const prompt = buildLocationPrompt(input);

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
    });

    const text = result.text ?? "";
    console.log(text)
    return text.trim();
}

function buildWorldPrompt(input: WorldHistoryEntry): string {
    return `
You are a fantasy world narrator for a turn-based strategy RPG.

Write a short world log for Day ${input.day}.
Tone: mythic, neutral, slightly dramatic.
Length: 2–4 sentences.

Rules:
- Do NOT invent events.
- Only describe what appears in the input.
- If no events occurred, describe a calm or uneventful day.
- Do NOT mention numbers unless provided.
- Do NOT mention players directly.

World Events (JSON):
${JSON.stringify(input, null, 2)}
`;
}

function buildLocationPrompt(input: LocationHistoryEntry): string {
    return `
You are narrating events at a single location in a fantasy world.

Location: ${input.location}
Day: ${input.day}

Write 2–3 sentences describing what happened here.

Rules:
- Only describe events listed below.
- If a clan was defeated or conquered, that is the most important event.
- If resources increased, mention only the largest gain.
- Do NOT mention population.
- Do NOT invent battles, weather, or characters.

Location Events (JSON):
${JSON.stringify(input, null, 2)}
`;
}



export function buildWorldNarrationInput(state: GameState): WorldHistoryEntry {
    // --- 1. Population ---
    const population = Object.values(state.players).length

    const currentEvents = (state.activeEvents ?? []).filter(e => e.day === state.day)

    // --- 2. Boss-related events ---
    const bossEvents: WorldHistoryEntry["bossEvents"] = []
    const locationEvents: WorldHistoryEntry["locationEvents"] = []

    for (const e of currentEvents) {
        if (e.id.startsWith("boss_")) {
            let status = e.type.replace("BOSS_", "") as "APPEARED" | "DEFEATED" | "FAILED";
            if (status === "APPEAR" as any) status = "APPEARED";

            bossEvents.push({
                name: e.data?.bossName ?? "Boss",
                location: e.location ?? "Unknown",
                status,
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

    return {
        day: state.day,
        population,
        bossEvents,
        locationEvents
    }
}

export function buildLocationNarrationInput(
    previousState: GameState,
    state: GameState,
    location: LocationState
): LocationHistoryEntry {
    const clanId = location.clanId
    const prevClan = clanId ? previousState.clans[clanId] : null
    const currClan = clanId ? state.clans[clanId] : null

    const events: LocationHistoryEntry["events"] = []

    // --- 1. Active location modifiers ---
    const activeModifiers =
        (state.activeModifiers ?? []).filter(
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

    return {
        day: state.day,
        location: location.name,
        clan: state.clans[location.clanId]?.name,
        events,
        population: Object.values(state.players).filter(p => p.character.clanId === location.clanId).length
    }
}