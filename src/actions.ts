import { Action } from '@openquests/schema';

export const VALID_RESOURCES = ['food', 'wood', 'gold'];
export const VALID_TARGETS = ['pinewood-grove', 'goldforge-mine', 'harmony-fields', 'golden-plains', 'twilight-pits', 'wildrift'];

export function parseAction(playerId: string, commentBody: string): Action {
    // Normalize input
    const cleanLine = commentBody.trim().split('\n')[0].trim(); // Take first line only
    const parts = cleanLine.split(/\s+/);
    const command = parts[0].toUpperCase();

    switch (command) {
        case 'GATHER':
            if (parts.length < 2 || !VALID_RESOURCES.includes(parts[1].toLowerCase())) return { playerId, type: 'WAIT' };
            return { playerId, type: 'GATHER', target: parts[1].toLowerCase() };

        case 'EXPLORE':
            if (parts.length < 2 || !VALID_TARGETS.includes(parts[1].toLowerCase())) return { playerId, type: 'WAIT' };
            return { playerId, type: 'EXPLORE', target: parts[1].toLowerCase() };

        case 'ATTACK':
            if (parts.length < 2 || !VALID_TARGETS.includes(parts[1].toLowerCase())) return { playerId, type: 'WAIT' };
            return { playerId, type: 'ATTACK', target: parts[1].toLowerCase() };

        case 'WAIT':
            return { playerId, type: 'WAIT' };

        default:
            // Invalid command defaults to WAIT
            return { playerId, type: 'WAIT' };
    }
}
