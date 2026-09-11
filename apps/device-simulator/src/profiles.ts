export type SimulatorProfile =
  | 'normal'
  | 'high-voltage'
  | 'mixed';

export function voltageFor(
  profile: SimulatorProfile,
  sequence: number,
): number {
  switch (profile) {
    case 'normal':
      return round(229.5 + (sequence % 5) * 0.35);

    case 'high-voltage':
      return round(258.0 + (sequence % 4) * 0.75);

    case 'mixed':
      return sequence % 4 === 0
        ? round(260 + (sequence % 3) * 0.4)
        : round(230 + (sequence % 5) * 0.25);
  }
}

export function currentFor(sequence: number): number {
  return round(3.8 + (sequence % 6) * 0.2);
}

export function activePowerFor(
  voltage: number,
  current: number,
): number {
  return round(voltage * current * 0.95);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}