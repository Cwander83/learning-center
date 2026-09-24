# The Complete Guide: Containers & Dev Environments on Apple Silicon

> **On a Mac, a "container" is a Linux VM wearing a very good disguise.** Understand that one fact and everything else — performance, networking, memory, licensing — stops being mysterious.

**Last verified: September 2026**
**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Every tutorial you've read says containers are "lightweight because they share the host kernel." That is true on Linux. It is **not** true on macOS, because macOS has no Linux kernel to share. So on your MacBook, a container is a process inside a small Linux virtual machine — and that VM is the real thing you're configuring, paying for, and occasionally cursing at.

```text
┌──────────────────────────────── macOS host (M5 Pro, 24 GB unified memory) ─────────────────────────────┐
│                                                                                                        │
│   Terminal / VS Code / your agent                                                                      │
│        │  docker / podman / container / orb CLI                                                        │
│        ▼                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐             │
│  │  CONTAINER RUNTIME + its Linux VM                                                    │             │
│  │  (Docker Desktop · OrbStack · Colima · Podman · Apple container)                      │             │
│  │                                                                                       │             │
│  │     ┌───────────┐   ┌───────────┐   ┌───────────┐                                    │             │
│  │     │ container │   │ container │   │ container │     ← your Postgres, your Node app, │             │
│  │     │ postgres  │   │  node/next│   │   agent   │       your sandboxed AI agent       │             │
│  │     └───────────┘   └───────────┘   └───────────┘                                    │             │
│  │           ▲ volumes (named)    ▲ bind mount to ~/code (shared, slower)               │             │
│  └──────────────────────────────────────────────────────────────────────────────────────┘             │
│                                                                                                        │
│   Apple `container` differs: 1 micro-VM PER CONTAINER, no shared VM, no daemon.                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Two consequences you will feel immediately:

1. **Every runtime is a different VM implementation**, so "which runtime" is a real decision with real tradeoffs — not a cosmetic choice.
2. **Files crossing the host↔VM boundary are slow-ish**, which is why `node_modules` placement matters more on a Mac than on Linux.

| Concept | Plain-English analogy |
|---|---|
| Image | A recipe + a sealed lunchbox of ingredients |
| Container | A meal cooked from that lunchbox — running, disposable |
| VM | The kitchen the meal is cooked in |
| Volume (named) | A pantry the kitchen owns; survives the meal |
| Bind mount | Reaching through a hatch into your own fridge (`~/code`) |
| Dockerfile | The recipe card |
| Compose file | A menu describing several dishes served together |
| Registry | The grocery store (Docker Hub, GHCR) |
| Runtime | Which kitchen you rented |

> **The single most important Mac fact:** because each runtime is a VM, "Docker is using 4 GB of RAM" is really "the Linux VM is using 4 GB." That is why runtime choice on a 24 GB machine is a memory decision, not a taste decision.

---

## The 60-Second Version (TL;DR)

1. **Learn the model** (below). A container is a thin Linux process; on macOS it rides inside a VM.
2. **Pick a runtime.** On your M5 Pro: **OrbStack** for speed and low RAM (paid for commercial use), **Colima** if you want free/MIT and don't need a GUI, **Docker Desktop** if a team standard demands it, **Apple `container`** if you want no daemon and are on macOS 26.
3. **Install one**, run `hello`, then run **Postgres with pgvector** via Compose.
4. **Use VS Code Dev Containers** for the "clone the repo, run it exactly the same" story.
5. **Sandbox your AI agents** in ephemeral containers with read-only mounts — this is the payoff.
6. **Know the budget:** give the VM **6–10 GB** on a 24 GB Mac. Not more.
7. **Clean up** with targeted commands, never a blind `prune -a`.

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| macOS on Apple Silicon | All of this assumes arm64 | `uname -m` → `arm64` |
| Homebrew | Installs runtimes and the CLI | `brew --version` |
| ~20+ GB free disk | Images and VMs are hungry | `df -h /` |
| macOS 26 (for Apple `container`) | Full networking features need it | `sw_vers` |
| VS Code + Dev Containers extension | The dev-environment story | Extensions → "Dev Containers" |
| 24 GB unified memory | You have it; the budget section allocates it | About This Mac |

> **Apple Silicon floor:** everything in this paper is arm64-native. Anything that says "Windows (WSL 2)" does not apply to you. When you see `--platform linux/amd64` in a tutorial, that is emulation and it will be slow — avoid it unless a dependency forces it.

---

## Part 1 — The Mental Model You Actually Need

**Image vs container.** An image is an immutable filesystem plus metadata. A container is a running process with a writable layer on top. Delete the container and the image remains; that's why `docker run` is cheap the second time.

**Layers and caching.** Images are built in layers. Change one `RUN` line and only that layer and those after it rebuild. This is why **order matters in a Dockerfile**: copy your lockfile and install dependencies *before* copying source, so editing code doesn't reinstall everything.

**Volume vs bind mount.**

| | Named volume | Bind mount |
|---|---|---|
| Looks like | `pgdata:/var/lib/postgresql/data` | `./app:/app` |
| Managed by | The runtime | You, on the Mac filesystem |
| Speed on macOS | Fast (lives inside the VM) | Slower (crosses the boundary) |
| Use it for | Databases, caches | Source code you're editing |

**Networking.** Containers get their own network namespace. Two facts that solve most confusion:

- Containers reach **each other** by service name in Compose (`db:5432`), not `localhost`.
- Containers reach **your Mac** at a special hostname; on Docker Desktop and OrbStack that's `host.docker.internal`.

**Lifecycle.** `run` → `stop` → `start` → `rm`. A stopped container is still on disk using space. `docker ps -a` shows them; `docker ps` does not.

> **The "it works on Linux" trap:** on Linux you can `--network host` and share the host's networking directly. On macOS, `host.docker.internal` is the portable answer. Tutorials written for Linux servers routinely skip this.

---

## Part 2 — Choosing a Runtime on Apple Silicon

This is the decision that shapes your next year, so here is the honest table. All figures are from benchmarks and vendor pages read in September 2026; treat them as directional, not gospel.

| Runtime | License / cost | Idle RAM | Startup | GUI | Compose | Best for |
|---|---|---|---|---|---|---|
| **Docker Desktop** | Paid for orgs ≥250 employees **and** ≥$10M revenue; free below that | ~600 MB–2 GB (improved by Resource Saver Mode) | Seconds to ~a minute on cold start | Yes | Yes | Team standard, Docker Scout/Build Cloud |
| **OrbStack** | **Free for personal use**; ~$8/user/mo Pro; Teams tier | ~150–500 MB | ~2–5 s | Yes | Yes | Fastest, lightest daily driver on Apple Silicon |
| **Colima** | **Free, MIT, no restrictions** | ~200–600 MB | ~5 s | No (CLI) | Yes | Free/OSS, automation, CI, corporate policy |
| **Podman** | Free, Apache-2.0 | ~80–200 MB | Fast | Podman Desktop optional | Yes | Rootless/daemonless security posture |
| **Apple `container`** | Free, Apache-2.0 | 1 micro-VM per container | Fast | No (CLI) | **No native Compose** | No daemon, strong isolation, macOS 26 |

**The benchmark picture (April 2026, 16 GB M-series, 4 CPU / 4 GB fairness limits):** volume write throughput roughly doubled across all runtimes; OrbStack led on container-to-container throughput (~130 Gbps) and volume-read speed; Colima was fastest to start and is fully free. Apple `container` (0.11.0 at benchmark time) is a different architecture — one VM per container — which is more isolated but heavier per container.

### Pick one

- **You want the best daily experience on a personal Mac → OrbStack.** It is free for personal use, boots in seconds, and idles at a fraction of Docker Desktop's memory. This is the recommendation for your machine.
- **You want free-no-matter-what (or you'll use this commercially without paying) → Colima.** MIT, scriptable, no GUI. Config lives in `~/.colima/default/colima.yaml`.
- **A client or team mandates Docker → Docker Desktop.** Check the license threshold honestly before installing it at work.
- **You want maximum isolation and no background daemon → Apple `container`.** But read the limits below first.

### Apple `container`, honestly

Apple shipped **1.0 on 9 June 2026** (a year after the WWDC 2025 introduction); releases are product-versioned, not semver, and a 1.4.x line existed by September 2026. It is written in Swift, optimized for Apple Silicon, OCI-compatible (so Docker Hub images work unchanged), and runs **each container in its own lightweight micro-VM** with no system-wide daemon.

Install and first run, per Apple's docs:

```bash
# Install via the signed package from the apple/container releases page,
# then start the system service:
container system start

