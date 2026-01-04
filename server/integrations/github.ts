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

export async function createBranch(owner: string, repo: string, branchName: string, fromBranch?: string) {
  const octokit = await getUncachableGitHubClient();
  const baseBranch = fromBranch || await getDefaultBranch(owner, repo);
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`
  });
  
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha
  });
  
  return { name: branchName, sha: ref.object.sha, baseBranch };
}

export async function createOrUpdateFile(
  owner: string, 
  repo: string, 
  path: string, 
  content: string, 
  message: string,
  branch: string,
  sha?: string
) {
  const octokit = await getUncachableGitHubClient();
  
  let existingSha = sha;
  if (!existingSha) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
      if (!Array.isArray(data) && 'sha' in data) {
        existingSha = data.sha;
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
  }
  
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    sha: existingSha
  });
  
  return {
    path: data.content?.path,
    sha: data.content?.sha,
    htmlUrl: data.content?.html_url,
    commitSha: data.commit.sha,
    commitUrl: data.commit.html_url
  };
}

/**
 * Creates a new file (wrapper around createOrUpdateFile for clarity)
 * This will fail if the file already exists
 */
export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
) {
  return createOrUpdateFile(owner, repo, path, content, message, branch);
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base?: string,
  draft = false
) {
  const octokit = await getUncachableGitHubClient();
  const baseBranch = base || await getDefaultBranch(owner, repo);
  
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base: baseBranch,
    draft
  });
  
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    htmlUrl: pr.html_url,
    head: pr.head.ref,
    base: pr.base.ref,
    draft: pr.draft,
    createdAt: pr.created_at
  };
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

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ATTRIBUTION SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agent author information for Git commits
 */
export interface AgentAuthor {
  name: string;      // e.g., "Agentia Compiler"
  email: string;     // e.g., "compiler@agentia.dev"
  signature?: string; // Optional signature to add to commit messages
}

/**
 * Creates or updates a file with custom agent author attribution
 * This uses the Git Data API to create a commit with custom author information
 */
export async function createOrUpdateFileWithAgent(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  agent: AgentAuthor,
  sha?: string
): Promise<{
  path: string | undefined;
  sha: string | undefined;
  htmlUrl: string | undefined;
  commitSha: string;
  commitUrl: string | undefined;
}> {
  const octokit = await getUncachableGitHubClient();
  
  // Get the current commit of the branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });
  const latestCommitSha = refData.object.sha;
  
  // Get the tree of the latest commit
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commitData.tree.sha;
  
  // Create a blob for the file content
  const { data: blobData } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  });
  
  // Create a new tree with the file
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: [
      {
        path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      }
    ]
  });
  
  // Add agent signature to commit message if provided
  const commitMessage = agent.signature 
    ? `${message}\n\n---\n${agent.signature}`
    : message;
  
  // Create a commit with custom author
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: treeData.sha,
    parents: [latestCommitSha],
    author: {
      name: agent.name,
      email: agent.email,
      date: new Date().toISOString()
    }
  });
  
  // Update the reference to point to the new commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });
  
  return {
    path,
    sha: blobData.sha,
    htmlUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,
    commitSha: newCommit.sha,
    commitUrl: newCommit.html_url
  };
}

/**
 * Creates a pull request with agent attribution in the body
 */
export async function createPullRequestWithAgent(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  agent: AgentAuthor,
  base?: string,
  draft = false
) {
  const octokit = await getUncachableGitHubClient();
  const baseBranch = base || await getDefaultBranch(owner, repo);
  
  // Add agent attribution to PR body
  const attributedBody = `${body}\n\n---\n*Created by: **${agent.name}** (${agent.email})*`;
  
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body: attributedBody,
    head,
    base: baseBranch,
    draft
  });
  
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    htmlUrl: pr.html_url,
    head: pr.head.ref,
    base: pr.base.ref,
    draft: pr.draft,
    createdAt: pr.created_at
  };
}

/**
 * Creates an issue with agent attribution
 */
export async function createIssueWithAgent(
  owner: string,
  repo: string,
  title: string,
  agent: AgentAuthor,
  body?: string,
  labels?: string[],
  assignees?: string[]
) {
  const octokit = await getUncachableGitHubClient();
  
  // Add agent attribution to issue body
  const attributedBody = body 
    ? `${body}\n\n---\n*Created by: **${agent.name}** (${agent.email})*`
    : `*Created by: **${agent.name}** (${agent.email})*`;
  
  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title,
    body: attributedBody,
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

/**
 * Adds a comment to an issue or PR with agent attribution
 */
export async function addCommentWithAgent(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  agent: AgentAuthor
) {
  const octokit = await getUncachableGitHubClient();
  
  // Add agent attribution to comment
  const attributedBody = `${body}\n\n---\n*Posted by: **${agent.name}** (${agent.email})*`;
  
  const { data: comment } = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: attributedBody
  });
  
  return {
    id: comment.id,
    body: comment.body,
    user: comment.user?.login,
    htmlUrl: comment.html_url,
    createdAt: comment.created_at
  };
}
