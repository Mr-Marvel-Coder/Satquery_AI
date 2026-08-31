/**
 * Scripted session data. Mirrors the exact shapes in Contracts 2 and 3 so that
 * swapping VITE_MOCK to 0 changes nothing above this file.
 *
 * The scripted queries cover the five demo beats in section 10 of the spec.
 */

// Koyna basin, Maharashtra. UTM 43N, matching the demo scene set.
export const BOUNDS = [[17.900, 74.100], [18.050, 74.300]]

const svg = (inner, w = 512, h = 400) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`
  )

const NOISE = `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
  <feColorMatrix type="saturate" values="0"/></filter>`

/** Rough stand-in for an 8-bit RGB preview of a Sentinel-2 tile. */
const OPTICAL_PREVIEW = svg(`
  ${NOISE}
  <rect width="512" height="400" fill="#3b4a32"/>
  <path d="M60 300 Q140 250 210 275 T360 240 L400 400 L40 400 Z" fill="#4c5c3a"/>
  <path d="M150 120 Q220 90 300 130 Q360 165 330 215 Q270 255 195 225 Q135 190 150 120 Z" fill="#1d3b52"/>
  <path d="M300 130 Q380 110 440 150 L455 200 Q390 220 335 205 Z" fill="#22465f"/>
  <rect x="380" y="290" width="90" height="70" fill="#6b6355"/>
  <rect x="40" y="60" width="70" height="55" fill="#6f6759"/>
  <rect width="512" height="400" filter="url(#n)" opacity="0.16"/>`)

/** Same footprint with cloud cover — the cross-modal demo pair. */
const OPTICAL_CLOUDY = svg(`
  ${NOISE}
  <rect width="512" height="400" fill="#3b4a32"/>
  <path d="M150 120 Q220 90 300 130 Q360 165 330 215 Q270 255 195 225 Q135 190 150 120 Z" fill="#1d3b52"/>
  <g fill="#e8edf5" opacity="0.88">
    <ellipse cx="240" cy="150" rx="120" ry="78"/>
    <ellipse cx="330" cy="185" rx="95" ry="62"/>
    <ellipse cx="165" cy="190" rx="80" ry="55"/>
  </g>
  <rect width="512" height="400" filter="url(#n)" opacity="0.12"/>`)

/** SAR renders in grayscale. Never colour-stretch dB. */
const SAR_PREVIEW = svg(`
  ${NOISE}
  <rect width="512" height="400" fill="#5a5a5a"/>
  <path d="M150 120 Q220 90 300 130 Q360 165 330 215 Q270 255 195 225 Q135 190 150 120 Z" fill="#111"/>
  <path d="M300 130 Q380 110 440 150 L455 200 Q390 220 335 205 Z" fill="#161616"/>
  <rect x="380" y="290" width="90" height="70" fill="#e6e6e6"/>
  <rect x="40" y="60" width="70" height="55" fill="#dcdcdc"/>
  <rect width="512" height="400" filter="url(#n)" opacity="0.42"/>`)

const maskOverlay = (color, path) => svg(`
  <path d="${path}" fill="${color}" fill-opacity="0.62" stroke="${color}" stroke-width="2.5"/>`)

const WATER_PATH = 'M150 120 Q220 90 300 130 Q360 165 330 215 Q270 255 195 225 Q135 190 150 120 Z'
const VEG_PATH   = 'M20 240 Q120 200 200 250 Q300 300 480 250 L500 400 L20 400 Z'
const CHANGE_PATH= 'M330 40 Q430 30 470 90 Q480 150 420 165 Q350 160 330 100 Z'

export const OVERLAYS = {
  ndwi:   { url: maskOverlay('#12A0B4', WATER_PATH),  label: 'NDWI > 0.2',  kind: 'optical' },
  ndvi:   { url: maskOverlay('#4A8B30', VEG_PATH),    label: 'NDVI > 0.35', kind: 'leaf'    },
  sar:    { url: maskOverlay('#E08A16', WATER_PATH),  label: 'VV < −15 dB', kind: 'radar'   },
  change: { url: maskOverlay('#E0526F', CHANGE_PATH), label: 'Change mask', kind: 'flag'    },
}

export const PREVIEWS = { OPTICAL_PREVIEW, OPTICAL_CLOUDY, SAR_PREVIEW }

const feature = (coords, props) => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Polygon', coordinates: [coords] },
})

export const WATER_BBOX = feature(
  [[74.155, 18.008], [74.222, 18.008], [74.222, 17.968], [74.155, 17.968], [74.155, 18.008]],
  { label: 'water body', confidence: 0.91 }
)

// ---------------------------------------------------------------------------

const SCENES = {
  s2_2024: {
    id: 's2_2024', sensor: 'S2', label: 'Sentinel-2 · 2024-03-14',
    bands: ['B02', 'B03', 'B04', 'B08', 'B11'], gsd: 10, crs: 'EPSG:32643',
    acquired: '2024-03-14T05:41:22Z', preview_png: OPTICAL_PREVIEW, bounds: BOUNDS,
  },
  s2_2022: {
    id: 's2_2022', sensor: 'S2', label: 'Sentinel-2 · 2022-03-09',
    bands: ['B02', 'B03', 'B04', 'B08', 'B11'], gsd: 10, crs: 'EPSG:32643',
    acquired: '2022-03-09T05:41:07Z', preview_png: OPTICAL_PREVIEW, bounds: BOUNDS,
  },
  s2_cloud: {
    id: 's2_cloud', sensor: 'S2', label: 'Sentinel-2 · 2024-07-02 (cloud)',
    bands: ['B02', 'B03', 'B04', 'B08', 'B11'], gsd: 10, crs: 'EPSG:32643',
    acquired: '2024-07-02T05:40:58Z', preview_png: OPTICAL_CLOUDY, bounds: BOUNDS,
  },
  s1_vv: {
    id: 's1_vv', sensor: 'S1', label: 'Sentinel-1 · 2024-07-03 (VV/VH)',
    bands: ['VV', 'VH'], gsd: 10, crs: 'EPSG:32643',
    acquired: '2024-07-03T00:52:11Z', preview_png: SAR_PREVIEW, bounds: BOUNDS,
  },
}

export function mockUpload(files, pairType) {
  const pick = {
    single:      ['s2_2024'],
    bitemporal:  ['s2_2022', 's2_2024'],
    cross_modal: ['s2_cloud', 's1_vv'],
  }[pairType] || ['s2_2024']

  const scenes = pick.map((k) => SCENES[k])
  return Promise.resolve({
    scene_ids: scenes.map((s) => s.id),
    metadata: scenes,
    validation: {
      ok: true,
      crs_match: true,
      co_registered: pairType !== 'single',
      notes: [
        `${scenes.length} GeoTIFF${scenes.length > 1 ? 's' : ''} read`,
        `${scenes[0].crs} · ${scenes[0].gsd} m GSD`,
        pairType === 'single' ? 'single-scene mode' : 'footprints overlap 99.4%',
      ],
    },
  })
}

// --- scripted responses -----------------------------------------------------

const step = (n, tool, version, label, detail, ms, conf, basis) =>
  ({ step: n, tool, version, label, detail, runtime_ms: ms, confidence: conf, confidence_basis: basis })

function script(text) {
  const q = text.toLowerCase()

  // Beat 2 — the compound query. Two tools, one answer.
  if (q.includes('vegetation') && (q.includes('water') || q.includes('surrounding'))) {
    return {
      interpreted_task: 'indices → indices (compound)',
      steps: [
        step(1, 'planner', '0.1', 'Route', 'compound query · 2 tools · indices → indices', 240, 0.88, 'plan_parse'),
        step(2, 'validator', '0.1', 'Validate', '1 GeoTIFF · EPSG:32643 · 5 bands present', 60, 1.0, 'metadata_complete'),
        step(3, 'indices', '0.1', 'NDWI', 'water mask · 11.8% coverage · threshold 0.20', 180, 0.94, 'deterministic'),
        step(4, 'indices', '0.1', 'NDVI', 'buffer ring 500 m · mean NDVI 0.51', 165, 0.92, 'deterministic'),
        step(5, 'vqa', '0.1', 'Compose', 'Qwen2.5-VL · statistics supplied as text', 1420, 0.86, 'answer_token_logprob'),
      ],
      overlays: ['ndwi', 'ndvi'],
      geojson: null,
      answer:
        'A single water body covers 11.8% of the scene, centred in the upper-left quadrant. ' +
        'Within a 500 m buffer around its shoreline, mean NDVI is 0.51 — dense, healthy vegetation ' +
        'on the southern and eastern banks. The northern bank scores 0.19, consistent with exposed ' +
        'soil or a drawdown zone. NDWI and NDVI were computed in NumPy; the model was given the ' +
        'numbers, not asked to estimate them.',
      confidence: 0.89, basis: 'deterministic_indices + answer_token_logprob', abstained: false,
    }
  }

  // Beat 5 — cross-modal. The close.
  if (q.includes('cloud') || q.includes('sar') || q.includes('under')) {
    return {
      interpreted_task: 'cross_modal',
      steps: [
        step(1, 'planner', '0.1', 'Route', 'two modalities detected → cross_modal', 210, 0.93, 'plan_parse'),
        step(2, 'validator', '0.1', 'Validate', '2 GeoTIFFs · S2 + S1 · co-registered 99.4%', 75, 1.0, 'footprint_overlap'),
        step(3, 'fusion', '0.1', 'Fuse', 'NDWI vs VV backscatter · agreement 0.71', 310, 0.71, 'inter_modality_agreement'),
        step(4, 'grounding', '0.1', 'Locate', 'bbox → EPSG:4326 · 74.155–74.222 E', 980, 0.84, 'box_token_logprob'),
        step(5, 'vqa', '0.1', 'Explain', 'disagreement narrated, not resolved silently', 1610, 0.79, 'answer_token_logprob'),
      ],
      overlays: ['sar'],
      geojson: WATER_BBOX,
      answer:
        'Yes. Optical indices suggest bare soil across the northern sector, but SAR backscatter there ' +
        'reads VV −18.3 dB — a smooth surface, consistent with open water beneath cloud shadow in the ' +
        'optical acquisition. The two modalities agree over 71% of the scene; the disagreement is ' +
        'concentrated exactly under the cloud mask. Reporting water at 74.155–74.222 E, 17.968–18.008 N ' +
        'with moderate confidence, flagged for review.',
      confidence: 0.71, basis: 'inter_modality_agreement', abstained: false,
    }
  }

  // Beat 4 — bi-temporal change.
  if (q.includes('chang') || q.includes('between') || q.includes('differ')) {
    return {
      interpreted_task: 'bitemporal_change',
      steps: [
        step(1, 'planner', '0.1', 'Route', 'temporal keyword + 2 dates → change', 195, 0.9, 'plan_parse'),
        step(2, 'validator', '0.1', 'Validate', '2022-03-09 → 2024-03-14 · same footprint', 70, 1.0, 'footprint_overlap'),
        step(3, 'change', '0.1', 'Difference', 'μ + 1.5σ threshold · opening 3×3 · 4.2%', 260, 0.9, 'deterministic'),
        step(4, 'change', '0.1', 'Vectorise', '3 polygons → GeoJSON EPSG:4326', 90, 1.0, 'deterministic'),
        step(5, 'vqa', '0.1', 'Describe', 'facts supplied · model writes prose only', 1380, 0.83, 'answer_token_logprob'),
      ],
      overlays: ['change'],
      geojson: null,
      answer:
        'Change affects 4.2% of the scene between March 2022 and March 2024, concentrated in the ' +
        'north-east. The pattern — angular, contiguous patches replacing previously vegetated ' +
        'surface — is characteristic of built-up expansion rather than seasonal variation, which ' +
        'the matched acquisition months already control for.',
      confidence: 0.83, basis: 'deterministic_mask + answer_token_logprob', abstained: false,
    }
  }

  // Beat 3 — grounding.
  if (q.includes('where') || q.includes('highlight') || q.includes('locate') || q.includes('find')) {
    return {
      interpreted_task: 'grounding',
      steps: [
        step(1, 'planner', '0.1', 'Route', 'locative query → grounding', 205, 0.91, 'plan_parse'),
        step(2, 'validator', '0.1', 'Validate', '1 GeoTIFF · affine transform present', 55, 1.0, 'metadata_complete'),
        step(3, 'grounding', '0.1', 'Locate', 'Qwen native box → pixel (148,96)–(392,246)', 1040, 0.87, 'box_token_logprob'),
        step(4, 'transform', '0.1', 'Reproject', 'EPSG:32643 → EPSG:4326', 35, 1.0, 'deterministic'),
      ],
      overlays: ['ndwi'],
      geojson: WATER_BBOX,
      answer:
        'The water body spans 74.1550–74.2220 E and 17.9680–18.0080 N, roughly 7.1 km by 4.4 km. ' +
        'Bounds are in EPSG:4326, reprojected from the source UTM 43N grid via the scene affine — ' +
        'download the GeoJSON to load it straight into QGIS.',
      confidence: 0.87, basis: 'box_token_logprob', abstained: false,
    }
  }

  // Abstention demo.
  if (q.includes('crop yield') || q.includes('who owns') || q.includes('next year')) {
    return {
      interpreted_task: 'abstain',
      steps: [
        step(1, 'planner', '0.1', 'Route', 'query maps to no registered tool', 230, 0.21, 'plan_parse'),
        step(2, 'validator', '0.1', 'Validate', 'inputs fine · question out of scope', 50, 1.0, 'metadata_complete'),
      ],
      overlays: [],
      geojson: null,
      answer:
        'I can\'t answer that from this imagery. Yield forecasting needs ground truth and a temporal ' +
        'series this scene set doesn\'t contain, and no registered tool produces it. What I can give ' +
        'you from these bands: current vegetation vigour (NDVI), water extent (NDWI), or change ' +
        'against a second date if you upload one.',
      confidence: 0.21, basis: 'no_tool_match', abstained: true,
    }
  }

  // Beat 1 — baseline VQA.
  return {
    interpreted_task: 'single_vqa',
    steps: [
      step(1, 'planner', '0.1', 'Route', 'descriptive query → single_vqa', 215, 0.86, 'plan_parse'),
      step(2, 'validator', '0.1', 'Validate', '1 GeoTIFF · EPSG:32643 · 10 m GSD', 55, 1.0, 'metadata_complete'),
      step(3, 'vqa', '0.1', 'Answer', 'Qwen2.5-VL · S2 sensor context prepended', 1520, 0.85, 'answer_token_logprob'),
    ],
    overlays: [],
    geojson: null,
    answer:
      'A mixed rural scene at 10 m resolution. An irregular inland water body occupies the upper-left ' +
      'quadrant. Agricultural land dominates the southern half in regular field parcels. Two small ' +
      'built-up clusters sit at the top-left and lower-right corners, with what appears to be a road ' +
      'corridor running between them.',
    confidence: 0.85, basis: 'answer_token_logprob', abstained: false,
  }
}

/** Replays the script over SSE-shaped events with believable timing. */
export function mockQueryStream({ text, onEvent, onDone }) {
  const s = script(text)
  let cancelled = false
  const timers = []
  const at = (ms, fn) => timers.push(setTimeout(() => !cancelled && fn(), ms))

  let t = 260
  onEvent({ event: 'interpreted', data: { interpreted_task: s.interpreted_task } })

  s.steps.forEach((st) => {
    at(t, () => onEvent({ event: 'trace_step', data: st }))
    t += Math.min(st.runtime_ms, 900) + 180
  })

  at(t + 220, () => {
    onEvent({
      event: 'final',
      data: {
        text: s.answer,
        geojson: s.geojson,
        overlays: s.overlays,
        confidence: s.confidence,
        basis: s.basis,
        abstained: s.abstained,
        session_id: 'mock-session',
      },
    })
    onDone?.()
  })

  return () => { cancelled = true; timers.forEach(clearTimeout) }
}
