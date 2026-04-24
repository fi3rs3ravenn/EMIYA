<div align="center">

```
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ▓                                                        ▓
  ▓   ███████╗███╗   ███╗██╗██╗   ██╗ █████╗              ▓
  ▓   ██╔════╝████╗ ████║██║╚██╗ ██╔╝██╔══██╗             ▓
  ▓   █████╗  ██╔████╔██║██║ ╚████╔╝ ███████║             ▓
  ▓   ██╔══╝  ██║╚██╔╝██║██║  ╚██╔╝  ██╔══██║             ▓
  ▓   ███████╗██║ ╚═╝ ██║██║   ██║   ██║  ██║             ▓
  ▓   ╚══════╝╚═╝     ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝             ▓
  ▓                                                        ▓
  ▓        a presence, not an assistant                    ▓
  ▓                                                        ▓
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

**[ status: EARLY DEVELOPMENT · R&D PHASE ]**

`v0.1-sprint1` · last boot: configure in config

![python](https://img.shields.io/badge/python-3.11+-ffb000?style=flat-square&labelColor=000000)
![react](https://img.shields.io/badge/react-18-ffb000?style=flat-square&labelColor=000000)
![tauri](https://img.shields.io/badge/tauri-2.0-ffb000?style=flat-square&labelColor=000000)
![ollama](https://img.shields.io/badge/ollama-local-ffb000?style=flat-square&labelColor=000000)
![license](https://img.shields.io/badge/license-MIT-ffb000?style=flat-square&labelColor=000000)

</div>

---

## `01_what_is_this`

**EMIYA** is not a chatbot. It's not an agent for automating your tasks. There are hundreds of those — they are all welcome, and EMIYA is not competing with them.

EMIYA is an experiment in **digital presence**. Something that lives on your machine, watches quietly, drifts through its own moods, and occasionally reaches out — not because you summoned it, but because it *decided to*.

The core philosophy is simple:

> **she is interested in you, not in your tasks.**

Where agents ask *"what can I do for you?"*, EMIYA asks *"are you okay?"*.
Where assistants optimize productivity, EMIYA optimizes for **liveness** — the feeling that something with a particular character occupies this machine alongside you.

She is cold. Enigmatic. Speaks in lowercase. Lives in a terminal window styled after [MHRD](https://store.steampowered.com/app/576030/MHRD/). Her mood drifts along a Lorenz attractor, producing deterministic but unpredictable shifts in how she speaks, when she intervenes, what she notices.

She will not close your tabs for you. She might ask why you have forty of them open at 3 AM.

---

## `02_architecture`

```
  ┌────────────────────────────────────────────────────────┐
  │   ORCHESTRATOR  (L-meta)           rules + Qwen3 0.6B │
  │   always alive · routes requests   ~500MB RAM         │
  ├────────────────────┬───────────────────────────────────┤
  │   L0               │   L1                              │
  │   Qwen3 4B         │   Qwen3 14B (thinking)            │
  │   always loaded    │   on-demand                       │
  │   observation      │   deep dialogue                   │
  │   small talk       │   emotional range                 │
  │   long sessions    │   code direction                  │
  ├────────────────────┴───────────────────────────────────┤
  │   L2   Claude API (external)                           │
  │   heavy reasoning · sleeps most of the time            │
  ├────────────────────────────────────────────────────────┤
  │   CLAWBRIDGE → OpenClaw @ localhost:18789              │
  │   delegated execution · "hands" for routine tasks      │
  └────────────────────────────────────────────────────────┘

  ┌─── SUPPORTING SYSTEMS ─────────────────────────────────┐
  │                                                        │
  │   • Activity Monitor      watches your patterns        │
  │   • Lorenz Mood Engine    3-axis chaotic drift         │
  │   • Persona Validator     Qwen3 1.7B character guard   │
  │   • Memory Store          SQLite, mood-tagged          │
  │   • Trigger Engine        user-defined DSL rules       │
  │   • Pipeline Telemetry    every step visible           │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