# First container — pulls alpine, runs it in a lightweight VM, removes it
container run --rm alpine echo hello
```

Known limits as of September 2026:

- **No native Docker Compose.** Third-party bridges exist but are not official.
- **Dev Container support is incomplete** — networking issues, setup scripts not fully supported.
- **macOS 26 is the supported target.** It may run on macOS 15, but issues not reproducible on macOS 26 are typically not fixed.
- **Apple Silicon only.** No Intel Macs.
- Default resources are deliberately small: containers get roughly **1 GB RAM / 4 CPUs**, and the builder VM about **2 GB / 2 CPUs** — worth knowing before you wonder why a build is slow.
- Config moved to a TOML file at `~/.config/container/config.toml`.

> **Verdict for you:** Apple `container` is genuinely interesting and improving fast, but the missing Compose and shaky devcontainer support mean it is not your daily driver yet if you want Dev Containers in VS Code. Watch it; don't build on it this month.

---

## Part 3 — Install and Your First Container

Assuming OrbStack as the daily driver (substitute the Colima or Docker lines if you chose otherwise):

```bash
# OrbStack (recommended: fast, low RAM, free for personal use)
brew install --cask orbstack

# --- or Colima (fully free, CLI only) ---
brew install colima docker docker-compose
colima start --cpu 4 --memory 8 --disk 60 --vm-type vz

