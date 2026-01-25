import { GameState, WorldLog } from '@openquests/schema';

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
            p.location === locId
        ).length;

        log += `### ${location.name}\n`;

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
