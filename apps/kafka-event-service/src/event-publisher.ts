import {
  Kafka,
  logLevel,
  Partitioners,
  type Producer,
} from 'kafkajs';
import {
  ALARM_TOPIC,
  READING_TOPIC,
  type AlarmEvent,
  type ReadingEvent,
} from './contracts.js';

export interface DomainEventPublisher {
  publishReading(event: ReadingEvent): Promise<void>;
  publishAlarm(event: AlarmEvent): Promise<void>;
}

export class KafkaDomainEventPublisher
implements DomainEventPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(brokers: string[]) {
    const kafka = new Kafka({
      clientId: 'smart-metering-domain-event-producer',
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

  async publishReading(event: ReadingEvent): Promise<void> {
    await this.send(READING_TOPIC, event);
  }

  async publishAlarm(event: AlarmEvent): Promise<void> {
    await this.send(ALARM_TOPIC, event);
  }

  private async send(
    topic: string,
    event: ReadingEvent | AlarmEvent,
  ): Promise<void> {
    await this.producer.send({
      topic,
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
