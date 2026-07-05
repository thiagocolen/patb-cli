# Docusaurus Documentation Website Implementation Plan

This document outlines the detailed implementation plan for scaffolding, building, and publishing a documentation website for `patb-cli` using [Docusaurus](https://docusaurus.io/) and [GitHub Pages](https://pages.github.com/).

---

### 1. Architectural Strategy

To keep the repository clean and avoid dependency conflicts between the CLI tool and the documentation website, the website will be scaffolded in a dedicated subdirectory of the repository: `/website`.

This ensures:
- Isolation of dependencies (`package.json`, `node_modules`, etc.).
- Independent development and dependency management.
- Simplified automated builds and CI/CD triggers.

```
patb-cli/ (repository root)
├── docs/
│   └── planning/
│       └── docusaurus_plan.md (this document)
├── website/ (Docusaurus project directory)
│   ├── blog/
│   ├── docs/
│   ├── src/
│   │   ├── css/
│   │   └── pages/
│   ├── docusaurus.config.ts
│   ├── package.json
│   ├── sidebars.ts
│   └── ...
├── src/ (CLI source code)
├── package.json (CLI package.json)
└── ...
```

---

### 2. Scaffolding Step-by-Step

#### Step 2.1: Initialize Docusaurus
Run the following command at the repository root to scaffold a new Docusaurus site using TypeScript and the classic template in the `website/` directory:

```bash
npx create-docusaurus@latest website classic --typescript
```

#### Step 2.2: Standard Clean-up
Docusaurus scaffolds some default template content. To prepare the project for the actual CLI docs, perform the following clean-up within the `website/` directory:
1. Keep the standard `docs/` structure but clear out the placeholder tutorials.
2. Update the landing page `/website/src/pages/index.tsx` to point to the `patb-cli` introduction documentation.

#### Step 2.3: Root Integration (Optional but Recommended)
To allow developers to manage the documentation from the repository root, add helper scripts to the root `package.json`:

```json
"scripts": {
  "build": "tsc",
  "docs:install": "npm install --prefix website",
  "docs:start": "npm run start --prefix website",
  "docs:build": "npm run build --prefix website"
}
```

---

### 3. Local Build & Development

Within the `/website` directory, developers can run the following standard commands to develop and build the site locally:

#### Install Dependencies
```bash
cd website
npm install
```

#### Local Development Server
Starts a local development server with hot-reloading at `http://localhost:3000`:
```bash
npm run start
```

#### Production Build
Compiles the site into static HTML, CSS, and JS assets inside the `/website/build` directory:
```bash
npm run build
```

#### Preview Production Build Locally
Serves the locally built static assets at `http://localhost:3000` to verify the production build before deployment:
```bash
npm run serve
```

---

### 4. Docusaurus Configuration (`docusaurus.config.ts`)

The Docusaurus configuration must be updated to support GitHub Pages hosting. Modify `/website/docusaurus.config.ts` with the following deployment and branding parameters:

```typescript
import {themes as prismeThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';

const config: Config = {
  title: 'Pinky and the Brain CLI',
  tagline: 'Interactive CLI and Zed ACP Bridge for Pinky and the Brain remote service',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://thiagocolen.github.io',
  // Set the /<projectName>/ path for GitHub pages
  baseUrl: '/patb-cli/',

  // GitHub pages deployment config.
  organizationName: 'thiagocolen', // Usually your GitHub org/user name.
  projectName: 'patb-cli', // Usually your repo name.
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/thiagocolen/patb-cli/edit/main/website/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: 'all',
            copyright: `Copyright © ${new Date().getFullYear()} thiagocolen.`,
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'patb-cli',
      logo: {
        alt: 'patb-cli Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/thiagocolen/patb-cli',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/thiagocolen/patb-cli/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} thiagocolen. Built with Docusaurus.`,
    },
    prism: {
      theme: prismeThemes.github,
      darkTheme: prismeThemes.dracula,
    },
  },
};

export default config;
```

---

### 5. Automated Build & Publish with GitHub Actions

To completely automate the build and deploy process, we will set up a GitHub Actions workflow that executes whenever a change is pushed to the `main` branch.

Create a workflow file at `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches:
      - main
    paths:
      - 'website/**'
      - '.github/workflows/deploy-docs.yml'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  deploy:
    name: Build and Deploy to GitHub Pages
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: website/package-lock.json

      - name: Install Dependencies
        run: |
          cd website
          npm ci

      - name: Build Docusaurus Website
        run: |
          cd website
          npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website/build
          publish_branch: gh-pages
          user_name: 'github-actions[bot]'
          user_email: 'github-actions[bot]@users.noreply.github.com'
```

---

### 6. GitHub Repository Setup Settings

Once the planning is approved and code is merged into `main`, complete the following settings in the repository settings panel on GitHub:

1. **Pages Configuration**:
   - Go to **Settings** > **Pages** (under Code and automation).
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Under **Branch**, select `gh-pages` and folder `/ (root)`. Click **Save**.
2. **HTTPS**:
   - Ensure **Enforce HTTPS** is checked once the custom domain / default domain is configured.
3. **Workflow Permissions**:
   - Go to **Settings** > **Actions** > **General**.
   - Under **Workflow permissions**, ensure **Read and write permissions** is selected to allow the GitHub Actions bot to write to the `gh-pages` branch.
