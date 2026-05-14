'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';

export function StatusStream({ auditId, status }: { auditId: string; status: string }) {
  const [events, setEvents] = useState<Array<{ status: string; message: string; at: string }>>([]);

  useEffect(() => {
    const socket = io(WS_URL);
    socket.on(`audit:${auditId}`, (event) => setEvents((current) => [event, ...current].slice(0, 6)));
    return () => {
      socket.disconnect();
    };
  }, [auditId]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-slate-950/50 p-3">
        <p className="text-sm font-medium">Current status</p>
        <p className="mt-1 text-sm text-primary">{events[0]?.status ?? status}</p>
      </div>
      {events.map((event) => (
        <div key={`${event.status}-${event.at}`} className="rounded-md border border-border p-3 text-sm text-muted">
          {event.message}
        </div>
      ))}
    </div>
  );
}
