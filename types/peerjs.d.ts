// types removed; rely on @types/peerjs

declare module 'peerjs' {
  export interface DataConnection {
    open: boolean;
    send(data: any): void;
    close(): void;
    on(event: string, cb: (...args: any[]) => void): void;
  }
  export default class Peer {
    constructor(id?: string, opts?: any);
    connect(id: string, opts?: any): DataConnection;
    on(event: string, cb: (...args: any[]) => void): void;
    reconnect(): void;
    destroy(): void;
  }
}