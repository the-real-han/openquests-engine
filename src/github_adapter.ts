import { Player, GameState } from '@openquests/schema';
import * as github from '@actions/github';


export interface GitHubUser {
    login: string;
    id: number;
    type: string;
}

export interface IssueComment {
    body: string;
    user: GitHubUser;
    created_at: string;
}

export interface IssueSummary {
    number: number;
    user: GitHubUser;
    title: string;
    body: string;
    created_at: string;
}

export interface GameInputs {
    fetchOpenIssues(): Promise<IssueSummary[]>;
    fetchLastComment(issueNumber: number): Promise<IssueComment | null>;
    postComment(issueNumber: number, body: string): Promise<void>;
    addLabel(issueNumber: number, label: string): Promise<void>;
    findOrCreateWorldLogIssue(): Promise<number>;
}

export class GitHubAdapter implements GameInputs {
    private octokit;
    private owner: string;
    private repo: string;

    constructor(token: string, owner: string, repo: string) {
        this.octokit = github.getOctokit(token);
        this.owner = owner;
        this.repo = repo;
    }

    async fetchOpenIssues(): Promise<IssueSummary[]> {
        const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
            owner: this.owner,
            repo: this.repo,
            state: 'open',
        });

        return issues.map(i => ({
            number: i.number,
            user: {
                login: i.user?.login || 'unknown',
                id: i.user?.id || 0,
                type: i.user?.type || 'User'
            },
            title: i.title,
            body: i.body || '',
            created_at: i.created_at
        }));
    }

    async fetchLastComment(issueNumber: number): Promise<IssueComment | null> {
        const comments = await this.octokit.rest.issues.listComments({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
            per_page: 100,
        });

        if (comments.data.length === 0) return null;

        const last = comments.data[comments.data.length - 1];
        return {
            body: last.body || '',
            user: {
                login: last.user?.login || 'unknown',
                id: last.user?.id || 0,
                type: last.user?.type || 'User'
            },
            created_at: last.created_at
        };
    }

    async postComment(issueNumber: number, body: string): Promise<void> {
        await this.octokit.rest.issues.createComment({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
            body,
        });
    }

    async addLabel(issueNumber: number, label: string): Promise<void> {
        await this.octokit.rest.issues.addLabels({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
            labels: [label]
        });
    }

    async findOrCreateWorldLogIssue(): Promise<number> {
        const issues = await this.octokit.rest.issues.listForRepo({
            owner: this.owner,
            repo: this.repo,
            state: 'open',
            labels: 'world-log',
            per_page: 1
        });

        if (issues.data.length > 0) {
            return issues.data[0].number;
        }

        const newIssue = await this.octokit.rest.issues.create({
            owner: this.owner,
            repo: this.repo,
            title: '📜 World Log',
            body: 'Chronicles of the realm...',
            labels: ['world-log']
        });

        return newIssue.data.number;
    }
}

export class MockAdapter implements GameInputs {
    async fetchOpenIssues(): Promise<IssueSummary[]> {
        console.log('[MOCK] Fetching open issues...');
        return [
            { number: 1, user: { login: 'player1', id: 101, type: 'User' }, title: '[Character] Player One', body: 'My backstory', created_at: '2023-01-01T00:00:00Z' },
            { number: 2, user: { login: 'player2', id: 102, type: 'User' }, title: 'Question', body: 'How do I play?', created_at: '2023-01-01T00:00:00Z' },
            { number: 3, user: { login: 'player1', id: 101, type: 'User' }, title: 'Duplicate Issue', body: 'My other char', created_at: '2023-01-02T00:00:00Z' } // Duplicate Test
        ];
    }

    async fetchLastComment(issueNumber: number): Promise<IssueComment | null> {
        console.log(`[MOCK] Fetching last comment for issue ${issueNumber}...`);
        if (issueNumber === 1) {
            return { body: 'MOVE forest', user: { login: 'player1', id: 101, type: 'User' }, created_at: new Date().toISOString() };
        }
        if (issueNumber === 2) {
            return { body: 'INVALID ACTION', user: { login: 'player2', id: 102, type: 'User' }, created_at: new Date().toISOString() };
        }
        if (issueNumber === 3) {
            return null;
        }
        return null;
    }

    async postComment(issueNumber: number, body: string): Promise<void> {
        console.log(`[MOCK] Posting comment to issue ${issueNumber}: "${body.slice(0, 50)}..."`);
    }

    async addLabel(issueNumber: number, label: string): Promise<void> {
        console.log(`[MOCK] Adding label "${label}" to issue ${issueNumber}`);
    }

    async findOrCreateWorldLogIssue(): Promise<number> {
        console.log('[MOCK] finding/creating World Log issue...');
        return 99; // Mock Log Issue ID
    }
}
