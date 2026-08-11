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
  prompt: string,
  apiKey: string | undefined
): Promise<OpenCodeRunResult> {

  const args = [
    "run",
    "--auto",
    "--format",
    "json",
    ];

    if (model && model !== "free") {
    args.push("--model", model);
    }

  args.push(`"${prompt}"`);

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
          const text = data.toString();
          output += text;
          core.info(text.trimEnd());
        },
        stderr: (data: Buffer) => {
          core.warning(data.toString().trimEnd());
        },
      },
    }
  );

  return {
    exitCode,
    output,
  };
}

export async function runOpenCodeTest(
  workspace: string,
  model: string
): Promise<void> {
  core.startGroup("OpenCode diagnostic test");

  core.info(`Workspace: ${workspace}`);
  core.info(`Model: ${model}`);

  // Test 1: OpenCode version
  await exec.exec(
    "opencode",
    ["--version"],
    {
      cwd: workspace,
    }
  );

  // Test 2: run OpenCode from a completely empty directory
  const tempWorkspace = "/tmp/opencode-test";

  await exec.exec(
    "rm",
    ["-rf", tempWorkspace]
  );

  await exec.exec(
    "mkdir",
    ["-p", tempWorkspace]
  );

  core.info("================================");
  core.info("TEST 1: OpenCode in empty workspace");
  core.info("================================");

  let output = "";

  const exitCode = await exec.exec(
    "timeout",
    [
      "60s",
      "opencode",
      "run",
      "--auto",
      "--print-logs",
      "--log-level",
      "DEBUG",
      "--format",
      "json",
      "--model",
      model,
      "Reply with exactly: REVIEW_TEST_OK",
    ],
    {
      cwd: tempWorkspace,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          const text = data.toString();
          output += text;
          core.info(text.trimEnd());
        },
        stderr: (data: Buffer) => {
          core.warning(data.toString().trimEnd());
        },
      },
    }
  );

  core.info(`OpenCode exit code: ${exitCode}`);

  if (exitCode !== 0) {
    throw new Error(
      `OpenCode diagnostic test failed with exit code ${exitCode}`
    );
  }

  core.info("OpenCode diagnostic test passed.");

  core.endGroup();
}