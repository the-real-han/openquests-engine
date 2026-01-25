import * as fs from 'fs';
import * as path from 'path';
import { GameState } from '@openquests/schema';

const STATE_FILE = 'gamestate.json';

export function loadState(baseDir: string): GameState {
    const filePath = path.join(baseDir, STATE_FILE);
    if (!fs.existsSync(filePath)) {
        console.log('No state file found. Initializing new game state.');
        return getInitialState();
    }

    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const state = JSON.parse(data) as GameState;
        if (!state.players) state.players = {};
        if (!state.locationLogs) state.locationLogs = {};
        return state;
    } catch (error) {
        console.error('Failed to parse state file:', error);
        throw new Error('Corrupted game state');
    }
}

export function saveState(baseDir: string, state: GameState): void {
    const filePath = path.join(baseDir, STATE_FILE);
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
}

function getInitialState(): GameState {
    return {
        day: 1,
        locations: {
            'town_square': {
                id: 'town_square',
                name: 'Town Square',
                description: 'The center of the village. It is safe here.',
                exits: ['forest_edge']
            },
            'forest_edge': {
                id: 'forest_edge',
                name: 'Forest Edge',
                description: 'The edge of the dark forest. Goblins are rumored to be near.',
                exits: ['town_square']
            }
        },
        players: {},
        worldLog: {
            day: 1,
            summary: 'The world stirs as adventurers continue their journeys.',
            population: 0,
            notes: []
        },
        locationLogs: {}
    };
}
