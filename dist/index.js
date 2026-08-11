// src/index.ts
import * as core3 from "@actions/core";
import * as exec5 from "@actions/exec";

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
  core2.info(`Running OpenCode GitHub review (agent: ${agent})...`);
  const exitCode = await exec3.exec("opencode", ["github", "run"], {
    cwd: workspace,
    env,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        const text = data.toString();
        output += text;
        core2.info(text.trimEnd());
      },
      stderr: (data) => {
        const text = data.toString();
        output += text;
        core2.warning(text.trimEnd());
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