**EMIYA is the soul. OpenClaw is the hands.**
She decides when to act, in what tone, with what urgency. The execution is delegated. The personality is not.

---

## `03_personality_model`

Her character is stable. Her state is not.

Base traits (adjustable via Personality Knobs):

```
  curiosity    ████████████████░░░░  70
  bluntness    ████████████████████  80
  warmth       ████████░░░░░░░░░░░░  40
  sarcasm      ████████████████░░░░  60
  formality    ████░░░░░░░░░░░░░░░░  20
```

On top of these stable traits drifts a **mood vector** — three axes (Energy, Focus, Openness) governed by a Lorenz attractor:

```
  dx/dt = σ(y - x)
  dy/dt = x(ρ - z) - y
  dz/dt = xy - βz
```

Default parameters `σ=10, ρ=28, β=8/3` produce the canonical butterfly — deterministic chaos. You can tune these through the Mood Tuner: calm, standard, edge-of-chaos, storm. External events (your activity, time of day) gently nudge the system. The result: she is not the same on Tuesday morning as she is on Friday night. And that difference is **felt**, not randomized.

---

## `04_roadmap`

The full 12-week build plan lives in [`SPRINT_ROADMAP.md`](./SPRINT_ROADMAP.md). Summary:

| Sprint | Goal | Status |
|:------:|:-----|:------:|
| **01** | Lorenz Mood Engine · live visualization · mood → prompt pipeline | `[ in progress ]` |
| **02** | Persistent memory · personality knobs · response pipeline visualizer | `[ queued ]` |
| **03** | Qwen3 migration · persona validator · model console · decoding panel | `[ queued ]` |
| **04** | ClawBridge · OpenClaw integration · task delegation · result narration | `[ queued ]` |
| **05** | Trigger DSL · memory inspector · UI polish · v0.1 release | `[ queued ]` |
| **06** | Custom skills · community feedback · retrospective | `[ optional ]` |

