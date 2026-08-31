import { useCallback, useEffect, useRef, useState } from 'react'
import { query as runQuery } from '../api.js'
import { OVERLAYS } from '../mockData.js'
import UploadPanel from '../components/UploadPanel.jsx'
import MapCanvas from '../components/MapCanvas.jsx'
import ChatPanel from '../components/ChatPanel.jsx'
import TracePanel from '../components/TracePanel.jsx'
import ConfidenceBar from '../components/ConfidenceBar.jsx'

const download = (obj, name) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalystView({ scenes, validation, mode, onMode, uploading, onUpload, onResult, onActiveTool, preload, onOpen }) {
  const [messages, setMessages] = useState([])
  const [trace, setTrace] = useState([])
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [layers, setLayers] = useState([])
  const [geojson, setGeojson] = useState(null)
  const abort = useRef(null)

  // Results handed over from AI mode land here already rendered, so "Open in
  // map" is a continuation rather than a re-run.
  useEffect(() => {
    if (!preload) return
    setResult(preload.result)
    setLayers(preload.layers || [])
    setGeojson(preload.result?.geojson || null)
    setMessages([{ role: 'assistant', text: preload.result.text, abstained: preload.result.abstained }])
  }, [preload])

  const send = useCallback((text) => {
    setMessages((m) => [...m, { role: 'user', text }])
    setTrace([]); setTask(''); setResult(null); setLayers([]); setGeojson(null); setBusy(true)

    abort.current = runQuery({
      sceneIds: scenes.map((s) => s.id),
      text,
      onEvent: (ev) => {
        if (ev.event === 'interpreted') setTask(ev.data.interpreted_task)
        if (ev.event === 'trace_step') setTrace((t) => [...t, ev.data])
        if (ev.event === 'final') {
          const d = ev.data
          setResult(d)
          setMessages((m) => [...m, { role: 'assistant', text: d.text, abstained: d.abstained }])
          setGeojson(d.geojson || null)
          setLayers((d.overlays || []).map((id) => ({ id, ...OVERLAYS[id] })).filter((l) => l.url))
          onResult?.({ query: text, task: d.basis, confidence: d.confidence, abstained: d.abstained })
        }
      },
      onError: (e) => {
        setMessages((m) => [...m, { role: 'assistant', abstained: true,
          text: `The backend didn't respond — ${e.message}. Confirm Colab is running and the ngrok URL in .env matches, then restart Vite.` }])
        setBusy(false)
      },
      onDone: () => setBusy(false),
    })
  }, [scenes, onResult])

  // Lights the matching rows in the sidebar registry. The legend shows every
  // tool this query used, not just the last one, so the sequence stays readable
  // after the run finishes.
  useEffect(() => {
    onActiveTool?.([...new Set(trace.map((s) => s.tool))])
  }, [trace, onActiveTool])

  useEffect(() => () => abort.current?.(), [])

  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      <div className="hidden w-[272px] shrink-0 flex-col gap-3 lg:flex">
        <UploadPanel mode={mode} onMode={onMode} scenes={scenes} validation={validation}
                     busy={uploading} onUpload={onUpload} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <MapCanvas
          scenes={scenes} layers={layers} geojson={geojson}
          onDownloadGeoJSON={() => download(
            { type: 'FeatureCollection', features: [geojson] }, 'satquery_detection.geojson')}
        />
      </div>

      <div className="hidden w-[346px] shrink-0 flex-col gap-3 xl:flex">
        <TracePanel
          steps={trace} task={task} running={busy} abstained={result?.abstained}
          onDownload={() => download(
            { query: messages.at(-2)?.text, interpreted_task: task, execution_sequence: trace,
              composite_confidence: result?.confidence, abstained: result?.abstained,
              timestamp: new Date().toISOString() }, 'satquery_trace.json')}
        />
        <ChatPanel messages={messages} busy={busy} ready={scenes.length > 0} mode={mode} onSend={send}
           onExpand={onOpen ? () => onOpen('orb') : undefined}>  <ConfidenceBar value={result?.confidence} basis={result?.basis} abstained={result?.abstained} />
        </ChatPanel>
      </div>
    </div>
  )
}
