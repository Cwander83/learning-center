# The Complete Guide: Local & On-Device AI

> Run the weights on your own metal — private, offline, no per-token bill.
> Last verified: September 2026
> Series: Chris Wander · New Paper Series

## The Big Picture

You already call hosted LLM APIs every day. This paper is about owning the other half: the part that runs on the machine under your desk. Local inference is not a replacement for frontier models — it is a second tool. For embeddings, bulk classification, private documents, and offline work, it is often the *better* tool, and it costs nothing per token.

The whole local stack is four layers. Most tutorials start you at layer 3 and hide layers 1 and 2. Understanding all four is what lets you debug things when a model "works but is dumb."

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 4 — YOUR APP                                                 │
│  Python script · RAG pipeline · editor plugin · chat UI             │
│  Speaks HTTP. Does not care where the model physically lives.       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  POST /v1/chat/completions
                                │  POST /v1/embeddings     (OpenAI shape)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — OPENAI-COMPATIBLE SERVER                                 │
│   ollama serve     ->  http://localhost:11434/v1                    │
│   llama-server     ->  http://localhost:8080/v1                     │
│   LM Studio        ->  http://localhost:1234/v1                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  load model + schedule tokens
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — RUNTIME (the inference engine)                           │
│   llama.cpp  -> GGUF files, Metal / CUDA / Vulkan / ROCm / CPU      │
│   MLX        -> Apple Silicon, unified memory, Safetensors          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  mmap + dequantize weights
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — THE MODEL FILE (one file on disk)                        │
│   model-Q4_K_M.gguf                                                 │
│   = weights (compressed) + tokenizer + chat template + metadata     │
└─────────────────────────────────────────────────────────────────────┘
```

The key insight: **Ollama is a friendly wrapper over llama.cpp on most platforms** (and, since Ollama 0.19 shipped March 30 2026, over Apple's MLX framework for supported models on Apple Silicon). It downloads the model file into a content-addressed store, picks a sane quantization, starts the engine, and exposes an HTTP API. You get convenience; underneath it is the same llama.cpp/MLX machinery a raw build uses.

| Layer | What it is | Plain-English analogy |
|---|---|---|
| GGUF model file | Weights + tokenizer + template in one container | A sealed engine crate: everything the car needs, shipped as one box |
| Runtime (llama.cpp / MLX) | The code that does matrix math on your CPU/GPU | The engine + transmission: turns the crate into motion |
| Ollama / LM Studio | Registry, downloader, process manager, HTTP API | The dealership: orders the crate, installs it, hands you keys |
| OpenAI-compatible endpoint | A standard HTTP shape for chat/embeddings | The universal fuel nozzle: fits any car |
| Quantization | Weights at lower precision | Shipping the engine with lighter parts — 5% slower, half the weight |
| KV cache | Memory holding conversation state | The engine's working fluid — grows with how much you've said |
| num_gpu / Metal | How many layers go to the GPU | How much horsepower you route to the wheels |
| Chat template | Prompt formatting rules baked in the file | The ignition sequence unique to each car |

## The 60-Second Version (TL;DR)

1. **Install Ollama**, run `ollama pull` a small chat model and `ollama pull nomic-embed-text`. You now have private chat and private embeddings.
2. **Default quantization is Q4_K_M** — roughly 4.8 bits per weight, ~95–97% of F16 quality, half the size. This is the right default for almost everyone.
3. **Memory math is the whole game.** Model file size + KV cache + ~1–2 GB overhead must fit in unified memory (Mac) or VRAM (GPU). Context length drives the KV cache.
4. **Every serious local server speaks the OpenAI HTTP shape.** Point the `openai` Python SDK at `http://localhost:11434/v1` and your existing code runs unchanged.
5. **Embeddings are tiny and cheap.** `nomic-embed-text` is ~274 MB and runs comfortably on any CPU. Local embeddings are the highest-value local workload there is.
6. **Local wins** on privacy, bulk embedding, offline/air-gapped use, and fine-tuning. **Hosted frontier models still win** on hard multi-step reasoning, huge context, and reliable tool calling.

## Prerequisites

- A Mac with Apple Silicon (M1 or later). 16 GB unified memory minimum; 32 GB is the comfortable floor for anything interesting; 64 GB opens up 70B-class models.
- macOS with a terminal. Homebrew installed.
- Python 3.10+ for the SDK examples (`python3 --version`).
- Roughly 10–40 GB of free disk depending on model sizes. Check with `df -h ~`.
- No GPU required. The examples target Apple Silicon; llama.cpp builds also run on Linux/Windows with CPU or discrete GPU.

> **Unified memory is not just extra RAM.** On Apple Silicon the CPU and GPU share one pool. A 16 GB Mac is really "16 GB total for OS + apps + model weights + KV cache." The OS and browser will eat 4–8 GB before a model loads. Plan around 60–75% of nominal memory as your real ceiling.

