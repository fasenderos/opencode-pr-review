import * as core from "@actions/core";
import * as exec from "@actions/exec";

export interface OpenCodeRunResult {
	exitCode: number;
	output: string;
}

export async function installOpenCode(version: string): Promise<void> {
	const packageSpec = getOpenCodePackage(version);

	core.startGroup(`Installing OpenCode: ${packageSpec}`);

	try {
		core.info(`Package: ${packageSpec}`);
		core.info(`Node: ${process.version}`);

		await exec.exec("node", ["--version"]);
		await exec.exec("npm", ["--version"]);

		core.info("Installing OpenCode globally...");

		await exec.exec(
			"npm",
			["install", "--global", "--no-fund", "--no-audit", packageSpec],
			{
				ignoreReturnCode: false,
			},
		);

		core.info("Verifying OpenCode installation...");

		let versionOutput = "";

		const exitCode = await exec.exec("opencode", ["--version"], {
			ignoreReturnCode: true,
			listeners: {
				stdout: (data: Buffer) => {
					versionOutput += data.toString();
				},
				stderr: (data: Buffer) => {
					core.warning(data.toString().trimEnd());
				},
			},
		});

		if (exitCode !== 0) {
			throw new Error(
				`OpenCode was installed but "opencode --version" failed with exit code ${exitCode}.`,
			);
		}

		const installedVersion = versionOutput.trim();

		if (!installedVersion) {
			throw new Error(
				'OpenCode was installed but "opencode --version" returned no output.',
			);
		}

		core.info(`OpenCode installed successfully: ${installedVersion}`);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`Failed to install OpenCode (${packageSpec}): ${error.message}`,
				{ cause: error },
			);
		}

		throw new Error(`Failed to install OpenCode (${packageSpec}).`);
	} finally {
		core.endGroup();
	}
}

export async function runOpenCode(
	workspace: string,
	agent: string,
	model: string | undefined,
	prompt: string,
	_apiKey: string | undefined,
	githubToken: string,
): Promise<OpenCodeRunResult> {
	let output = "";

	const env: Record<string, string> = {
		...process.env,
		GITHUB_TOKEN: githubToken,
		USE_GITHUB_TOKEN: "true",
		PROMPT: prompt,
	};

	env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
		$schema: "https://opencode.ai/config.json",
		model,
		default_agent: agent,
	});

	core.info(`Running OpenCode GitHub review (agent: ${agent})...`);

	const exitCode = await exec.exec("opencode", ["github", "run"], {
		cwd: workspace,
		env,
		ignoreReturnCode: true,
		listeners: {
			stdout: (data: Buffer) => {
				const text = data.toString();
				output += text;
				core.info(text.trimEnd());
			},
			stderr: (data: Buffer) => {
				const text = data.toString();
				output += text;
				core.warning(text.trimEnd());
			},
		},
	});

	return {
		exitCode,
		output,
	};
}

function getOpenCodePackage(version: string): string {
	const normalized = version.trim();

	if (!normalized || normalized === "latest") {
		return "opencode-ai@latest";
	}

	if (!/^[0-9]+(?:\.[0-9]+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
		throw new Error(
			`Invalid OpenCode version: "${version}". Expected "latest" or a valid npm version.`,
		);
	}

	return `opencode-ai@${normalized}`;
}
