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
    await exec.exec(
        "find",
        [".opencode", "-type", "f", "-maxdepth", "5"],
        {
        cwd: workspace,
        }
    );

    await exec.exec(
        "opencode",
        ["agent", "list"],
        {
            cwd: workspace,
        }
    );

  const args = [
  "run",
  "--auto",
  "--format",
  "json",
];

//   if (model) {
//     args.push("--model", model);
//   }

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