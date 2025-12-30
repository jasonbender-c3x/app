# External Documentation Hosting

*Guide for hosting Meowstik documentation externally via Docusaurus + GitHub Pages*

---

## Overview

We have two documentation options:

| Option | Location | Purpose |
|--------|----------|---------|
| **In-app** | `/docs` route | Internal reference, always in sync |
| **External** | `docs.meowstik.com` | Public-facing, SEO-friendly |

---

## Docusaurus + GitHub Pages Setup

### Why Docusaurus?

- React-based (matches our stack)
- Great search, versioning, i18n
- Free hosting on GitHub Pages
- Custom domain support

### Deployment Methods

#### Method 1: GitHub Actions (Recommended)

Push to main → auto-builds and deploys

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build website
        run: npm run build
        
      - name: Setup Pages
        uses: actions/configure-pages@v4
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: build
          
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### Method 2: Manual Deploy

```bash
npm install gh-pages --save-dev
GIT_USER=<your-github-username> npm run deploy
```

### Configuration

In `docusaurus.config.js`:

```javascript
const config = {
  url: 'https://docs.meowstik.com',
  baseUrl: '/',
  organizationName: 'your-username',
  projectName: 'meowstik-docs',
  trailingSlash: false,
};
```

### Custom Domain Setup

1. Create CNAME record: `docs.meowstik.com` → `yourusername.github.io`
2. Add CNAME file to `static/` folder with content: `docs.meowstik.com`
3. Enable HTTPS in GitHub Pages settings

---

## Screenshot Behavior Clarification

| Context | Screenshot Source | Permission |
|---------|------------------|------------|
| **Replit IDE** | Agent viewing webview | Yes (every turn) |
| **Published App** | Browserbase API | No (server-side) |

### In Replit IDE (Development)

- Replit Agent asks permission to see your screen
- This is a platform security feature
- Cannot be disabled or made persistent

### In Published Web App (Production)

- No Replit Agent involvement
- Monitor button → Browserbase captures external URLs
- Camera button → One-time screenshot of URLs
- No permission dialogs for end users

---

## Implementation Steps

1. Create new repo: `meowstik-docs`
2. Initialize Docusaurus: `npx create-docusaurus@latest meowstik-docs classic`
3. Copy content from `docs/` folder
4. Configure custom domain
5. Set up GitHub Actions workflow
6. Sync mechanism (optional): GitHub Action to copy updates from main repo

---

## Sync Strategy

Option A: **Manual copy** - Update docs repo when docs change

Option B: **Submodule** - Keep docs as git submodule in both repos

Option C: **Automated sync** - GitHub Action triggers on main repo docs changes

---

## Related Links

- [Docusaurus Deployment Docs](https://docusaurus.io/docs/deployment)
- [GitHub Pages Custom Domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
