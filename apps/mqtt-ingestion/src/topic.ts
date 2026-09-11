const telemetryTopic =
  /^smart-metering\/meters\/([0-9a-fA-F-]{36})\/telemetry$/;

export function telemetryTopicFor(meterId: string): string {
  return `smart-metering/meters/${meterId}/telemetry`;
}

export function meterIdFromTelemetryTopic(topic: string): string | null {
  const match = telemetryTopic.exec(topic);
  return match?.[1] ?? null;
}