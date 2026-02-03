'use client';
import { useEffect, useRef } from 'react';

type RedocInit = (specUrl: string, options: Record<string, unknown>, element: HTMLElement) => void;

export default function ApiReference() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    s.onload = () => {
      const redoc = (window as Window & { Redoc?: { init: RedocInit } }).Redoc;
      redoc?.init('/api/openapi.json', {}, ref.current!);
    };
    document.body.appendChild(s);
    return () => {
      document.body.removeChild(s);
    };
  }, []);

  return <div style={{ height: 'calc(100vh - 64px)' }} ref={ref} />;
}
