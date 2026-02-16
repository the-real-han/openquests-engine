
import { describe, test, expect } from 'vitest';
import { buildWorldNarrationInput, buildLocationNarrationInput } from '../src/story';
import { GameState, LocationState, Player, Clan, WorldEvent, LocationModifier } from '@openquests/schema';

// --- Fixtures ---
function makeState(day = 1): GameState {
    return {
        day,
        locations: {
            'locA': { id: 'locA', name: 'Location A', description: 'Desc A', clanId: 'clanA' }
        },
        players: {},
        clans: {
            'clanA': { id: 'clanA', name: 'Clan A', description: '', wood: 100, food: 100, gold: 100, defeatedBy: null },
            'clanB': { id: 'clanB', name: 'Clan B', description: '', wood: 100, food: 100, gold: 100, defeatedBy: null }
        },
        worldLog: { day: 0, summary: '', population: 0, notes: [] },
        locationLogs: {},
        activeBoss: null,
        worldEvents: [],
        locationModifiers: []
    } as unknown as GameState; // Partial
}

describe('Story Logic', () => {

    describe('buildWorldNarrationInput', () => {
        test('Includes boss events', () => {
            const state = makeState(5);
            state.activeEvents = [
                {
                    id: 'boss_appear_dragon_5', type: 'BOSS_APPEARED', day: 5, location: 'Mountain',
                    data: { bossName: 'Dragon', message: 'Roar' }
                } as any, // Cast to any to bypass strict type matching if needed for partial mocks
                {
                    id: 'old_event', type: 'BOSS_APPEARED', day: 4, location: 'Old', data: {}
                } as any
            ];

            const input = buildWorldNarrationInput(state);

            expect(input.day).toBe(5);
            expect(input.bossEvents).toHaveLength(1);
            expect(input.bossEvents[0]).toEqual({
                name: 'Dragon',
                location: 'Mountain',
                status: 'APPEARED',
                message: 'Roar'
            });
        });

        test('Includes location modifier events', () => {
            const state = makeState(5);
            state.activeEvents = [{
                id: 'locmod_rain_5', type: 'WEATHER', day: 5, location: 'Loc A',
                data: { effects: { explore: -1 }, message: 'It rains.' }
            } as any];

            const input = buildWorldNarrationInput(state);

            expect(input.locationEvents).toHaveLength(1);
            expect(input.locationEvents[0]).toEqual({
                type: 'WEATHER',
                location: 'Loc A',
                effects: { explore: -1 },
                message: 'It rains.'
            });
        });
    });


    describe('buildLocationNarrationInput', () => {

        test('A. Location Event included', () => {
            const prev = makeState(1);
            const state = makeState(2);
            state.activeModifiers = [{
                id: 'rain', type: 'WEATHER', locationId: 'locA',
                startedOn: 2, effects: { explore: -1 }, messages: ['Rain falls.']
            }];
            const locA = state.locations['locA'];

            const input = buildLocationNarrationInput(prev, state, locA);

            expect(input.events).toHaveLength(1);
            expect(input.events[0]).toEqual({
                type: 'LOCATION_EVENT',
                data: { eventType: 'WEATHER', effects: { explore: -1 } },
                message: 'Rain falls.'
            });
        });

        test('B. Clan Defeated', () => {
            const prev = makeState(2);
            const state = makeState(2); // Same day processing, but pure function uses states

            prev.clans['clanA'].defeatedBy = null;
            state.clans['clanA'].defeatedBy = 'clanB';

            const locA = state.locations['locA']; // locA owned by clanA

            const input = buildLocationNarrationInput(prev, state, locA);

            expect(input.events).toContainEqual({
                type: 'CLAN_DEFEATED',
                data: { defeatedBy: 'Clan B' }
            });
        });

        test('C. Clan Conquered', () => {
            const prev = makeState(2);
            const state = makeState(2);

            // Clan A conquers Clan B
            prev.clans['clanB'].defeatedBy = null;
            state.clans['clanB'].defeatedBy = 'clanA';

            // We are generating log for Loc A (Clan A)
            const locA = state.locations['locA'];

            const input = buildLocationNarrationInput(prev, state, locA);

            expect(input.events).toContainEqual({
                type: 'CLAN_CONQUERED',
                data: { targetClanName: 'Clan B' }
            });
        });

        test('D. Resource Surge (Largest Positive Delta)', () => {
            const prev = makeState(2);
            const state = makeState(2);
            const locA = state.locations['locA'];

            prev.clans['clanA'].food = 100;
            state.clans['clanA'].food = 150; // +50

            prev.clans['clanA'].wood = 100;
            state.clans['clanA'].wood = 110; // +10

            // Gold decreased or same
            prev.clans['clanA'].gold = 100;
            state.clans['clanA'].gold = 50;

            const input = buildLocationNarrationInput(prev, state, locA);

            // Should verify only Food +50 is reported
            const surge = input.events.find(e => e.type === 'RESOURCE_SURGE');
            expect(surge).toBeDefined();
            expect(surge?.data).toEqual({ resource: 'food', amount: 50 });

            // Verify no second surge event
            expect(input.events.filter(e => e.type === 'RESOURCE_SURGE')).toHaveLength(1);
        });

        test('D. Resource Surge ignored if < 10', () => {
            const prev = makeState(2);
            const state = makeState(2);
            const locA = state.locations['locA'];

            prev.clans['clanA'].food = 100;
            state.clans['clanA'].food = 109; // +9

            const input = buildLocationNarrationInput(prev, state, locA);
            expect(input.events.some(e => e.type === 'RESOURCE_SURGE')).toBe(false);
        });

        test('E. No False Positives', () => {
            const prev = makeState(2);
            const state = makeState(2);
            const locA = state.locations['locA'];
            // No changes.

            const input = buildLocationNarrationInput(prev, state, locA);
            expect(input.events).toHaveLength(0);
        });
    });
});
