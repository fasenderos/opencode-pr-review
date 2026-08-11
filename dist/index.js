// src/index.ts
import * as core3 from "@actions/core";

// src/github.ts
import * as github from "@actions/github";
async function getPullRequestFiles(token) {
  const context2 = getPullRequestContext();
  const octokit = github.getOctokit(token);
  const files = await octokit.paginate(
    octokit.rest.pulls.listFiles,
    {
      owner: context2.owner,
      repo: context2.repo,
      pull_number: context2.pullNumber,
      per_page: 100
    }
  );
  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  }));
}
function getPullRequestContext() {
  const context2 = github.context;
  if (!context2.payload.pull_request) {
    throw new Error(
      "This action must be run on a pull_request event."
    );
  }
  const pullRequest = context2.payload.pull_request;
  return {
    owner: context2.repo.owner,
    repo: context2.repo.repo,
    pullNumber: pullRequest.number,
    baseSha: pullRequest.base.sha,
    headSha: pullRequest.head.sha
  };
}

// src/review.ts
function buildReviewInput(files) {
  const reviewableFiles = files.filter((file) => Boolean(file.patch)).map((file) => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch,
    additions: file.additions,
    deletions: file.deletions
  }));
  return {
    files: reviewableFiles
  };
}
function buildReviewPrompt() {
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
function parseReviewOutput(output) {
  const json = extractJson(output);
  if (!json) {
    throw new Error(
      "OpenCode did not return a valid JSON review."
    );
  }
  const parsed = JSON.parse(json);
  if (!isReviewResult(parsed)) {
    throw new Error(
      "OpenCode returned JSON, but it does not match the expected review format."
    );
  }
  return parsed;
}
function extractJson(output) {
  const trimmed = output.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const fenced = trimmed.match(
    /```(?:json)?\s*([\s\S]*?)\s*```/
  );
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
function isReviewResult(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value;
  if (typeof candidate.summary !== "string") {
    return false;
  }
  if (!Array.isArray(candidate.issues)) {
    return false;
  }
  return candidate.issues.every(isReviewIssue);
}
function isReviewIssue(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const issue = value;
  return typeof issue.severity === "string" && ["critical", "high", "medium", "low"].includes(
    issue.severity
  ) && typeof issue.file === "string" && typeof issue.line === "number" && typeof issue.title === "string" && typeof issue.body === "string";
}

// src/opencode.ts
import * as core from "@actions/core";
import * as exec from "@actions/exec";
async function installOpenCode(version) {
  const packageSpec = version === "latest" ? "opencode-ai@latest" : `opencode-ai@${version}`;
  core.info(
    `Installing OpenCode: ${packageSpec}`
  );
  await exec.exec(
    "npm",
    [
      "install",
      "--global",
      packageSpec
    ]
  );
  await exec.exec("opencode", [
    "--version"
  ]);
}
async function runOpenCode(workspace, agent, model, prompt, apiKey) {
  const args = [
    "run",
    "--auto",
    "--agent",
    agent,
    "--format",
    "json",
    "--dir",
    workspace
  ];
  if (model) {
    args.push("--model", model);
  }
  args.push("--prompt", prompt);
  let output = "";
  const env = {
    ...process.env
  };
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
        stdout: (data) => {
          const text = data.toString();
          output += text;
          core.info(text.trimEnd());
        },
        stderr: (data) => {
          core.warning(data.toString().trimEnd());
        }
      }
    }
  );
  return {
    exitCode,
    output
  };
}

