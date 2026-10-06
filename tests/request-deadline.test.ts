import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestDeadline } from '../src/lib/requestDeadline.ts'
const timeout = () => new Error('deadline reached')
test('deadline rejects a transport that ignores abort and aborts upstream', async () => {
  let upstream: AbortSignal | undefined
  await assert.rejects(withRequestDeadline(signal => { upstream = signal; return new Promise(() => {}) }, undefined, 10, timeout), /deadline reached/)
  assert.equal(upstream?.aborted, true)
})
test('deadline includes stalled body parsing, not only response headers', async () => {
  await assert.rejects(withRequestDeadline(async () => {
    const response = new Response(new ReadableStream({ start() {} }))
    return response.json()
  }, undefined, 10, timeout), /deadline reached/)
})
test('successful completion does not abort upstream later', async () => {
  let upstream: AbortSignal | undefined
  assert.equal(await withRequestDeadline(async signal => { upstream = signal; return 42 }, undefined, 10, timeout), 42)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(upstream?.aborted, false)
})
test('caller cancellation rejects immediately even when transport ignores it', async () => {
  const controller = new AbortController()
  const result = withRequestDeadline(() => new Promise(() => {}), controller.signal, 1000, timeout)
  controller.abort()
  await assert.rejects(result, { name: 'AbortError' })
})
test('late completion cannot replace timeout', async () => {
  let complete!: (value: number) => void
  const result = withRequestDeadline<number>(() => new Promise(resolve => { complete = resolve }), undefined, 10, timeout)
  await assert.rejects(result, /deadline reached/)
  complete(42)
})
