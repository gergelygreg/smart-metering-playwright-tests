import { test as base, expect } from '@playwright/test';

import { MeterApiClient } from '../api/MeterApiClient.js';
import { TrackedMeterApiClient } from './TrackedMeterApiClient.js';

type ApiFixtures = {
  meterApi: MeterApiClient;
};

export const test = base.extend<ApiFixtures>({
  meterApi: async ({ request }, use) => {
    const meterApi = new TrackedMeterApiClient(request);

    try {
      await use(meterApi);
    } finally {
      await meterApi.cleanupCreatedMeters();
    }
  },
});

export { expect };
