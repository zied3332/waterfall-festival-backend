import { describe, expect, it } from '@jest/globals';
import { HostingStorageService } from './hosting-storage.service.js';

describe('Disabled hosting statistics compatibility', () => {
  it('requires no configuration or client and returns no invented measurements', async () => {
    const service = new HostingStorageService();
    const expected = {
      status: 'unavailable', source: 'cpanel_uapi', measuredAt: null,
      quotaBytes: null, usedBytes: null, availableBytes: null,
      usagePercent: null, isUnlimited: false, errorCode: 'integration_disabled',
    };
    expect(await service.getStats()).toEqual(expected);
    const changed = await service.getStats(); changed.quotaBytes = 123;
    expect(await service.getStats()).toEqual(expected);
  });
});
