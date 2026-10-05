import { useCallback, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import type { GeoJsonObject } from 'geojson'
import topoRaw from 'us-atlas/states-10m.json?raw'
import type { StateCount } from '../lib/aggregate.ts'
import { formatNumber } from '../lib/format.ts'
import { US_STATES } from '../lib/constants.ts'
import {
  CHOROPLETH_COUNT_COLORS,
  CHOROPLETH_ZERO_COLOR,
  colorForCount,
  fipsToPostal,
} from '../lib/statemap.ts'

const STATES_TOPO = JSON.parse(topoRaw) as unknown as GeoJsonObject

const BORDER_COLOR = '#334155'
const SELECTED_COLOR = '#f59e0b'

const STATE_NAME_BY_POSTAL = new Map(US_STATES.map((s) => [s.code, s.name]))

function stateName(postal: string): string {
  return STATE_NAME_BY_POSTAL.get(postal) ?? postal
}

function recordLabel(count: number): string {
  return `${formatNumber(count)} declaration ${count === 1 ? 'record' : 'records'}`
}

interface StateChoroplethProps {
  counts: StateCount[]
  selectedState: string
  onSelectState?: (postal: string) => void
}

interface HoverInfo {
  postal: string
  count: number
  x: number
  y: number
}

export default function StateChoropleth({
  counts,
  selectedState,
  onSelectState,
}: StateChoroplethProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [focusedPostal, setFocusedPostal] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const countByPostal = new Map(counts.map((entry) => [entry.state, entry.count]))
  const maxCount = counts.reduce((max, entry) => Math.max(max, entry.count), 0)

  const clampToWrapper = useCallback((x: number, y: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x, y }
    const margin = 70
    return {
      x: Math.min(Math.max(x, margin), Math.max(margin, rect.width - margin)),
      y: Math.min(Math.max(y, margin), Math.max(margin, rect.height - margin)),
    }
  }, [])

  const trackHover =
    (postal: string, count: number) => (event: MouseEvent<SVGPathElement>) => {
      const svg = event.currentTarget.ownerSVGElement
      if (!svg) return
      const bounds = svg.getBoundingClientRect()
      const pos = clampToWrapper(event.clientX - bounds.left, event.clientY - bounds.top)
      setHover({ postal, count, ...pos })
    }

  const trackFocus =
    (postal: string, count: number) => (event: FocusEvent<SVGPathElement>) => {
      const svg = event.currentTarget.ownerSVGElement
      if (!svg) return
      const svgBounds = svg.getBoundingClientRect()
      const pathBounds = event.currentTarget.getBoundingClientRect()
      const pos = clampToWrapper(
        pathBounds.left + pathBounds.width / 2 - svgBounds.left,
        pathBounds.top + pathBounds.height / 2 - svgBounds.top,
      )
      setFocusedPostal(postal)
      setHover({ postal, count, ...pos })
    }

  const handleBlur = (postal: string) => () => {
    setFocusedPostal((current) => (current === postal ? null : current))
    setHover(null)
  }

  const handleMouseLeavePath = (postal: string) => () => {
    setHover((current) =>
      current && focusedPostal !== postal ? null : current,
    )
  }

  const handleKeyDown =
    (postal: string) => (event: KeyboardEvent<SVGPathElement>) => {
      if (event.repeat) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelectState?.(postal)
      }
    }

  return (
    <div>
      <div className="relative" ref={wrapperRef}>
        <ComposableMap
          projection="geoAlbersUsa"
          width={960}
          height={500}
          className="block h-auto w-full"
          role="group"
          aria-label={`Map of declaration record counts per state in the current view. Highest count is ${formatNumber(maxCount)} records in one state. Equivalent values are listed in the table below.`}
          onMouseLeave={() => {
            if (focusedPostal === null) setHover(null)
          }}
        >
          <Geographies geography={STATES_TOPO}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const postal = fipsToPostal(geo.id ?? '')
                if (postal === null) return null
                const count = countByPostal.get(postal) ?? 0
                const selected = postal === selectedState
                const name = stateName(postal)
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={colorForCount(count, maxCount)}
                    stroke={focusedPostal === postal ? '#16a34a' : selected ? SELECTED_COLOR : BORDER_COLOR}
                    strokeWidth={focusedPostal === postal ? 2.5 : selected ? 1.4 : 0.4}
                    data-state={postal}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name}, ${recordLabel(count)} in the current view. Activate to select ${name}.`}
                    aria-pressed={selected}
                    aria-describedby={hover && hover.postal === postal ? 'state-map-tooltip' : undefined}
                    onMouseMove={trackHover(postal, count)}
                    onMouseLeave={handleMouseLeavePath(postal)}
                    onFocus={trackFocus(postal, count)}
                    onBlur={handleBlur(postal)}
                    onClick={() => onSelectState?.(postal)}
                    onKeyDown={handleKeyDown(postal)}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
        {hover ? (
          <div
            id="state-map-tooltip"
            role="tooltip"
            className="pointer-events-none absolute z-10 max-w-64 rounded-md bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white shadow-md"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 16px)',
              maxWidth: '16rem',
              boxSizing: 'border-box',
            }}
          >
            {stateName(hover.postal)} ({hover.postal}) — {recordLabel(countByPostal.get(hover.postal) ?? 0)}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>0 records</span>
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
        <span>max {formatNumber(maxCount)} records in this view</span>
      </div>
      <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Declaration record counts by state (text table, {counts.length}{' '}
          {counts.length === 1 ? 'state' : 'states'})
        </summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <th scope="col" className="py-1 pr-4 font-semibold">State</th>
              <th scope="col" className="py-1 font-semibold">Declaration records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {counts.map((entry) => (
              <tr key={entry.state}>
                <td className="py-1 pr-4 text-slate-700">
                  {stateName(entry.state)} ({entry.state})
                </td>
                <td className="py-1 text-slate-700">{formatNumber(entry.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
