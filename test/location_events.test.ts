
import { describe, test, expect } from 'vitest';
import { processTick } from '../src/engine';
import { GameState, Player, Clan, Action, PlayerClass, LocationModifier } from '@openquests/schema';
import LOCATION_EVENTS from '../src/rules/locationEvent.rules.json';

// --- Fixtures ---

function makeClan(id: string, name: string): Clan {
    return {
        id,
        name,
        description: `${name} desc`,
        wood: 100,
        food: 100,
        gold: 100,
        defeatedBy: null
    };
}

function makePlayer(id: string, clanId: string, charClass: PlayerClass = 'Adventurer'): Player {
    return {
        playerId: parseInt(id.replace(/\D/g, '')) || 1,
        github: { username: id, issueNumber: 1, userId: 1 },
        character: {
            name: id,
            class: charClass,
            level: 1,
            xp: 0,
            clanId,
            titles: [],
            backstory: 'A hero'
        },
        message: '',
        status: { alive: true },
        meta: {
            joinedDay: 1, lastActionDay: 1,
            gatherFoodCount: 0, gatherWoodCount: 0, gatherGoldCount: 0,
            food: 0, wood: 0, gold: 0,
            exploreCount: 0, attackCount: 0,
            playerWins: 0, playerLosses: 0,
            monsterKilled: 0, bossKilled: 0, monsterEncountered: 0,
            attackWinStreak: 0, attackLoseStreak: 0, attackedCount: 0
        }
    };
}

function makeGameState(): GameState {
    const clanA = makeClan('clanA', 'Clan A');
    const player1 = makePlayer('1', 'clanA');

    return {
        day: 1,
        locations: {
            'locA': { id: 'locA', description: 'Location A', clanId: 'clanA' },
            'locB': { id: 'locB', description: 'Location B', clanId: 'clanB' },
            'monsters_base': { id: 'monsters_base', description: 'Monster Base', clanId: 'monsters' }
        },
        players: { [player1.github.username]: player1 },
        worldLog: { day: 0, summary: '', population: 0, notes: [] },
        locationLogs: {},
        clans: { [clanA.id]: clanA },
        activeBoss: null,
        worldEvents: [],
        locationModifiers: []
    };
}

function createDeterministicDice(rolls: number[]) {
    let index = 0;
    return () => {
        const roll = rolls[index % rolls.length];
        index++;
        return roll;
    };
}

// --- Tests ---

