import * as core from "@actions/core";
import { getPullRequestFiles } from "./github";
import { buildReviewInput } from "./review";

async function run(): Promise<void> {
  try {
    const model = core.getInput("model") || "free";
    const apiKey = core.getInput("api_key");
    const githubToken = core.getInput("github_token", {
        required: true
    });

    core.info(`Model: ${model}`);
    core.info(`API key provided: ${apiKey ? "yes" : "no"}`);

    const files = await getPullRequestFiles(githubToken);

    core.info(`Changed files: ${files.length}`);

    const reviewInput = buildReviewInput(files);

    core.info(
      `Reviewable files: ${reviewInput.files.length}`
    );

    core.info("--- Review Input Preview ---");

    for (const file of reviewInput.files) {
      core.info(`FILE: ${file.filename}`);
      core.info(`STATUS: ${file.status}`);
      core.info(`ADDITIONS: ${file.additions}`);
      core.info(`DELETIONS: ${file.deletions}`);
      core.info("");
      core.info(file.patch);
      core.info("==============================");
    }

    core.setOutput(
      "changed_files",
      files.length
    );

    core.setOutput(
      "reviewable_files",
      reviewInput.files.length
    );
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();