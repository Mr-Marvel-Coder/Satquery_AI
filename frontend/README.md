# SatQuery AI — Frontend

Vite + React 18 + Tailwind + Leaflet. Panel names and the API surface match
sections 4–6 of the build spec, so nothing here changes when the backend lands.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

No backend needed. `VITE_MOCK=1` replays a scripted session covering all five
demo beats. If `VITE_API_URL` is empty the app falls into mock mode by itself,
so a missing `.env` can never leave it firing requests at nothing.

When Colab is live: paste the ngrok URL into `.env`, set `VITE_MOCK=0`, restart
Vite. Nothing else changes.

Sign in with anything (`a@b.com` / `1234`) or press **Continue as demo analyst**.

## Navigation

A collapsible sidebar. The handle straddles the rule at the top edge; collapsed
it drops to a 76px icon rail with hover tooltips, and the state persists across
reloads. Below 1024px it becomes a drawer behind a hamburger.

The **tool registry is in the sidebar**, not buried in a config file. All five
tools are listed with a status dot, and the one currently executing lights up.
A judge can see the registry exists without being told.

## Three surfaces

**Overview** — session status, the three curated scene sets, query history with
confidence, and the two ways into the product.

**Workspace** — the analyst view. Map, layers, execution trace, GeoJSON export.
This is where the evidence lives.

**AI mode** — the orb. Voice or text in ten Indian languages. The router lights
the tools it picks and fans results out as cards.

On a dark canvas an orb is made of light. On paper it has to be made of pigment,
so this one is a saturated sphere in a soft chromatic wash with a real cast
shadow, rather than a glow.

## How AI mode works

The orb is driven by real signal, not a canned animation:

- Radiating bars are live FFT bins from the microphone via `AnalyserNode`. Quiet
  room, quiet orb. Mic off, it breathes on a slow sine instead of faking audio.
- Ring colour is system state on the same semantic palette as the rest of the
  app — cyan nominal, amber working, rose flagged.
- Orbital arcs spin faster while the router is working. That is the only motion
  cue that a tool is actually running.

The connector web is not decoration. Left column is what was loaded, right column
is the tool registry, the orb is the router. When a tool is selected its line
lights and a pulse travels along it toward the orb, **in execution order**. The
PS asks the system to select *and sequence*; here the sequence is drawn.

Try the compound query — "find the water body and tell me whether the surrounding
area has vegetation" — and watch two separate index lines fire in turn.

## Voice and language

Speech in and out use the browser's built-in engines through
`src/hooks/useSpeech.js`. Chrome already handles the ten Indian languages in the
picker, at zero cost and zero latency budget. That is the honest reason to reach
for it before Bhashini.

When Bhashini goes in it replaces the bodies of `listen` and `speak`. Nothing
above that file changes.

Voice needs Chrome and needs `localhost` or HTTPS. Typing works everywhere.

## Backend contract

`src/api.js` is the only file that touches the network.

| Function | Route |
|---|---|
| `health()` | `GET /health` |
| `upload(files, pairType)` | `POST /upload` |
| `query({sceneIds, text, onEvent})` | `POST /query` → SSE |
| `reportUrl(sessionId)` | `GET /report/{id}` |

SSE events consumed: `interpreted`, `trace_step`, `final`. The parser splits on
blank lines and skips malformed frames rather than killing the stream — a bad
frame from the router should not end the demo.

`ngrok-skip-browser-warning` is set on every request; without it ngrok's free
tier interstitial breaks `fetch`.

## Design system — the survey sheet

The light theme is not a generic dashboard palette. It is drawn from the visual
language this product already lives in: topographic sheets, nautical charts and
aerial mosaics are all light, and they have a specific grammar.

**Paper.** `#EEF1F5`, a cool chart stock rather than a warm cream. A graticule is
ruled under the entire app — fine 32px lines with a heavier 128px grid over them,
because a survey sheet is ruled before anything is printed on it.

**Corners are 2–3px, never soft.** Map sheets and instruments have corners. Large
radii would read as consumer software.

**Colour is a legend key, not a brand palette.** Every accent means one thing:

| Key | Hex | Means |
|---|---|---|
| Teal | `#0B7285` | Sentinel-2 / optical / nominal |
| Ochre | `#A9610A` | Sentinel-1 / SAR / working |
| Carmine | `#B0264C` | disagreement, abstention, failure |
| Moss | `#2F7A3E` | vegetation indices only |

If a thing is teal on this screen it is because it came from the optical path.
That rule is what lets the cross-modal demo read without narration.

**Type.** Familjen Grotesk for display — a grotesque with real character in its
letterforms, used with restraint on headings and the wordmark. Public Sans for
body, which comes from the same institutional world as survey sheets. IBM Plex
Mono for every number, coordinate, EPSG code and runtime.

**Icons are drawn for this product**, not imported. The glyphs borrow from map
marginalia — quad sheets, benchmarks, crosshairs, swath diagrams — so navigation
speaks the same language as the data.

## The sidebar is a map legend

A survey sheet keys its symbols down one margin: sections ruled off, each entry a
glyph beside its meaning, a scale bar and north arrow at the foot. That grammar
does real work here, because the tool registry genuinely is a legend — each tool
paints the map in its own colour, and the swatch beside its name is the colour it
paints.

Collapsed to 62px, the labels drop away and the glyphs remain, which is what a
legend looks like once you know the key. Hovering a glyph shows its label. The
state persists across reloads.

The registry rows light up as tools fire, in both Workspace and AI mode, so the
sidebar is a live readout rather than static navigation.

## File map

```
src/
├── App.jsx                 shell: session, scenes, history
├── api.js                  the only file that touches the network
├── auth.js                 local session, no server
├── mockData.js             scripted session for all five demo beats
├── hooks/
│   ├── useMicLevel.js      Web Audio analyser → orb
│   └── useSpeech.js        STT + TTS · swap point for Bhashini
├── views/
│   ├── LoginView.jsx       ground-track hero
│   ├── DashboardView.jsx   status, scene library, history
│   ├── AnalystView.jsx     map + trace + chat
│   └── OrbView.jsx         AI mode
└── components/
    ├── Icon.jsx            custom cartographic glyph set + wordmark
    ├── Sidebar.jsx         collapsible legend panel
    ├── TopBar.jsx          title, scene keys, backend status
    ├── OrbCore.jsx         canvas orb, 60fps off two refs
    ├── NodeGraph.jsx       router connector web
    ├── ResultCard.jsx      one card per tool result
    ├── MapCanvas.jsx  OpacitySlider.jsx  UploadPanel.jsx
    └── TracePanel.jsx  ChatPanel.jsx  ConfidenceBar.jsx
```

## Known gaps

- **Everything answers from `mockData.js`.** The API contract is real; the
  responses are scripted. Point it at Colab and they become real.
- Workspace needs ~1280px wide for all three columns. Fine for a projector.
- Basemaps are Esri (Topo, Imagery, Light) — free and keyless. CARTO now needs
  an API key.
- The Evidence card in AI mode shows the scene preview with masks composited by
  CSS, not a real map. "Open in map" hands the result to the Workspace tab,
  which does render it properly on Leaflet.
- Result cards land in fixed positions with a fan-out animation. They close but
  do not drag — deliberately, because draggable cards are one more thing to
  break on stage.
- Auth is local-only. No server, no security. It exists to group analyses by
  session and give the product a front door.
