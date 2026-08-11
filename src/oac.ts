import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function installOac(
    ref: string,
    workspace: string
): Promise<void> {
  core.info("Installing OpenAgentsControl...");

  await exec.exec(
    "bash",
    [
      "-c",
      "curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer",
    ],
  );

  core.info(
    "OpenAgentsControl installation completed."
  );

  await configureReviewPermissions(workspace);
}

// export async function installOac(
//   ref: string,
//   workspace: string
// ): Promise<void> {
//   const oacDirectory = `${workspace}/.oac`;
//   const agentsDirectory = `${workspace}/.opencode/agents`;

//   core.info(
//     `Installing OpenAgentsControl (${ref})...`
//   );

//   await exec.exec(
//     "git",
//     [
//       "clone",
//       "--depth",
//       "1",
//       "--branch",
//       ref,
//       "https://github.com/darrenhinde/OpenAgentsControl.git",
//       oacDirectory,
//     ],
//     {
//       cwd: workspace,
//     }
//   );

//   core.info(
//     "OpenAgentsControl repository downloaded."
//   );

//   await exec.exec(
//     "mkdir",
//     ["-p", agentsDirectory]
//   );

//   /*
//    * OAC contains several "code reviewer" agents for
//    * different integrations. We specifically want the
//    * native OpenCode agent.
//    */
//   const reviewerPath =
//     `${oacDirectory}/.opencode/agent/subagents/code/reviewer.md`;

//   core.info(
//     `Using OAC OpenCode reviewer: ${reviewerPath}`
//   );

//   await exec.exec(
//     "test",
//     ["-f", reviewerPath]
//   );

//   await exec.exec(
//     "cp",
//     [
//       reviewerPath,
//       `${agentsDirectory}/code-reviewer.md`,
//     ]
//   );

//   core.info(
//     "OpenAgentsControl code-reviewer installed."
//   );

//   await configureReviewPermissions(workspace);
// }

async function configureReviewPermissions(
  workspace: string
): Promise<void> {
  const configPath =
    `${workspace}/.opencode/opencode.json`;

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

  const fs = await import("node:fs/promises");

  await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 2),
    "utf8"
  );

  core.info(
    "OpenCode review permissions configured."
  );
}