# --- or Docker Desktop ---
brew install --cask docker
```

Verify, then run something:

```bash
docker version
docker run --rm hello-world
docker run --rm -it alpine sh -c 'uname -a'   # note: a REAL Linux kernel
```

That last command is the whole lesson. You asked a Mac for `uname -a` and got a Linux kernel, because you were inside a VM the whole time. `--rm` deletes the container when it exits; the image stays cached.

**Colima lifecycle** (worth memorizing, it's your free option):

```bash
colima status
colima list
colima stop
colima start
colima delete          # destroys the VM and its containers
```

> **Colima tip:** `--vm-type vz` uses Apple's Virtualization.framework (faster, lower overhead) instead of QEMU. On an M-series Mac, use it.

---

## Part 4 — Images and the Build Loop

A minimal multi-stage Dockerfile for a Node/Next app, ordered for cache efficiency:

```dockerfile
# syntax=docker/dockerfile:1

########## deps ##########
FROM node:22-alpine AS deps
WORKDIR /app
# Copy ONLY manifests first → this layer is cached until deps change
COPY package.json package-lock.json ./
RUN npm ci

########## builder ##########
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

########## runner ##########
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# .dockerignore — the single biggest build-speed win
node_modules
.next
.git
.env*
*.log
```

Build and inspect:

```bash
docker build -t myapp:dev .
docker images
docker history myapp:dev
docker buildx build --platform linux/arm64 -t myapp:arm64 .
```

> **Why `node_modules` never goes in `.dockerignore` for a *build*:** you want it excluded from the build *context* (so uploads are fast) but recreated inside the image by `npm ci`. The Dockerfile above does exactly that.

**arm64 vs amd64.** Your M5 wants `linux/arm64` images. If an image is only published for `amd64`, you'll be emulating — slow and occasionally broken. Fixes, in order of preference: (1) find an arm64 image, (2) build your own multi-stage image on arm64, (3) last resort, enable Rosetta emulation in your runtime settings.

---

## Part 5 — Postgres With pgvector, Locally

Since your SaaS plan already leans on pgvector (Paper 3), run it locally in a container. `pgvector` publishes an official image — always confirm the tag on the registry before pinning it.

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg17
    container_name: saas-db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: saas_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d saas_dev"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose ps
docker compose logs -f db

# connect without installing anything locally
docker compose exec db psql -U app -d saas_dev -c 'SELECT version();'
docker compose exec db psql -U app -d saas_dev -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

Then from your host app, the connection string is just:

```bash
DATABASE_URL="postgresql://app:devpassword@localhost:5432/saas_dev"
```

> **Named volume, not bind mount, for `pgdata`.** This is the single most common Postgres-in-Docker mistake on macOS: a bind mount for the data directory is slower and has historically had permission problems. Named volume is correct.

**Reset when you break something:**

```bash
docker compose down            # stop + remove containers, KEEP data
docker compose down -v         # stop + remove containers AND the volume (destroys data)
```

> **`down -v` is destructive.** It deletes `pgdata` permanently. Use it when you genuinely want a clean slate, never as a reflex.

---

## Part 6 — File Performance on macOS (the Part Everyone Learns the Hard Way)

Bind mounts on macOS go through a file-sharing layer (VirtioFS on current runtimes), which is far slower than native disk for many small files. `node_modules` is the worst possible case: tens of thousands of tiny files, touched constantly.

**Three fixes, best first:**

1. **Keep `node_modules` inside the container**, not on the bind mount. In Compose, declare an anonymous/named volume at that path so it shadows the host directory:

```yaml
services:
  app:
    build: .
    volumes:
      - .:/app
      - node_modules:/app/node_modules   # container-owned; hides the host copy
