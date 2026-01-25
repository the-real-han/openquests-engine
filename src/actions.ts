import { Action } from '@openquests/schema';

export const VALID_ACTIONS = ['MOVE', 'ATTACK', 'WAIT'] as const;

export function parseAction(playerId: string, commentBody: string): Action {
    // Normalize input
    const cleanLine = commentBody.trim().split('\n')[0].trim(); // Take first line only
    const parts = cleanLine.split(/\s+/);
    const command = parts[0].toUpperCase();

    switch (command) {
        case 'MOVE':
            if (parts.length < 2) return { playerId, type: 'WAIT' };
            return { playerId, type: 'MOVE', target: parts.slice(1).join(' ') };

        case 'ATTACK':
            if (parts.length < 2) return { playerId, type: 'WAIT' };
            return { playerId, type: 'ATTACK', target: parts.slice(1).join(' ') };

        case 'WAIT':
            return { playerId, type: 'WAIT' };

        default:
            // Invalid command defaults to WAIT
            return { playerId, type: 'WAIT' };
    }
}
