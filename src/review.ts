import { PullRequestFile } from "./github";

export interface ReviewFile {
  filename: string;
  status: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface ReviewInput {
  files: ReviewFile[];
}

export function buildReviewInput(
  files: PullRequestFile[]
): ReviewInput {
  return {
    files: files
      .filter((file) => file.patch)
      .map((file) => ({
        filename: file.filename,
        status: file.status,
        patch: file.patch!,
        additions: file.additions,
        deletions: file.deletions,
      })),
  };
}