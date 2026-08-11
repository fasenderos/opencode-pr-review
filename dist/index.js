// src/index.ts
import * as core2 from "@actions/core";
import * as exec3 from "@actions/exec";

// src/opencode.ts
import { writeFile } from "fs/promises";
import { join } from "path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
async function installOpenCode(version) {
  const packageSpec = version === "latest" ? "opencode-ai@latest" : `opencode-ai@${version}`;
  core.info(`Installing OpenCode: ${packageSpec}`);
  await exec.exec("npm", ["install", "--global", packageSpec]);
  await exec.exec("opencode", ["--version"]);
}
async function runOpenCode(workspace, agent, model, prompt, apiKey, githubToken) {
  let output = "";
  const env = {
    ...process.env,
    GITHUB_TOKEN: githubToken,
    USE_GITHUB_TOKEN: "true",
    PROMPT: prompt
  };
  if (model) {
    env.MODEL = model;
  }
  if (agent) {
    env.AGENT = agent;
  }
  if (apiKey) {
    env.OPENAI_API_KEY = apiKey;
  }
  core.info(`Running OpenCode GitHub review (agent: ${agent})...`);
  const exitCode = await exec.exec("opencode", ["github", "run"], {
    cwd: workspace,
    env,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        const text = data.toString();
        output += text;
        core.info(text.trimEnd());
      },
      stderr: (data) => {
        const text = data.toString();
        output += text;
        core.warning(text.trimEnd());
      }
    }
  });
  return {
    exitCode,
    output
  };
}

// src/prompt.ts
function buildReviewPrompt() {
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

// src/index.ts
async function run() {
  try {
    const workspace = process.env.GITHUB_WORKSPACE;
    if (!workspace) {
      throw new Error("GITHUB_WORKSPACE is not available.");
    }
    const githubToken = core2.getInput("github_token", { required: true });
    const model = core2.getInput("model");
    const apiKey = core2.getInput("api_key") || void 0;
    const agent = core2.getInput("agent");
    const opencodeVersion = core2.getInput("opencode_version");
    core2.info("================================");
    core2.info("OpenCode PR Review");
    core2.info("================================");
    core2.info(`Agent: ${agent}`);
    core2.info(`Model: ${model ?? "OpenCode default"}`);
    core2.info(`API key provided: ${apiKey ? "yes" : "no"}`);
    await installOpenCode(opencodeVersion);
    await exec3.exec("git", ["reset", "--hard", "HEAD"], { cwd: workspace });
    await exec3.exec("git", ["clean", "-fd"], { cwd: workspace });
    const prompt = buildReviewPrompt();
    const result = await runOpenCode(
      workspace,
      agent,
      model,
      prompt,
      apiKey,
      githubToken
    );
    core2.info(`OpenCode exit code: ${result.exitCode}`);
    if (result.exitCode !== 0) {
      throw new Error(`OpenCode exited with code ${result.exitCode}.`);
    }
    core2.info("================================");
    core2.info("OpenCode PR Review completed successfully.");
    core2.info("The review comment was handled by OpenCode.");
    core2.info("================================");
  } catch (error) {
    if (error instanceof Error) {
      core2.setFailed(error.message);
    } else {
      core2.setFailed("Unknown error.");
    }
  }
}
run();
