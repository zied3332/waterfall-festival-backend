import { Injectable } from '@nestjs/common';
import type { HostingStorageStatsDto } from './hosting-storage.dto.js';

@Injectable()
export class HostingStorageService {
  // Compatibility for older dashboards. No account metrics are measured.
  getStats(): Promise<HostingStorageStatsDto> {
    return Promise.resolve({
      status: 'unavailable', source: 'cpanel_uapi', measuredAt: null,
      quotaBytes: null, usedBytes: null, availableBytes: null,
      usagePercent: null, isUnlimited: false, errorCode: 'integration_disabled',
    });
  }
}
