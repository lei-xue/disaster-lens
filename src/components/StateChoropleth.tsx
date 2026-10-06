import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
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

interface PointerTip {
  postal: string
  x: number
  y: number
}

export default function StateChoropleth({
  counts,
  selectedState,
  onSelectState,
}: StateChoroplethProps) {
  // Pointer tooltip: transient, pointer-only, anchored at the pointer. It is
  // never kept alive by keyboard focus or click focus, so it cannot persist
  // after the pointer leaves the map.
  const [tip, setTip] = useState<PointerTip | null>(null)
  // Keyboard focus: tracked separately and surfaced as text OUTSIDE the map,
  // plus a visible stroke on the state shape itself.
  const [focusedPostal, setFocusedPostal] = useState<string | null>(null)
  const [lastFocusedPostal, setLastFocusedPostal] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const countByPostal = new Map(counts.map((entry) => [entry.state, entry.count]))
  const maxCount = counts.reduce((max, entry) => Math.max(max, entry.count), 0)

  // Tooltip half-width estimate; combined with max-w-64 this keeps long
  // state names inside the container at any viewport width.
  const clampToWrapper = useCallback((x: number, y: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x, y }
    const marginX = Math.min(130, rect.width / 2 - 8)
    const marginY = 64
    return {
      x: Math.min(Math.max(x, marginX), Math.max(marginX, rect.width - marginX)),
      y: Math.min(Math.max(y, marginY), Math.max(marginY, rect.height - 8)),
    }
  }, [])

  const trackPointer =
    (postal: string) => (event: PointerEvent<SVGPathElement>) => {
      // Touch can synthesize mousemove after pointerup and recreate a tooltip.
      // Only a genuine mouse pointer may show hover information.
      if (event.pointerType !== 'mouse') return
      const svg = event.currentTarget.ownerSVGElement
      if (!svg) return
      const bounds = svg.getBoundingClientRect()
      const pos = clampToWrapper(event.clientX - bounds.left, event.clientY - bounds.top)
      setTip({ postal, ...pos })
    }

  const clearTip = useCallback(() => setTip(null), [])

  const handleFocus = (postal: string) => () => {
    setFocusedPostal(postal)
    setLastFocusedPostal(postal)
  }

  const handleBlur = (postal: string) => () => {
    setFocusedPostal((current) => (current === postal ? null : current))
  }

  const handleKeyDown =
    (postal: string) => (event: KeyboardEvent<SVGPathElement>) => {
      if (event.repeat) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelectState?.(postal)
      }
    }

  const focusedInfo =
    lastFocusedPostal !== null
      ? { postal: lastFocusedPostal, count: countByPostal.get(lastFocusedPostal) ?? 0 }
      : null
  const focusInfoVisible = focusedPostal !== null && focusedPostal === lastFocusedPostal

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
          onMouseLeave={clearTip}
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
                    stroke={focusedPostal === postal ? '#0f766e' : selected ? SELECTED_COLOR : BORDER_COLOR}
                    strokeWidth={focusedPostal === postal ? 2.5 : selected ? 1.4 : 0.4}
                    data-state={postal}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name}, ${recordLabel(count)} in the current view. Activate to select ${name}.`}
                    aria-pressed={selected}
                    aria-describedby={
                      tip && tip.postal === postal
                        ? 'state-map-tooltip'
                        : focusedPostal === postal
                          ? 'state-map-focus-info'
                          : undefined
                    }
                    onPointerMove={trackPointer(postal)}
                    onMouseLeave={clearTip}
                    onPointerDown={clearTip}
                    onPointerUp={clearTip}
                    onPointerCancel={clearTip}
                    onPointerLeave={clearTip}
                    onFocus={handleFocus(postal)}
                    onBlur={handleBlur(postal)}
                    onClick={() => onSelectState?.(postal)}
                    onKeyDown={handleKeyDown(postal)}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
        {tip ? (
          <div
            id="state-map-tooltip"
            role="tooltip"
            className="pointer-events-none absolute z-10 max-w-64 rounded-md bg-slate-900 px-3 py-2 text-center text-xs font-semibold break-words text-white shadow-md"
            style={{
              left: tip.x,
              top: tip.y,
              transform: 'translate(-50%, calc(-100% - 14px))',
            }}
          >
            {stateName(tip.postal)} ({tip.postal}) —{' '}
            {recordLabel(countByPostal.get(tip.postal) ?? 0)}
          </div>
        ) : null}
      </div>
      {focusedInfo ? (
        <p
          id="state-map-focus-info"
          role="status"
          aria-hidden={focusInfoVisible ? undefined : true}
          className={`mt-2 rounded-md border border-teal-700/40 bg-teal-50 px-3 py-2 text-sm text-teal-950${focusInfoVisible ? '' : ' invisible'}`}
        >
          {stateName(focusedInfo.postal)} ({focusedInfo.postal}) —{' '}
          {recordLabel(focusedInfo.count)} in the current view. Press Enter or
          Space to select {stateName(focusedInfo.postal)}.
        </p>
      ) : null}
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
