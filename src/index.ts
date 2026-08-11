import * as core from "@actions/core";
import { getPullRequestFiles, buildReviewInput } from "./github.js";

async function run() {
  try {
    const model = core.getInput("model") || "free";
    const apiKey = core.getInput("api_key");
    const githubToken = core.getInput("github_token");

    core.info(`Model: ${model}`);
    core.info(`API key provided: ${apiKey ? "yes" : "no"}`);

    const files = await getPullRequestFiles(githubToken);

    core.info(`Changed files: ${files.length}`);

    const reviewInput = buildReviewInput(files);

    core.info("--- Review Input Preview ---");
    core.info(reviewInput.substring(0, 1000));

    core.setOutput("changed_files", String(files.length));
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();