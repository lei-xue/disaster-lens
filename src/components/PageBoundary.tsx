import { Component, type ReactNode } from 'react'

export default class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <section aria-labelledby="page-error-title" className="dl-page">
          <h1 id="page-error-title" className="dl-page-title">Page unavailable</h1>
          <p role="alert" className="dl-note">Reload to retry, or choose another page from the navigation.</p>
          <div>
            <button type="button" className="dl-btn dl-btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}