## Part 1 — Why Run Local At All

**Privacy and data residency.** When you call a hosted API, your prompt leaves your machine and lands in someone else's logs, jurisdiction, and retention policy. For medical notes, client contracts, financial records, or unreleased code, that may be a non-starter. Local inference means the bytes never leave the loopback interface. You can prove it: pull the network cable and keep going.

**No per-token cost.** Hosted embeddings get expensive at volume. A million documents embedded through a paid API is a recurring bill; the same work locally is one download and some electricity. Bulk classification, nightly re-indexing, and "just embed everything" stop being budget decisions.

**Offline and air-gapped use.** A laptop on a plane, a machine on a factory floor, a demo with no wifi. Local models just work. This alone justifies the stack for field work.

**Fine-tuning and full control.** You control the quantization, the chat template, the seed, the system prompt, the sampler. You can fine-tune a small model on your own data (LoRA), and on Apple Silicon, MLX supports native LoRA fine-tuning on-device. You cannot do any of that with a hosted black box.

**But be honest about the ceiling.** A local 7B–35B model does not out-reason a hosted frontier model on hard, multi-step problems. Benchmarks and lived experience agree. Local wins on privacy, cost, and control; hosted wins on raw reasoning, very long context, and reliable structured/tool output. Use both. The rest of this paper shows you how to keep one interface so swapping is a one-line change.

## Part 2 — The Layers, Precisely

### 2.1 The GGUF file format

**GGUF** is the model file format defined by the llama.cpp project (repo `ggml-org/llama.cpp`, MIT licensed). It replaced the older GGML format. A single `.gguf` file contains:

- the quantized **weights** (tensors),
- the **tokenizer** (vocabulary and merge rules),
- the **chat template** (how to format user/assistant turns),
- **metadata** (architecture, context length, RoPE settings, parameter count).

That "everything in one file" property is why you can download a single `.gguf` from Hugging Face and run it. Hugging Face hosts many model repos that publish *multiple* GGUF quantizations per model (frequently from uploaders like `bartowski`, `unsloth`, and `ggml-org`). Each quantization gets its own file.

Tools in the llama.cpp toolchain:

- `llama-quantize` — takes a GGUF (often F16) and produces a smaller quantized GGUF.
- `convert-hf-to-gguf.py` — converts Hugging Face Safetensors weights into GGUF.
- **importance-matrix (imatrix) calibration** — uses a sample corpus to decide which weights matter most, improving low-bit quant quality. Sometimes labelled `IQ` quants (e.g. `IQ4_XS`).

### 2.2 Runtimes

| Runtime | Format | Best for | Notes |
|---|---|---|---|
| **llama.cpp** | GGUF | Broadest model support, every platform | Metal, CUDA, Vulkan, ROCm, SYCL, CPU backends. Ships `llama-server` (OpenAI-compatible) and `llama-cli`. |
| **MLX** | Safetensors | Apple Silicon | Apple's array framework. Unified-memory aware, native LoRA fine-tuning, Python (`mlx-lm`) and Swift bindings. |
| **Ollama** | GGUF (plus MLX path on Mac) | Everyday use | Wraps llama.cpp; since 0.19 (March 30 2026) uses MLX on supported Apple Silicon models. Registry + Modelfile. |
| **LM Studio** | GGUF / MLX | People who want a GUI | Point-and-click model browser and chat; also serves an OpenAI-compatible endpoint. |

On a Mac in 2026 you generally have three good options: Ollama for convenience, MLX (`mlx-lm`) for maximum Apple-Silicon throughput, and raw llama.cpp when you want a flag for everything. They are not mutually exclusive.

### 2.3 The OpenAI-compatible endpoint pattern

This is the single most important architectural idea in the paper. Every major local server exposes the same HTTP shape as the OpenAI API:

- `POST /v1/chat/completions`
- `POST /v1/embeddings`

So your application code is written once and pointed at a base URL. Hosted vs local becomes configuration:

```bash
# Hosted
OPENAI_BASE_URL=https://api.openai.com/v1

# Local (Ollama)
OPENAI_BASE_URL=http://localhost:11434/v1
```

`llama-server` defaults to `127.0.0.1:8080`; LM Studio defaults to `1234`; Ollama to `11434`. Build your app against the endpoint, not the vendor.

## Part 3 — Quantization, Explained Properly

Quantization stores weights at lower precision. A model trained in 16-bit floats gets compressed to 4-ish bits per weight. This is lossy, but models are surprisingly robust: most of the quality survives, and the file typically shrinks to a quarter of its size. **Quantization is what makes local inference fit on consumer hardware.**

### 3.1 The naming scheme

GGUF quant names encode a scheme and bit level:

