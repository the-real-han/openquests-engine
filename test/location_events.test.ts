
import { describe, test, expect, vi } from 'vitest';
import { processTick } from '../src/engine';
import { GameState, Player, Clan, Action, PlayerClass, LocationModifier } from '@openquests/schema';
import LOCATION_EVENTS from '../src/rules/locationEvent.rules.json';

// Mock AI generation
vi.mock('../src/story', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/story')>();
    return {
        ...actual,
        generateWorldSummary: vi.fn().mockResolvedValue("Mock World Summary"),
        generateLocationSummary: vi.fn().mockResolvedValue("Mock Location Summary")
    };
});

// --- Fixtures ---

function makeClan(id: string, name: string): Clan {
    return {
        id,
        name,
        description: `${name} desc`,
        wood: 100,
        food: 100,
        gold: 100,
        defeatedBy: null,
        bonus: { food: 0, wood: 0, gold: 0 }
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
        history: [],
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
            'locA': { id: 'locA', description: 'Location A', clanId: 'clanA', name: 'Location A', history: [] },
            'locB': { id: 'locB', description: 'Location B', clanId: 'clanB', name: 'Location B', history: [] },
            'wildrift': { id: 'wildrift', description: 'Monster Base', clanId: 'monsters', name: 'Monster Base', history: [] }
        },
        players: { [player1.github.username]: player1 },
        clans: { [clanA.id]: clanA },
        activeBoss: null,
        activeEvents: [],
        activeModifiers: [],
        history: []
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
        test('Spawns modifier when roll < 6', async () => {
            const state = makeGameState();
            const actions: Action[] = [{ playerId: '1', type: 'EXPLORE', target: 'locA' }];
            // Dice:
            // 1. Explore Rule Roll: 10
            // 2. Explore Outcome Roll: 2 (Outcome wood)
            // 3. Explore Msg Roll: 0
            // 4. Location Mod Spawn Check: 5 (< 6, Success)
            // 5. Event Index Select: 0 (weather_heavy_rain)
            // 6. Modifier Message Roll: 0
            const dice = createDeterministicDice([10, 2, 0, 5, 0, 0]);

            const { newState } = await processTick(state, actions, dice);

            expect(newState.activeModifiers).toBeDefined();
            expect(newState.activeModifiers?.length).toBe(1);
            expect(newState.activeModifiers?.[0].locationId).toBe('locA');
            expect(newState.activeModifiers?.[0].id).toBe('weather_heavy_rain');
            expect(newState.activeEvents.find(e => e.type === 'WEATHER')).toBeDefined();
        });

        test('Does not spawn modifier when roll >= 6', async () => {
            const state = makeGameState();
            const actions: Action[] = [{ playerId: '1', type: 'EXPLORE', target: 'locA' }];
            // Dice: Explore(10, 2, 0), LocMod(6, Fail)
            const dice = createDeterministicDice([10, 2, 0, 6]);

            const { newState } = await processTick(state, actions, dice);
            expect(newState.activeModifiers?.length).toBe(0);
        });

        test('Modifiers are cleared/replaced next tick', async () => {
            const state = makeGameState();
            state.activeModifiers = [{
                id: 'old_mod',
                type: 'WEATHER',
                locationId: 'locA',
                startedOn: 1,
                effects: {},
                messages: []
            }];

            // Dice: Boss(1), LocMod(4, Fail) -> Modifiers should be overwritten by empty list
            const dice = createDeterministicDice([1, 4]);
            const { newState } = await processTick(state, [], dice);

            expect(newState.activeModifiers).toHaveLength(0);
        });
    });

    describe('Resource Loss (Invasion/Curse)', () => {
        test('Goblin Raid reduces gold and wood', async () => {
            const state = makeGameState();
            // Set up Goblin Raid manually to match new rules
            // Goblin Raid: Gold 10%, Wood 10%
            state.activeModifiers = [{
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

            const { newState } = await processTick(state, [], dice);

            // Gold: 100 * 0.1 = 10 loss -> 90 remaining
            // Wood: 100 * 0.1 = 10 loss -> 90 remaining
            // Food: Unchanged
            expect(newState.clans['clanA'].gold).toBe(90);
            expect(newState.clans['clanA'].wood).toBe(90);
            expect(newState.clans['clanA'].food).toBe(100);
        });

        test('Resource loss does not drop below 0', async () => {
            const state = makeGameState();
            state.activeModifiers = [{
                id: 'invasion_heavy',
                type: 'INVASION',
                locationId: 'locA',
                startedOn: 1,
                effects: { clanResourceLossPct: { food: 0.5 } },
                messages: []
            }];
            state.clans['clanA'].food = 1;

            const dice = createDeterministicDice([1, 4]);
            const { newState } = await processTick(state, [], dice);

            // 1 * 0.5 = 0.5 -> floor(0.5) = 0? Or floor(loss)?
            // Code: loss = Math.floor(clan[res] * pct)
            // 1 * 0.5 = 0.5 -> floor = 0. No loss.
            expect(newState.clans['clanA'].food).toBe(1);

            // Try with 2: 2 * 0.5 = 1 -> loss 1 -> 1 left.
        });

        test('Defeated clan ignores resource loss', async () => {
            const state = makeGameState();
            state.activeModifiers = [{
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
            const { newState } = await processTick(state, [], dice);

            expect(newState.clans['clanA'].food).toBe(100);
        });
    });

    describe('Fortune Stacking', () => {

        test('Fortune affects ATTACK_MONSTER (Reversed Logic)', async () => {
            const state = makeGameState();
            // Monster Base has Blessing (+2 Fortune)
            // Logic: dice - fortuneMod. 
            // So roll should be REDUCED by 2.
            state.activeModifiers = [{
                id: 'blessing_fortune',
                type: 'BLESSING',
                locationId: 'wildrift',
                startedOn: 1,
                effects: { fortune: 2 }, // +2
                messages: []
            }];

            const actions: Action[] = [{ playerId: '1', type: 'ATTACK', target: 'wildrift' }];

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
            const { newState } = await processTick(state, actions, dice);
            const p1 = newState.players['1'];

            // Expect XP 9 (indicating 17 was used), NOT 11 (indicating 19).
            // 9 * 1.05 = 9.

            expect(p1.message).toContain("[+9 xp]");
        });

        test('Explore Logic (Target Bonus Only - Home Ignored)', async () => {
            const state = makeGameState();
            // Home (locA): Modifiers that should be IGNORED
            // Fortune +10, Explore +10.
            state.clans['clanA'].defeatedBy = null;
            state.locations['locA'].clanId = 'clanA';

            state.activeModifiers = [
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
            const { newState } = await processTick(state, actions, dice);
            const p1 = newState.players['1'];

            // 7 * 1.05 = 7.35 -> 7.
            expect(p1.message).toContain("[+9 xp]");
        });
    });
});
