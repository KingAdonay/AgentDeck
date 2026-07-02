import { open } from 'node:fs/promises'

const NEWLINE = 0x0a

/**
 * Incrementally reads complete lines appended to a JSONL file.
 *
 * - Tracks a byte offset, so a large transcript is never re-read.
 * - Only newline-terminated lines are returned; a line still being written
 *   stays buffered (as bytes, so multi-byte UTF-8 split across reads is safe).
 * - If the file shrinks (rotated/rewritten), the tailer resets to the start.
 * - A missing file is treated as empty, never an error.
 */
export class JsonlTailer {
  private offset = 0
  private partial: Buffer = Buffer.alloc(0)

  constructor(readonly filePath: string) {}

  async readNewLines(): Promise<string[]> {
    let handle
    try {
      handle = await open(this.filePath, 'r')
    } catch {
      this.offset = 0
      this.partial = Buffer.alloc(0)
      return []
    }

    try {
      const { size } = await handle.stat()
      if (size < this.offset) {
        this.offset = 0
        this.partial = Buffer.alloc(0)
      }
      if (size === this.offset) return []

      const chunk = Buffer.alloc(size - this.offset)
      await handle.read(chunk, 0, chunk.length, this.offset)
      this.offset = size

      const data = Buffer.concat([this.partial, chunk])
      const lastNewline = data.lastIndexOf(NEWLINE)
      if (lastNewline === -1) {
        this.partial = data
        return []
      }
      this.partial = data.subarray(lastNewline + 1)

      return data
        .subarray(0, lastNewline)
        .toString('utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
    } finally {
      await handle.close()
    }
  }
}
