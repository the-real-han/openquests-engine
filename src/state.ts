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
        day: 0,
        locations: {
            'blue_base': {
                id: 'blue_base',
                clanId: 'blue_clan',
                description: 'The base of the Blue Whales.',
            },
            'red_base': {
                id: 'red_base',
                clanId: 'red_clan',
                description: 'The base of the Red Lions.',
            },
            'purple_base': {
                id: 'purple_base',
                clanId: 'purple_clan',
                description: 'The base of the Purple Dragons.',
            },
            'yellow_base': {
                id: 'yellow_base',
                clanId: 'yellow_clan',
                description: 'The base of the Yellow Eagles.',
            },
            'black_base': {
                id: 'black_base',
                clanId: 'black_clan',
                description: 'The base of the Black Vipers.',
            },
            'monsters_base': {
                id: 'monsters_base',
                clanId: 'monsters_clan',
                description: 'No one dares to claim this land. It breathes on its own, spawning monsters as naturally as the forest grows leaves. Those who enter do so for glory, power, or foolish pride.',
            }
        },
        players: {},
        worldLog: {
            day: 0,
            summary: 'The world stirs as adventurers continue their journeys.',
            population: 0,
            notes: []
        },
        locationLogs: {},
        clans: {
            'blue': {
                id: 'blue_clan',
                name: 'The Blue Whales',
                description: 'We tread the world and endure storms not by rage, but by patience and depth.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null
            },
            'red': {
                id: 'red_clan',
                name: 'The Red Lions',
                description: 'We are the roar before the clash. Our banners move where blood is spilled, and our courage feeds on conflict.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null
            },
            'purple': {
                id: 'purple_clan',
                name: 'The Purple Dragons',
                description: 'We walk between myth and fire. Power is not taken — it is awakened.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null
            },
            'yellow': {
                id: 'yellow_clan',
                name: 'The Yellow Eagles',
                description: 'From the highest skies, we watch and wait. When we strike, it is swift, precise, and already decided.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null
            },
            'black': {
                id: 'black_clan',
                name: 'The Black Vipers',
                description: 'We do not announce our presence. By the time our enemies feel the venom, it is already too late.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null
            }
        }
    };
}