volumes:
  node_modules:
```

2. **Use a dev container** (Part 7) and let the image own dependencies; keep only source bind-mounted.
3. **Move the whole repo inside the VM** for heavy builds (Colima/OrbStack both expose a Linux filesystem you can work in) — fastest, least convenient.

**Measure before optimizing.** A quick sanity check:

```bash
# On the host
time (cd node_modules && find . -type f | wc -l)

# In the container against the bind mount
docker compose exec app sh -c 'cd /app && time find . -type f | wc -l'
```

If the container count is similar but the time is 5–10× worse, you've confirmed mount overhead — and you know the volume trick will pay off.

---

## Part 7 — VS Code Dev Containers

This is where your existing VS Code choice pays off. A dev container makes "the environment for this repo" a versioned file instead of a set of oral traditions.

**Install:** the **Dev Containers** extension (`ms-vscode-remote.remote-containers`). On macOS, VS Code's docs list Docker Desktop 2.0+ as the baseline requirement; alternative Docker-compatible CLIs generally work, but the smoothest path is a mainstream runtime.

**Create `.devcontainer/devcontainer.json`:**

```json
{
  "name": "SaaS dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
  "features": {
    "ghcr.io/devcontainers/features/python:1": {}
  },
  "forwardPorts": [3000, 5432],
  "postCreateCommand": "npm ci",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss"
      ],
      "settings": {
        "editor.formatOnSave": true
      }
    }
  },
  "remoteUser": "node"
}
```

**Open the project in it:** Command Palette (`⌘⇧P`) → **Dev Containers: Reopen in Container**. First build takes a few minutes; afterwards it's fast.

**What you get:** a consistent toolchain, extensions installed automatically, ports forwarded to your Mac's browser at `localhost`, and a repo that says what it needs.

**What you give up:** some host integration is slower, the container must be running for you to work, and Apple `container`'s devcontainer support is currently incomplete (networking/setup-script gaps). If you go with Apple `container`, expect friction here.

### Editor alternatives, honestly

You use VS Code. Keep it. Where a different tool would genuinely matter:

| Tool | When it's the better call | Tradeoff |
|---|---|---|
| **VS Code** | Default; best Dev Containers story | Electron overhead |
| **Cursor** | You want agents inside the editor; it's a VS Code fork so extensions carry over | Another AI toolchain and subscription to manage |
| **Zed** | You want a fast native macOS editor | Smaller extension ecosystem; less mature container story |
| **Neovim** | You want everything in the terminal, including inside a container | You build the environment yourself |

For this particular paper — Dev Containers, Compose, Postgres, agent sandboxing — **VS Code is the correct choice**, not a compromise.

---

## Part 8 — Sandboxing AI Coding Agents (the Payoff)

This is why containers matter to you specifically. An agent with filesystem and shell access is an agent that can `rm -rf` the wrong directory, exfiltrate a `.env`, or rewrite your SSH keys. A container turns "hope" into a boundary.

**The threat model in one line:** assume the agent will do exactly what the prompt says, and assume the prompt can be manipulated by content it reads (Paper 2 — indirect prompt injection).

### The pattern

1. **Give the agent a copy, not your repo.** Clone into a scratch directory.
2. **Mount read-only where possible.** `:ro` on anything it only needs to read.
3. **Drop capabilities** and don't hand it the host network.
4. **Never bake secrets into the image.** No `.env`, no tokens, no SSH keys.
5. **Make it ephemeral.** `--rm`, one container per task; delete when done.

A concrete run — no agent-specific flags, just container flags, so this is generic and safe:

```bash
# Make a disposable copy of the repo
mkdir -p ~/agent-scratch && cd ~/agent-scratch
git clone ~/code/my-saas work-1

