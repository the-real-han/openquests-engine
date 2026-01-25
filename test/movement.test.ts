import { processTick } from '../src/engine';
import { GameState, Player, Action } from '@openquests/schema';
import * as assert from 'assert';

const mockState: GameState = {
    day: 1,
    locations: {
        'A': { id: 'A', name: 'Loc A', description: 'A', exits: ['B'] },
        'B': { id: 'B', name: 'Loc B', description: 'B', exits: ['A'] },
        'C': { id: 'C', name: 'Loc C', description: 'C', exits: [] } // Isolated
    },
    locationLogs: {},
    players: {
        'p1': {
            playerId: 1,
            github: { username: 'p1', issueNumber: 1, userId: 101 },
            character: { name: 'P1', class: 'Adventurer', title: '', backstory: '' },
            location: 'A',
            status: { alive: true },
            meta: { joinedDay: 1, lastActionDay: 1 }
        },
        'p2': {
            playerId: 2,
            github: { username: 'p2', issueNumber: 2, userId: 102 },
            character: { name: 'P2', class: 'Adventurer', title: '', backstory: '' },
            location: 'A', // Same start
            status: { alive: true },
            meta: { joinedDay: 1, lastActionDay: 1 }
        }
    },
    worldLog: {
        day: 1,
        summary: 'Day 1 has ended. Travelers moved between the known locations.',
        population: 2,
        notes: []
    }
};

console.log('Running Movement Tests...');

// TEST 1: Valid Move
{
    const actions: Action[] = [{ playerId: 'p1', type: 'MOVE', target: 'B' }];
    const result = processTick(mockState, actions, []);
    const p1 = result.newState.players['p1'];

    assert.strictEqual(p1.location, 'B', 'P1 should have moved to B');
    assert.match(result.playerResults['p1'], /You travel from/);
    console.log('✅ Valid Move Passed');
}

// TEST 2: Invalid Move (Not Connected)
{
    const actions: Action[] = [{ playerId: 'p1', type: 'MOVE', target: 'C' }];
    const result = processTick(mockState, actions, []);
    const p1 = result.newState.players['p1'];

    assert.strictEqual(p1.location, 'A', 'P1 should stay in A');
    assert.match(result.playerResults['p1'], /You cannot travel/);
    console.log('✅ Invalid Move (Not Connected) Passed');
}

// TEST 3: Invalid Move (Non-existent)
{
    const actions: Action[] = [{ playerId: 'p1', type: 'MOVE', target: 'VOID' }];
    const result = processTick(mockState, actions, []);
    const p1 = result.newState.players['p1'];

    assert.strictEqual(p1.location, 'A', 'P1 should stay in A');
    assert.match(result.playerResults['p1'], /ensure the existence/);
    console.log('✅ Invalid Move (Non-existent) Passed');
}

// TEST 4: Simultaneous Move
{
    const actions: Action[] = [
        { playerId: 'p1', type: 'MOVE', target: 'B' },
        { playerId: 'p2', type: 'WAIT' }
    ];
    const result = processTick(mockState, actions, []);

    assert.strictEqual(result.newState.players['p1'].location, 'B', 'P1 moved');
    assert.strictEqual(result.newState.players['p2'].location, 'A', 'P2 waited');
    console.log('✅ Simultaneous Move Passed');
}
