# Documentation Site

> How the docs system works (frontend and backend)

---

## Overview

The Meowstik documentation system consists of:

1. **Frontend** - React-based docs viewer at `/docs`
2. **Backend** - Markdown files in `/docs` directory
3. **Index** - Organized navigation in `docs/ragent/INDEX.md`

---

## Frontend: Docs Viewer

### Location

`client/src/pages/docs.tsx`

### How It Works

```
1. User visits /docs or /docs/:slug
2. React component loads
3. Fetch available docs from file system
4. Parse and render markdown
5. Apply syntax highlighting
6. Generate table of contents
```

### Features

| Feature | Description |
|---------|-------------|
| **Markdown Rendering** | Full GFM (GitHub Flavored Markdown) support |
| **Syntax Highlighting** | Code blocks with language detection |
| **Table of Contents** | Auto-generated from headings |
| **Category Navigation** | Organized by topic |
| **Search** | Quick search across all docs |
| **Dark Mode** | Follows system theme |
| **Responsive** | Works on mobile and desktop |

### Route Structure

```
/docs                    → Index page (all categories)
/docs/ragent-index       → Agent documentation index
/docs/agent-configuration → Specific doc page
/docs/SYSTEM_OVERVIEW    → System architecture
```

### Adding a New Doc

1. Create markdown file in `/docs/` or `/docs/ragent/`
2. Add frontmatter (optional):
   ```yaml
   ---
   title: My New Doc
   category: ragent
   order: 5
   ---
   ```
3. Add link to `docs/ragent/INDEX.md` if in ragent category
4. Doc is automatically available at `/docs/filename`

---

## Backend: File Structure

### Directory Layout

```
docs/
├── ragent/                    # Agent documentation
│   ├── INDEX.md               # Navigation hub
│   ├── agent-configuration.md # Behavior settings
│   ├── job-orchestration.md   # Job queue system
│   ├── collaborative-editing.md
│   ├── browser-computer-use.md
│   ├── install-browser-extension.md
│   ├── install-desktop-agent.md
│   ├── scheduler.md
│   └── docs-site.md           # This file
├── v2-roadmap/                # Development roadmap
│   └── MASTER-ROADMAP.md
├── 01-database-schemas.md     # Technical docs
├── 02-ui-architecture.md
├── 03-prompt-lifecycle.md
├── 05-tool-call-schema.md
├── RAG_PIPELINE.md
└── SYSTEM_OVERVIEW.md
```

### Categories

| Category | Path | Description |
|----------|------|-------------|
| Agent (Ragent) | `/docs/ragent/` | Agent configuration and features |
| System | `/docs/` | Technical architecture |
| Roadmap | `/docs/v2-roadmap/` | Development plans |

---

## Writing Documentation

### Markdown Syntax

All standard Markdown is supported:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold** and *italic* text

- Bullet list
- Another item

1. Numbered list
2. Another item

`inline code`

\`\`\`typescript
// Code block with syntax highlighting
const x = 1;
\`\`\`

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |

[Link text](./other-doc.md)
```

### Extended Features

#### Callouts

```markdown
> **Note:** This is important information.

> **Warning:** Be careful with this.

> **Tip:** Try this helpful trick.
```

#### Tables with Alignment

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| L    |   C    |     R |
```

#### Task Lists

```markdown
- [x] Completed task
- [ ] Pending task
```

### Internal Links

Link to other docs using relative paths:

```markdown
See [Agent Configuration](./agent-configuration.md) for more.
```

Link to app pages:

```markdown
Visit [/collaborate](/collaborate) to start a session.
```

---

## API Endpoints

### List Docs

```
GET /api/docs

Response: {
  categories: [
    {
      name: "Agent (Ragent)",
      docs: [
        { slug: "agent-configuration", title: "Agent Configuration" },
        ...
      ]
    },
    ...
  ]
}
```

### Get Doc Content

```
GET /api/docs/:slug

Response: {
  slug: "agent-configuration",
  title: "Agent Configuration",
  content: "# Agent Configuration\n\n...",
  category: "ragent"
}
```

---

## Contributing Docs

### Style Guidelines

1. **Clear headings** - Use descriptive H2 and H3 headings
2. **Tables for data** - Prefer tables over long lists
3. **Code examples** - Include practical examples
4. **Cross-links** - Link to related documentation
5. **Keep updated** - Update docs when features change

### Template

```markdown
# Feature Name

> One-line description of the feature

---

## Overview

Brief explanation of what this feature does and why it exists.

---

## How It Works

Technical explanation with diagrams if helpful.

---

## Usage

### Basic Usage

Code examples and step-by-step instructions.

### Advanced Usage

More complex scenarios.

---

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| ...    | ...  | ...     | ...         |

---

## Related Documentation

- [Related Doc 1](./related.md)
- [Related Doc 2](./other.md)
- [Ragent Index](./INDEX.md)
```

---

## Related Documentation

- [Agent Configuration](./agent-configuration.md) - Behavior settings
- [Job Orchestration](./job-orchestration.md) - Background processing
- [System Overview](/docs/SYSTEM_OVERVIEW) - Full architecture
- [Ragent Index](./INDEX.md) - All agent documentation
