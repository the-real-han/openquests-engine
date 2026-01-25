import { GameState, Action, TickResult, Player } from '@openquests/schema';
import { generateWorldLog } from './world_log';

/**
 * Pure function to process a single tick of the game world.
 * Must be deterministic and side-effect free.
 */ //
export function processTick(initialState: GameState, actions: Action[], players: Player[]): TickResult {
    // Deep copy state to ensure immutability during processing
    const nextState = JSON.parse(JSON.stringify(initialState)) as GameState;
    const playerResults: Record<string, string> = {};

    // 1. Advance Day
    nextState.day += 1;
    nextState.locations = initialState.locations; // Ensure locations structure is preserved/updated if needed (deep copy handled above)

    // 2. Process Actions
    for (const action of actions) {
        const player = nextState.players[action.playerId];

        if (!player) {
            console.warn(`Action received for unknown player ${action.playerId}`);
            continue;
        }

        // Default Result
        let resultMessage = '';

        switch (action.type) {
            case 'MOVE': {
                const currentLocationId = player.location;
                const currentLocation = nextState.locations[currentLocationId];
                const targetLocationId = action.target;

                if (!currentLocation) {
                    resultMessage = `You are in the void. You cannot move.`;
                    break;
                }

                if (!targetLocationId) {
                    resultMessage = `You try to move nowhere. You stay where you are.`;
                    break;
                }

                // Validate Target Exists
                const targetLocation = nextState.locations[targetLocationId];
                if (!targetLocation) {
                    resultMessage = `You cannot ensure the existence of "${targetLocationId}".`;
                    break;
                }

                // Validate Connection (Graph Traversal)
                if (currentLocation.exits.includes(targetLocationId)) {
                    // SUCCESS
                    player.location = targetLocationId;
                    resultMessage = `**[Day ${nextState.day} Result]**\nYou travel from **${currentLocation.name}** to **${targetLocation.name}**.`;
                } else {
                    // FAILURE
                    resultMessage = `**[Day ${nextState.day} Result]**\nYou cannot travel to "**${targetLocation.name}**" from here.`;
                }
                break;
            }

            case 'ATTACK':
                resultMessage = `**[Day ${nextState.day} Result]**\nYou attack the air. It is super effective. (Combat not implemented)`;
                break;

            case 'WAIT':
                resultMessage = `**[Day ${nextState.day} Result]**\nYou wait. Time passes.`;
                break;

            default:
                resultMessage = `**[Day ${nextState.day} Result]**\nYou interact with the world in mysterious ways.`;
        }

        playerResults[action.playerId] = resultMessage;
    }

    // 3. Update World & Generate Logs
    const worldLog = generateWorldLog(nextState);
    nextState.worldLog = worldLog;

    if (!nextState.locationLogs) nextState.locationLogs = {};

    for (const locId of Object.keys(nextState.locations)) {
        const population = Object.values(nextState.players).filter((p: Player) =>
            p.location === locId
        ).length;

        let summary = '';
        if (population === 0) summary = "The area is quiet and undisturbed.";
        else if (population === 1) summary = "A lone adventurer lingers here.";
        else if (population < 5) summary = "A small group of adventurers gather here.";
        else summary = "The location buzzes with activity.";

        // Append static flavor
        summary += ` ${nextState.locations[locId].description}`;

        nextState.locationLogs[locId] = {
            day: nextState.day,
            summary: summary,
            population: population,
            notes: []
        };
    }

    // 4. Generate Narrative
    const narrativeSummary = `Day ${nextState.day} has ended. Travelers moved between the known locations.`;

    return {
        newState: nextState,
        playerResults,
        narrativeSummary
    };
}
