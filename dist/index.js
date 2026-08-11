// src/index.ts
import * as core from "@actions/core";
import * as github from "@actions/github";
async function run() {
  try {
    const model = core.getInput("model") || "free";
    const apiKey = core.getInput("api_key");
    core.info(`Model: ${model}`);
    core.info(`API key provided: ${apiKey ? "yes" : "no"}`);
    const context2 = github.context;
    core.info(`Event: ${context2.eventName}`);
    core.info(`Repository: ${context2.repo.owner}/${context2.repo.repo}`);
    if (context2.payload.pull_request) {
      core.info(`PR #${context2.payload.pull_request.number}`);
      core.info(`Base: ${context2.payload.pull_request.base.ref}`);
      core.info(`Head: ${context2.payload.pull_request.head.ref}`);
    } else {
      core.warning("This action was not triggered by a pull request.");
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}
run();
