import { GameState, LocationLog, LocationState, Player, WorldLog } from '@openquests/schema';

export function generateWorldLog(state: GameState): WorldLog {
    let log = '';

    const totalPopulation = Object.values(state.players).length;

    // Global Flavor
    if (totalPopulation === 0) {
        log += `A quiet day passes across the land.\n`;
    } else {
        log += `The world stirs as adventurers continue their journeys.\n`;
    }

    log += `\n---\n\n`;

    // Per Location
    // Sort locations ID for stability
    const locationIds = Object.keys(state.locations).sort();

    for (const locId of locationIds) {
        const location = state.locations[locId];
        const population = Object.values(state.players).filter(p =>
            p.character.clanId === location.clanId
        ).length;

        log += `### ${location.clanId}\n`;

        // Location Flavor
        if (population === 0) {
            log += `The area is quiet.\n`;
        } else if (population < 4) {
            const groupTerm = population === 1 ? 'lone adventurer' : 'small group';
            log += `A ${groupTerm} is present here.\n`;
        } else {
            log += `The area feels lively with many adventurers.\n`;
        }
    }

    return {
        day: state.day,
        summary: log.trim(),
        population: totalPopulation,
        notes: []
    };
}

export function generateLocationLog(previousState: GameState, state: GameState, location: LocationState): LocationLog {
    const population = Object.values(state.players).filter((p: Player) =>
        p.character.clanId === location.clanId
    ).length;

    let summary = '';
    if (population === 0) summary = "The area is quiet and undisturbed.";
    else if (population === 1) summary = "A lone adventurer lingers here.";
    else if (population < 5) summary = "A small group of adventurers gather here.";
    else summary = "The location buzzes with activity.";

    // Append static flavor
    summary += ` ${location.description}`;
    return {
        day: state.day,
        summary: summary,
        population: population,
        notes: []
    };
}