- `Q4_K_M` = 4-bit, K-quant, **M**edium mix. `_S` = small, `_L` = large. The letter controls how much of the model stays at higher precision.
- `Q8_0`, `Q6_K`, `Q5_K_M`, `Q3_K_M`, `Q2_K` — descending size and quality.
- `IQ…` variants use importance-matrix calibration for better low-bit quality.
- `F16` = 16-bit, the reference. `BF16` = 16-bit brain-float.

**Why "4-bit" often averages ~4.8 bits per weight.** K-quants don't store every weight at 4 bits. They group weights into **super-blocks**, and each block carries a shared scale plus higher-precision values for the most important weights. So the average bits-per-weight lands above the headline number. When someone says "Q4_K_M is a 4-bit quant," they mean the *scheme family*, not an exact 4.00 bpw.

### 3.2 Bits-per-weight and quality table

> **These quality percentages are community rules of thumb, not benchmarks.** They come from accumulated anecdote and small evaluations across many models. Your model, task, and tolerance will vary. Treat them as a rough ordering, not a spec sheet.

| Quant | Approx. bits/weight | Rough quality vs F16 | Typical use |
|---|---|---|---|
| Q2_K | ~2.6 | ~80–85% | Last resort for tight memory; noticeably degraded |
| Q3_K_M | ~3.5 | ~90% | Squeezing a bigger model into small memory |
| **Q4_K_M** | **~4.8** | **~95–97%** | **The default. Best size/quality trade** |
| Q5_K_M | ~5.7 | ~97–98% | When you have a little headroom |
| Q6_K | ~6.56 | ~98–99% | Quality-sensitive work near the memory wall |
| Q8_0 | ~8.0–8.5 | ~99%+ (near-lossless) | Bigger files, near-reference quality |
| F16 | 16 | 100% (reference) | Not deployed; the measuring stick |

**Practical rule:** start at **Q4_K_M**. Move up to Q5_K_M or Q6_K only if you have memory to spare and a quality-sensitive task. Go below Q4 only when nothing else fits. For structured extraction where small errors matter, practitioners report Q4→Q6 as a real accuracy gap — if your task demands digit-accurate output, budget for Q6 or Q8.

### 3.3 What Ollama does by default

When you `ollama pull` a model from the registry, the default tag is typically a `Q4_K_M` build if the upstream repo has one. The same rule applies when Ollama imports a GGUF directly from Hugging Face: **Q4_K_M is chosen when present, otherwise the closest reasonable quant.** Check what you actually got:

```bash
ollama list
ollama show <model>
```

`ollama show` prints the architecture, parameter count, quantization, context length, and template. Never assume — always look.

## Part 4 — Memory Math (The Skill That Matters Most)

If you learn one thing from this paper, learn this: **does the model fit, and what happens at long context?**

Total memory needed ≈ **model file size + KV cache + runtime overhead**.

- **Model file size** — the download size. Roughly `params × bits_per_weight / 8`. A 7B model at Q4_K_M (~4.8 bpw) ≈ 4.2 GB. An 8B at Q4_K_M ≈ 4.7–5 GB. A 32B at 4-bit ≈ 19–20 GB. A 70B at Q4_K_M ≈ 40–43 GB.
- **KV cache** — the attention memory that holds your conversation context. It grows **linearly with context length**. Rough formula per token:
  `2 (K and V) × layers × kv_heads × head_dim × bytes_per_value`.
  In F16 that is 2 bytes per value; quantizing the cache to `q8_0` halves it, `q4_0` quarters it. Ollama exposes `OLLAMA_KV_CACHE_TYPE` and `OLLAMA_FLASH_ATTENTION`.
- **Overhead** — the runtime, CUDA/Metal buffers, the OS, your browser. Budget 1–2 GB, more on a desktop with a GUI.

### 4.1 Sizing by machine

| Machine memory | Comfortable | Stretch (slow / tight KV) | Don't bother |
|---|---|---|---|
| 8 GB | 3B Q4 | 7–8B Q4 at short context | 13B+ |
| 16 GB | 7–8B Q4/Q5 | 13–14B Q4 at modest context | 32B+ |
| 32 GB | 13–14B Q4/Q5, 30B-class MoE | 32B Q4 at short context | 70B |
| 64 GB | 32B Q4/Q5, 70B Q4 with headroom | 70B Q5/Q6 | 120B+ dense |

> **Your hardware will vary.** These are community-reported rough guides, not guarantees. The only reliable test is: load the model, watch memory pressure (`Activity Monitor` on macOS), and measure tokens/sec.

### 4.2 `num_ctx` — the silent killer

Context window is the setting most likely to bite you twice:

1. **Truncation.** If `num_ctx` is smaller than your prompt, the runtime silently drops the oldest tokens. Your model "answers the wrong question" because half the context vanished. Embedding models have the same issue: `nomic-embed-text` allows 8,192 tokens, but some models (e.g. `mxbai-embed-large` as shipped, 512 tokens) truncate far earlier. Run `ollama show <model>` and check `num_ctx` in the params block.
2. **Memory blow-up.** Raising `num_ctx` raises the KV cache linearly. Setting `num_ctx` to 128K on a 32B model can add many gigabytes and push you into swap — which on a Mac means the model suddenly runs at 2 tokens/sec or the OS kills it.