docker run --rm -it \
  --name agent-work-1 \
  --network none \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --memory 4g --cpus 2 \
  -v "$PWD/work-1":/work \
  -w /work \
  node:22-alpine sh
```

Read that flag list as a policy: **no network** (`--network none`), **no added capabilities** (`--cap-drop ALL`), **no privilege escalation** (`no-new-privileges`), **a hard memory and CPU ceiling**, and **only the scratch directory mounted**. The agent can destroy `~/agent-scratch/work-1` and nothing else.

If the agent needs network access, grant it deliberately and narrowly — use a user-defined network with only the services it needs, rather than the host's.

> **The honest limitation:** `--network none` blocks exfiltration but also blocks legitimate package installs and API calls. Real agent sandboxes relax this incrementally — a proxy, an allow-list, a dedicated network — and each relaxation is a decision you should make on purpose. Containers reduce blast radius; they do not make a poisoned prompt harmless.

### Where this connects to everything else

- **Paper 2 (agent security)** gives the attack model; this gives the containment.
- **Git worktrees** give each agent its own branch; containers give each agent its own filesystem and network. Together they're the isolation layer.

---

## Part 9 — Resource Budgets on 24 GB, and Disk Hygiene

Your M5 Pro has **24 GB of unified memory**, shared between macOS, your browser (a genuine memory hog), VS Code, and the container VM. Allocate accordingly.

| Allocation | Recommendation on 24 GB | Why |
|---|---|---|
| Container VM RAM | **6–10 GB** | Enough for Postgres + Node builds; leaves headroom |
| VM CPUs | **4–6** | Half the performance cores is plenty; don't starve macOS |
| Disk image | **60–100 GB** | Images accumulate quietly |
| Swap | Leave to macOS | Don't fight the unified memory manager |

```bash
# Colima: set resources at creation
colima start --cpu 6 --memory 10 --disk 80 --vm-type vz

