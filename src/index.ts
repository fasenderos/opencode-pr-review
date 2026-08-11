import * as core from "@actions/core";

// import { installOac } from "./oac";
import { installOpenCode, runOpenCode } from "./opencode";
import { buildReviewPrompt } from "./prompt";

async function run(): Promise<void> {
	try {
		const workspace = process.env.GITHUB_WORKSPACE;

		if (!workspace) {
			throw new Error("GITHUB_WORKSPACE is not available.");
		}

		const githubToken = core.getInput("github_token", { required: true });
		const model = core.getInput("model");
		const apiKey = core.getInput("api_key") || undefined;
		const agent = core.getInput("agent");
		const opencodeVersion = core.getInput("opencode_version");

		core.info("================================");
		core.info("OpenCode PR Review");
		core.info("================================");

		core.info(`Agent: ${agent}`);

		core.info(`Model: ${model ?? "OpenCode default"}`);

		core.info(`API key provided: ${apiKey ? "yes" : "no"}`);

		/*
		 * Install OpenCode
		 */
		await installOpenCode(opencodeVersion);

		/*
		 * Install OAC reviewer
		 */
		// await installOac();

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

		/*
		 * Action outputs
		 *
		 * The review itself is already handled by
		 * `opencode github run`, so we don't parse it here.
		 */
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
