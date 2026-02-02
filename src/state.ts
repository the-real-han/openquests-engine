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
                name: 'Pinewood Grove',
                clanId: 'blue_clan',
                description: 'The base of the Timberkeep.',
            },
            'red_base': {
                id: 'red_base',
                name: 'Goldforge Mine',
                clanId: 'red_clan',
                description: 'The base of the Emberwatch.',
            },
            'purple_base': {
                id: 'purple_base',
                name: 'Harmony Fields',
                clanId: 'purple_clan',
                description: 'The base of the Prismveil.',
            },
            'yellow_base': {
                id: 'yellow_base',
                name: 'Golden Plains',
                clanId: 'yellow_clan',
                description: 'The base of the Sunherd.',
            },
            'black_base': {
                id: 'black_base',
                name: 'Twilight Pits',
                clanId: 'black_clan',
                description: 'The base of the Shardveil.',
            },
            'monsters_base': {
                id: 'monsters_base',
                name: 'The Wildrift',
                clanId: 'monsters_clan',
                description: 'A rugged no-man’s land crawling with wild beasts and old ruins. Once fertile, now overrun, the Wildrift tempts adventurers with hidden loot and danger alike.',
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
                name: 'The Timberkeep',
                description: 'Timberkeep’s people dwell in forest clearings surrounded by towering pines. They’re builders and wardens—steady as the trunks that shield their homes.',
                wood: 100,
                food: 100,
                gold: 100,
                defeatedBy: null,
                bonus: {
                    wood: 15
                }
            },
            'red': {
                id: 'red_clan',
                name: 'The Emberwatch',
                description: 'The miners and smiths of Emberwatch live among glowing forges and dusty tunnels rich with gold. They trade sweat for fortune and see progress in every swing of their hammers.',
                wood: 100,
                food: 100,
                gold: 100,
                bonus: {
                    gold: 15
                },
                defeatedBy: null
            },
            'purple': {
                id: 'purple_clan',
                name: 'The Prismveil',
                description: 'A gathering of traders and travelers who value balance over greed. Prismveil’s lands hold a little of everything—trees, farms, and gold for trade or craft.',
                wood: 100,
                food: 100,
                gold: 100,
                bonus: {
                    wood: 5,
                    food: 5,
                    gold: 5
                },
                defeatedBy: null
            },
            'yellow': {
                id: 'yellow_clan',
                name: 'The Sunherd',
                description: 'Peaceful and hearty, the Sunherd clan tends vast grazing fields where flocks roam freely. Food means life to them, and their bounty feeds all who stand beside them.',
                wood: 100,
                food: 100,
                gold: 100,
                bonus: {
                    food: 15
                },
                defeatedBy: null
            },
            'black': {
                id: 'black_clan',
                name: 'The Shardveil',
                description: 'A clan of wanderers drawn to fortune and mystery. Each sunrise brings them a different bounty—some days gold, others wood or food. Chaos is their ally.',
                wood: 100,
                food: 100,
                gold: 100,
                bonus: {
                },
                defeatedBy: null
            }
        },
        worldEvents: []
    };
}
