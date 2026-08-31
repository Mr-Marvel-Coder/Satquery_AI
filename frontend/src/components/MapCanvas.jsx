import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import OpacitySlider from './OpacitySlider.jsx'
import Icon from './Icon.jsx'

/** Esri's tiles are free and keyless. Topo is the sheet this product is printed
 *  on; Imagery is the context an analyst wants; Light keeps masks legible. */
const BASEMAPS = {
  topo:    { label: 'Topo',    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}' },
  imagery: { label: 'Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  light:   { label: 'Light',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}' },
}

/** The map lives in a tab that can be hidden. Leaflet caches its container size,
 *  so it must be told when that changes or tiles render into a stale 0×0 box. */
function Resizer() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [28, 28] }) }, [bounds, map])
  return null
}

/** Live lat/lon under the cursor, in the same EPSG:4326 the tools emit. The
 *  cheapest way to keep the georeferencing claim continuously true on screen. */
function Graticule({ onMove }) {
  useMapEvents({
    mousemove: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => onMove(null),
  })
  return null
}

const BOX_STYLE = { color: '#0B7285', weight: 2, opacity: 1, fillColor: '#0B7285', fillOpacity: 0.1, dashArray: '6 4' }

export default function MapCanvas({ scenes, layers, geojson, onDownloadGeoJSON }) {
  const [opacity, setOpacity] = useState(0.72)
  const [active, setActive] = useState([])
  const [cursor, setCursor] = useState(null)
  const [baseIdx, setBaseIdx] = useState(0)
  const [basemap, setBasemap] = useState('topo')

  useEffect(() => { setActive(layers.map((l) => l.id)) }, [layers])
  useEffect(() => { setBaseIdx(0) }, [scenes])

  const base = scenes[baseIdx]
  const bounds = base?.bounds
  const toggle = (id) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded border border-rule bg-sheet shadow-sheet">
      {scenes.length > 1 && (
        <div className="pointer-events-auto absolute left-3 top-3 z-[500] flex overflow-hidden rounded
                        border border-rule bg-sheet shadow-sheet">
          {scenes.map((s, i) => (
            <button key={s.id} onClick={() => setBaseIdx(i)}
                    className={`px-3 py-2 font-mono text-[10px] uppercase tracking-eyebrow
                                border-r border-rule last:border-r-0 transition-colors
                                ${i === baseIdx ? 'bg-primary-soft text-primary-deep' : 'text-ink3 hover:bg-wash hover:text-ink'}`}>
              {s.sensor} · {s.acquired?.slice(0, 10)}
            </button>
          ))}
        </div>
      )}

      <div className="pointer-events-auto absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <div className="flex overflow-hidden rounded border border-rule bg-sheet shadow-sheet">
          {Object.entries(BASEMAPS).map(([k, v]) => (
            <button key={k} onClick={() => setBasemap(k)}
                    className={`px-3 py-2 font-mono text-[10px] uppercase tracking-eyebrow
                                border-r border-rule last:border-r-0 transition-colors
                                ${basemap === k ? 'bg-primary-soft text-primary-deep' : 'text-ink3 hover:bg-wash hover:text-ink'}`}>
              {v.label}
            </button>
          ))}
        </div>
        {geojson && (
          <button onClick={onDownloadGeoJSON} className="btn btn-primary py-2 shadow-lift">
            <Icon name="download" size={15} />
            GeoJSON
          </button>
        )}
      </div>

      <MapContainer bounds={bounds || [[17.9, 74.1], [18.05, 74.3]]} className="h-full w-full">
        <TileLayer key={basemap} url={BASEMAPS[basemap].url} attribution="Tiles &copy; Esri" />
        {base && <ImageOverlay url={base.preview_png} bounds={base.bounds} opacity={1} />}
        {layers.filter((l) => active.includes(l.id)).map((l) => (
          <ImageOverlay key={l.id} url={l.url} bounds={bounds} opacity={opacity} />
        ))}
        {geojson && <GeoJSON key={JSON.stringify(geojson)} data={geojson} style={BOX_STYLE} />}
        <FitBounds bounds={bounds} />
        <Resizer />
        <Graticule onMove={setCursor} />
      </MapContainer>

      <OpacitySlider value={opacity} onChange={setOpacity} layers={layers} active={active} onActive={toggle} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-center gap-4
                      border-t border-rule bg-sheet/92 px-3 py-1.5 backdrop-blur">
        <span className="readout text-ink2">
          <span className="text-primary">LAT</span> {cursor ? cursor.lat.toFixed(5) : '——.—————'}
        </span>
        <span className="readout text-ink2">
          <span className="text-primary">LON</span> {cursor ? cursor.lng.toFixed(5) : '——.—————'}
        </span>
        <span className="readout ml-auto text-ink3">
          {base ? `${base.crs} → EPSG:4326 · ${base.gsd} m` : 'no scene loaded'}
        </span>
      </div>
    </section>
  )
}