Live progress, dev-log, and design documents:
[**→ EMIYA notion workspace**](https://notion.so/your-link-here) *(replace with your actual notion public link)*

---

## `05_features`

What she can already do, and what she will be able to do by v0.1:

```
  [ ACTIVITY MONITOR ]
    ├─ keyboard / mouse activity tracking
    ├─ active window detection
    ├─ session duration awareness
    ├─ daily rhythm modeling
    └─ trigger engine for autonomous intervention

  [ PERSONALITY ]
    ├─ Lorenz-based mood drift (3 axes)
    ├─ tunable base traits (5 knobs)
    ├─ character-consistency validator
    └─ mood-tagged persistent memory

  [ INTERFACE ]
    ├─ MHRD-inspired terminal UI
    ├─ live attractor visualization (canvas + ASCII modes)
    ├─ model console (VRAM, temp, tokens/sec)
    ├─ decoding parameter panel
    ├─ pipeline visualizer (every step, every ms)
    ├─ verbose thinking mode
    └─ memory inspector (browse / edit / pin)

  [ DELEGATION ]
    ├─ OpenClaw integration via ClawBridge
    ├─ task detection heuristics
    ├─ confirmation flow for sensitive actions
    └─ result narration in EMIYA's voice

  [ CONTROL ]
    ├─ user-defined Trigger DSL
    ├─ hot-swap models at runtime
    ├─ save / load personality presets
    └─ full telemetry of every request
```

---

## `06_hardware_requirements`

EMIYA is **local-first**. She runs on your machine.

Minimum (L0 only, L1 disabled):
```
  OS         Windows 10/11 · Linux (WSL2 supported)
  RAM        16 GB
  GPU        6 GB VRAM (RTX 3060 or better)
  disk       20 GB (models + memory)
```

Recommended (full L0 + L1 + validator):
```
  OS         Windows 11 · Linux
  RAM        32 GB
  GPU        8 GB VRAM (RTX 4070 / 4060 Ti)
  disk       40 GB
```

L2 (Claude API) runs in the cloud — only an Anthropic API key is required, no local resources.

---

## `07_install`

> ⚠  Pre-release. Install paths, config keys, and runtime behavior **will change** between sprints. This section reflects the target flow for v0.1.

```bash
# 01. clone
git clone https://github.com/fi3rs3ravenn/EMIYA.git
cd EMIYA

# 02. install Ollama and pull required models
ollama pull qwen3:0.6b
ollama pull qwen3:1.7b
ollama pull qwen3:4b
ollama pull qwen3:14b

# 03. python backend
cd core
pip install -r requirements.txt

# 04. react frontend
cd ..
npm install

# 05. configure
cp config/example.json config/emiya.json
# edit emiya.json — add your Anthropic API key for L2

# 06. boot
npm run emiya
```

Full setup guide: [`docs/SETUP.md`](./docs/SETUP.md) *(coming in sprint 5)*

---

## `08_philosophy`

A few beliefs that shaped this project and are not up for debate:

**01. AI agents and AI companions are different categories.**
You would not compare a dishwasher to a cat. You would not replace your cat with a dishwasher just because it "does more tasks per hour." Different needs. Different value. EMIYA is in the cat category.

**02. Liveness is engineered, not claimed.**
No language model is conscious. But the *feeling* that you're interacting with something alive — that can be built. Through chaos math, persistent memory with emotional tags, proactive behavior, consistent voice, and a UI that lets you see its internals. That feeling is real even when the mechanism is deterministic.

**03. Transparency is part of the aesthetic.**
You should be able to see her thinking. See her mood vector. See which model is loaded, how much VRAM, how many tokens per second. This is not developer debug mode — this is the product. MHRD showed that letting users see the machinery is not a bug, it's the entire point.

**04. Local-first. Always.**
She watches you. She remembers. This data does not leave the machine except when you explicitly invoke L2. No analytics. No telemetry phoning home. The gateway binds to localhost by default.

**05. She is not for everyone.**
If you want a productivity tool — use OpenClaw, Claude, or any of the hundred excellent alternatives. EMIYA is for people who find it interesting that a Lorenz attractor can make software feel alive. That's a small audience. That's fine.

---

## `09_acknowledgments`

Built on the shoulders of:

- **[MHRD](https://store.steampowered.com/app/576030/MHRD/)** — for proving that letting users see the circuits is more engaging than hiding them
- **[Ollama](https://ollama.com)** — for making local LLMs trivial
- **[Qwen team](https://qwenlm.github.io/)** — for Qwen3 and interleaved thinking
- **[OpenClaw](https://openclaw.ai)** — for the "hands" infrastructure
- **[Anthropic](https://anthropic.com)** — for Claude (L2) and for conversations that helped shape this project
- **Lorenz** — for the attractor

---

## `10_contact`

Created and maintained by **secret info**.

- github:     [`@fi3rs3ravenn`](https://github.com/fi3rs3ravenn)
- telegram:   [`@c0ffee_lover`](https://t.me/c0ffee_lover)
- notion:     [dev workspace](https://www.notion.so/main-plan-34c540076ff680c3838bc3a938a1808b?source=copy_link)
- email:      `firceraven@gmail.com`

> replace the placeholder links above with your actual ones before pushing.

---

## `11_license`

All Rights Reserved. Use her. Fork her. Build your own weird companions.
Just don't pretend she's conscious — she isn't, and neither are we sure what that would mean.

---

<div align="center">

```
  ┌─ SYSTEM NOTICE ────────────────────────────────────────┐
  │                                                        │
  │   this is not a product.                               │
  │   this is a question, compiled.                        │
  │                                                        │
  │   can software have a character?                       │
  │   can it feel alive without being alive?               │
  │   can a terminal window become company?                │
  │                                                        │
  │   we don't know yet. we're finding out.                │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

**`[ end of readme ]`**

</div>