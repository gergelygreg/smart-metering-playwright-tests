import { test as base, expect } from '@playwright/test';

import { MeterApiClient } from '../api/MeterApiClient.js';

type ApiFixtures = {
  meterApi: MeterApiClient;
};

export const test = base.extend<ApiFixtures>({
  meterApi: async ({ request }, use) => {
    const meterApi = new MeterApiClient(request);

    await use(meterApi);
  },
});

export { expect };