# OrbStack: allocate in the app's settings (auto-scales by default)
# Docker Desktop: Settings → Resources
```

**Disk hygiene — targeted, not blind:**

```bash
docker system df                 # what's actually consuming space
docker container prune           # stopped containers
docker image prune               # dangling images only (safe)
docker builder prune             # build cache
docker system prune              # stopped containers + unused networks + dangling images
docker system prune -a           # ⚠ ALSO deletes images not used by a running container
docker volume prune              # ⚠ deletes volumes not used by any container — DATA LOSS
docker volume ls                 # check before you prune
```

> **Never run `docker system prune -a` or `docker volume prune` on autopilot.** `-a` forces a full re-download of every image; volume prune can delete your Postgres data. Your `pgdata` volume is the thing you least want gone.

---

## Cheat Sheet

| Task | OrbStack / Docker | Colima | Apple `container` |
|---|---|---|---|
| Start runtime | Launch app | `colima start` | `container system start` |
| Stop runtime | Quit app | `colima stop` | `container system stop` |
| List containers | `docker ps -a` | `docker ps -a` | `container ls` |
| Run | `docker run` | `docker run` | `container run` |
| Compose up | `docker compose up -d` | `docker compose up -d` | *(no native Compose)* |
| Shell in | `docker exec -it x sh` | `docker exec -it x sh` | `container exec` |
| Disk usage | `docker system df` | `docker system df` | `container ls` + prune |

| Compose command | Meaning |
|---|---|
| `up -d` | Start in background |
| `ps` | Show services |
| `logs -f <svc>` | Follow a service's logs |
| `exec <svc> <cmd>` | Run a command inside a service |
| `down` | Stop and remove containers, **keep volumes** |
| `down -v` | Stop and remove containers **and volumes** (destructive) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `port is already allocated` | Something on the host already uses it (Postgres on 5432 is common) | `lsof -i :5432` to find it; change the host port `"5433:5432"` |
| Container can't reach a service on the Mac | Container networking is isolated | Use `host.docker.internal` instead of `localhost` |
| "no matching manifest for linux/arm64" | Image is amd64-only | Find an arm64 tag; or build your own; or enable Rosetta emulation as a last resort |
| Builds extremely slow | amd64 emulation, or bind-mount churn | Confirm arm64; move `node_modules` into a volume (Part 6) |
| `EACCES`/permissions on mounted files | UID mismatch between host user and container user | Set `remoteUser`, or use a named volume, or fix ownership inside the container |
| Runtime eats RAM with nothing running | The VM's working set, not containers | Lower VM memory; prefer OrbStack/Colima over a default Docker Desktop config |
| Disk mysteriously full | Old images + build cache | `docker system df`, then targeted prunes (never `-a` blindly) |
| Postgres data vanished | `docker compose down -v` or `docker volume prune` | Restore from backup; henceforth, back up the volume |
| Dev container won't build | Missing/locked Dockerfile, or a slow first pull | Reopen, read the build log, verify the runtime is running |
| Rosetta-related crashes | x86 emulation edge cases | Prefer native arm64 images; disable Rosetta and fix the image instead |
| `uname` inside container says Linux | That is correct and expected | It's a Linux VM; the Mac has no Linux kernel to share |

---

## Video Library

> **YouTube search links**, not specific videos — always valid, and you pick the current best result. No invented URLs.

| Search link | What to look for, and why |
|---|---|
| [Apple Silicon Docker explained](https://www.youtube.com/results?search_query=Apple+Silicon+Docker+explained) | Why containers are VMs on a Mac; the core mental model |
| [OrbStack vs Docker Desktop](https://www.youtube.com/results?search_query=OrbStack+vs+Docker+Desktop) | Speed and RAM comparisons on M-series hardware |
| [Colima tutorial macOS](https://www.youtube.com/results?search_query=Colima+tutorial+macOS) | Free CLI-only runtime, start to finish |
| [Apple container tool](https://www.youtube.com/results?search_query=Apple+container+tool+macOS) | The new Swift CLI; one micro-VM per container |
| [Docker Compose tutorial](https://www.youtube.com/results?search_query=Docker+Compose+tutorial) | Services, volumes, networking, env vars |
| [Multi-stage Dockerfile Node](https://www.youtube.com/results?search_query=multi-stage+Dockerfile+Node) | Build/ship pattern and cache efficiency |
| [VS Code Dev Containers](https://www.youtube.com/results?search_query=VS+Code+Dev+Containers+tutorial) | devcontainer.json in practice |
| [Postgres Docker pgvector](https://www.youtube.com/results?search_query=Postgres+Docker+pgvector) | Running pgvector locally |
| [Docker volume performance macOS](https://www.youtube.com/results?search_query=Docker+volume+performance+macOS) | Bind mount vs volume; the node_modules trick |
| [Sandbox AI coding agent container](https://www.youtube.com/results?search_query=sandbox+AI+coding+agent+container) | Isolation patterns for agents |

---

## Written References & Docs

Official docs and repositories only. If a link moves, navigate from the vendor's own domain.

| Source | URL |
|---|---|
| VS Code Dev Containers docs | `https://code.visualstudio.com/docs/devcontainers/containers` |
| Dev Containers specification | `https://containers.dev` |
| Development container images | `https://github.com/devcontainers/images` |
| Docker docs | `https://docs.docker.com` |
| Docker Compose reference | `https://docs.docker.com/compose/` |
| Docker Desktop license | `https://www.docker.com/pricing/` |
| OrbStack | `https://orbstack.dev` |
| Colima repo | `https://github.com/abiosoft/colima` |
| Podman | `https://podman.io` |
| Apple `container` repo | `https://github.com/apple/container` |
| pgvector repo | `https://github.com/pgvector/pgvector` |

