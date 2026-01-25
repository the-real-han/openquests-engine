import { processTick } from '../src/engine';
import { GameState, Player, Action } from '@openquests/schema';
import * as assert from 'assert';

const mockState: GameState = {
    day: 1,
    locations: {
        'A': { id: 'A', name: 'Quiet Village', description: 'A quiet place.', exits: ['B'] },
        'B': { id: 'B', name: 'Busy Market', description: 'A busy place.', exits: ['A'] }
    },
    locationLogs: {},
    players: {
        // 0 in A
        // 5 in B
        '1': { playerId: 1, location: 'B', status: { alive: true }, github: { username: 'u1', issueNumber: 1, userId: 1 }, character: { name: 'C1', class: 'Adventurer', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '2': { playerId: 2, location: 'B', status: { alive: true }, github: { username: 'u2', issueNumber: 2, userId: 2 }, character: { name: 'C2', class: 'Adventurer', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '3': { playerId: 3, location: 'B', status: { alive: true }, github: { username: 'u3', issueNumber: 3, userId: 3 }, character: { name: 'C3', class: 'Adventurer', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '4': { playerId: 4, location: 'B', status: { alive: true }, github: { username: 'u4', issueNumber: 4, userId: 4 }, character: { name: 'C4', class: 'Adventurer', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '5': { playerId: 5, location: 'B', status: { alive: true }, github: { username: 'u5', issueNumber: 5, userId: 5 }, character: { name: 'C5', class: 'Adventurer', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
    },
    worldLog: {
        day: 1,
        summary: 'The world stirs as adventurers continue their journeys.',
        population: 5,
        notes: []
    }
};

console.log('Running Location Logs Tests...');

// TEST 1: Generate logs for Day 2
{
    const result = processTick(mockState, [], []);
    const logs = result.newState.locationLogs;

    // Location A (Empty)
    const logA = logs['A'];
    assert.strictEqual(logA.day, 2, 'Day should be 2');
    assert.strictEqual(logA.population, 0, 'Population A should be 0');
    assert.match(logA.summary, /quiet and undisturbed/, 'Flavor A incorrect');
    assert.match(logA.summary, /A quiet place/, 'Description A missing');

    // Location B (5 Players)
    const logB = logs['B'];
    assert.strictEqual(logB.day, 2, 'Day should be 2');
    assert.strictEqual(logB.population, 5, 'Population B should be 5');
    assert.match(logB.summary, /buzzes with activity/, 'Flavor B incorrect');
    assert.match(logB.summary, /A busy place/, 'Description B missing');

    console.log('✅ Log Generation Passed');
}

// TEST 2: Update logs after movement
{
    // Move p1 from B to A
    const actions: Action[] = [{ playerId: '1', type: 'MOVE', target: 'A' }];
    const result = processTick(mockState, actions, []); // Pass generic list, engine reads from state
    const logs = result.newState.locationLogs;

    // Location A (1 Player)
    const logA = logs['A'];
    assert.strictEqual(logA.population, 1, 'Population A should be 1');
    assert.match(logA.summary, /lone adventurer/, 'Flavor A updated incorrect');

    // Location B (4 Players)
    const logB = logs['B'];
    assert.strictEqual(logB.population, 4, 'Population B should be 4');
    assert.match(logB.summary, /small group/, 'Flavor B updated incorrect');

    console.log('✅ Log Updates Passed');
}
