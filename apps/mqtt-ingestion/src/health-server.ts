import { createServer, type Server } from 'node:http';
import type { IngestionMetrics } from './telemetry-handler.js';

export interface HealthState {
  isMqttConnected(): boolean;
  metrics(): IngestionMetrics;
}

export function startHealthServer(
  port: number,
  state: HealthState,
): Server {
  const server = createServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 'NOT_FOUND' }));
      return;
    }

    const mqttConnected = state.isMqttConnected();
    const statusCode = mqttConnected ? 200 : 503;

    response.writeHead(statusCode, {
      'content-type': 'application/json',
    });

    response.end(
      JSON.stringify({
        status: mqttConnected ? 'UP' : 'DEGRADED',
        service: 'mqtt-ingestion',
        mqttConnected,
        metrics: state.metrics(),
      }),
    );
  });

  server.listen(port, '0.0.0.0');
  return server;
}