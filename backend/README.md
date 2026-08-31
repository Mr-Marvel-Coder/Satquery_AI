# SatQuery — Backend

FastAPI. Five registered tools behind one contract. Runs on Colab with a GPU, or
on any laptop without one.

## Run it locally, no GPU, right now

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then point the frontend at `http://localhost:8000` and set `VITE_MOCK=0`.

**The service does not need the vision model to be useful.** Without torch it
starts in seconds and `indices`, `fusion`, `grounding` and `change` all return
real results computed from real pixels. That is not a degraded mode bolted on —
it falls out of the architecture, because the two clauses the PS makes mandatory
are pure NumPy and never touch a model.

What you lose without the VLM: open-ended VQA, and prose narration (deterministic
sentences are used instead). The trace says which, every time — `confidence_basis`
reads `deterministic_template` rather than `answer_token_logprob`, so a report can
never claim model confidence for text a template produced.

On Colab, use `notebooks/satquery_backend.ipynb`.

## Routes

| Method | Route | Notes |
|---|---|---|
| POST | `/upload` | `files[]` + `pair_type` → scene ids, metadata, validation |
| POST | `/query` | `{scene_ids, text}` → SSE: `interpreted`, `trace_step`×N, `final` |
| GET | `/report/{session_id}` | PDF of every trace in the session |
| GET | `/health` | `{status, model_loaded, vlm, tools}` |
| POST | `/warmup` | loads the VLM on demand |
| GET | `/static/*` | previews and mask overlays |

## The five tools

| Tool | Inputs | Method | Confidence basis |
|---|---|---|---|
| `vqa` | single | Qwen2.5-VL + sensor context | `answer_token_logprob` |
| `grounding` | single | index extent, or Qwen boxes | `deterministic_index_extent` / `box_token_logprob` |
| `indices` | single optical | NumPy NDVI/NDWI/NDBI | `deterministic_indices` |
| `indices_ring` | single optical | index measured in a buffer ring | `deterministic_indices` |
| `fusion` | optical + SAR | NDWI vs VV backscatter | `inter_modality_agreement` |
| `change` | bi-temporal | differencing + threshold + opening | `deterministic_mask` |

Adding a sixth is one file in `tools/` plus one line in `agent/registry.py`.

## Rules the code enforces

**Never let the model calculate what can be computed.** Every percentage in every
answer comes from NumPy. The VLM is handed the numbers as text and writes prose
about them; the prompts say "these figures are exact, do not re-estimate".

**Bands resolve by name, never by index position.** A four-band subset and a
twelve-band granule must both answer to `nir`. See `BAND_ALIASES` in
`geo/loader.py`.

**SAR stays in dB.** Stretching it to 8-bit destroys the only signal that makes
fusion work, so the 8-bit copy lives in `preview_png` and never in `array`.

**Everything leaves in EPSG:4326.** A box in pixel coordinates is not evidence —
it cannot be checked against anything. `geo/transform.py` reprojects every box
and polygon through the scene affine.

**Confidence is the weakest link.** A chained plan takes the minimum of its
steps, not the mean, because an average hides the step you should worry about.

**Out-of-scope is decided by rule, before routing.** A VLM asked to forecast a
crop yield will cheerfully try. `OUT_OF_SCOPE` in `agent/planner.py` catches
those first, so abstention is a decision rather than an accident of low
confidence.

## Configuration

Everything is an environment variable, listed in `app/config.py`.

The OOM ladder from section 11 of the build spec is one string:

```bash
SATQUERY_MODEL=Qwen/Qwen2.5-VL-7B-Instruct   # then Qwen2-VL-7B, then Qwen2-VL-2B
SATQUERY_4BIT=1
SATQUERY_BACKEND=auto        # auto | qwen (fail loudly) | stub (never load)
SATQUERY_DATA=/tmp/satquery
```

## Demo scenes

`demo/scenes/` holds four committed GeoTIFFs covering all three input
configurations. They are synthetic but genuinely georeferenced — real UTM 43N
affine, real band descriptions, SAR in dB, physically plausible values — so every
code path runs exactly as it will on real Sentinel data. Real granules are ~1 GB
each and cannot be committed.

Regenerate or edit them with `demo/make_scenes.py`.

**Swap in real data before the demo if you can.** The synthetic scenes prove the
pipeline; real Sentinel-2 and Sentinel-1 over the same footprint will prove the
science, and nothing in the code changes.

## Known gaps

- Scenes live in memory. A Colab restart drops them and `/query` returns 410
  telling you to re-upload, rather than silently reloading something that may
  have changed.
- Cross-modal alignment crops to the common extent rather than resampling.
  Validation has already confirmed the footprints overlap, so this is honest,
  but genuinely misaligned pairs need a reprojection step.
- Change detection compares band means. That is the spec's method and it is
  fast, but it will flag illumination differences as change on scenes that are
  not seasonally matched.
- No auth. The API is open to anyone with the ngrok URL.