Set it deliberately:

```bash
# Per-run override
ollama run qwen3.5:4b --parameter num_ctx 8192

# In an API call
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:4b",
  "messages": [{"role":"user","content":"Hello"}],
  "options": {"num_ctx": 8192}
}'
```

> **Disk usage warning.** Every pulled model stays on disk. `ollama list` shows sizes; `ollama rm <model>` deletes one. Ten experiments can quietly consume 200 GB.

## Part 5 — Hands-On: Ollama End to End

### 5.1 Install and run

```bash
# macOS install (Homebrew)
brew install ollama

# or download the app from ollama.com, then start the service
ollama serve
```

On macOS the desktop app starts the server automatically. In another terminal:

```bash
# Pull a small, current chat model (verify exact tags with the search results)
ollama pull qwen3.5:4b

# Interactive chat
ollama run qwen3.5:4b

# Check what you got
ollama show qwen3.5:4b
ollama list
```

> **Model tags change constantly.** Do not trust a tag in this document. Search the Ollama library for the model family you want, then `ollama pull` and confirm with `ollama show`. If a tag 404s, the family was renamed or retired.

### 5.2 Run an OpenAI-compatible server

Ollama serves it out of the box. Verify:

```bash
curl http://localhost:11434/v1/models
```

If you prefer raw llama.cpp (e.g. Homebrew's build):

```bash
brew install llama.cpp

# Start a server on 127.0.0.1:8080 with a GGUF from Hugging Face
llama-server -hf ggml-org/Qwen2.5-VL-7B-Instruct-GGUF:Q4_K_M
```

> **Verify the exact repo and quant tag before running.** `llama-server -hf <repo>:<quant>` is the current syntax; older builds use different flags. Run `llama-server --help` to confirm your version.

### 5.3 Call it from Python with the OpenAI SDK

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install openai
```

**Basic chat:**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # required by the SDK, ignored by Ollama
)

resp = client.chat.completions.create(
    model="qwen3.5:4b",          # must match `ollama list`
    messages=[
        {"role": "system", "content": "You are concise."},
        {"role": "user", "content": "Explain embeddings in two sentences."},
    ],
    temperature=0.2,
)
print(resp.choices[0].message.content)
```

**Streaming:**

```python
stream = client.chat.completions.create(
    model="qwen3.5:4b",
    messages=[{"role": "user", "content": "Write a haiku about local inference."}],
    stream=True,
)
for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
print()
```

That is the whole trick. Swap `base_url` to your hosted provider and the identical code runs against a frontier model.

## Part 6 — Local Embeddings for RAG

Embedding models are **encoders**, not chat models. They read text and output one vector (a list of floats) per input. They are small — tens to hundreds of millions of parameters — so they run fast on a CPU and add almost nothing to memory. This makes local embeddings the single best-value local workload: no per-token bill, no data leaving the machine, and no API deprecation ever breaking your vector store.

### 6.1 Current embedding models in the Ollama library

> **Verify names and specs with `ollama show`.** These are library entries observed in September 2026; availability and defaults change.

| Model | Params | Download | Dims | Max input (as shipped) |
|---|---|---|---|---|
| `all-minilm` | 22–23M | ~46 MB | 384 | 256 tokens |
| `nomic-embed-text` | 137M | ~274 MB | 768 | 8,192 tokens |
| `mxbai-embed-large` | 335M | ~670 MB | 1024 | 512 tokens |
| `bge-m3` | 567M | ~1.2 GB | 1024 | 8,192 tokens |
| `embeddinggemma` | 300M | ~622 MB | 768 | 2,048 tokens |
| `qwen3-embedding:0.6b` | 0.6B | ~639 MB | adjustable (32–1024) | 32,768 tokens |

Practical picks: `nomic-embed-text` for general English RAG (long context, tiny, every framework has tested against it); `bge-m3` for multilingual corpora; `qwen3-embedding` when you need very long chunks or adjustable dimensions. `all-minilm` is fine for prototypes but its 256-token input truncates most real documents.

**The prefix gotcha.** Some embedding models expect task prefixes on the input (e.g. `search_document:` / `search_query:`). Omitting them silently degrades retrieval. Check the model card and the `ollama show` template before you index a corpus. This is the number-one cause of "my local RAG results are bad."

### 6.2 Embed locally

```bash
ollama pull nomic-embed-text
```

```bash
curl http://localhost:11434/api/embed -d '{
  "model": "nomic-embed-text",
  "input": "The sky is blue because of Rayleigh scattering"
}'
```

Python via the OpenAI SDK's embeddings endpoint:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

def embed(texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model="nomic-embed-text", input=texts)
    return [d.embedding for d in resp.data]

vectors = embed(["first document", "second document"])
print(len(vectors), len(vectors[0]))  # e.g. 2 768
```

### 6.3 Point a vector pipeline at the local embedder

The swap is one line in most RAG frameworks: wherever you constructed a hosted embedding client, construct a local one with the same interface. Sketch with a local store and cosine similarity:

```python
import math, json, pathlib

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

docs = [pathlib.Path(p).read_text() for p in ["a.txt", "b.txt"]]
doc_vecs = embed(docs)
query_vec = embed(["what is the sky made of?"])[0]
ranked = sorted(
    (cosine(query_vec, v) for v in doc_vecs), reverse=True
)
print(ranked[:3])
```

For real corpora, use a proper vector store (Chroma, FAISS, LanceDB, sqlite-vec) and pass it your local vectors. The embedder is the only thing that changed.

## Part 7 — Performance Tuning

Tokens per second is a **memory-bandwidth** problem, not a FLOPs problem. Generating a token requires reading the weights, so a bigger quantized model reads more bytes per token. That is why a 70B model on a fast desktop is still slow: bandwidth, not compute, is the wall.

### 7.1 Knobs that matter

- **GPU layer offload (`num_gpu` in Ollama, `-ngl` / `--n-gpu-layers` in llama.cpp).** How many transformer layers run on the GPU. On Apple Silicon, Metal runs the layers; the rest run on CPU. Ollama auto-selects; override when it guesses wrong.
  ```bash
  ollama run <model> --parameter num_gpu 999
  ```
- **Threads (`num_thread`).** CPU thread count for the layers left on CPU. More is not always faster; past the performance-core count, extra threads add contention. On Apple Silicon, target the number of performance cores.
- **Batch size (`num_batch`).** Prompt-evaluation batch. Larger batches improve prompt processing (prefill) throughput at the cost of memory.
- **Flash attention + KV cache quantization.** Ollama supports `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` (set as environment variables, or via a service override on Linux). This is the main lever for long-context memory.
- **MLX on Apple Silicon.** Since Ollama 0.19 (March 30 2026), supported models run on MLX by default and are substantially faster than the older llama.cpp Metal path on the same machine, especially for MoE models. Ollama's own blog reported decode roughly doubling on a benchmark (specific numbers vary by model and chip — treat vendor benchmarks as directional).

### 7.2 Prompt-eval speed vs token-generation speed

Two different numbers, often reported as one:

- **Prefill / prompt-eval (tokens/sec):** processing your input before the first output token. Compute-bound. Long prompts make this the dominant cost; it is why pasting a 40,000-token file can take minutes before any output appears.
- **Decode / generation (tokens/sec):** producing output. Bandwidth-bound. This is the number people quote.

Always measure both. `llama-bench` is the standard tool:

```bash
llama-bench -m /path/to/model.gguf -p 512 -n 128
# -p 512 = prompt size, -n 128 = tokens generated
```

### 7.3 Rough expectations (Apple Silicon, community reports)

> Date-stamped September 2026. Hardware-dependent estimates, not benchmarks. Re-measure on your own machine.

| Model class (4-bit) | M-class chip | Rough decode speed |
|---|---|---|
| 3B | M-series, 16 GB+ | 60–80 tok/s |
| 7–8B | M-series, 16 GB+ | 40–55 tok/s |
| 14B | M-series Pro/Max | 25–40 tok/s |
| 27–32B | M-series Max, 32–64 GB | 15–25 tok/s |
| 70B | Max/Ultra, 64 GB+ | 12–20 tok/s |

Numbers move fast. Measure with `llama-bench` or by timing a streaming call; do not trust any table, including this one.

## Part 8 — When Local Wins vs Loses

| Workload | Local | Hosted frontier | Why |
|---|---|---|---|
| Private/personal documents | ✅ | ❌ | Data must not leave the machine |
| Bulk embeddings (millions) | ✅ | Costly | $0/token forever vs a recurring bill |
| Offline / air-gapped demos | ✅ | ❌ | No network required |
| Fine-tuning / LoRA | ✅ | Limited | You own the weights and the run |
| Drafting, summarizing, extraction on bounded context | ✅ | Ties | A good 14B–32B is plenty |
| Hard multi-step reasoning | ❌ | ✅ | Frontier models still lead |
| Very long context (100K+) | ❌ (memory wall) | ✅ | KV cache explodes locally |
| Reliable tool / function calling | ⚠️ | ✅ | Local models drop or malform tool calls more often |
| Structured JSON at scale | ⚠️ | ✅ | Quantization can cost you exact digits |

**Decision rule:** route by sensitivity and difficulty. Personal or regulated data → local. High-volume embeddings → local. Anything requiring frontier reasoning, huge context, or dependable tool use → hosted. Keep one OpenAI-compatible interface so routing is a config change, not a rewrite.

## Cheat Sheets

### Ollama commands

| Command | Does |
|---|---|
| `ollama serve` | Start the local server (`:11434`) |
| `ollama pull <model>` | Download a model |
| `ollama run <model>` | Chat interactively |
| `ollama list` | Show installed models and sizes |
| `ollama show <model>` | Architecture, params, quant, context, template |
| `ollama rm <model>` | Delete a model from disk |
| `ollama ps` | Show loaded models and memory use |
| `ollama cp <src> <dst>` | Copy/rename a model |
| `ollama create <name> -f Modelfile` | Build a custom model from a Modelfile |

Ollama environment variables: `OLLAMA_HOST` (bind address), `OLLAMA_MODELS` (storage path), `OLLAMA_KEEP_ALIVE` (how long a model stays loaded), `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`.

### llama.cpp flags (verify with `--help` on your build)

| Flag | Meaning |
|---|---|
| `-m <file.gguf>` | Model file path |
| `-hf <repo>:<quant>` | Download + run a GGUF from Hugging Face |
| `-ngl N` / `--n-gpu-layers N` | Layers to offload to GPU (999 = all) |
| `-c N` / `--ctx-size N` | Context window size |
| `-t N` / `--threads N` | CPU threads |
| `-b N` / `--batch-size N` | Prompt-processing batch |
| `--host 127.0.0.1 --port 8080` | Server bind address |
| `--jinja` | Use the model's built-in chat template |

Tools: `llama-cli` (terminal chat), `llama-server` (OpenAI-compatible HTTP), `llama-bench` (benchmark), `llama-quantize` (produce quants), `convert-hf-to-gguf.py` (Hugging Face → GGUF).

### Model math

| Quantity | Rough formula |
|---|---|
| Model size | `params × bits_per_weight / 8` |
| 7B @ Q4_K_M (~4.8 bpw) | ~4.2 GB |
| 32B @ Q4_K_M | ~19–20 GB |
| 70B @ Q4_K_M | ~40–43 GB |
| KV cache per token | `2 × layers × kv_heads × head_dim × bytes_per_value` |
| F16 KV | 2 bytes/value |
| q8_0 KV | ~1 byte/value (≈half) |
| q4_0 KV | ~0.5 bytes/value (≈quarter) |
| Total memory | model + KV cache + 1–2 GB overhead |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Out-of-memory / process killed / Mac swaps hard | Model + KV cache exceed unified memory | Use a smaller quant (Q4_K_M or lower), lower `num_ctx`, set `OLLAMA_KV_CACHE_TYPE=q8_0`, unload other models (`ollama ps`), close the browser |
| Very slow tokens/sec | Layers on CPU instead of GPU; model too big for VRAM; thermal throttling | Raise `num_gpu`; pick a smaller model; measure with `llama-bench`; watch Activity Monitor for throttling |
| Model won't load | Corrupt download, unsupported architecture, wrong file path | Re-pull; check `ollama show`; confirm the runtime build supports the architecture; verify the GGUF isn't split without its parts |
| Garbage output / wrong chat template | Template mismatch (model expects a specific format) | Use the model's built-in template (`--jinja` where supported); check `ollama show` template; prefer the Modelfile shipped with the model |
| Context overflow / model ignores early instructions | `num_ctx` smaller than the prompt — silent truncation | Raise `num_ctx`; chunk the input; for embeddings, check the model's real max input (`mxbai-embed-large` ships at 512) |
| Embedding search quality poor | Missing task prefixes; truncation; wrong dims | Add the model's required prefixes; verify `num_ctx`; confirm vector dimensions match your index |
| First token takes minutes | Long prompt prefill (compute-bound) | Expect it; split work; use a model with faster prefill; avoid 40K+ prompts locally |
| Model disappears after idle | `OLLAMA_KEEP_ALIVE` expired | Raise `OLLAMA_KEEP_ALIVE` (e.g. `-1` to keep loaded) |

## Video Library

Search links only — no invented URLs. Browse, don't trust a single video's version numbers.

- [Ollama tutorial for beginners](https://www.youtube.com/results?search_query=ollama+tutorial+for+beginners) — install, pull, run.
- [llama.cpp llama-server OpenAI compatible API](https://www.youtube.com/results?search_query=llama.cpp+llama-server+openai+compatible+api) — raw runtime and server flags.
- [GGUF quantization explained](https://www.youtube.com/results?search_query=gguf+quantization+explained+q4_k_m) — the quant naming scheme.
- [MLX on Apple Silicon local LLM](https://www.youtube.com/results?search_query=mlx+apple+silicon+local+llm) — Apple's framework.
- [local RAG with Ollama embeddings](https://www.youtube.com/results?search_query=local+rag+ollama+embeddings) — embeddings + vector store.
- [local LLM memory requirements explained](https://www.youtube.com/results?search_query=local+llm+memory+requirements+explained) — sizing and KV cache.
- [LM Studio tutorial](https://www.youtube.com/results?search_query=lm+studio+tutorial) — the GUI path.
- [llama-bench benchmark tokens per second](https://www.youtube.com/results?search_query=llama-bench+benchmark+tokens+per+second) — measuring honestly.

## Written References & Repos

Official docs and repositories only. If a URL is uncertain, search the name.

- llama.cpp (repo `ggml-org/llama.cpp`) — the GGUF format, quantizer, and `llama-server`. Search: `llama.cpp github`
- Ollama — CLI, Modelfile, API docs, model library. Search: `ollama docs`
- Ollama embedding models library. Search: `ollama embedding models`
- MLX and `mlx-lm` (Apple). Search: `mlx apple github`
- LM Studio. Search: `lm studio`
- Hugging Face GGUF model repos and the "Use Ollama with any GGUF model" guide. Search: `huggingface gguf ollama`
- Hugging Face `mlx-community` org — pre-converted MLX models. Search: `huggingface mlx-community`
- Nomic embedding model card (`nomic-ai/nomic-embed-text-v1.5`). Search: `nomic-embed-text model card`
- mixedbread `mxbai-embed-large-v1` model card. Search: `mxbai-embed-large model card`

## Glossary

- **GGUF** — Model file format defined by llama.cpp; weights + tokenizer + template + metadata in one file. Replaced GGML.
- **GGML** — The older tensor format GGUF superseded.
- **Quantization** — Storing weights at lower precision to shrink a model and speed inference.
- **Bits per weight (bpw)** — Average storage cost per parameter. "4-bit" K-quants typically average ~4.8 bpw.
- **K-quant** — Quant family using super-blocks with per-block scales; `_S`/`_M`/`_L` control the mix.
- **imatrix / IQ** — Importance-matrix calibration that improves low-bit quality; produces `IQ…` quants.
- **Runtime** — The engine that executes the model (llama.cpp, MLX).
- **llama-server** — llama.cpp's OpenAI-compatible HTTP server (default `127.0.0.1:8080`).
- **Ollama** — Convenience layer over llama.cpp (and MLX on supported Apple Silicon models); registry + server on `:11434`.
- **MLX** — Apple's array framework for Apple Silicon, with unified-memory-aware inference and on-device LoRA.
- **KV cache** — Memory holding attention state for the current context; grows with context length.
- **num_ctx** — Configured context window; too small truncates, too large balloons memory.
- **num_gpu / n_gpu_layers** — How many layers run on the GPU.
- **Prompt-eval (prefill)** — Processing the input before the first output token; compute-bound.
- **Decode / generation** — Producing output tokens; memory-bandwidth-bound.
- **Unified memory** — Apple Silicon's shared CPU/GPU memory pool.
- **Chat template** — The formatting rules for turns, baked into the model file.
- **MoE (mixture of experts)** — Architecture activating only a subset of parameters per token; fast for its total size.
- **Embedding model** — Encoder that turns text into vectors; small and CPU-friendly.

## FAQ & Next Steps

**Is local good enough to replace my hosted API?**
For embeddings and privacy-sensitive work, yes. For hard reasoning, very long context, and dependable tool calling, no — keep a frontier model in the loop. Route by task.

**What should I download first?**
A small chat model (4B–8B class) at Q4_K_M and `nomic-embed-text`. That pair covers chat and RAG.

**Why is my model slower than the table?**
Layers are probably on CPU, the model is oversized for memory, or the machine is thermally throttling. Check `ollama ps`, raise `num_gpu`, and measure with `llama-bench`.

**Can I fine-tune locally?**
Yes — LoRA on Apple Silicon via MLX is practical for small models. Full fine-tuning of large models is not.

**How do I keep local and hosted behind one interface?**
Write against the OpenAI shape and set the base URL from an environment variable. Swapping providers becomes a config change.

**Next steps:** (1) Get chat + embeddings running. (2) Build one RAG script over your own documents. (3) Benchmark two quantizations of the same model. (4) Build the second-brain setup below. (5) Add a routing rule: sensitive → local, hard → hosted.

## Bonus — Fully Local Private Second Brain

A worked setup: Ollama embeddings + a local chat model + a small Python script that answers questions over your own notes. Nothing leaves the machine.

```bash
ollama pull nomic-embed-text
ollama pull qwen3.5:4b        # verify the current tag in the library
pip install openai
```

```python
# brain.py — local embeddings + local chat, no network egress
import pathlib
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
EMBED_MODEL = "nomic-embed-text"
CHAT_MODEL  = "qwen3.5:4b"

NOTES = pathlib.Path("~/notes").expanduser()

def chunk(text, size=800, overlap=100):
    words, out, i = text.split(), [], 0
    while i < len(words):
        out.append(" ".join(words[i:i + size]))
        i += size - overlap
    return out

def embed(texts):
    r = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in r.data]

