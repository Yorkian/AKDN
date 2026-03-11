declare module 'undici' {
  export class ProxyAgent {
    constructor(uri: string | { uri: string; token?: string });
  }

  export class Agent {
    constructor(opts?: {
      connect?: (opts: any, cb: (err: Error | null, socket: any) => void) => void;
    });
  }

  export function fetch(url: string | URL, options?: any): Promise<Response>;
}
