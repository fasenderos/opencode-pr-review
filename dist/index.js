// src/index.ts
import * as core from "@actions/core";

// src/github.ts
import * as github from "@actions/github";
async function getPullRequestFiles(token) {
  const context2 = github.context;
  if (!context2.payload.pull_request) {
    throw new Error(
      "This action must be run on a pull_request event"
    );
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
    patch: file.patch,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  }));
}

// src/review.ts
function buildReviewInput(files) {
  return {
    files: files.filter((file) => file.patch).map((file) => ({
      filename: file.filename,
      status: file.status,
      patch: file.patch,
      additions: file.additions,
      deletions: file.deletions
    }))
  };
}

// src/index.ts
async function run() {
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
