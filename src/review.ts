import {
  PullRequestFile,
  ReviewFile,
  ReviewInput,
  ReviewResult,
} from "./types";

export function buildReviewInput(
  files: PullRequestFile[]
): ReviewInput {
  const reviewableFiles: ReviewFile[] = files
    .filter((file) => Boolean(file.patch))
    .map((file) => ({
      filename: file.filename,
      status: file.status,
      patch: file.patch!,
      additions: file.additions,
      deletions: file.deletions,
    }));

  return {
    files: reviewableFiles,
  };
}

export function parseReviewOutput(
  output: string
): ReviewResult {
  const json = extractJson(output);

  if (!json) {
    throw new Error(
      "OpenCode did not return a valid JSON review."
    );
  }

  const parsed: unknown = JSON.parse(json);

  if (!isReviewResult(parsed)) {
    throw new Error(
      "OpenCode returned JSON, but it does not match the expected review format."
    );
  }

  return parsed;
}

function extractJson(output: string): string | null {
  const trimmed = output.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(
    /```(?:json)?\s*([\s\S]*?)\s*```/
  );

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function isReviewResult(
  value: unknown
): value is ReviewResult {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.summary !== "string") {
    return false;
  }

  if (!Array.isArray(candidate.issues)) {
    return false;
  }

  return candidate.issues.every(isReviewIssue);
}

function isReviewIssue(
  value: unknown
): boolean {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const issue = value as Record<string, unknown>;

  return (
    typeof issue.severity === "string" &&
    ["critical", "high", "medium", "low"].includes(
      issue.severity
    ) &&
    typeof issue.file === "string" &&
    typeof issue.line === "number" &&
    typeof issue.title === "string" &&
    typeof issue.body === "string"
  );
}