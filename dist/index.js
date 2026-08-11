// src/index.ts
import * as core3 from "@actions/core";
import * as exec5 from "@actions/exec";

// src/github.ts
import * as github from "@actions/github";
async function getPullRequestFiles(token) {
  const context2 = getPullRequestContext();
  const octokit = github.getOctokit(token);
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: context2.owner,
    repo: context2.repo,
    pull_number: context2.pullNumber,
    per_page: 100
  });
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
    throw new Error("This action must be run on a pull_request event.");
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

// src/oac.ts
import * as core from "@actions/core";
import * as exec from "@actions/exec";
async function installOac() {
  core.info("Installing OpenAgentsControl...");
  await exec.exec("bash", [
    "-c",
    "curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer"
  ]);
  core.info("OpenAgentsControl installation completed.");
}

// src/opencode.ts
import * as core2 from "@actions/core";
import * as exec3 from "@actions/exec";
async function installOpenCode(version) {
  const packageSpec = version === "latest" ? "opencode-ai@latest" : `opencode-ai@${version}`;
  core2.info(`Installing OpenCode: ${packageSpec}`);
  await exec3.exec("npm", ["install", "--global", packageSpec]);
  await exec3.exec("opencode", ["--version"]);
}
async function runOpenCode(workspace, agent, model, prompt, apiKey, githubToken) {
  const args = ["run", "--auto", "--format", "json"];
  if (model && model !== "free") {
    args.push("--model", model);
  }
  args.push(`"${prompt}"`);
  const output = "";
  const env = {
    ...process.env
  };
  if (apiKey) {
    env.OPENAI_API_KEY = apiKey;
  }
  core2.info(`Running OpenCode with agent "${agent}"...`);
  const exitCode = await exec3.exec("opencode", ["github", "run"], {
    cwd: workspace,
    env: {
      ...process.env,
      GITHUB_TOKEN: githubToken,
      MODEL: "opencode/deepseek-v4-flash-free",
      AGENT: "code-reviewer",
      USE_GITHUB_TOKEN: "true",
      PROMPT: prompt
    }
  });
  return {
    exitCode,
    output
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

// src/index.ts
async function run() {
  try {
    const workspace = process.env.GITHUB_WORKSPACE;
    if (!workspace) {
      throw new Error("GITHUB_WORKSPACE is not available.");
    }
    const githubToken = core3.getInput("github_token", { required: true });
    const model = core3.getInput("model") || void 0;
    const apiKey = core3.getInput("api_key") || void 0;
    const agent = core3.getInput("agent") || "code-reviewer";
    const opencodeVersion = core3.getInput("opencode_version") || "latest";
    core3.info("================================");
    core3.info("OpenCode PR Review");
    core3.info("================================");
    core3.info(`Agent: ${agent}`);
    core3.info(`Model: ${model ?? "OpenCode default"}`);
    core3.info(`API key provided: ${apiKey ? "yes" : "no"}`);
    const files = await getPullRequestFiles(githubToken);
    core3.info(`Changed files: ${files.length}`);
    const reviewInput = buildReviewInput(files);
    core3.info(`Reviewable files: ${reviewInput.files.length}`);
    await installOpenCode(opencodeVersion);
    await installOac();
    await exec5.exec("git", ["reset", "--hard", "HEAD"], { cwd: workspace });
    await exec5.exec("git", ["clean", "-fd"], { cwd: workspace });
    const prompt = buildReviewPrompt();
    const result = await runOpenCode(
      workspace,
      agent,
      model,
      prompt,
      apiKey,
      githubToken
    );
    core3.info(`OpenCode exit code: ${result.exitCode}`);
    if (result.exitCode !== 0) {
      throw new Error(`OpenCode exited with code ${result.exitCode}.`);
    }
    core3.info("OpenCode completed successfully.");
    core3.setOutput("changed_files", files.length);
    core3.setOutput("reviewable_files", reviewInput.files.length);
    core3.info("================================");
    core3.info("OpenCode PR Review completed successfully.");
    core3.info("The review comment was handled by OpenCode.");
    core3.info("================================");
  } catch (error) {
    if (error instanceof Error) {
      core3.setFailed(error.message);
    } else {
      core3.setFailed("Unknown error.");
    }
  }
}
run();
