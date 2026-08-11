// src/index.ts
import * as core3 from "@actions/core";

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
  const packageSpec = getOpenCodePackage(version);
  core2.startGroup(`Installing OpenCode: ${packageSpec}`);
  try {
    core2.info(`Package: ${packageSpec}`);
    core2.info(`Node: ${process.version}`);
    await exec3.exec("node", ["--version"]);
    await exec3.exec("npm", ["--version"]);
    core2.info("Installing OpenCode globally...");
    await exec3.exec(
      "npm",
      ["install", "--global", "--no-fund", "--no-audit", packageSpec],
      {
        ignoreReturnCode: false
      }
    );
    core2.info("Verifying OpenCode installation...");
    let versionOutput = "";
    const exitCode = await exec3.exec("opencode", ["--version"], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data) => {
          versionOutput += data.toString();
        },
        stderr: (data) => {
          core2.warning(data.toString().trimEnd());
        }
      }
    });
    if (exitCode !== 0) {
      throw new Error(
        `OpenCode was installed but "opencode --version" failed with exit code ${exitCode}.`
      );
    }
    const installedVersion = versionOutput.trim();
    if (!installedVersion) {
      throw new Error(
        'OpenCode was installed but "opencode --version" returned no output.'
      );
    }
    core2.info(`OpenCode installed successfully: ${installedVersion}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to install OpenCode (${packageSpec}): ${error.message}`,
        { cause: error }
      );
    }
    throw new Error(`Failed to install OpenCode (${packageSpec}).`);
  } finally {
    core2.endGroup();
  }
}
async function runOpenCode(workspace, agent, model, prompt, _apiKey, githubToken) {
  let output = "";
  const env = {
    ...process.env,
    GITHUB_TOKEN: githubToken,
    USE_GITHUB_TOKEN: "true",
    PROMPT: prompt,
    MODEL: model
  };
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    model,
    default_agent: agent,
    permission: {
      bash: {
        "git status*": "allow",
        "git diff*": "allow",
        "git log*": "allow",
        "git show*": "allow",
        "git rev-parse*": "allow",
        "git ls-files*": "allow",
        "git grep*": "allow",
        "grep *": "allow",
        "find *": "allow",
        "cat *": "allow",
        "ls*": "allow",
        pwd: "allow",
        "*": "deny"
      },
      edit: {
        "*": "deny"
      },
      write: {
        "*": "deny"
      }
    }
  });
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
function getOpenCodePackage(version) {
  const normalized = version.trim();
  if (!normalized || normalized === "latest") {
    return "opencode-ai@latest";
  }
  if (!/^[0-9]+(?:\.[0-9]+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error(
      `Invalid OpenCode version: "${version}". Expected "latest" or a valid npm version.`
    );
  }
  return `opencode-ai@${normalized}`;
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
    const model = core3.getInput("model");
    const apiKey = core3.getInput("api_key") || void 0;
    const agent = core3.getInput("agent");
    const opencodeVersion = core3.getInput("opencode_version");
    core3.info("================================");
    core3.info("OpenCode PR Review");
    core3.info("================================");
    core3.info(`Agent: ${agent}`);
    core3.info(`Model: ${model ?? "OpenCode default"}`);
    core3.info(`API key provided: ${apiKey ? "yes" : "no"}`);
    await installOpenCode(opencodeVersion);
    await installOac();
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