describe('Location Events & Modifiers', () => {

    describe('Modifier Spawning', () => {
        test('Spawns modifier when roll < 4', () => {
            const state = makeGameState();
            // Dice:
            // 1. Boss Spawn: 1 (Fail)
            // 2. Location Mod Spawn Check: 3 (< 4, Success)
            // 3. Location Select: 0 (locA)
            // 4. Event Select: 0 (weather_heavy_rain)
            // 5. Message Roll: 0
            const dice = createDeterministicDice([1, 3, 0, 0, 0]);

            const { newState } = processTick(state, [], dice);

            expect(newState.locationModifiers).toBeDefined();
            expect(newState.locationModifiers?.length).toBe(1);
            expect(newState.locationModifiers?.[0].locationId).toBe('locA');
            expect(newState.locationModifiers?.[0].id).toBe('weather_heavy_rain');
            expect(newState.worldEvents.find(e => e.type === 'WEATHER')).toBeDefined();
        });

        test('Does not spawn modifier when roll >= 4', () => {
            const state = makeGameState();
            // Dice: Boss(1), LocMod(4, Fail)
            const dice = createDeterministicDice([1, 4]);

            const { newState } = processTick(state, [], dice);
            expect(newState.locationModifiers?.length).toBe(0);
        });

        test('Modifiers are cleared/replaced next tick', () => {
            const state = makeGameState();
            state.locationModifiers = [{
                id: 'old_mod',
                type: 'WEATHER',
                locationId: 'locA',
                startedOn: 1,
                effects: {},
                messages: []
            }];

            // Dice: Boss(1), LocMod(4, Fail) -> Modifiers should be overwritten by empty list
            const dice = createDeterministicDice([1, 4]);
            const { newState } = processTick(state, [], dice);

            expect(newState.locationModifiers).toHaveLength(0);
        });
    });

    describe('Resource Loss (Invasion/Curse)', () => {
        test('Goblin Raid reduces gold and wood', () => {
            const state = makeGameState();
            // Set up Goblin Raid manually to match new rules
            // Goblin Raid: Gold 10%, Wood 10%
            state.locationModifiers = [{
                id: 'invasion_goblin_raid',
                type: 'INVASION',
                locationId: 'locA',
                startedOn: 1,
                effects: {
                    clanResourceLossPct: { gold: 0.1, wood: 0.1 }
                },
                messages: []
            }];
            state.clans['clanA'].gold = 100;
            state.clans['clanA'].wood = 100;
            state.clans['clanA'].food = 100;

            // Dice: just enough for basic processing
            const dice = createDeterministicDice([1, 4]);

            const { newState } = processTick(state, [], dice);

            // Gold: 100 * 0.1 = 10 loss -> 90 remaining
            // Wood: 100 * 0.1 = 10 loss -> 90 remaining
            // Food: Unchanged
            expect(newState.clans['clanA'].gold).toBe(90);
            expect(newState.clans['clanA'].wood).toBe(90);
            expect(newState.clans['clanA'].food).toBe(100);
        });

        test('Resource loss does not drop below 0', () => {
            const state = makeGameState();
            state.locationModifiers = [{
                id: 'invasion_heavy',
                type: 'INVASION',
                locationId: 'locA',
                startedOn: 1,
                effects: { clanResourceLossPct: { food: 0.5 } },
                messages: []
            }];
            state.clans['clanA'].food = 1;

            const dice = createDeterministicDice([1, 4]);
            const { newState } = processTick(state, [], dice);

            // 1 * 0.5 = 0.5 -> floor(0.5) = 0? Or floor(loss)?
            // Code: loss = Math.floor(clan[res] * pct)
            // 1 * 0.5 = 0.5 -> floor = 0. No loss.
            expect(newState.clans['clanA'].food).toBe(1);

            // Try with 2: 2 * 0.5 = 1 -> loss 1 -> 1 left.
        });

        test('Defeated clan ignores resource loss', () => {
            const state = makeGameState();
            state.locationModifiers = [{
                id: 'invasion_goblin_raid',
                type: 'INVASION',
                locationId: 'locA',
                startedOn: 1,
                effects: { clanResourceLossPct: { food: 0.5 } },
                messages: []
            }];
            state.clans['clanA'].food = 100;
            state.clans['clanA'].defeatedBy = 'other_clan';

            const dice = createDeterministicDice([1, 4]);
            const { newState } = processTick(state, [], dice);

            expect(newState.clans['clanA'].food).toBe(100);
        });
    });

    describe('Fortune Stacking', () => {

        test('Fortune affects ATTACK_MONSTER (Reversed Logic)', () => {
            const state = makeGameState();
            // Monster Base has Blessing (+2 Fortune)
            // Logic: dice - fortuneMod. 
            // So roll should be REDUCED by 2.
            state.locationModifiers = [{
                id: 'blessing_fortune',
                type: 'BLESSING',
                locationId: 'monsters_base',
                startedOn: 1,
                effects: { fortune: 2 }, // +2
                messages: []
            }];

            const actions: Action[] = [{ playerId: '1', type: 'ATTACK', target: 'monsters_base' }];

            // Dice: 19.
            // Modifier: -2.
            // Effective: 17.
            // Rule 17 (>15): 9 XP.
            // If it was 19 un-modified: Reward 11 XP.

            // Wait, previous test said: Rule 19 (>18): 11. Rule 18 (>15): 9.
            // Let's verify Monster Rules defaults.
            // >18: XP 11.
            // >15: XP 9.

            // 19 - 2 = 17. -> XP 9.
            // Message will match XP.

            const dice = createDeterministicDice([19, 0]);
            const { newState } = processTick(state, actions, dice);
            const p1 = newState.players['1'];

            // Expect XP 9 (indicating 17 was used), NOT 11 (indicating 19).
            // 9 * 1.05 = 9.

            expect(p1.message).toContain("[+9 xp]");
        });

        test('Explore Logic (Target Bonus Only - Home Ignored)', () => {
            const state = makeGameState();
            // Home (locA): Modifiers that should be IGNORED
            // Fortune +10, Explore +10.
            state.clans['clanA'].defeatedBy = null;
            state.locations['locA'].clanId = 'clanA';

            state.locationModifiers = [
                {
                    id: 'ignored_home', type: 'BLESSING', locationId: 'locA', startedOn: 1,
                    effects: { explore: 10, fortune: 10 }, messages: []
                },
                {
                    id: 'target_mod', type: 'WEATHER', locationId: 'locB', startedOn: 1,
                    effects: { explore: 1 }, messages: []
                }
            ];

            const actions: Action[] = [{ playerId: '1', type: 'EXPLORE', target: 'locB' }];

            const dice = createDeterministicDice([18, 0, 0]);
            const { newState } = processTick(state, actions, dice);
            const p1 = newState.players['1'];

            // 7 * 1.05 = 7.35 -> 7.
            expect(p1.message).toContain("[+9 xp]");
        });
    });
});
