import { createServer, type Server } from 'node:http';
import type { AuditHandler } from './audit-handler.js';
import type { EventStore } from './event-store.js';
import type { ProcessorMetrics } from './processor.js';

export interface HealthState {
  isProcessorConnected(): boolean;
  isAuditConnected(): boolean;
  isProducerConnected(): boolean;
  processorMetrics(): ProcessorMetrics;
}

export function startHttpServer(
  port: number,
  state: HealthState,
  audit: AuditHandler,
  store: EventStore,
): Server {
  const server = createServer((request, response) => {
    const url = new URL(
      request.url ?? '/',
      'http://127.0.0.1',
    );

    if (url.pathname === '/health') {
      const processorConnected = state.isProcessorConnected();
      const auditConnected = state.isAuditConnected();
      const producerConnected = state.isProducerConnected();
      const ready =
        processorConnected && auditConnected && producerConnected;

      response.writeHead(ready ? 200 : 503, {
        'content-type': 'application/json',
      });

      response.end(
        JSON.stringify({
          status: ready ? 'UP' : 'DEGRADED',
          service: 'kafka-event-service',
          processorConnected,
          auditConnected,
          producerConnected,
          processorMetrics: state.processorMetrics(),
          auditMetrics: audit.metrics,
          eventCount: store.size(),
        }),
      );
      return;
    }

    if (url.pathname === '/events') {
      const events = store.list({
        correlationId:
          url.searchParams.get('correlationId') ?? undefined,
        meterId:
          url.searchParams.get('meterId') ?? undefined,
        eventType:
          url.searchParams.get('eventType') ?? undefined,
      });

      response.writeHead(200, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify(events));
      return;
    }

    if (url.pathname === '/metrics') {
      response.writeHead(200, {
        'content-type': 'application/json',
      });
      response.end(
        JSON.stringify({
          processor: state.processorMetrics(),
          audit: audit.metrics,
        }),
      );
      return;
    }

    response.writeHead(404, {
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ code: 'NOT_FOUND' }));
  });

  server.listen(port, '0.0.0.0');
  return server;
}
