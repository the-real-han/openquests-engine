import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadState, saveState } from './state';
import { processTick } from './engine';
import { Action, Player } from '@openquests/schema';
import { GameInputs, MockAdapter, GitHubAdapter } from './github_adapter';
import { parseAction } from './actions';
import { parseIssueBody } from './parser';
import { generateWorldLog } from './world_log';

export async function runTick() {
    try {
        const workspace = process.env.GITHUB_WORKSPACE || './';
        const token = process.env.GITHUB_TOKEN;
        const repoOwner = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'mock-owner';
        const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'mock-repo';

        // Select Adapter
        let adapter: GameInputs;
        if (!token) {
            console.log('No GITHUB_TOKEN found. Using MockAdapter.');
            adapter = new MockAdapter();
        } else {
            console.log(`Using GitHubAdapter for ${repoOwner}/${repoName}`);
            adapter = new GitHubAdapter(token, repoOwner, repoName);
        }

        // 1. Load State
        console.log('Loading game state...');
        const gameState = loadState(workspace);

        // 2. Fetch Inputs
        console.log('Fetching open issues...');
        const issues = await adapter.fetchOpenIssues();
        const actions: Action[] = [];
        // We construct a list of active players for the engine, but the engine should primarily rely on GameState.
        // However, the engine needs to know who is 'active' this turn if we used that logic.
        // For now, let's just pass the full player list from state to the engine later.

        // Deduplicate Issues by User ID
        // Group: userId -> IssueSummary[]
        const issuesByUserId: Record<number, typeof issues> = {};
        for (const issue of issues) {
            const uid = issue.user.id;
            if (!issuesByUserId[uid]) issuesByUserId[uid] = [];
            issuesByUserId[uid].push(issue);
        }

        for (const uidStr of Object.keys(issuesByUserId)) {
            const uid = parseInt(uidStr);
            const userIssues = issuesByUserId[uid];

            // Sort by creation time (ascending) to find canonical
            userIssues.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const canonical = userIssues[0];
            const invalid = userIssues.slice(1);

            // Handle Invalid Issues
            for (const inv of invalid) {
                console.log(`Ignoring duplicate issue #${inv.number} for user ${uid}. Canonical is #${canonical.number}.`);
                // Check if already labeled (optimization: adapter could check labels, but for now we blindly try adding)
                // We'll post a comment if it's the first time? No state to track "first time" for invalid issues yet.
                // To avoid spam, we might just assume the label is enough or check if we commented.
                // For V1, we will just add the label.
                await adapter.addLabel(inv.number, 'invalid-player');
                // Optional: Close? User said "Do not auto-close".
            }

            // Process Canonical Issue
            const issue = canonical;
            const playerId = issue.number.toString();
            const existingPlayer = gameState.players[playerId];

            if (!existingPlayer) {
                // --- ONBOARDING FLOW ---
                console.log(`New player detected: ${issue.user.login} (Issue ${issue.number})`);

                // Parse Character Data
                const parsed = parseIssueBody(issue.body);

                // Create Player Record
                const newPlayer: Player = {
                    playerId: issue.number,
                    github: {
                        username: issue.user.login,
                        issueNumber: issue.number,
                        userId: issue.user.id
                    },
                    character: {
                        name: parsed.name || issue.user.login,
                        class: parsed.charClass || 'Adventurer',
                        title: 'Wanderer',
                        backstory: parsed.backstory || ''
                    },
                    location: 'town_square',
                    status: {
                        alive: true
                    },
                    meta: {
                        joinedDay: gameState.day,
                        lastActionDay: gameState.day
                    }
                };

                // Persist to State
                gameState.players[playerId] = newPlayer;

                // Welcome Comment
                const welcomeMsg = `Welcome, **${newPlayer.character.name}** the **${newPlayer.character.class}**.\n` +
                    `You arrive at the **Town Square**.\n` +
                    `The world will move at the next tick.`;

                console.log(`Onboarding ${newPlayer.character.name}...`);
                await adapter.postComment(issue.number, welcomeMsg);
            }

            // --- ACTION FLOW ---
            const lastComment = await adapter.fetchLastComment(issue.number);

            if (lastComment) {
                // strict identity check: Comment Author ID must match Issue Author ID
                if (lastComment.user.id !== issue.user.id) {
                    console.log(`Ignoring comment from non-owner ${lastComment.user.login} on issue #${issue.number}`);
                    continue;
                }

                // Bot Check
                if (lastComment.user.type === 'Bot') {
                    console.log(`Ignoring bot comment on issue #${issue.number}`);
                    continue;
                }

                // Parse Action
                const action = parseAction(issue.number.toString(), lastComment.body);
                actions.push(action);
                console.log(`Action received from ${issue.user.login}: ${action.type}`);
            }
        }

        // 3. Process Turn
        console.log('Processing tick...');
        // We pass the full player map to the engine
        const activePlayers = Object.values(gameState.players);
        const result = processTick(gameState, actions, activePlayers);

        // 4. Save State
        console.log('Saving new state...');
        saveState(workspace, result.newState);

        // 5. Report Results
        console.log('Narrative Summary:', result.narrativeSummary);
        core.setOutput('narrative', result.narrativeSummary);

    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('Unknown error occurred');
        }
    }
}

runTick()
