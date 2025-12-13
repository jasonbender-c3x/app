/**
 * =============================================================================
 * GITHUB INTEGRATION
 * =============================================================================
 * 
 * Provides access to GitHub repositories, issues, pull requests, and code.
 * Uses Replit's GitHub connector for OAuth authentication.
 * 
 * CAPABILITIES:
 * - List and search repositories
 * - Read repository contents (files, directories)
 * - Manage issues (list, create, update, close)
 * - View pull requests
 * - Search code across repositories
 * - Get commit history
 * =============================================================================
 */

import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected. Please connect your GitHub account.');
  }
  return accessToken;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listUserRepos(perPage = 30, page = 1, sort: 'created' | 'updated' | 'pushed' | 'full_name' = 'updated') {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: perPage,
    page,
    sort,
    direction: 'desc'
  });
  
  return data.map(repo => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    private: repo.private,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    defaultBranch: repo.default_branch,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at
  }));
}

export async function getRepo(owner: string, repo: string) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.get({ owner, repo });
  
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    private: data.private,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    language: data.language,
    stargazersCount: data.stargazers_count,
    forksCount: data.forks_count,
    openIssuesCount: data.open_issues_count,
    defaultBranch: data.default_branch,
    topics: data.topics,
    license: data.license?.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at
  };
}

export async function searchRepos(query: string, perPage = 10) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.search.repos({
    q: query,
    per_page: perPage,
    sort: 'stars',
    order: 'desc'
  });
  
  return {
    totalCount: data.total_count,
    repos: data.items.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count
    }))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE/CONTENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getRepoContents(owner: string, repo: string, path = '', ref?: string) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref
  });
  
  if (Array.isArray(data)) {
    return data.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      htmlUrl: item.html_url
    }));
  } else {
    return {
      name: data.name,
      path: data.path,
      type: data.type,
      size: data.size,
      sha: data.sha,
      htmlUrl: data.html_url,
      content: 'content' in data ? Buffer.from(data.content, 'base64').toString('utf-8') : null,
      encoding: 'encoding' in data ? data.encoding : null
    };
  }
}

export async function getFileContent(owner: string, repo: string, path: string, ref?: string) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref
  });
  
  if (Array.isArray(data)) {
    throw new Error(`Path "${path}" is a directory, not a file`);
  }
  
  if (!('content' in data)) {
    throw new Error(`Cannot read content of "${path}"`);
  }
  
  return {
    name: data.name,
    path: data.path,
    sha: data.sha,
    size: data.size,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    htmlUrl: data.html_url
  };
}

export async function searchCode(query: string, perPage = 10) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.search.code({
    q: query,
    per_page: perPage
  });
  
  return {
    totalCount: data.total_count,
    items: data.items.map(item => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      htmlUrl: item.html_url,
      repository: {
        fullName: item.repository.full_name,
        description: item.repository.description
      }
    }))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state,
    per_page: perPage,
    sort: 'updated',
    direction: 'desc'
  });
  
  return data.filter(issue => !issue.pull_request).map(issue => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    htmlUrl: issue.html_url,
    user: issue.user?.login,
    labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
    assignees: issue.assignees?.map(a => a.login),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at
  }));
}

export async function getIssue(owner: string, repo: string, issueNumber: number) {
  const octokit = await getUncachableGitHubClient();
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber
  });
  
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    htmlUrl: issue.html_url,
    user: issue.user?.login,
    labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
    assignees: issue.assignees?.map(a => a.login),
    milestone: issue.milestone?.title,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at
  };
}

export async function createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[], assignees?: string[]) {
  const octokit = await getUncachableGitHubClient();
  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
    assignees
  });
  
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url,
    state: issue.state,
    createdAt: issue.created_at
  };
}

export async function updateIssue(owner: string, repo: string, issueNumber: number, updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[] }) {
  const octokit = await getUncachableGitHubClient();
  const { data: issue } = await octokit.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    ...updates
  });
  
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    htmlUrl: issue.html_url,
    updatedAt: issue.updated_at
  };
}

export async function addIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
  const octokit = await getUncachableGitHubClient();
  const { data: comment } = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
  
  return {
    id: comment.id,
    body: comment.body,
    user: comment.user?.login,
    htmlUrl: comment.html_url,
    createdAt: comment.created_at
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PULL REQUEST OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state,
    per_page: perPage,
    sort: 'updated',
    direction: 'desc'
  });
  
  return data.map(pr => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    htmlUrl: pr.html_url,
    user: pr.user?.login,
    head: pr.head.ref,
    base: pr.base.ref,
    draft: pr.draft,
    merged: pr.merged_at !== null,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at
  }));
}

export async function getPullRequest(owner: string, repo: string, pullNumber: number) {
  const octokit = await getUncachableGitHubClient();
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber
  });
  
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    htmlUrl: pr.html_url,
    user: pr.user?.login,
    head: pr.head.ref,
    base: pr.base.ref,
    draft: pr.draft,
    merged: pr.merged,
    mergeable: pr.mergeable,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMIT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listCommits(owner: string, repo: string, sha?: string, perPage = 30) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.listCommits({
    owner,
    repo,
    sha,
    per_page: perPage
  });
  
  return data.map(commit => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name,
    authorEmail: commit.commit.author?.email,
    date: commit.commit.author?.date,
    htmlUrl: commit.html_url
  }));
}

export async function getCommit(owner: string, repo: string, sha: string) {
  const octokit = await getUncachableGitHubClient();
  const { data: commit } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: sha
  });
  
  return {
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name,
    authorEmail: commit.commit.author?.email,
    date: commit.commit.author?.date,
    htmlUrl: commit.html_url,
    stats: commit.stats,
    files: commit.files?.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch
    }))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listBranches(owner: string, repo: string, perPage = 100) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.listBranches({
    owner,
    repo,
    per_page: perPage
  });
  
  return data.map(branch => ({
    name: branch.name,
    sha: branch.commit.sha,
    protected: branch.protected
  }));
}

export async function deleteBranch(owner: string, repo: string, branchName: string) {
  const octokit = await getUncachableGitHubClient();
  await octokit.git.deleteRef({
    owner,
    repo,
    ref: `heads/${branchName}`
  });
  
  return { success: true, deletedBranch: branchName };
}

export async function getDefaultBranch(owner: string, repo: string) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.get({ owner, repo });
  return data.default_branch;
}

// ═══════════════════════════════════════════════════════════════════════════
// USER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAuthenticatedUser() {
  const octokit = await getUncachableGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at
  };
}
