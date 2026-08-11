import * as core from "@actions/core";
import * as exec from "@actions/exec";

export interface OpenCodeRunResult {
  exitCode: number;
  output: string;
}

export async function installOpenCode(
  version: string
): Promise<void> {
  const packageSpec =
    version === "latest"
      ? "opencode-ai@latest"
      : `opencode-ai@${version}`;

  core.info(
    `Installing OpenCode: ${packageSpec}`
  );

  await exec.exec(
    "npm",
    [
      "install",
      "--global",
      packageSpec,
    ]
  );

  await exec.exec("opencode", [
    "--version",
  ]);
}

export async function runOpenCode(
  workspace: string,
  agent: string,
  model: string | undefined,
  apiKey: string | undefined
): Promise<OpenCodeRunResult> {
  const prompt = buildReviewPrompt();

  const args = [
    "run",
    "--agent",
    agent,
    "--format",
    "json",
    "--dir",
    workspace,
  ];

  if (model) {
    args.push("--model", model);
  }

  args.push(prompt);

  let output = "";

  const env = {
    ...process.env as Record<string, string>,
  };

  /*
   * We intentionally expose the key through the process
   * environment rather than passing it as a CLI argument.
   *
   * For now we support the common OpenAI environment variable.
   * Provider-specific credential handling can be added later.
   */
  if (apiKey) {
    env.OPENAI_API_KEY = apiKey;
  }

  core.info(
    `Running OpenCode with agent "${agent}"...`
  );

  const exitCode = await exec.exec(
    "opencode",
    args,
    {
      env,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          core.debug(data.toString());
        },
      },
    }
  );

  return {
    exitCode,
    output,
  };
}

function buildReviewPrompt(): string {
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