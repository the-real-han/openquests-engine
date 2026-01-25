import * as core from '@actions/core';
import * as github from '@actions/github';
import { Action, PlayerClass, PLAYER_CLASSES } from '@openquests/schema';
import { loadState } from './state';
import { generateLookResponse } from './queries/look';

export async function handleComment() {
    try {
        const context = github.context;
        // Event Trigger: issue_comment
        // Payload has 'comment' and 'issue'

        if (context.eventName !== 'issue_comment') {
            console.log('Not an issue_comment event. Skipping.');
            return;
        }

        const commentBody = context.payload.comment?.body;
        const issueNumber = context.payload.issue?.number;
        const commentUser = context.payload.comment?.user?.login;

        if (!commentBody || !issueNumber || !commentUser) {
            console.log('Missing comment data. Skipping.');
            return;
        }

        // 1. Strict Parsing: "LOOK" (case-insensitive, trimmed)
        const cleaned = commentBody.trim();
        if (cleaned.toUpperCase() !== 'LOOK') {
            console.log(`Comment "${cleaned}" is not LOOK. Skipping.`);
            return;
        }

        // Check if Bot (avoid loops)
        if (context.payload.comment?.user?.type === 'Bot') {
            console.log('Bot comment ignored.');
            return;
        }

        // Enforce Owner Only
        const commentUserId = context.payload.comment?.user?.id;
        const issueUserId = context.payload.issue?.user?.id;

        if (commentUserId && issueUserId && commentUserId !== issueUserId) {
            console.log(`Ignoring query from non-owner (Commenter: ${commentUserId}, Owner: ${issueUserId})`);
            return;
        }

        console.log(`Processing LOOK query for issue #${issueNumber} from @${commentUser}`);

        // 2. Load State (Read-Only)
        const workspace = process.env.GITHUB_WORKSPACE || './';
        const gameState = loadState(workspace);

        // 3. Generate Response
        // We use issueNumber as the playerId, consistent with our schema
        const response = generateLookResponse(gameState, issueNumber.toString());

        // 4. Post Reply
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN not found');
        }

        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issueNumber,
            body: response
        });

        console.log('Reply posted.');

    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('Unknown error occurred');
        }
    }
}
