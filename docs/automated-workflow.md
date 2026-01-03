# Automated Issue Lifecycle Workflow

This document describes the automated workflow for handling feature development and bug fixes using GitHub Actions and Codespaces.

## Overview

The workflow streamlines the process from idea to deployment with minimal manual intervention, ensuring consistency and efficiency across all development tasks.

## Workflow Steps

### 1. Issue Creation (Manual)

A developer or user creates an issue in GitHub, defining:
- **What**: The feature request or bug description
- **Why**: The business value or problem being solved
- **Acceptance Criteria**: What constitutes "done"

### 2. Branch Creation (Automated)

**Trigger**: Adding the `ready-to-develop` or `approved` label to an issue

**What Happens**:
- GitHub Action automatically creates a new branch from `main`
- Branch naming convention: `feature/<issue-number>-<issue-title-slug>`
  - Example: `feature/42-add-user-authentication`
- A comment is posted on the issue with:
  - Branch name
  - Instructions to check out the branch
  - Link to create a Codespace
- If the branch already exists, a notification comment is added

**Workflow File**: `.github/workflows/create-branch-on-label.yml`

### 3. Development Environment (Automated/Manual)

**Option A: Automatic Codespace Creation**
- Click the Codespace link in the issue comment
- GitHub automatically provisions a containerized development environment
- All dependencies are installed via `postCreateCommand`
- Setup script runs automatically

**Option B: Local Development**
```bash
git fetch
git checkout feature/<issue-number>-<title>
npm install
npm run dev
```

**Codespace Configuration**: `.devcontainer/devcontainer.json`

The Codespace includes:
- Node.js 20
- PostgreSQL 16
- Pre-configured VS Code extensions
- Automatic port forwarding for the app (port 5000)
- Consistent development environment for all contributors

### 4. Development & Commits (Manual)

Developers work on the feature branch:
```bash
# Make changes
git add .
git commit -m "descriptive commit message"
git push
```

**Best Practices**:
- Make small, focused commits
- Write descriptive commit messages
- Push frequently to back up work
- Test changes locally before pushing

### 5. Pull Request Creation (Semi-Automated)

**Manual Step**: Developer creates a PR from the feature branch to `main`

**Automated Steps**:
- The PR description is auto-populated with:
  - Link to the original issue (`Closes #<issue-number>`)
  - Issue title and description
  - Template sections for changes, testing, and checklist
- A comment is posted on the original issue with a link to the PR
- CI/CD pipeline runs automatically (see step 6)

**Workflow File**: `.github/workflows/auto-populate-pr.yml`

### 6. CI/CD & Deployment (Automated)

**Trigger**: PR is opened/updated or merged to `main`

**On PR Open/Update**:
- Checkout code
- Install dependencies
- Run type checking (`npm run check`)
- Build the application (`npm run build`)
- Report status back to the PR

**On Merge to Main**:
- All the above steps, plus:
- Upload build artifacts
- Deploy to production environment
- Send deployment notifications

**Workflow File**: `.github/workflows/ci-cd.yml`

## Quick Reference

### Labels

- `ready-to-develop` - Triggers branch creation
- `approved` - Also triggers branch creation

### Branch Naming

Format: `feature/<issue-number>-<title-slug>`
- Issue number for easy tracking
- Title slug (lowercase, hyphenated, max 50 chars)
- Automatically generated from issue title

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build
npm run check        # Type check with TypeScript
npm run db:push      # Sync database schema
```

## Customization

### Adding Custom Labels

To trigger branch creation with different labels, edit `.github/workflows/create-branch-on-label.yml`:

```yaml
if: github.event.label.name == 'ready-to-develop' || github.event.label.name == 'approved' || github.event.label.name == 'your-custom-label'
```

### Configuring Deployment

Update `.github/workflows/ci-cd.yml` in the `deploy` job with your specific deployment steps:

```yaml
- name: Deploy
  run: |
    # Add your deployment commands here
    # Examples:
    # - aws s3 sync dist/ s3://your-bucket/
    # - kubectl apply -f k8s/
    # - vercel deploy --prod
```

### Modifying Codespace Environment

Edit `.devcontainer/devcontainer.json` to:
- Add VS Code extensions
- Change Node.js version
- Add additional tools/features
- Customize VS Code settings

## Troubleshooting

### Branch Already Exists

If you add the label and see "Branch already exists":
- The branch was already created previously
- You can safely continue working on the existing branch
- Or delete the remote branch and re-add the label

### Codespace Setup Issues

If the Codespace fails to set up:
1. Check `.devcontainer/setup.sh` logs
2. Ensure `.env` file is configured (may need manual setup)
3. Run `npm install` manually if needed
4. Check PostgreSQL configuration

### CI/CD Failures

If the build fails:
1. Review the workflow run logs in GitHub Actions
2. Fix issues locally
3. Push changes to re-trigger the workflow
4. Ensure all tests pass with `npm run check`

## Benefits

✅ **Consistency**: Every developer uses the same environment  
✅ **Speed**: Automated branch creation and PR setup  
✅ **Traceability**: Clear links between issues, branches, and PRs  
✅ **Quality**: Automated testing and type checking on every PR  
✅ **Efficiency**: Reduced manual setup and context switching  

## Future Enhancements

Potential improvements to this workflow:
- Automated test runs with coverage reports
- Integration with project boards for status updates
- Automatic assignment of reviewers based on code changes
- Slack/Discord notifications for key events
- Automated dependency updates via Dependabot
- Preview deployments for each PR
