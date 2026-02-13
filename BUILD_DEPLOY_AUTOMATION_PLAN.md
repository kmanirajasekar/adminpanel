# Project Overview

## Repository Summary
- Monorepo with two deployable applications:
  - `client/`: Vue 3 SPA built with Vite 4 and served by NGINX in containerized production.
  - `server/`: ASP.NET Core Web API (.NET 8) with Clean Architecture layers and PostgreSQL persistence.
- Root orchestration file: `docker-compose.yml` (client, API, PostgreSQL, pgAdmin).
- Test projects under `server/tests`:
  - `Application.Tests.Unit` (xUnit + FakeItEasy).
  - `WebApi.Tests.Integration` (xUnit + Testcontainers.PostgreSql + ASP.NET test host).

## Technology and Version Baseline
- Frontend
  - Framework: Vue `3.3.4`
  - Build tool: Vite `4.5.2`
  - Router: Vue Router `4.2.4`
  - HTTP: Axios `1.6.0`
  - Node runtime recommendation for CI: Node 20 LTS
- Backend
  - Target framework: `.NET 8.0` (`net8.0`)
  - EF Core: `8.0.0`
  - Auth: JWT Bearer
  - DB provider: PostgreSQL via Npgsql EF provider
  - API/ORM related package baseline:
    - `Microsoft.AspNetCore.Authentication.JwtBearer` `8.0.0`
    - `Microsoft.AspNetCore.OpenApi` `8.0.0`
    - `Npgsql.EntityFrameworkCore.PostgreSQL` `8.0.0`
    - `Swashbuckle.AspNetCore` `6.6.2`
- Database
  - PostgreSQL (compose image: `postgres`, README indicates v15)

## Configuration Surface
- Backend config files
  - `server/src/WebApi/appsettings.json`
  - `server/src/WebApi/appsettings.Development.json`
  - `server/src/WebApi/Properties/launchSettings.json`
- Frontend config files
  - `client/vite.config.js`
  - `client/src/axiosDefaults.js` (API base URL currently localhost-based)
- Container/deployment files
  - `docker-compose.yml`
  - `client/Dockerfile`
  - `server/Dockerfile`
  - `client/nginx.conf`

## Existing CI/CD Assets
- No first-party CI/CD workflows found in repository:
  - No `.github/workflows/*`
  - No `azure-pipelines.yml`
- Current project has build/test tooling but no automated pipeline wiring in-repo.

# Current Build & Run Process

## Required Tools (Current State)
- Git
- Node.js + npm (Node 20 LTS recommended)
- .NET SDK 8.0.x
- PostgreSQL (local) OR Docker Desktop for compose-based DB
- Optional: `dotnet-ef` CLI for migration commands

## Local Run Path A (Docker Compose)
1. Install and start Docker Desktop.
2. From repo root: `docker compose up --build -d`
3. Endpoints:
   - Frontend: `http://localhost:8080`
   - API: `http://localhost:5000`
   - pgAdmin: `http://localhost:8000`
4. Shutdown: `docker compose down`

## Local Run Path B (Native Local Services)
1. Backend restore/build:
   - `dotnet restore server/Portfolio.sln --source https://api.nuget.org/v3/index.json`
   - `dotnet build server/src/WebApi/WebApi.csproj --no-restore`
2. Frontend install/build:
   - `cd client && npm install`
   - `npm run dev -- --host --port 8080`
3. Database requirements:
   - PostgreSQL running and reachable.
   - Connection string aligned with backend config.
4. Backend run:
   - `dotnet run --project server/src/WebApi/WebApi.csproj --urls http://localhost:5000`

## Test Execution (Current)
- Unit tests:
  - `dotnet test server/tests/Application.Tests.Unit/Application.Tests.Unit.csproj`
- Integration tests:
  - `dotnet test server/tests/WebApi.Tests.Integration/WebApi.Tests.Integration.csproj`
- Frontend tests:
  - No test framework/scripts currently configured.

