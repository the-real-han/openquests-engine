import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadState, saveState } from './state';
import { processTick } from './engine';
import { Action, Clan, Player } from '@openquests/schema';
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

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

        const clansById: Record<string, number> = {};
        const players = Object.values(gameState.players);
        for (const clan of Object.keys(gameState.clans)) {
            if (gameState.clans[clan].defeatedBy) continue;
            clansById[clan] = players.filter(p => p.character.clanId === clan).length;
        }
        const clans = Object.entries(clansById);

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

                const minGroup = clans.reduce((min, group) =>
                    group[1] < min[1] ? group : min
                );

                // Create Player Record
                const name = parsed.name || issue.user.login;
                const charClass = parsed.charClass || 'Adventurer';
                const newPlayer: Player = {
                    playerId: issue.number,
                    github: {
                        username: issue.user.login,
                        issueNumber: issue.number,
                        userId: issue.user.id
                    },
                    character: {
                        name: name,
                        class: charClass,
                        titles: [],
                        backstory: parsed.backstory || '',
                        level: 1,
                        xp: 0,
                        clanId: minGroup[0]
                    },
                    status: {
                        alive: true
                    },
                    meta: {
                        joinedDay: gameState.day,
                        lastActionDay: gameState.day,
                        gatherFoodCount: 0,
                        gatherWoodCount: 0,
                        gatherGoldCount: 0,
                        food: 0,
                        wood: 0,
                        gold: 0,
                        exploreCount: 0,
                        attackCount: 0,
                        playerWins: 0,
                        playerLosses: 0,
                        monsterKilled: 0,
                        bossKilled: 0,
                        monsterEncountered: 0,
                        attackWinStreak: 0,
                        attackLoseStreak: 0,
                        attackedCount: 0
                    },
                    message: `Welcome, ${name} the ${charClass}, to ${gameState.clans[minGroup[0]].name}.\nLet's conquer the world together!`
                };

                // Persist to State
                gameState.players[playerId] = newPlayer;
                minGroup[1]++;

                console.log(`Onboarding ${newPlayer.character.name}...`);
                await adapter.postComment(issue.number, newPlayer.message);
            } else {
                existingPlayer.message = ''
                if (gameState.clans[existingPlayer.character.clanId].defeatedBy) {
                    console.log(`Player ${existingPlayer.character.name} is from a defeated clan.`);
                    const minGroup = clans.reduce((min, group) =>
                        group[1] < min[1] ? group : min
                    );
                    existingPlayer.character.clanId = minGroup[0];
                    existingPlayer.message = `You have been offered refuge by ${gameState.clans[minGroup[0]].name}.\nDon't forget the past and avenge your clan!`;
                }
                console.log(`Processing action for ${issue.user.login} on issue #${issue.number}`);

                // --- ACTION FLOW ---
                const lastComment = await adapter.fetchLastComment(issue.number, issue.user.id, twentyFourHoursAgo);

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
        }

        // 3. Process Turn
        console.log('Processing tick...');
        const result = processTick(gameState, actions);

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
