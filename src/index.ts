import * as core from "@actions/core";
import * as exec from "@actions/exec";

import { getPullRequestFiles } from "./github";
import { installOac } from "./oac";
import { installOpenCode, runOpenCode } from "./opencode";
import { buildReviewInput, buildReviewPrompt } from "./review";

async function run(): Promise<void> {
	try {
		const workspace = process.env.GITHUB_WORKSPACE;

		if (!workspace) {
			throw new Error("GITHUB_WORKSPACE is not available.");
		}

		const githubToken = core.getInput("github_token", { required: true });

		const model = core.getInput("model") || undefined;

		const apiKey = core.getInput("api_key") || undefined;

		const agent = core.getInput("agent") || "code-reviewer";

		const opencodeVersion = core.getInput("opencode_version") || "latest";

		core.info("================================");
		core.info("OpenCode PR Review");
		core.info("================================");

		core.info(`Agent: ${agent}`);

		core.info(`Model: ${model ?? "OpenCode default"}`);

		core.info(`API key provided: ${apiKey ? "yes" : "no"}`);

		/*
		 * Read PR files
		 */
		const files = await getPullRequestFiles(githubToken);

		core.info(`Changed files: ${files.length}`);

		/*
		 * Build review input
		 *
		 * This is currently only used to determine how many
		 * files are reviewable.
		 */
		const reviewInput = buildReviewInput(files);

		core.info(`Reviewable files: ${reviewInput.files.length}`);

		/*
		 * Install OpenCode
		 */
		await installOpenCode(opencodeVersion);

		/*
		 * Install OAC reviewer
		 */
		await installOac();

		/*
		 * Ensure working tree is clean
		 *
		 * OpenCode github run automatically commits and pushes
		 * if the repository is dirty. We only want a review comment.
		 */
		await exec.exec("git", ["reset", "--hard", "HEAD"], { cwd: workspace });

		await exec.exec("git", ["clean", "-fd"], { cwd: workspace });

		/*
		 * Run OpenCode
		 */
		const prompt = buildReviewPrompt();
		const result = await runOpenCode(
			workspace,
			agent,
			model,
			prompt,
			apiKey,
			githubToken,
		);

		core.info(`OpenCode exit code: ${result.exitCode}`);

		/*
		 * Check OpenCode result
		 */
		if (result.exitCode !== 0) {
			throw new Error(`OpenCode exited with code ${result.exitCode}.`);
		}

		core.info("OpenCode completed successfully.");

		/*
		 * 7. Action outputs
		 *
		 * The review itself is already handled by
		 * `opencode github run`, so we don't parse it here.
		 */
		core.setOutput("changed_files", files.length);

		core.setOutput("reviewable_files", reviewInput.files.length);

		core.info("================================");

		core.info("OpenCode PR Review completed successfully.");

		core.info("The review comment was handled by OpenCode.");

		core.info("================================");
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed("Unknown error.");
		}
	}
}

run();
