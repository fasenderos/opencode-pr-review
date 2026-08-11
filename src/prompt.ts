export function buildReviewPrompt(): string {
	return `
Review the current GitHub pull request.

Focus only on issues introduced by this PR.

Report only actionable issues:

- correctness bugs
- security vulnerabilities
- regressions
- broken edge cases
- incorrect error handling
- performance problems
- API compatibility problems
- missing tests when clearly required

Do not report formatting, naming preferences, or unrelated pre-existing issues.

Do not modify files or create commits.
`;
}
