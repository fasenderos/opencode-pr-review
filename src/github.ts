import * as github from "@actions/github";
import type { PullRequestContext, PullRequestFile } from "./types";

export async function getPullRequestFiles(
	token: string,
): Promise<PullRequestFile[]> {
	const context = getPullRequestContext();

	const octokit = github.getOctokit(token);

	const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
		owner: context.owner,
		repo: context.repo,
		pull_number: context.pullNumber,
		per_page: 100,
	});

	return files.map((file) => ({
		filename: file.filename,
		status: file.status,
		patch: file.patch,
		additions: file.additions,
		deletions: file.deletions,
		changes: file.changes,
	}));
}

function getPullRequestContext(): PullRequestContext {
	const context = github.context;

	if (!context.payload.pull_request) {
		throw new Error("This action must be run on a pull_request event.");
	}

	const pullRequest = context.payload.pull_request;

	return {
		owner: context.repo.owner,
		repo: context.repo.repo,
		pullNumber: pullRequest.number,
		baseSha: pullRequest.base.sha,
		headSha: pullRequest.head.sha,
	};
}