# 1. Index
chunks = []
for p in NOTES.rglob("*.md"):
    try:
        chunks += chunk(p.read_text(errors="ignore"))
    except Exception:
        pass
print(f"indexing {len(chunks)} chunks...")
vectors = embed(chunks) if chunks else []

# 2. Retrieve (brute-force cosine; use a vector store for real corpora)
def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))

def top_k(query, k=4):
    qv = embed([query])[0]
    scored = sorted(zip(chunks, vectors), key=lambda cv: cosine(qv, cv[1]), reverse=True)
    return [c for c, _ in scored[:k]]

# 3. Answer with the local chat model
def ask(question):
    context = "\n\n---\n\n".join(top_k(question))
    r = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": "Answer using only the context. If it's not there, say so."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
        ],
        temperature=0.1,
    )
    return r.choices[0].message.content

if __name__ == "__main__":
    import sys
    print(ask(" ".join(sys.argv[1:]) or "Summarize my notes."))
```

Run it:

```bash
python brain.py "What did I write about embeddings?"
```

To swap to a hosted model, change `base_url` and the two model names. The retrieval logic doesn't move.

## Verification Note

Facts in this paper were checked against primary sources in September 2026:

- **GGUF and the llama.cpp toolchain** — the GGUF format, `llama-quantize`, `convert-hf-to-gguf.py`, imatrix calibration, and the `llama-server` OpenAI-compatible routes (`/v1/chat/completions`, `/v1/embeddings`, default `127.0.0.1:8080`) are from the llama.cpp project (`ggml-org/llama.cpp`).
- **Ollama** — wraps llama.cpp; adopts MLX on supported Apple Silicon models as of 0.19 (March 30 2026); registry defaults to Q4_K_M when present; API on `:11434`; embedding model specs (`nomic-embed-text` 137M/768/8192; `mxbai-embed-large` 335M/1024/512; `bge-m3` 567M; `qwen3-embedding`; `all-minilm`) are from Ollama's library pages and model cards.
- **Performance figures** — the Ollama 0.19 MLX numbers and the tokens/sec tables are directional, hardware-dependent, date-stamped estimates from vendor blog posts and community benchmarks, not controlled measurements.
- **Quant quality percentages** — community rules of thumb compiled from anecdote and small evaluations, explicitly not benchmarks.
- **Model tags** — model families and tags change frequently. Every command in this paper tells you to verify with `ollama list`, `ollama show`, or `--help`. No model tag here should be trusted blindly.

Where a URL could not be confirmed, this paper uses a "search: `<name>`" instruction instead of inventing one.

## Bonus — Handoff Prompt

Copy-paste this to expand the paper into a deeper, verified edition.

```text
You are expanding a long-form technical paper titled
"The Complete Guide: Local & On-Device AI" for a semi-technical Mac user
(Apple Silicon, comfortable in a terminal) who wants a fully local, private
inference stack for embeddings and chat.

