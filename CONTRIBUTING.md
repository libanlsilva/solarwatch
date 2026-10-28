# Contributing

SolarWatch uses a lightweight branch and pull request workflow. Read the [development plan](docs/DEVELOPMENT_PLAN.md) before starting a feature, and keep each change aligned with the current phase.

## Scope and branches

- Start from current `main` and create a short-lived branch for one outcome, such as `docs/mvp-requirements`, `feat/measurement-validation`, or `fix/telemetry-timestamps`.
- Define the problem and acceptance criteria before implementing behavior. Use an issue for features, bugs, or decisions that need tracking; small documentation corrections can go directly to a pull request.
- Preserve the backend dependency direction described in the README. Add dependencies and abstractions only when the current use case justifies them.
- Record significant tradeoffs in `docs/architecture/`, close to the work that requires the decision.

## Commits

Use English messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
docs: define MVP acceptance criteria
feat(domain): validate battery state of charge
fix(api): reject invalid measurement timestamps
ci: validate frontend production builds
```

These are examples of message format, not existing functionality. Each commit should describe one coherent change, including the tests needed to verify it. There is no target number of commits. Preserve published history and use follow-up commits for corrections.

## Validation

For backend changes, from the repository root:

```sh
dotnet restore backend/src/SolarWatch.slnx
dotnet build backend/src/SolarWatch.slnx --configuration Release --no-restore
dotnet test backend/src/SolarWatch.slnx --configuration Release --no-build --no-restore
```

For frontend changes:

```sh
cd frontend
npm ci
npm run lint
npm run build
```

Add meaningful tests when introducing behavior, including failure cases. Frontend automated tests are not configured yet. Existing backend template tests are not evidence of business coverage.

For documentation-only changes, check links, consistency, and the diff. The configured CI still runs on pull requests to `main`. Test Docker or database setup changes with the affected tooling once those services are configured.

## Pull requests and review

Use the pull request template to explain the problem, resulting behavior, and validation. Link the issue when one exists. Open a draft for work that is still being discussed; mark it ready when its acceptance criteria and relevant checks are satisfied.

Review the complete diff and CI results before merging into `main`. For solo work, record real self-review and verification; external approval is not required by this guide. Keep meaningful commits when merging. Remove completed remote feature branches after merging, without rewriting published `main` history.

Before committing, inspect staged files and exclude dependencies, build outputs, machine-specific configuration, credentials, and private keys. Use user secrets or ignored local configuration for credentials. Document sanitized examples only.

The branch workflow follows [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow).
