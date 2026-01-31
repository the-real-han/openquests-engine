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
    fetchLastComment(issueNumber: number, userId: number, since: string): Promise<IssueComment | null>;
    postComment(issueNumber: number, body: string): Promise<void>;
    addLabel(issueNumber: number, label: string): Promise<void>;
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
            labels: 'player'
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

    async fetchLastComment(issueNumber: number, userId: number, since: string): Promise<IssueComment | null> {
        const comments = await this.octokit.rest.issues.listComments({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
            per_page: 100,
            since
        });

        if (comments.data.length === 0) return null;

        const filterComments = comments.data.filter(c => c.user?.id === userId);
        if (filterComments.length === 0) return null;

        const last = filterComments.sort(
            (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ).at(-1)!;
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

    async fetchLastComment(issueNumber: number, userId: number, since: string): Promise<IssueComment | null> {
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
}
