declare module 'peerjs' {
  export interface PeerJSOption {
    host?: string;
    port?: number;
    path?: string;
    secure?: boolean;
    key?: string;
    debug?: number;
  }

  export interface DataConnection {
    open: boolean;
    send(data: any): void;
    close(): void;
    on(event: string, cb: (...args: any[]) => void): void;
  }

  export default class Peer {
    constructor(id?: string, opts?: PeerJSOption);
    connect(id: string, opts?: any): DataConnection;
    on(event: string, cb: (...args: any[]) => void): void;
    reconnect(): void;
    destroy(): void;
  }
}