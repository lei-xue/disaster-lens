export function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    let settled = false
    const finish = (error: unknown, value?: T) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (error !== null) reject(error)
      else resolve(value as T)
    }
    const onAbort = () => {
      const reason = signal?.reason ?? new DOMException('Aborted', 'AbortError')
      finish(reason)
      controller.abort(reason)
    }
    const timer = setTimeout(() => {
      const error = timeoutError()
      finish(error)
      controller.abort(error)
    }, timeoutMs)
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    Promise.resolve().then(() => {
      controller.signal.throwIfAborted()
      return operation(controller.signal)
    }).then(value => finish(null, value), error => finish(error))
  })
}
