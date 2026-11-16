# Contributing to Team-no-9

Thank you for contributing to Team-no-9! This guide explains how to make changes, test your work, and submit contributions through GitHub.

## 1. Getting Started

1. Fork or clone the repository.
2. Open the project in your preferred code editor.
3. Install the required dependencies for the area you want to work on.

For the backend:

```bash
cd backend
npm ci
```

For the frontend:

```bash
cd frontend
npm ci
```

## 2. Create a Branch

Always create a separate branch for your work. Avoid making changes directly on `main`.

First, update your local main branch:

```bash
git switch main
git pull origin main
```

Create a new branch:

```bash
git switch -c docs/your-change-description
```

Suggested branch naming conventions:

- `docs/` – Documentation changes
- `fix/` – Bug fixes
- `feature/` – New features
- `test/` – Testing improvements

Examples:

```text
docs/update-readme
fix/login-validation
feature/asset-management
test/frontend-unit-tests
```

## 3. Make Your Changes

- Keep changes focused on one task whenever possible.
- Follow the existing project structure and coding conventions.
- Avoid modifying unrelated files.
- Add or update tests when changing application functionality.
- Never commit passwords, API keys, tokens, or other secrets.

## 4. Run Tests Before Submitting

### Backend

From the backend directory:

```bash
npm ci
npm test
```

Check JavaScript syntax:

```bash
node --check src/app.js
node --check src/config/db.js
```

### Frontend

From the frontend directory:

```bash
npm ci
npm test
npm run build
npm run lint
```

For frontend browser tests, see the instructions in `frontend/README.md`.

## 5. Commit Your Changes

Review your changes:

```bash
git status
git diff --check
git diff
```

Stage the files you intend to commit:

```bash
git add <file-name>
```

Create a meaningful commit:

```bash
git commit -m "Add a clear description of the change"
```

Examples:

```bash
git commit -m "Improve frontend testing documentation"
git commit -m "Fix asset validation"
git commit -m "Add backend API tests"
```

## 6. Push Your Branch

Push your branch to GitHub:

```bash
git push -u origin <branch-name>
```

Replace `<branch-name>` with your actual branch name.

## 7. Create a Pull Request

1. Open the repository on GitHub.
2. Select the option to create a Pull Request.
3. Set the base branch to `main`.
4. Select your contribution branch as the compare branch.
5. Provide a clear title and description.
6. Explain what changed and how you tested it.
7. Submit the Pull Request.

Before merging, review the changes and address any requested updates.

## 8. Continuous Integration Checks

The repository uses GitHub Actions to validate contributions.

The current CI workflow checks:

- Required project documents are present.
- Backend JavaScript syntax.
- Backend database configuration syntax.
- Backend API tests.
- Frontend unit tests.
- Frontend production build.

Make sure the applicable checks pass before requesting a merge.

## 9. Files That Must Not Be Committed

Do not commit local configuration, secrets, generated files, or dependencies.

The repository's `.gitignore` excludes:

- `.env` and other environment files (except `.env.example`)
- `node_modules/`
- `frontend/dist/`
- Log files (`*.log`)
- Local TLS certificates and keys (`certs/`, `*.pem`, `*.key`)

Keep `.env.example` updated when new environment variables are required, but never include real credentials.

## 10. Pull Request Checklist

Before submitting a Pull Request, confirm:

- [ ] Changes are made on a separate branch.
- [ ] Only relevant files are modified.
- [ ] No passwords, secrets, or local configuration files are committed.
- [ ] Tests relevant to the changes have been run.
- [ ] `git diff --check` passes.
- [ ] Commit messages clearly describe the changes.
- [ ] Pull Request targets the `main` branch.
- [ ] Pull Request description explains the changes and testing performed.

## 11. Questions and Issues

If you find a bug or need clarification, open an issue in the GitHub repository with a clear description and relevant details.

Thank you for contributing to Team-no-9!