Deliverable: ONE Markdown file at
markdown_docs/04-local-on-device-ai-stack.md

Keep the exact section order:
# title, one-liner + Last verified + Series, ## The Big Picture (with ASCII
diagram + analogy table), ## The 60-Second Version, ## Prerequisites,
## Part 1..N, ## Cheat Sheets, ## Troubleshooting, ## Video Library,
## Written References & Repos, ## Glossary, ## FAQ & Next Steps,
## Verification Note, ## Bonus — Handoff Prompt.

Required coverage (one Part each): why local vs hosted (honest about frontier
reasoning); the layers (GGUF, llama.cpp, MLX, Ollama, LM Studio, OpenAI-
compatible endpoint); quantization (naming, bits-per-weight table, K-quants,
Ollama default Q4_K_M); memory math (file size + KV cache + overhead, num_ctx,
sizing 8/16/32/64 GB); hands-on Ollama install/pull/run + OpenAI-compatible
server + Python chat and streaming; local embeddings for RAG; performance
tuning (num_gpu, Metal, threads, batch, prefill vs decode); local wins vs
loses decision table.

Rules:
- Target 3,500–5,000 words, pure Markdown, no HTML, second person, no filler.
- NEVER invent model tags, flags, filenames, or URLs. Write "search: <name>"
  when unsure and tell the reader how to verify (ollama list, ollama show,
  --help).
- Date every performance claim and label it a rough hardware-dependent estimate.
- Use blockquote callouts for memory/thermal/disk limits and "your hardware
  will vary."
- State explicitly that quant quality percentages are community rules of thumb,
  not benchmarks.
- Verify current model names, tags, and flags with web tools before writing,
  and record what you verified in the Verification Note.

Research first with web search (Ollama library pages, llama.cpp repo/README,
MLX docs, Hugging Face GGUF guidance, community tok/s benchmarks). Then write
the full file in one pass. Reply with only: file path, one-line summary,
word count.
```
