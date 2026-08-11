import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { ReviewInput } from "./types";

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
  input: ReviewInput,
  apiKey: string | undefined
): Promise<OpenCodeRunResult> {
  const prompt = buildReviewPrompt(input);

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

function buildReviewPrompt(
  input: ReviewInput
): string {
  const files = input.files
    .map(
      (file) => `
FILE: ${file.filename}
STATUS: ${file.status}
ADDITIONS: ${file.additions}
DELETIONS: ${file.deletions}

PATCH:
${file.patch}
`
    )
    .join("\n==============================\n");

  return `
You are reviewing a GitHub pull request.

The repository is checked out in your current working directory.

Review the pull request changes carefully.

Use the repository files for context when necessary.

Do not modify any files.
Do not create commits.
Do not change the working tree.

Focus only on real, actionable issues introduced by the pull request.

Look for:
- correctness bugs
- security vulnerabilities
- broken edge cases
- incorrect error handling
- regressions
- performance problems
- API compatibility problems
- missing tests when the change clearly requires them

Avoid:
- subjective style preferences
- formatting issues
- naming preferences
- unrelated pre-existing problems
- speculative concerns without evidence

Return ONLY valid JSON.

The JSON must have exactly this structure:

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

If there are no actionable issues, return:

{
  "summary": "No actionable issues found.",
  "issues": []
}

The following files are part of the pull request:

${files}
`;
}