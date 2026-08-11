import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function installOac(
  ref: string,
  workspace: string
): Promise<void> {
  core.info(
    `Installing OpenAgentsControl (${ref})...`
  );

  await exec.exec(
    "git",
    [
      "clone",
      "--depth",
      "1",
      "--branch",
      ref,
      "https://github.com/darrenhinde/OpenAgentsControl.git",
      `${workspace}/.oac`,
    ],
    {
      cwd: workspace,
    }
  );

  core.info("OpenAgentsControl repository downloaded.");

  await installCodeReviewerAgent(workspace);
}

async function installCodeReviewerAgent(
  workspace: string
): Promise<void> {
  /*
   * OAC can evolve its directory layout.
   *
   * We intentionally keep this logic isolated here so changes
   * in OAC do not leak into the rest of the Action.
   *
   * For the first version, we locate the reviewer agent and
   * copy it into the project-local OpenCode agent directory.
   */

  const targetDirectory =
    `${workspace}/.opencode/agents`;

  await exec.exec(
    "mkdir",
    ["-p", targetDirectory]
  );

  const output: string[] = [];

  await exec.exec(
    "find",
    [
      `${workspace}/.oac`,
      "-type",
      "f",
      "-iname",
      "*reviewer*.md",
    ],
    {
      listeners: {
        stdout: (data: Buffer) => {
          output.push(data.toString());
        },
      },
    }
  );

  const candidates = output
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    throw new Error(
      "Could not find a reviewer agent in OpenAgentsControl."
    );
  }

  const reviewer =
    candidates.find((file) =>
      file.toLowerCase().includes("code-reviewer")
    ) ??
    candidates.find((file) =>
      file.toLowerCase().includes("reviewer")
    );

  if (!reviewer) {
    throw new Error(
      "Could not identify the OpenAgentsControl code reviewer agent."
    );
  }

  core.info(
    `Using OAC reviewer agent: ${reviewer}`
  );

  await exec.exec(
    "cp",
    [
      reviewer,
      `${targetDirectory}/code-reviewer.md`,
    ]
  );

  core.info(
    "OpenAgentsControl code-reviewer installed."
  );
}