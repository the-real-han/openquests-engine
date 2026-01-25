import { GameState, Player } from '@openquests/schema';

export function generateLookResponse(state: GameState, requestingPlayerId: string): string {
    const player = state.players[requestingPlayerId];
    if (!player) {
        return 'You have not joined the world yet. Create a character first.';
    }

    const locId = player.location;
    const location = state.locations[locId];

    if (!location) {
        return `You are in the void (LocationID: ${locId}). Something is wrong.`;
    }

    // Header & Description
    let output = `**[Day ${state.day} — ${location.name}]**\n\n${location.description}\n\n`;

    // Exits
    output += `**Exits**\n`;
    if (location.exits.length === 0) {
        output += `- (none)\n`;
    } else {
        for (const exitId of location.exits) {
            const exitLoc = state.locations[exitId];
            const exitName = exitLoc ? exitLoc.name : exitId;
            output += `- ${exitName}\n`;
        }
    }
    output += `\n`;

    // Players Here
    output += `**Players Here**\n`;
    const otherPlayers = Object.values(state.players).filter(p =>
        p.location === locId &&
        p.playerId.toString() !== requestingPlayerId
    );

    if (otherPlayers.length === 0) {
        output += `- (no one else)\n`;
    } else {
        for (const p of otherPlayers) {
            output += `- @${p.github.username}\n`; // Using @username mentions
        }
    }

    return output;
}
