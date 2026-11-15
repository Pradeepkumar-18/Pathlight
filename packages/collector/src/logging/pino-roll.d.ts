// pino-roll ships without types; only the options and stream methods the collector uses.
declare module 'pino-roll' {
  import type { DestinationStream } from 'pino';

  interface PinoRollOptions {
    file: string;
    extension?: string;
    size?: string | number;
    limit?: { count: number };
    mkdir?: boolean;
  }

  interface RollStream extends DestinationStream {
    end(): void;
    once(event: 'close' | 'finish' | 'error', listener: () => void): RollStream;
  }

  function pinoRoll(options: PinoRollOptions): Promise<RollStream>;
  export = pinoRoll;
}
