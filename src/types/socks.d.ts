declare module 'socks' {
  interface SocksClientOptions {
    proxy: {
      host: string;
      port: number;
      type: 4 | 5;
      userId?: string;
      password?: string;
    };
    destination: {
      host: string;
      port: number;
    };
    command: 'connect' | 'bind' | 'associate';
    timeout?: number;
  }

  interface SocksClientEstablishedEvent {
    socket: import('net').Socket;
  }

  export class SocksClient {
    static createConnection(options: SocksClientOptions): Promise<SocksClientEstablishedEvent>;
  }
}
