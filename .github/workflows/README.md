# GitHub Actions Workflows

This directory contains automated workflows for the Meowstik project.

## Available Workflows

### 1. Create Branch on Label (`create-branch-on-label.yml`)

**Trigger**: When an issue is labeled with `ready-to-develop` or `approved`

**Purpose**: Automatically creates a feature branch for an issue

**Actions**:
- Creates branch from `main` with naming pattern: `feature/<issue-number>-<title-slug>`
- Posts comment on issue with branch details and Codespace link
- Handles duplicate branch creation gracefully

**Permissions Required**:
- `issues: write`
- `contents: write`
- `pull-requests: write`

---

### 2. Auto-populate PR from Issue (`auto-populate-pr.yml`)

**Trigger**: When a pull request is opened

**Purpose**: Pre-fills PR description with information from the linked issue

**Actions**:
- Extracts issue number from branch name
- Fetches issue details
- Populates PR description with issue content and template
- Adds comment to issue with PR link

**Permissions Required**:
- `pull-requests: write`
- `issues: read`

---

### 3. CI/CD Pipeline (`ci-cd.yml`)

**Triggers**:
- Pull requests (opened, synchronized, reopened)
- Push to `main` branch

**Purpose**: Continuous integration and deployment

**Actions on PR**:
- Install dependencies
- Run type checking
- Build application

**Actions on Main Branch**:
- All of the above, plus:
- Upload build artifacts
- Deploy to production
- Send notifications

**Permissions Required**:
- `contents: read`
- Default write permissions for artifacts

---

## Workflow Interactions

```
Issue Created
    ↓
Label Added (ready-to-develop/approved)
    ↓
[create-branch-on-label.yml] Creates Branch
    ↓
Developer Works on Branch
    ↓
PR Opened
    ↓
[auto-populate-pr.yml] Populates PR Description
[ci-cd.yml] Runs Tests & Build
    ↓
PR Merged to Main
    ↓
[ci-cd.yml] Deploys to Production
```

## Configuration

### Branch Naming Convention

Branches are automatically named using the pattern:
```
feature/<issue-number>-<title-slug>
```

Example: Issue #42 titled "Add User Authentication" becomes:
```
feature/42-add-user-authentication
```

### Environment Variables

The workflows may use repository secrets:
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

Add additional secrets in repository settings as needed for deployment.

## Testing Workflows

To test workflow changes:

1. Create a test issue
2. Add the `ready-to-develop` label
3. Verify branch creation and comments
4. Create a PR from the branch
5. Verify PR auto-population
6. Check CI/CD runs

## Maintenance

When modifying workflows:
- Test changes in a fork first
- Use `act` tool for local testing when possible
- Increment workflow versions when updating actions
- Document any new secrets or permissions required

## Troubleshooting

### Workflow Not Triggering

Check:
- Workflow file syntax (YAML validation)
- Trigger conditions match actual events
- Required permissions are granted
- GitHub Actions is enabled for the repository

### Permission Errors

Ensure repository settings allow:
- Actions to create and approve pull requests
- Workflows to write to repository
- Proper secret access if using external services

### Branch Creation Fails

Verify:
- Main branch exists and is accessible
- No conflicting branch names
- Repository isn't archived
- Token has write access to contents

## Related Documentation

- [Automated Workflow Guide](../docs/automated-workflow.md) - Full workflow documentation
- [Codespaces Configuration](../.devcontainer/devcontainer.json) - Development environment setup
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Official GitHub Actions docs
