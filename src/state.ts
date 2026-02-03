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
            'pinewood-grove': {
                id: 'pinewood-grove',
                name: 'Pinewood Grove',
                clanId: 'timberkeep',
                description: 'Home of the Timberkeep.',
            },
            'goldforge-mine': {
                id: 'goldforge-mine',
                name: 'Goldforge Mine',
                clanId: 'emberwatch',
                description: 'Home of the Emberwatch.',
            },
            'harmony-fields': {
                id: 'harmony-fields',
                name: 'Harmony Fields',
                clanId: 'prismveil',
                description: 'Home of the Prismveil.',
            },
            'golden-plains': {
                id: 'golden-plains',
                name: 'Golden Plains',
                clanId: 'sunherd',
                description: 'Home of the Sunherd.',
            },
            'twilight-pits': {
                id: 'twilight-pits',
                name: 'Twilight Pits',
                clanId: 'shardveil',
                description: 'Home of the Shardveil.',
            },
            'wildrift': {
                id: 'wildrift',
                name: 'The Wildrift',
                clanId: 'monsters',
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
            'timberkeep': {
                id: 'timberkeep',
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
            'emberwatch': {
                id: 'emberwatch',
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
            'prismveil': {
                id: 'prismveil',
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
            'sunherd': {
                id: 'sunherd',
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
            'shardveil': {
                id: 'shardveil',
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
