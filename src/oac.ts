import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function installOac(): Promise<void> {
	core.info("Installing OpenAgentsControl...");

	await exec.exec("bash", [
		"-c",
		"curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer",
	]);

	core.info("OpenAgentsControl installation completed.");
}