# Identified Gaps / Risks

## Build and Dependency Risks
- Backend is on `.NET 8` (LTS), reducing prior runtime EOL risk.
- No `global.json` to pin SDK version deterministically in CI/dev.
- Machine-level private NuGet feeds can break restore unexpectedly.
- Integration test execution depends on Docker/Testcontainers availability in CI runners and dev machines.

## Security Risks
- Secrets and credentials are hardcoded in repo (`appsettings.json`, `docker-compose.yml`).
- Default admin credentials are seeded in DB migrations.
- JWT key is static/sample and not environment-secure.
- Password handling in domain currently indicates plaintext storage pattern (high risk for production).

## Release Engineering Gaps
- No CI workflow, no CD workflow, no environment promotion gates.
- No artifact versioning policy enforced.
- No SBOM/signing/container vulnerability scanning gates.
- No IaC pipeline for environment provisioning.

## Observability and Operability Gaps
- No structured centralized logging strategy described.
- No production health probe/readiness strategy documented for deployment platform.
- No rollback/runbook automation.

## Frontend Delivery Gaps
- API URL is environment-coupled to localhost patterns; cloud promotion needs runtime-config strategy.
- No E2E smoke tests validating login-critical flow in CI/CD.

# Step-by-Step Automation Plan

## Phase 1: Standardize Build Inputs
1. Add `global.json` to pin .NET SDK 8.x (migration to .NET 8 is already completed).
2. Add repository-local `nuget.config` with approved package sources only.
3. Add `.nvmrc` or `engines` policy for Node 20 LTS.
4. Define branch strategy (`main`, `develop`, `release/*`, `hotfix/*`) and PR protection.

## Phase 2: Harden Configuration and Secrets
1. Replace hardcoded secrets with environment variables.
2. Adopt Azure Key Vault for runtime secrets:
   - DB connection strings
   - JWT signing keys
   - admin bootstrap credentials
3. Split app settings by environment (Development/Test/Staging/Production) with non-secret defaults only.
4. Add secret scanning (GitHub Advanced Security or equivalent).

## Phase 3: Container and Artifact Strategy
1. Keep multi-stage Dockerfiles, add explicit immutable base image tags.
2. Build and publish two OCI images per commit:
   - `ghcr.io/<org>/adminpanel-client:<sha>`
   - `ghcr.io/<org>/adminpanel-api:<sha>`
3. Generate SBOM and image provenance (SLSA-aware where possible).
4. Run image vulnerability scans (Trivy/Defender) and fail on defined severity thresholds.

## Phase 4: Automated Testing Gate
1. Backend CI gates:
   - restore/build/test unit
   - integration tests (Testcontainers)
   - coverage report publication
2. Frontend CI gates:
   - `npm ci`
   - lint (`npm run lint`)
   - build (`npm run build`)
   - add Vitest + Playwright smoke suite (recommended)
3. Enforce status checks before merge.

## Phase 5: Infrastructure and Environment Promotion
1. Target Azure runtime (recommended):
   - Azure Container Apps (or AKS for higher control)
   - Azure Database for PostgreSQL Flexible Server
   - Azure Container Registry (ACR)
   - Azure Key Vault
2. Provision via IaC (Bicep/Terraform), including identities and RBAC.
3. Define environments: `dev` -> `staging` -> `prod` with approvals.

## Phase 6: Deployment Automation and Reliability
1. Use blue/green or canary rollout for API and frontend containers.
2. Configure readiness/liveness probes and deployment health checks.
3. Run post-deploy smoke tests (login + key API endpoints).
4. Auto-rollback on probe or smoke test failure.

# CI Pipeline Design

## Platform Recommendation
- Primary: GitHub Actions (source-native), integrated with Azure via OIDC federated credentials.
- Alternative: Azure DevOps pipelines if organization standard mandates it.

## Proposed GitHub Actions Workflows
1. `ci-pr.yml` (on PR)
   - Backend restore/build/test
   - Frontend install/lint/build
   - SAST + dependency scan
   - Optional: lightweight container build validation
