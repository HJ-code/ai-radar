import { useEffect, useRef } from 'react';
import type { SseAlert } from '../types.ts';

/** 订阅后端 SSE 告警事件；连接掉线自动 3s 重连 */
export function useStream(onAlert: (a: SseAlert) => void): void {
  const cbRef = useRef(onAlert);
  cbRef.current = onAlert;

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: number | undefined;

    const connect = () => {
      es = new EventSource('/api/stream/hotspots');
      es.addEventListener('alert', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent<string>).data) as SseAlert;
          if (data?.keyword) cbRef.current(data);
        } catch { /* 忽略畸形报文 */ }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        retry = window.setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      window.clearTimeout(retry);
      es?.close();
    };
  }, []);
}