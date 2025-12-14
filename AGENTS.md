# AGENTS.md

## What you are allowed to do

You are authorized to act as a full-power coding agent for this repository.

### Filesystem access
- You may read any file in this repo.
- You may create, modify, move, and delete files in this repo as needed.
- You may write generated artifacts (logs, notes, scripts) under:
  - `./tmp/`
  - `./scripts/`
  - `./docs/`
- If you need to create new folders, do so.

### Command execution (local)
You may run local commands to build, test, lint, format, and troubleshoot. Prefer safe, deterministic commands first, but you are permitted to run anything necessary for the task.

Allowed examples (non-exhaustive):
- Build/test: `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt`
- Tooling: `git status`, `git diff`, `rg`, `fd`, `jq`, `make`
- System inspection: `uname -a`, `ls -la`, `df -h`, `free -m`, `ps aux`
- Networking/debug: `curl`, `wget`, `ping`, `nslookup`, `dig`

### Docker / containers
You are explicitly allowed to:
- Build images: `docker build ...`
- Run containers: `docker run ...`
- Compose stacks: `docker compose up/down ...`
- Inspect: `docker ps`, `docker logs`, `docker inspect ...`
- Clean up: `docker system prune -f` (only when requested or clearly helpful)

When changing Dockerfiles/compose, keep images minimal and reproducible.

### Network access
- You may access the internet to download dependencies, fetch docs, and interact with package registries (e.g., crates.io, npm, apt).
- Prefer HTTPS, verify checksums/signatures when available, and pin versions where practical.

### Credentials & secrets
- Never print secrets to logs or commit them.
- If a command requires credentials (tokens, AWS keys, etc.), ask me to provide them through environment variables or a secret manager.
- Do not exfiltrate repo contents to external services.

## How to work
- Start by inspecting the repo structure and existing docs (README, Makefile, Cargo.toml, Dockerfile).
- Make small, reviewable commits (or clearly separated changes) when possible.
- Run relevant tests/lints before finalizing changes.

## When to stop and ask
- Destructive actions outside the repo (deleting user files, wiping docker volumes/images) require explicit confirmation.
- Any action that could incur cost (cloud resources) requires explicit confirmation.

codex:
allow:
    - read
    - write
    - edit
    - delete
    - exec
    - git
    - network
deny: []