2. `ci-main.yml` (on merge to main)
   - Full test matrix
   - Build container images
   - SBOM + vulnerability scan
   - Push signed images to ACR/GHCR
   - Publish artifacts/metadata (commit SHA, semver, changelog)
3. `release.yml` (tag-triggered)
   - Promote immutable images
   - Generate release notes
   - Trigger staged deployment workflow

## CI Quality Gates
- Required:
  - Unit + integration tests pass
  - Frontend lint/build pass
  - No critical/high vulnerabilities (policy-based)
  - Secret scan clean
- Optional advanced gates:
  - Minimum coverage threshold
  - Contract tests between SPA and API

# CD / Deployment Strategy

## Target Azure Reference Architecture
- Runtime: Azure Container Apps (client + API)
- Registry: Azure Container Registry
- Data: Azure PostgreSQL Flexible Server
- Secrets: Azure Key Vault
- Monitoring: Azure Monitor + Application Insights + Log Analytics

## Deployment Flow
1. Deploy to `dev` automatically from `main`.
2. Execute smoke tests.
3. Promote same immutable image digest to `staging` with approval.
4. Run integration + synthetic checks.
5. Promote to `prod` with manual approval and change window policy.

## Zero-Downtime Approach
- API:
  - Blue/green or canary with weighted traffic shifting.
  - Health probes + automatic rollback.
- Frontend:
  - Versioned static assets with cache-busting.
  - Atomic container revision swap.

## Database Change Strategy
- Use EF migrations in controlled deployment stage.
- Backward-compatible schema first, app switch second, cleanup later (expand/contract).
- Pre-deployment backup + rollback runbook.

# Recommended Tools & Scripts

## Recommended Tooling
- CI/CD: GitHub Actions + environments + required reviewers
- Cloud auth: OIDC federated credentials (no long-lived secrets in CI)
- IaC: Bicep or Terraform
- Security: CodeQL, Dependabot, Trivy/Defender, secret scanning
- Release: semantic-release or GitVersion for SemVer automation
- Observability: OpenTelemetry + App Insights exporters

## Script Recommendations (to add)
- Root `Makefile` or `taskfile.yml` with standardized commands:
  - `task restore`
  - `task build`
  - `task test`
  - `task test-integration`
  - `task lint`
  - `task image-build`
  - `task image-scan`
  - `task deploy-dev`
- Backend helper scripts:
  - migration apply script with environment checks
- Frontend helper scripts:
  - runtime env generation for API base URL (non-hardcoded localhost)

## Versioning Strategy
- Use SemVer with immutable image tags:
  - `vMAJOR.MINOR.PATCH`
  - `sha-<shortsha>`
- Keep both tags on each image to support traceability and rollback.

# Final Checklist for Implementation

## Foundation
- [ ] Add `global.json` and repository `nuget.config`
- [ ] Define branching, PR policy, and CODEOWNERS
- [ ] Add issue/PR templates and change management checks

## Security
- [ ] Remove hardcoded secrets and credentials from tracked config
- [ ] Integrate Azure Key Vault + managed identity
- [ ] Enable secret scanning and dependency alerts
- [ ] Rotate seeded/default credentials and enforce password hashing policy

## CI
- [ ] Create `ci-pr.yml` and `ci-main.yml`
- [ ] Add backend unit/integration tests to pipeline
- [ ] Add frontend lint/build and smoke tests
- [ ] Add artifact signing, SBOM, and vulnerability scan gates

## CD
- [ ] Provision Azure resources with IaC
- [ ] Create staged environments (dev/staging/prod)
- [ ] Implement blue/green or canary deployment
- [ ] Add automated smoke tests + rollback criteria

## Operations
- [ ] Configure health probes and dashboards
- [ ] Centralize logs and alerts (SLO-driven)
- [ ] Document runbooks (incident response, rollback, DB migration failure)
- [ ] Perform production readiness review and DR test
