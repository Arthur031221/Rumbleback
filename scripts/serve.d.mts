import type { IncomingMessage, Server } from 'node:http';

export function serve(dir: string, port?: number, onRequest?: (req: IncomingMessage) => void): Promise<{ server: Server; url: string }>;
