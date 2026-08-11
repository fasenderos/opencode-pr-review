import * as github from "@actions/github";

export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string;
}

export async function getPullRequestFiles(token: string): Promise<ChangedFile[]> {
  const context = github.context;

  if (!context.payload.pull_request) {
    throw new Error("This action must be run on a pull_request event");
  }

  const octokit = github.getOctokit(token);

  const files = await octokit.paginate(
    octokit.rest.pulls.listFiles,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    }
  );

  return files.map(file => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch,
  }));
}

export function buildReviewInput(files: ChangedFile[]): string {
  return files
    .filter(file => file.patch)
    .map(
      file =>
        `FILE: ${file.filename}\nSTATUS: ${file.status}\n\n${file.patch}`
    )
    .join("\n\n==============================\n\n");
}