> **Verification tip:** for any image name, confirm the tag on the registry (`hub.docker.com`) before pinning it in a Compose file. Tags move; `latest` is not a version.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Image | Immutable filesystem + metadata used to create containers |
| Container | A running process with a writable layer over an image |
| VM | The lightweight Linux machine a container runs inside on macOS |
| Runtime | The software that manages the VM and containers (OrbStack, Colima, Docker Desktop, Apple `container`) |
| Layer | A cached filesystem diff; builds reuse unchanged layers |
| Dockerfile | A recipe for building an image |
| Compose | A YAML file (and CLI) describing multiple services |
| Named volume | Runtime-managed persistent storage, fast on macOS |
| Bind mount | A host directory shared into a container, slower on macOS |
| Registry | A store for images (Docker Hub, GHCR) |
| Base image | The `FROM` image you build on top of |
| Multi-stage build | Several `FROM` stages where only the last ships |
| VirtioFS | The file-sharing layer between macOS and the Linux VM |
| Rosetta | Apple's x86 translation layer; used for amd64 images |
| Micro-VM | A very small VM — Apple `container` uses one per container |
| Build context | The files sent to the builder; control it with `.dockerignore` |
| `host.docker.internal` | Hostname containers use to reach your Mac |

---

## FAQ & Next Steps

**Do I need Docker Desktop at all?** No. On Apple Silicon, OrbStack (personal) or Colima (MIT) covers the same ground. Docker Desktop is the right answer mainly when a team standard or paid tooling requires it.

**Is Apple `container` ready to replace Docker for me?** Not yet, for your workflow — no native Compose and incomplete Dev Container support. It's worth watching.

**How much RAM should the VM get on 24 GB?** 6–10 GB. More is rarely worth it; you're competing with your browser.

**Containers or dev containers?** Containers for services (Postgres) and for sandboxing agents; a dev container for the "same environment for this repo" promise. They compose well.

**Can I run Postgres without containers?** Yes — `brew install postgresql@17` works and is faster. Containers win on throwaway-ability and version pinning; the host install wins on raw speed.

**What's the one thing I should do this week?** Get Postgres + pgvector running via Compose, and then run one agent inside a `--network none` container. The first is convenience; the second is safety.

### Next steps, in order

1. **Today:** install OrbStack (or Colima), run `hello-world`, confirm `uname -a` says Linux.
2. **Today:** bring up the Postgres/pgvector Compose file and create the `vector` extension.
3. **This week:** add `.devcontainer/devcontainer.json` to one repo and reopen it in VS Code.
4. **This week:** move `node_modules` into a named volume and measure the difference.
5. **Next week:** run one AI agent inside a `--network none`, `--cap-drop ALL` container on a scratch clone.
6. **Month 2:** re-evaluate Apple `container` — by then, Compose and devcontainer support may have moved.

---

## Verification Note

**Verified against primary and vendor sources in September 2026:**

- **Apple `container` 1.0** released **9 June 2026**; Swift, Apache-2.0, Apple Silicon only, macOS 26 as the supported target; OCI-compatible; **one micro-VM per container**; **no native Compose**; incomplete Dev Container support; config in `~/.config/container/config.toml`; conservative default resources (~1 GB/4 CPU per container, ~2 GB/2 CPU builder); install via signed package then `container system start`; releases are product versions, with a 1.4.x line by September 2026. (Source: the `apple/container` repository and contemporaneous coverage.)
- **Runtime comparison figures** (idle RAM, startup, throughput, licensing) drawn from an April 2026 benchmark of Colima/Docker Desktop/OrbStack/Apple-container plus vendor pages. These are **directional measurements on specific hardware**, not guarantees.
- **Docker Desktop licensing threshold** (250+ employees and $10M+ revenue) and resource-saver improvements; **OrbStack** free-for-personal with paid commercial/Teams tiers; **Colima** MIT with config at `~/.colima/default/colima.yaml`.
- **VS Code Dev Containers** requires a Docker-compatible runtime (docs list Docker Desktop 2.0+ on macOS); `devcontainer.json` keys shown (`image`, `features`, `forwardPorts`, `postCreateCommand`, `customizations.vscode.extensions/settings`, `remoteUser`) are from the Dev Containers docs.

