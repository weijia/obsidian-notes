# obsidian-notes

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## GitHub Actions Setup

### Set up WebDAV Secrets

Install [GitHub CLI](https://cli.github.com/) and run the following commands to set up WebDAV credentials:

```sh
# Login to GitHub CLI
gh auth login


set USERNAME=weijia
set DAV_USERNAME=richard
set PASSWORD=xxx
set URL=https://xxx.teracloud.jp/dav/app_data/
set ROOT=online/obsidian-notes

# Set WebDAV secrets (replace with your actual values)
gh secret set WEBDAV_URL --repo %USERNAME%/obsidian-notes --body %URL%
gh secret set WEBDAV_USERNAME --repo %USERNAME%/obsidian-notes --body %DAV_USERNAME%
gh secret set WEBDAV_PASSWORD --repo %USERNAME%/obsidian-notes --body %PASSWORD%
```

### Automatic Deployment

The project is configured with a GitHub Action workflow that automatically deploys to WebDAV when you push to the `main` branch. The workflow file is located at `.github/workflows/webdav-publish.yml`.

Deployment target: `online/obsidian`
Build output directory: `./dist`
