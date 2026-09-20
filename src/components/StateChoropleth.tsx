import { useState } from 'react'
import type { MouseEvent } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { GeoJsonObject } from 'geojson'
import topoRaw from 'us-atlas/states-10m.json?raw'
import type { StateCount } from '../lib/aggregate.ts'
import { formatNumber } from '../lib/format.ts'
import {
  CHOROPLETH_COUNT_COLORS,
  CHOROPLETH_ZERO_COLOR,
  colorForCount,
  fipsToPostal,
} from '../lib/statemap.ts'

const STATES_TOPO = JSON.parse(topoRaw) as unknown as GeoJsonObject

const BORDER_COLOR = '#334155'
const SELECTED_COLOR = '#f59e0b'

interface StateChoroplethProps {
  counts: StateCount[]
  selectedState: string
}

interface HoverInfo {
  postal: string
  count: number
  x: number
  y: number
}

export default function StateChoropleth({ counts, selectedState }: StateChoroplethProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const countByPostal = new Map(counts.map((entry) => [entry.state, entry.count]))
  const maxCount = counts.reduce((max, entry) => Math.max(max, entry.count), 0)

  const trackHover =
    (postal: string, count: number) => (event: MouseEvent<SVGPathElement>) => {
      const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
      if (!bounds) return
      setHover({
        postal,
        count,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    }

  return (
    <div>
      <div className="relative">
        <ComposableMap
          projection="geoAlbersUsa"
          width={960}
          height={500}
          className="block h-auto w-full"
          onMouseLeave={() => setHover(null)}
        >
          <Geographies geography={STATES_TOPO}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const postal = fipsToPostal(geo.id ?? '')
                if (postal === null) return null
                const count = countByPostal.get(postal) ?? 0
                const selected = postal === selectedState
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={colorForCount(count, maxCount)}
                    stroke={selected ? SELECTED_COLOR : BORDER_COLOR}
                    strokeWidth={selected ? 1.4 : 0.4}
                    onMouseMove={trackHover(postal, count)}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-md"
            style={{
              left: hover.x,
              top: hover.y,
              transform: 'translate(-50%, calc(-100% - 10px))',
            }}
          >
            {hover.postal} — {formatNumber(hover.count)}{' '}
            {hover.count === 1 ? 'declaration' : 'declarations'}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>0</span>
        <div className="flex overflow-hidden rounded">
          <span
            aria-hidden="true"
            className="h-3 w-8"
            style={{ backgroundColor: CHOROPLETH_ZERO_COLOR }}
          />
          {CHOROPLETH_COUNT_COLORS.map((color) => (
            <span
              key={color}
              aria-hidden="true"
              className="h-3 w-8"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>{formatNumber(maxCount)}</span>
      </div>
    </div>
  )
}
