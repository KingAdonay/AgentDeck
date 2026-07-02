import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JsonlTailer } from './jsonl-tailer'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agentdeck-tailer-'))
  file = join(dir, 'session.jsonl')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('JsonlTailer', () => {
  it('returns complete lines and only new ones on subsequent reads', async () => {
    const tailer = new JsonlTailer(file)
    writeFileSync(file, '{"a":1}\n{"a":2}\n')
    expect(await tailer.readNewLines()).toEqual(['{"a":1}', '{"a":2}'])

    appendFileSync(file, '{"a":3}\n')
    expect(await tailer.readNewLines()).toEqual(['{"a":3}'])
    expect(await tailer.readNewLines()).toEqual([])
  })

  it('buffers a partial line until its newline arrives (append mid-write)', async () => {
    const tailer = new JsonlTailer(file)
    writeFileSync(file, '{"a":1}\n{"a":2,"trunc')
    expect(await tailer.readNewLines()).toEqual(['{"a":1}'])

    appendFileSync(file, 'ated":true}\n')
    expect(await tailer.readNewLines()).toEqual(['{"a":2,"truncated":true}'])
  })

  it('reassembles multi-byte UTF-8 split across reads', async () => {
    const tailer = new JsonlTailer(file)
    const line = Buffer.from('{"emoji":"🚀"}\n', 'utf8')
    const splitInsideEmoji = line.length - 4 // cut inside the 4-byte rocket

    writeFileSync(file, line.subarray(0, splitInsideEmoji))
    expect(await tailer.readNewLines()).toEqual([])

    appendFileSync(file, line.subarray(splitInsideEmoji))
    expect(await tailer.readNewLines()).toEqual(['{"emoji":"🚀"}'])
  })

  it('resets when the file shrinks (rotation/rewrite)', async () => {
    const tailer = new JsonlTailer(file)
    writeFileSync(file, '{"a":1}\n{"a":2}\n')
    await tailer.readNewLines()

    writeFileSync(file, '{"fresh":1}\n')
    expect(await tailer.readNewLines()).toEqual(['{"fresh":1}'])
  })

  it('treats a missing file as empty', async () => {
    const tailer = new JsonlTailer(join(dir, 'nope.jsonl'))
    expect(await tailer.readNewLines()).toEqual([])
  })

  it('skips blank lines', async () => {
    const tailer = new JsonlTailer(file)
    writeFileSync(file, '{"a":1}\n\n   \n{"a":2}\n')
    expect(await tailer.readNewLines()).toEqual(['{"a":1}', '{"a":2}'])
  })
})
