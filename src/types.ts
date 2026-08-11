export interface PullRequestFile {
  filename: string;
  status: string;
  patch?: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
  baseSha: string;
  headSha: string;
}

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

export type ReviewSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export interface ReviewIssue {
  severity: ReviewSeverity;
  file: string;
  line: number;
  title: string;
  body: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
}