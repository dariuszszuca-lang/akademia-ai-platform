import type { IncomingHttpHeaders } from 'node:http'

export type RzutRequest = AsyncIterable<Uint8Array> & {
  method: string
  headers: IncomingHttpHeaders
}

export type RzutResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  write(chunk: string): boolean
  end(chunk?: string): void
}

declare function handler(req: RzutRequest, res: RzutResponse): Promise<void>
export default handler
export declare function jsonFrom(text: string): unknown
