export type GitHubUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type GitHubRepo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatarUrl: string;
  private: boolean;
  description: string | null;
  openIssuesCount: number;
  updatedAt: string;
  defaultBranch: string;
};

export type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  body: string | null;
  labels: string[];
  author: string;
  authorAvatarUrl: string | null;
  comments: number;
  updatedAt: string;
};

export type GitHubIssueComment = {
  id: number;
  author: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateGitHubIssueInput = {
  repo: string;
  title: string;
  body: string;
  labels?: string[];
};

const API_ROOT = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function getViewer(token: string): Promise<GitHubUser> {
  const data = await githubRequest<GitHubUserResponse>(token, "/user");
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
  };
}

export async function listRepositories(token: string): Promise<GitHubRepo[]> {
  const data = await githubRequest<GitHubRepoResponse[]>(
    token,
    "/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=50",
  );

  return data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    ownerAvatarUrl: repo.owner.avatar_url,
    private: repo.private,
    description: repo.description,
    openIssuesCount: repo.open_issues_count,
    updatedAt: repo.updated_at,
    defaultBranch: repo.default_branch,
  }));
}

export async function listIssues(
  token: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<GitHubIssue[]> {
  const data = await githubRequest<GitHubIssueResponse[]>(
    token,
    `/repos/${repo}/issues?state=${state}&per_page=50`,
  );

  return data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.html_url,
      body: issue.body,
      labels: issue.labels.map((label) => label.name),
      author: issue.user?.login ?? "unknown",
      authorAvatarUrl: issue.user?.avatar_url ?? null,
      comments: issue.comments,
      updatedAt: issue.updated_at,
    }));
}

export async function getIssue(
  token: string,
  repo: string,
  issueNumber: number,
): Promise<GitHubIssue> {
  const data = await githubRequest<GitHubIssueResponse>(token, `/repos/${repo}/issues/${issueNumber}`);
  return mapIssue(data);
}

export async function listIssueComments(
  token: string,
  repo: string,
  issueNumber: number,
): Promise<GitHubIssueComment[]> {
  const data = await githubRequest<GitHubIssueCommentResponse[]>(
    token,
    `/repos/${repo}/issues/${issueNumber}/comments?per_page=50`,
  );

  return data.map((comment) => ({
    id: comment.id,
    author: comment.user?.login ?? "unknown",
    authorAvatarUrl: comment.user?.avatar_url ?? null,
    body: comment.body,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  }));
}

export async function ensureAiDraftLabel(token: string, repo: string): Promise<void> {
  try {
    await githubRequest(token, `/repos/${repo}/labels/ai-draft`);
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 404) {
      throw error;
    }

    await githubRequest(token, `/repos/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: "ai-draft",
        color: "BFD4F2",
        description: "Created by ghi from a rough report and not yet human-triaged.",
      }),
    });
  }
}

export async function createGitHubIssue(
  token: string,
  input: CreateGitHubIssueInput,
): Promise<GitHubIssue> {
  const data = await githubRequest<GitHubIssueResponse>(token, `/repos/${input.repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      labels: input.labels ?? [],
    }),
  });

  return {
    id: data.id,
    number: data.number,
    title: data.title,
    state: data.state,
    htmlUrl: data.html_url,
    body: data.body,
    labels: data.labels.map((label) => label.name),
    author: data.user?.login ?? "unknown",
    authorAvatarUrl: data.user?.avatar_url ?? null,
    comments: data.comments,
    updatedAt: data.updated_at,
  };
}

export function formatGithubDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function githubRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new GitHubApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string };
    return data.message ?? `GitHub request failed with ${response.status}`;
  } catch {
    return `GitHub request failed with ${response.status}`;
  }
}

function mapIssue(issue: GitHubIssueResponse): GitHubIssue {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    htmlUrl: issue.html_url,
    body: issue.body,
    labels: issue.labels.map((label) => label.name),
    author: issue.user?.login ?? "unknown",
    authorAvatarUrl: issue.user?.avatar_url ?? null,
    comments: issue.comments,
    updatedAt: issue.updated_at,
  };
}

type GitHubUserResponse = {
  login: string;
  name: string | null;
  avatar_url: string;
};

type GitHubRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  description: string | null;
  open_issues_count: number;
  updated_at: string;
  default_branch: string;
};

type GitHubIssueResponse = {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  labels: Array<{ name: string }>;
  user: { login: string; avatar_url: string } | null;
  comments: number;
  updated_at: string;
  pull_request?: unknown;
};

type GitHubIssueCommentResponse = {
  id: number;
  body: string;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
};
