import * as core from "@actions/core";

import {
  getPullRequestFiles,
} from "./github";

import {
  buildReviewInput,
  buildReviewPrompt,
  parseReviewOutput,
} from "./review";

import {
  installOpenCode,
  runOpenCode,
  runOpenCodeTest
} from "./opencode";

import {
  installOac,
} from "./oac";

async function run(): Promise<void> {
  try {
    const workspace =
      process.env.GITHUB_WORKSPACE;

    if (!workspace) {
      throw new Error(
        "GITHUB_WORKSPACE is not available."
      );
    }

    const githubToken = core.getInput(
      "github_token",
      { required: true }
    );

    const model =
      core.getInput("model") || undefined;

    const apiKey =
      core.getInput("api_key") || undefined;

    const agent =
      core.getInput("agent") ||
      "code-reviewer";

    const opencodeVersion =
      core.getInput("opencode_version") ||
      "latest";

    const oacRef =
      core.getInput("oac_ref") ||
      "main";

    core.info("================================");
    core.info("OpenCode PR Review");
    core.info("================================");

    core.info(
      `Agent: ${agent}`
    );

    core.info(
      `Model: ${model ?? "OpenCode default"}`
    );

    core.info(
      `API key provided: ${apiKey ? "yes" : "no"}`
    );

    /*
     * 1. Read PR files
     */
    const files =
      await getPullRequestFiles(
        githubToken
      );

    core.info(
      `Changed files: ${files.length}`
    );

    /*
     * 2. Build review input
     */
    const reviewInput =
      buildReviewInput(files);

    core.info(
      `Reviewable files: ${reviewInput.files.length}`
    );

    /*
     * 3. Install OpenCode
     */
    await installOpenCode(
      opencodeVersion
    );

    /*
     * 4. Install OAC reviewer
     */
    // await installOac(
    //   oacRef,
    //   workspace
    // );

    // await runOpenCodeTest(workspace, "opencode/deepseek-v4-flash-free");

    /*
     * 5. Run OpenCode
     */
    const prompt = buildReviewPrompt();
    const result =
      await runOpenCode(
        workspace,
        agent,
        model,
        "Reply with exactly: REVIEW_TEST_OK",
        apiKey
      );

    core.info(
      `OpenCode exit code: ${result.exitCode}`
    );

    /*
     * 6. Parse review
     */
    if (result.exitCode !== 0) {
      throw new Error(
        `OpenCode exited with code ${result.exitCode}.`
      );
    }

    const review =
      parseOpenCodeEvents(
        result.output
      );

    /*
     * 7. Validate structured review
     */
    const reviewResult =
      parseReviewOutput(review);

    core.info(
      `Issues found: ${reviewResult.issues.length}`
    );

    core.info(
      "--- Review Summary ---"
    );

    core.info(
      reviewResult.summary
    );

    for (const issue of reviewResult.issues) {
      core.info(
        `[${issue.severity}] ${issue.file}:${issue.line} - ${issue.title}`
      );
    }

    /*
     * 8. Action outputs
     */
    core.setOutput(
      "changed_files",
      files.length
    );

    core.setOutput(
      "reviewable_files",
      reviewInput.files.length
    );

    core.setOutput(
      "review",
      JSON.stringify(reviewResult)
    );

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(
        "Unknown error."
      );
    }
  }
}

/**
 * OpenCode --format json returns a stream of JSON events.
 *
 * We extract the final assistant text from those events.
 */
function parseOpenCodeEvents(
  output: string
): string {
  const lines =
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const assistantTexts: string[] = [];

  for (const line of lines) {
    try {
      const event =
        JSON.parse(line) as Record<
          string,
          unknown
        >;

      const part =
        event.part as
          | Record<string, unknown>
          | undefined;

      if (
        event.type === "text" &&
        typeof event.text === "string"
      ) {
        assistantTexts.push(
          event.text
        );
      }

      if (
        part &&
        part.type === "text" &&
        typeof part.text === "string"
      ) {
        assistantTexts.push(
          part.text
        );
      }
    } catch {
      /*
       * Ignore non-JSON lines.
       */
    }
  }

  if (assistantTexts.length > 0) {
    return assistantTexts.join("\n");
  }

  /*
   * Fallback for future OpenCode output changes.
   */
  return output;
}

run();