import { Component, type ReactNode } from 'react'

/** A failed map chunk must not remove filters, records, or navigation. */
export default class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <p role="alert" className="dl-note">Map unavailable. Use the State filter or browse loaded records. Reload the page to retry the map.</p>
    }
    return this.props.children
  }
}
