import { z } from 'zod';

export const telemetrySchema = z.object({
  messageId: z.string().uuid(),
  meterId: z.string().uuid(),
  serialNumber: z.string().min(1).max(64),
  firmwareVersion: z.string().min(1).max(64),
  timestamp: z.string().datetime({ offset: true }),
  voltage: z.number().positive(),
  current: z.number().nonnegative(),
  activePower: z.number(),
  energyKwh: z.number().nonnegative(),
  sequence: z.number().int().positive(),
  source: z.literal('smart-meter-device-simulator'),
});

export type TelemetryMessage = z.infer<typeof telemetrySchema>;
