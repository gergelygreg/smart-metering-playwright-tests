import {
  Kafka,
  logLevel,
  Partitioners,
  type Producer,
} from 'kafkajs';
import {
  TELEMETRY_TOPIC,
  type TelemetryReceivedEvent,
} from './events.js';

export interface TelemetryEventPublisher {
  publishTelemetry(event: TelemetryReceivedEvent): Promise<void>;
}

export class KafkaTelemetryPublisher
implements TelemetryEventPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(brokers: string[]) {
    const kafka = new Kafka({
      clientId: 'smart-metering-mqtt-ingestion',
      brokers,
      logLevel: logLevel.NOTHING,
    });

    this.producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      allowAutoTopicCreation: false,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.producer.disconnect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async publishTelemetry(event: TelemetryReceivedEvent): Promise<void> {
    await this.producer.send({
      topic: TELEMETRY_TOPIC,
      acks: -1,
      messages: [
        {
          key: event.meterId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.eventType,
            eventVersion: String(event.eventVersion),
            correlationId: event.correlationId,
          },
        },
      ],
    });
  }
}
