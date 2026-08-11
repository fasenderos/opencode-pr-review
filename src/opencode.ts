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
  ["github", "run"],
  {
    cwd: workspace,
    env: {
      ...process.env,

      MODEL: "opencode/deepseek-v4-flash-free",

      AGENT: "code-reviewer",

      USE_GITHUB_TOKEN: "true",

      PROMPT: "Reply with exactly: REVIEW_TEST_OK",
    },
  }
);

//   const exitCode = await exec.exec(
//     "opencode",
//     args,
//     {
//       env,
//       ignoreReturnCode: true,
//       listeners: {
//         stdout: (data: Buffer) => {
//           const text = data.toString();
//           output += text;
//           core.info(text.trimEnd());
//         },
//         stderr: (data: Buffer) => {
//           core.warning(data.toString().trimEnd());
//         },
//       },
//     }
//   );

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

  await exec.exec("opencode", ["--version"], {
    cwd: workspace,
  });

  const tempWorkspace = "/tmp/opencode-test";
  const cleanHome = "/tmp/opencode-home";

  await exec.exec("rm", ["-rf", tempWorkspace]);
  await exec.exec("mkdir", ["-p", tempWorkspace]);

  await exec.exec("rm", ["-rf", cleanHome]);
  await exec.exec("mkdir", ["-p", cleanHome]);

  // ============================================================
  // TEST 1
  // OpenCode with CI=false and clean HOME
  // ============================================================

  core.info("================================");
  core.info("TEST 1: CI=false + clean HOME");
  core.info("================================");

  await runSingleOpenCodeTest({
    name: "CI=false",
    workspace: tempWorkspace,
    home: cleanHome,
    model,
    ci: "false",
  });

  // ============================================================
  // TEST 2
  // OpenCode with CI=true and clean HOME
  // ============================================================

  core.info("================================");
  core.info("TEST 2: CI=true + clean HOME");
  core.info("================================");

  await runSingleOpenCodeTest({
    name: "CI=true",
    workspace: tempWorkspace,
    home: cleanHome,
    model,
    ci: "true",
  });

  core.info("================================");
  core.info("All diagnostic tests passed");
  core.info("================================");

  core.endGroup();
}

interface OpenCodeTestOptions {
  name: string;
  workspace: string;
  home: string;
  model: string;
  ci: string;
}

async function runSingleOpenCodeTest(
  options: OpenCodeTestOptions
): Promise<void> {
  core.info(`Running: ${options.name}`);
  core.info(`HOME=${options.home}`);
  core.info(`CI=${options.ci}`);
  core.info(`Workspace=${options.workspace}`);
  core.info(`Model=${options.model}`);

  let stdout = "";
  let stderr = "";

  const exitCode = await exec.exec(
    "timeout",
    [
      "20s",
      "opencode",
      "run",
      "--auto",
      "--print-logs",
      "--log-level",
      "DEBUG",
      "--format",
      "json",
      "--model",
      options.model,
      "Reply with exactly: REVIEW_TEST_OK",
    ],
    {
      cwd: options.workspace,
      ignoreReturnCode: true,
      env: {
        ...process.env,
        HOME: options.home,
        XDG_CONFIG_HOME: `${options.home}/.config`,
        CI: options.ci,
      },
      listeners: {
        stdout: (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          core.info(text.trimEnd());
        },
        stderr: (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          core.warning(text.trimEnd());
        },
      },
    }
  );

  core.info(`${options.name} exit code: ${exitCode}`);

  if (exitCode !== 0) {
    throw new Error(
      [
        `OpenCode test "${options.name}" failed.`,
        `Exit code: ${exitCode}`,
        `stdout length: ${stdout.length}`,
        `stderr length: ${stderr.length}`,
      ].join(" ")
    );
  }

  if (!stdout.includes("REVIEW_TEST_OK")) {
    throw new Error(
      `OpenCode test "${options.name}" completed but did not return REVIEW_TEST_OK.`
    );
  }

  core.info(`✓ ${options.name}: REVIEW_TEST_OK`);
}