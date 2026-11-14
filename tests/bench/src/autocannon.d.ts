// Minimal types for the part of autocannon 9 this benchmark uses (the package ships none).
declare module 'autocannon' {
  interface Histogram {
    average: number;
    p50: number;
    p90: number;
    p99: number;
    max: number;
  }

  export interface Result {
    requests: Histogram & { total: number };
    latency: Histogram;
    errors: number;
    timeouts: number;
    non2xx: number;
    '2xx': number;
  }

  export interface Options {
    url: string;
    connections?: number;
    duration?: number;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  }

  function autocannon(options: Options): Promise<Result>;
  export default autocannon;
}
