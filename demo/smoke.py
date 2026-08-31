"""End-to-end exercise of every MUST clause, no model, no network."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient
from app.main import app

S = str(ROOT / "demo" / "scenes")
c = TestClient(app)

h = c.get("/health").json()
print(f"health: model_loaded={h['model_loaded']} tools={len(h['tools'])} vlm_err={h['vlm']['error'][:40] if h['vlm']['error'] else None}")

def up(files, pair):
    fs = [("files", (f.split("/")[-1], open(f, "rb"), "image/tiff")) for f in files]
    r = c.post("/upload", files=fs, data={"pair_type": pair})
    assert r.status_code == 200, r.text
    return r.json()

def ask(ids, text):
    with c.stream("POST", "/query", json={"scene_ids": ids, "text": text}) as r:
        assert r.status_code == 200, r.read()
        steps, final = [], None
        for line in r.iter_lines():
            if line.startswith("data:"):
                ev = json.loads(line[5:])
                if ev["event"] == "trace_step": steps.append(ev["data"])
                if ev["event"] == "final": final = ev["data"]
                if ev["event"] == "interpreted": pass
        return steps, final

def show(title, steps, final):
    print(f"\n{'='*74}\n{title}")
    for s in steps:
        print(f"  {s['step']:02d} {s['label']:<18} {s['tool']:<12} {s['runtime_ms']:>5}ms  "
              f"{s['confidence']:.2f} {s['confidence_basis'][:34]}")
        print(f"     {s['detail'][:96]}")
    print(f"  -> conf={final['confidence']} abstained={final['abstained']} "
          f"overlays={len(final['overlays'])} geo={final['geojson']['type'] if final['geojson'] else None}")
    print(f"  {final['text'][:260]}")

# 1 single
u = up([f"{S}/koyna_s2_2024-03-14.tif"], "single")
print("\nvalidation:", u["validation"]["notes"], "ok=", u["validation"]["ok"])
print("scene:", u["metadata"][0]["sensor"], u["metadata"][0]["bands"], u["metadata"][0]["bounds"])
single = u["scene_ids"]
show("1 · VQA baseline", *ask(single, "Describe the land cover in this scene."))
show("2 · COMPOUND (NDWI -> NDVI ring)", *ask(single, "Find the water body and tell me whether the surrounding area has vegetation."))
show("3 · GROUNDING -> lat/lon", *ask(single, "Where exactly is the water body?"))

# 2 bitemporal (MANDATORY)
u = up([f"{S}/koyna_s2_2022-03-09.tif", f"{S}/koyna_s2_2024-03-14.tif"], "bitemporal")
print("\nbitemporal validation:", u["validation"]["notes"])
show("4 · CHANGE (mandatory)", *ask(u["scene_ids"], "What changed between these two dates?"))

# 3 cross-modal (MANDATORY)
u = up([f"{S}/koyna_s2_2024-07-02_cloud.tif", f"{S}/koyna_s1_2024-07-03_vvvh.tif"], "cross_modal")
print("\ncross-modal validation:", u["validation"]["notes"])
steps, final = ask(u["scene_ids"], "Is there water under these clouds?")
show("5 · CROSS-MODAL FUSION (mandatory)", steps, final)
print("  stats:", json.dumps(final["trace"]["outputs"]["stats"].get("fusion", {}), indent=None)[:300])

# 4 abstention
show("6 · ABSTENTION", *ask(single, "What will the crop yield be next year?"))

# 5 report
sid = final["session_id"]
r = c.get(f"/report/{sid}")
print(f"\nreport: {r.status_code} {r.headers.get('content-type')} {len(r.content)} bytes "
      f"pdf={r.content[:5]}")
