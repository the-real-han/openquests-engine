import { generateLookResponse } from '../src/queries/look';
import { GameState } from '@openquests/schema';
import * as assert from 'assert';

const mockState: GameState = {
    day: 5,
    locations: {
        'A': { id: 'A', name: 'Start', description: 'Starting Point', exits: ['B'] },
        'B': { id: 'B', name: 'End', description: 'Ending Point', exits: ['A'] }
    },
    locationLogs: {},
    players: {
        '1': {
            playerId: 1,
            github: { username: 'alice', issueNumber: 1, userId: 201 },
            character: { name: 'Alice', class: 'Warrior', title: '', backstory: '' },
            location: 'A',
            status: { alive: true },
            meta: { joinedDay: 1, lastActionDay: 1 }
        },
        '2': {
            playerId: 2,
            github: { username: 'bob', issueNumber: 2, userId: 202 },
            character: { name: 'Bob', class: 'Archer', title: '', backstory: '' },
            location: 'A',
            status: { alive: true },
            meta: { joinedDay: 1, lastActionDay: 1 }
        },
        '3': {
            playerId: 3,
            github: { username: 'charlie', issueNumber: 3, userId: 203 },
            character: { name: 'Charlie', class: 'Lancer', title: '', backstory: '' },
            location: 'B',
            status: { alive: true },
            meta: { joinedDay: 1, lastActionDay: 1 }
        }
    },
    worldLog: {
        day: 5,
        summary: 'The world stirs as adventurers continue their journeys.',
        population: 3,
        notes: []
    }
};

console.log('Running LOOK Query Tests...');

// TEST 1: Basic LOOK (Alice sees Bob at Start)
{
    const result = generateLookResponse(mockState, '1');
    assert.match(result, /\*\*\[Day 5 — Start\]\*\*/); // Header
    assert.match(result, /Starting Point/); // Description
    assert.match(result, /- End/); // Exits
    assert.match(result, /- @bob/); // Other player
    assert.doesNotMatch(result, /- @alice/); // Shouldn't see self
    assert.doesNotMatch(result, /- @charlie/); // Shouldn't see Charlie (in B)
    console.log('✅ Basic LOOK Passed');
}

// TEST 2: LOOK Alone (Charlie at End)
{
    const result = generateLookResponse(mockState, '3');
    assert.match(result, /\*\*\[Day 5 — End\]\*\*/);
    assert.match(result, /- \(no one else\)/);
    console.log('✅ LOOK Alone Passed');
}

// TEST 3: Not Registered
{
    const result = generateLookResponse(mockState, '999');
    assert.match(result, /Create a character first/);
    console.log('✅ Not Registered Passed');
}
