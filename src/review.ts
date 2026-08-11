import type {
	PullRequestFile,
	ReviewFile,
	ReviewInput,
	ReviewResult,
} from "./types";

export function buildReviewInput(files: PullRequestFile[]): ReviewInput {
	const reviewableFiles: ReviewFile[] = files
		.filter((file) => Boolean(file.patch))
		.map((file) => ({
			filename: file.filename,
			status: file.status,
			patch: file.patch,
			additions: file.additions,
			deletions: file.deletions,
		}));

	return {
		files: reviewableFiles,
	};
}

export function buildReviewPrompt(): string {
	return `
Review the current GitHub pull request.

The repository is already checked out in the current working directory.

Use git diff, git status, git log and the repository files to understand
the changes and their context.

Review ONLY issues introduced by the pull request.

Do NOT modify any files.
Do NOT create commits.
Do NOT change the working tree.

Look for:
- correctness bugs
- security vulnerabilities
- regressions
- broken edge cases
- incorrect error handling
- performance problems
- API compatibility problems
- missing tests when clearly required

Do NOT report:
- formatting
- subjective style preferences
- naming preferences
- unrelated pre-existing issues
- speculative problems without evidence

Return ONLY valid JSON with exactly this structure:

{
  "summary": "short summary of the review",
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "file": "path/to/file",
      "line": 123,
      "title": "Short issue title",
      "body": "Detailed explanation",
      "suggestion": "Optional suggested fix"
    }
  ]
}

If there are no actionable issues:

{
  "summary": "No actionable issues found.",
  "issues": []
}
`;
}

export function parseReviewOutput(output: string): ReviewResult {
	const json = extractJson(output);

	if (!json) {
		throw new Error("OpenCode did not return a valid JSON review.");
	}

	const parsed: unknown = JSON.parse(json);

	if (!isReviewResult(parsed)) {
		throw new Error(
			"OpenCode returned JSON, but it does not match the expected review format.",
		);
	}

	return parsed;
}

function extractJson(output: string): string | null {
	const trimmed = output.trim();

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		return trimmed;
	}

	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

	if (fenced?.[1]) {
		return fenced[1].trim();
	}

	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");

	if (firstBrace >= 0 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}

	return null;
}

function isReviewResult(value: unknown): value is ReviewResult {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	if (typeof candidate.summary !== "string") {
		return false;
	}

	if (!Array.isArray(candidate.issues)) {
		return false;
	}

	return candidate.issues.every(isReviewIssue);
}

function isReviewIssue(value: unknown): boolean {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const issue = value as Record<string, unknown>;

	return (
		typeof issue.severity === "string" &&
		["critical", "high", "medium", "low"].includes(issue.severity) &&
		typeof issue.file === "string" &&
		typeof issue.line === "number" &&
		typeof issue.title === "string" &&
		typeof issue.body === "string"
	);
}
