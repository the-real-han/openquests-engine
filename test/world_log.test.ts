import { generateWorldLog } from '../src/world_log';
import { GameState } from '@openquests/schema';
import * as assert from 'assert';

const mockState: GameState = {
    day: 10,
    locations: {
        'A': { id: 'A', name: 'City', description: 'Desc A', exits: [] },
        'B': { id: 'B', name: 'Ruins', description: 'Desc B', exits: [] }
    },
    locationLogs: {},
    players: {
        // 5 Players in A
        '1': { playerId: 1, location: 'A', status: { alive: true }, github: { username: 'a', issueNumber: 1, userId: 301 }, character: { name: 'A', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '2': { playerId: 2, location: 'A', status: { alive: true }, github: { username: 'b', issueNumber: 2, userId: 302 }, character: { name: 'B', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '3': { playerId: 3, location: 'A', status: { alive: true }, github: { username: 'c', issueNumber: 3, userId: 303 }, character: { name: 'C', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '4': { playerId: 4, location: 'A', status: { alive: true }, github: { username: 'd', issueNumber: 4, userId: 304 }, character: { name: 'D', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        '5': { playerId: 5, location: 'A', status: { alive: true }, github: { username: 'e', issueNumber: 5, userId: 305 }, character: { name: 'E', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        // 1 Player in B
        '6': { playerId: 6, location: 'B', status: { alive: true }, github: { username: 'f', issueNumber: 6, userId: 306 }, character: { name: 'F', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } },
        // 1 Dead Player in B (should be ignored)
        '7': { playerId: 7, location: 'B', status: { alive: false }, github: { username: 'g', issueNumber: 7, userId: 307 }, character: { name: 'G', class: 'Warrior', title: '', backstory: '' }, meta: { joinedDay: 1, lastActionDay: 1 } }
    },
    worldLog: {
        day: 10,
        summary: 'The world stirs as adventurers continue their journeys.',
        population: 7,
        notes: []
    }
};

console.log('Running World Log Tests...');

const worldLog = generateWorldLog(mockState);
console.log(worldLog);

// Assertions
assert.match(worldLog.summary, /The world stirs/, 'Global flavor missing');

// Location A (5 people)
assert.match(worldLog.summary, /### City/, 'City header missing');
assert.match(worldLog.summary, /feels lively/, 'City should be lively (5 people)');
assert.equal(worldLog.population, 7, 'City population wrong');

// Location B (1 person, 1 dead)
assert.match(worldLog.summary, /### Ruins/, 'Ruins header missing');
assert.match(worldLog.summary, /small group/, 'Ruins should have small group');

console.log('✅ World Log Tests Passed');
