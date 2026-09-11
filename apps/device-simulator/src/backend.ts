export interface Meter {
  id: string;
  serialNumber: string;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE';
  firmwareVersion: string;
}

export async function ensureMeter(
  baseUrl: string,
  serialNumber: string,
  firmwareVersion: string,
): Promise<Meter> {
  const api = baseUrl.replace(/\/$/, '');

  const listResponse = await fetch(`${api}/api/meters`);

  if (!listResponse.ok) {
    throw new Error(
      `Could not list meters: ${listResponse.status} ${await listResponse.text()}`,
    );
  }

  const meters = (await listResponse.json()) as Meter[];
  const existing = meters.find(
    (meter) => meter.serialNumber === serialNumber,
  );

  if (existing) {
    return existing;
  }

  const createResponse = await fetch(`${api}/api/meters`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      serialNumber,
      status: 'ONLINE',
      firmwareVersion,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(
      `Could not provision meter: ${createResponse.status} ${await createResponse.text()}`,
    );
  }

  return (await createResponse.json()) as Meter;
}