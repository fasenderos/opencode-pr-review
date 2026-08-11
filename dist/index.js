// src/index.ts
import * as core from "@actions/core";

// src/github.ts
import * as github from "@actions/github";
async function getPullRequestFiles(token) {
  const context2 = github.context;
  if (!context2.payload.pull_request) {
    throw new Error("This action must be run on a pull_request event");
  }
  const octokit = github.getOctokit(token);
  const files = await octokit.paginate(
    octokit.rest.pulls.listFiles,
    {
      owner: context2.repo.owner,
      repo: context2.repo.repo,
      pull_number: context2.payload.pull_request.number,
      per_page: 100
    }
  );
  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch
  }));
}
function buildReviewInput(files) {
  return files.filter((file) => file.patch).map(
    (file) => `FILE: ${file.filename}
STATUS: ${file.status}

${file.patch}`
  ).join("\n\n==============================\n\n");
}

// src/index.ts
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
    core.info(reviewInput.substring(0, 1e3));
    core.setOutput("changed_files", String(files.length));
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}
run();
