
import { describe, test, expect } from 'vitest';
import { processTick } from '../src/engine';
import { GameState, Player, Clan, Action, PlayerClass } from '@openquests/schema';
import BOSS_RULES from '../src/rules/boss.rules.json';

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
        github: {
            username: id,
            issueNumber: 1,
            userId: 1,
        },
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
    // const player2 = makePlayer('2', 'clanA'); // Unused for now


    return {
        day: 1,
        locations: {
            'monsters_base': { id: 'monsters_base', description: 'Monster Base', clanId: 'monsters' }
        },
        players: { [player1.github.username]: player1 },
        worldLog: { day: 0, summary: '', population: 0, notes: [] },
        locationLogs: {},
        clans: {
            [clanA.id]: clanA
        },
        activeBoss: null,
        worldEvents: []
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

describe('Boss Mechanics', () => {

    describe('Boss Spawn Logic', () => {
        test('Boss spawns when roll is 20', () => {
            const state = makeGameState();
            // User updated code: const boss = BOSS_RULES[rollDice() % BOSS_RULES.length]
            // Dice Needed:
            // 1. Spawn Check Roll: 20
            // 2. Boss Selection Roll: 0 (Iron Behemoth)
            const dice = createDeterministicDice([20, 0]);

            const { newState } = processTick(state, [], dice);

            expect(newState.activeBoss).toBeDefined();
            expect(newState.activeBoss?.bossId).toBe(BOSS_RULES[0].id);
            expect(newState.activeBoss?.appearedOn).toBe(2); // Day 1 -> 2
        });

        test('Emits BOSS_APPEAR event', () => {
            const state = makeGameState();
            const dice = createDeterministicDice([20, 0]);

            const { newState } = processTick(state, [], dice);
            const event = newState.worldEvents.find(e => e.type === 'BOSS_APPEAR');

            expect(event).toBeDefined();
            expect(event?.data?.bossId).toBe(BOSS_RULES[0].id);
        });

        test('Boss does not spawn if active boss exists', () => {
            const state = makeGameState();
            state.activeBoss = {
                bossId: BOSS_RULES[0].id, // Use valid ID
                locationId: 'monsters_base',
                appearedOn: 1,
                expiresOn: 999,
                participants: []
            };

            // Dice: 20 (would spawn if null).
            const dice = createDeterministicDice([20, 0]);
            const { newState } = processTick(state, [], dice);

            // Should still be the old boss
            expect(newState.activeBoss?.bossId).toBe(BOSS_RULES[0].id);
            // Should not emit new BOSS_APPEAR
            const validEvents = newState.worldEvents.filter(e => e.type === 'BOSS_APPEAR');
            expect(validEvents.length).toBe(0);
        });

        test('Boss does not spawn if roll is not 20', () => {
            const state = makeGameState();
            const dice = createDeterministicDice([19]); // Not 20

            const { newState } = processTick(state, [], dice);
            expect(newState.activeBoss).toBeNull();
        });
    });

    describe('Boss Participation', () => {
        test('Attacking monsters_base adds player to participants', () => {
            const state = makeGameState();
            state.activeBoss = {
                bossId: BOSS_RULES[0].id, // Iron Behemoth
                locationId: 'monsters_base',
                appearedOn: 1,
                expiresOn: 10,
                participants: []
            };

            const actions: Action[] = [{ playerId: '1', type: 'ATTACK', target: 'monsters_base' }];
            // processTick logic: if boss active, just add participant and continue. No dice needed for attack resolution?
            // "if (boss) { ... pushMessage ... continue }"
            // But processTick creates `nextState` deep copy.

            const { newState } = processTick(state, actions);

            // expect(newState.activeBoss?.participants).toContain(1); // cleared at end of tick
            expect(newState.players['1'].message).toContain("join the hunt");
            // Also check failure XP to ensure participation
            expect(newState.players['1'].character.xp).toBeGreaterThan(0);
        });

        test('Duplicate participation prevented', () => {
            const state = makeGameState();
            state.activeBoss = {
                bossId: BOSS_RULES[0].id,
                locationId: 'monsters_base',
                appearedOn: 1,
                expiresOn: 10,
                participants: [1] // Already joined
            };

            const actions: Action[] = [{ playerId: '1', type: 'ATTACK', target: 'monsters_base' }];
            const { newState } = processTick(state, actions);

            // Participants should still only have one '1'
            // Participants cleared. Check XP to ensure no double-dip.
            // Iron Behemoth failure XP = 3.
            // Level 1: 3 * 1.05 = 3.
            // If double participation: 6.
            expect(newState.players['1'].character.xp).toBe(3);
            expect(newState.players['1'].message).toContain("join the hunt");
        });
    });

    describe('Boss Resolution', () => {
        // Iron Behemoth: Min 10 players, Warrior 10.
        // Let's pick a boss with easier reqs or mock the boss rules?
        // We can't mock imports easily in Vitest without verifying module mocks setup.
        // Better to just create enough players in the state to match Iron Behemoth or another boss.

        // Iron Behemoth: Min 10, Warrior 10.
        // Veil of Whispers (index 3): Min 5, Monk 5.
        // Great Eagle (index 7): Min 5, Archer 5.

        test('Resolution Fails - Requirements not met', () => {
            const state = makeGameState();
            const boss = BOSS_RULES[0]; // Iron Behemoth
            state.activeBoss = {
                bossId: boss.id,
                locationId: boss.locationId,
                appearedOn: 1,
                expiresOn: 10,
                participants: [1] // Only 1 player
            };
            // p1 is Adventurer (default from makePlayer).

            // processTick calls resolveBossIfNeeded at end.
            // Players get Failure XP.
            const dice = createDeterministicDice([0]); // Message roll

            const { newState } = processTick(state, [], dice);
            const p1 = newState.players['1'];

            // Not defeated -> Boss remains.
            expect(newState.activeBoss).not.toBeNull();
            // Failure Reward (Iron Behemoth): 3 XP.
            // 3 * 1.05 = 3.
            expect(p1.character.xp).toBe(3);
            expect(p1.message).toContain("try attacking with more allies");

            // Participants cleared?
            expect(newState.activeBoss?.participants).toEqual([]);
        });

        test('Resolution Success - Requirements met', () => {
            const state = makeGameState();
            // Use 'Great Eagle' (index 7) -> Min 5, Archer 5.
            // We need to ensure we invoke the resolution for this specific boss.
            const boss = BOSS_RULES.find(b => b.id === 'great_eagle')!;

            state.activeBoss = {
                bossId: boss.id,
                locationId: boss.locationId,
                appearedOn: 1,
                expiresOn: 10, // Far in future
                participants: []
            };

            // Create 5 Archer players and add to participants
            for (let i = 1; i <= 5; i++) {
                const pid = `${i}`;
                const p = makePlayer(pid, 'clanA', 'Archer');
                state.players[pid] = p;
                state.activeBoss.participants.push(p.playerId);
            }

            // Dice:
            // 1. Success Message Roll: 0
            // 2. Loop players: none needed for XP calc (unless title bonus uses random?) No.
            // ... Events ... null.
            const dice = createDeterministicDice([0]);

            const { newState } = processTick(state, [], dice);

            // Boss should be cleared
            expect(newState.activeBoss).toBeNull();

            // Check events
            const event = newState.worldEvents.find(e => e.type === 'BOSS_DEFEATED');
            expect(event).toBeDefined();
            expect(event?.data?.bossId).toBe(boss.id);

            // Check Rewards
            // Great Eagle Reward: 20 XP.
            // 20 * 1.05 = 21.0 -> 21.
            const p1 = newState.players['1'];
            // 20 * 1.05 = 21.
            // Level 1 -> requires 9 XP.
            // Level up -> 2. XP = 21 - 9 = 12.
            expect(p1.character.xp).toBe(12);
            expect(p1.character.level).toBe(2);
            expect(p1.message).toContain("Defeated The Great Eagle");
            expect(p1.meta.bossKilled).toBe(1);
        });
    });

    describe('Boss Expiration', () => {
        test('Boss expires when day >= expiresOn', () => {
            const state = makeGameState();
            const boss = BOSS_RULES[0]; // Iron Behemoth
            state.activeBoss = {
                bossId: boss.id,
                locationId: boss.locationId,
                appearedOn: 1,
                expiresOn: 2, // Expires on Day 2
                participants: [1]
            };
            state.day = 1; // Will become 2 in processTick

            // processTick:
            // 1. Advance Day -> 2.
            // ...
            // resolveBossIfNeeded: 
            // - Not enough players -> Fail.
            // - Clear participants.
            // - Check if day (2) >= expiresOn (2) -> True.
            // - Emit BOSS_FAILED.
            // - Set activeBoss = null.

            const dice = createDeterministicDice([0]); // Fail msg

            const { newState } = processTick(state, [], dice);

            expect(newState.activeBoss).toBeNull();
            expect(newState.worldEvents.some(e => e.type === 'BOSS_FAILED')).toBe(true);

            // Player still gets failure XP for that day's attempt
            expect(newState.players['1'].character.xp).toBeGreaterThan(0);
        });

        test('Boss does not expire before expiresOn', () => {
            const state = makeGameState();
            const boss = BOSS_RULES[0];
            state.activeBoss = {
                bossId: boss.id,
                locationId: boss.locationId,
                appearedOn: 1,
                expiresOn: 3,
                participants: [] // No participants
            };
            state.day = 1; // -> 2

            // day 2 < 3. 

            const dice = createDeterministicDice([0]);
            const { newState } = processTick(state, [], dice);

            expect(newState.activeBoss).not.toBeNull();
            expect(newState.worldEvents.some(e => e.type === 'BOSS_FAILED')).toBe(false);
        });
    });
});