// src/oac.ts
import * as core2 from "@actions/core";
import * as exec3 from "@actions/exec";
async function installOac(ref, workspace) {
  const oacDirectory = `${workspace}/.oac`;
  const agentsDirectory = `${workspace}/.opencode/agents`;
  core2.info(
    `Installing OpenAgentsControl (${ref})...`
  );
  await exec3.exec(
    "git",
    [
      "clone",
      "--depth",
      "1",
      "--branch",
      ref,
      "https://github.com/darrenhinde/OpenAgentsControl.git",
      oacDirectory
    ],
    {
      cwd: workspace
    }
  );
  core2.info(
    "OpenAgentsControl repository downloaded."
  );
  await exec3.exec(
    "mkdir",
    ["-p", agentsDirectory]
  );
  const reviewerPath = `${oacDirectory}/.opencode/agent/subagents/code/reviewer.md`;
  core2.info(
    `Using OAC OpenCode reviewer: ${reviewerPath}`
  );
  await exec3.exec(
    "test",
    ["-f", reviewerPath]
  );
  await exec3.exec(
    "cp",
    [
      reviewerPath,
      `${agentsDirectory}/code-reviewer.md`
    ]
  );
  core2.info(
    "OpenAgentsControl code-reviewer installed."
  );
  await configureReviewPermissions(workspace);
}
async function configureReviewPermissions(workspace) {
  const configPath = `${workspace}/.opencode/opencode.json`;
  const config = {
    "$schema": "https://opencode.ai/config.json",
    "permission": {
      "edit": "deny",
      "webfetch": "deny",
      "question": "deny",
      "task": "deny",
      "bash": {
        "*": "deny",
        "git status*": "allow",
        "git diff*": "allow",
        "git log*": "allow",
        "git show*": "allow"
      }
    }
  };
  const fs = await import("fs/promises");
  await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 2),
    "utf8"
  );
  core2.info(
    "OpenCode review permissions configured."
  );
}

// src/index.ts
async function run() {
  try {
    const workspace = process.env.GITHUB_WORKSPACE;
    if (!workspace) {
      throw new Error(
        "GITHUB_WORKSPACE is not available."
      );
    }
    const githubToken = core3.getInput(
      "github_token",
      { required: true }
    );
    const model = core3.getInput("model") || void 0;
    const apiKey = core3.getInput("api_key") || void 0;
    const agent = core3.getInput("agent") || "code-reviewer";
    const opencodeVersion = core3.getInput("opencode_version") || "latest";
    const oacRef = core3.getInput("oac_ref") || "main";
    core3.info("================================");
    core3.info("OpenCode PR Review");
    core3.info("================================");
    core3.info(
      `Agent: ${agent}`
    );
    core3.info(
      `Model: ${model ?? "OpenCode default"}`
    );
    core3.info(
      `API key provided: ${apiKey ? "yes" : "no"}`
    );
    const files = await getPullRequestFiles(
      githubToken
    );
    core3.info(
      `Changed files: ${files.length}`
    );
    const reviewInput = buildReviewInput(files);
    core3.info(
      `Reviewable files: ${reviewInput.files.length}`
    );
    await installOpenCode(
      opencodeVersion
    );
    await installOac(
      oacRef,
      workspace
    );
    const prompt = buildReviewPrompt();
    const result = await runOpenCode(
      workspace,
      agent,
      model,
      "Reply with exactly: REVIEW_TEST_OK",
      apiKey
    );
    core3.info(
      `OpenCode exit code: ${result.exitCode}`
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `OpenCode exited with code ${result.exitCode}.`
      );
    }
    const review = parseOpenCodeEvents(
      result.output
    );
    const reviewResult = parseReviewOutput(review);
    core3.info(
      `Issues found: ${reviewResult.issues.length}`
    );
    core3.info(
      "--- Review Summary ---"
    );
    core3.info(
      reviewResult.summary
    );
    for (const issue of reviewResult.issues) {
      core3.info(
        `[${issue.severity}] ${issue.file}:${issue.line} - ${issue.title}`
      );
    }
    core3.setOutput(
      "changed_files",
      files.length
    );
    core3.setOutput(
      "reviewable_files",
      reviewInput.files.length
    );
    core3.setOutput(
      "review",
      JSON.stringify(reviewResult)
    );
  } catch (error) {
    if (error instanceof Error) {
      core3.setFailed(error.message);
    } else {
      core3.setFailed(
        "Unknown error."
      );
    }
  }
}
function parseOpenCodeEvents(output) {
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const assistantTexts = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const part = event.part;
      if (event.type === "text" && typeof event.text === "string") {
        assistantTexts.push(
          event.text
        );
      }
      if (part && part.type === "text" && typeof part.text === "string") {
        assistantTexts.push(
          part.text
        );
      }
    } catch {
    }
  }
  if (assistantTexts.length > 0) {
    return assistantTexts.join("\n");
  }
  return output;
}
run();
