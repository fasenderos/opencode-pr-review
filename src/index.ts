import * as core from "@actions/core";
import * as github from "@actions/github";

async function run() {
  try {
    const model = core.getInput("model") || "free";
    const apiKey = core.getInput("api_key");

    core.info(`Model: ${model}`);
    core.info(`API key provided: ${apiKey ? "yes" : "no"}`);

    const context = github.context;

    core.info(`Event: ${context.eventName}`);
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);

    if (context.payload.pull_request) {
      core.info(`PR #${context.payload.pull_request.number}`);
      core.info(`Base: ${context.payload.pull_request.base.ref}`);
      core.info(`Head: ${context.payload.pull_request.head.ref}`);
    } else {
      core.warning("This action was not triggered by a pull request.");
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();