**Changes fast — verify before relying on it:** all pricing and license terms, benchmark numbers, Apple `container`'s feature gaps (Compose and devcontainers are the ones most likely to change), image tags, and Docker Desktop's resource behavior.

**Vendor claims, not independently verified:** speed percentages and "80% less RAM" style figures quoted from vendor marketing. The benchmark table is closer to neutral, but still one source's hardware.

**Hardware-dependent:** every memory number is an estimate for a 24 GB M-series Mac. Measure your own with `docker stats`.

---

## Bonus — Handoff Prompt

Copy this into any AI agent to extend this paper into a deeper, machine-specific guide.

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He builds a
Next.js + Postgres SaaS, runs AI coding agents daily (opencode + MCP), and works on a
MacBook Pro, Apple M5 Pro, 24 GB unified memory, macOS 26, in VS Code.

Paper: markdown_docs/07-containers-dev-environments-macos.md
Topic: Containers & dev environments on Apple Silicon.

Match the house style exactly: title "# The Complete Guide: <Topic>"; blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big Picture
(ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered "## Part N — Title"
sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH links only) → Written
References & Docs (official docs/repos only) → Glossary → FAQ & Next Steps → Verification Note →
Bonus — Handoff Prompt → Your Setup Notes. Pure Markdown, no HTML. Every fence language-tagged.
Second person, no filler. macOS commands only — never Windows.

Do whichever Chris asks:
(A) Expand one Part by 1,200+ words with a runnable, tested example.
(B) Add a Part on a topic he names — e.g. Docker networking in depth, devcontainer features,
    running the full Next.js + Postgres + pgvector stack in Compose, or CI on Apple Silicon runners.
(C) Audit his actual machine and repos: check which runtime is installed, list images/volumes and
    their disk usage, inspect any .devcontainer config, then write a concrete migration plan
    (runtime choice, VM memory allocation for 24 GB, node_modules volume fix, an agent sandbox
    recipe). Use his real paths.

Rules: never invent image tags, CLI flags, package names, URLs, or version numbers. If unsure write
"search: <name> docs" and say how to verify. Date every licensing/pricing claim and label it vendor
terms. Use blockquote callouts for memory limits and destructive commands (prune, down -v). Keep
the structure. Report path, one-line summary, word count.

Anchors (verified September 2026) — reuse and re-verify:
https://code.visualstudio.com/docs/devcontainers/containers
https://containers.dev
https://docs.docker.com/compose/
https://github.com/apple/container
https://github.com/abiosoft/colima
https://orbstack.dev
https://github.com/pgvector/pgvector
```

---

## Your Setup Notes (M5 Pro · 24 GB · VS Code)

**Recommended stack for your machine, decided:**

| Choice | Recommendation | Why |
|---|---|---|
| Runtime | **OrbStack** | Free for personal use, ~2–5 s startup, ~150–500 MB idle — the best fit for a 24 GB Mac |
| Free/OSS alternative | **Colima** with `--vm-type vz` | MIT, no license risk; use if this ever becomes commercial work |
| VM allocation | **6–10 GB RAM, 4–6 CPUs, 80 GB disk** | Leaves room for macOS, browser, VS Code |
| Editor | **Stay on VS Code** | Best Dev Containers story; no reason to switch |
| Alternate editor | **Zed** (native/fast) or **Cursor** (agent-in-editor) | Only if you want speed or in-editor agents; both trade something |
| Database | `pgvector/pgvector` via Compose, **named volume** | Matches your pgvector plan from Paper 3 |
| Agent isolation | Ephemeral container, `--network none`, `--cap-drop ALL`, `--rm` | Containment for the threat model in Paper 2 |
| Node deps | Named volume over `node_modules` | Avoids the macOS bind-mount tax |

**Your first three commands on this machine:**

```bash
brew install --cask orbstack          # install the runtime
docker run --rm hello-world           # prove it works
docker run --rm -it alpine uname -a   # prove it's Linux inside — the core lesson
```
