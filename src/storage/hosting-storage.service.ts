import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { CpanelClientService, CpanelError } from './cpanel-client.service.js';
import { normalizeCpanelDiskUsage } from './cpanel-disk-parser.js';
import type { HostingStorageStatsDto } from './hosting-storage.dto.js';

const SUCCESS_TTL_MS = 5 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 1000;

@Injectable()
export class HostingStorageService {
  private readonly logger = new Logger(HostingStorageService.name);
  private success?: { value: HostingStorageStatsDto; expiresAt: number };
  private failure?: { value: HostingStorageStatsDto; retryAt: number };
  private inFlight?: Promise<HostingStorageStatsDto>;

  constructor(private readonly client: CpanelClientService) {}

  async getStats(): Promise<HostingStorageStatsDto> {
    if (this.success && performance.now() < this.success.expiresAt) return structuredClone(this.success.value);
    if (this.failure && performance.now() < this.failure.retryAt) return structuredClone(this.failure.value);
    if (!this.inFlight) {
      this.inFlight = this.measure().finally(() => { this.inFlight = undefined; });
    }
    return structuredClone(await this.inFlight);
  }

  private async measure(): Promise<HostingStorageStatsDto> {
    try {
      const normalized = normalizeCpanelDiskUsage(await this.client.getDiskUsage());
      const value: HostingStorageStatsDto = { ...normalized, measuredAt: new Date().toISOString() };
      this.success = { value, expiresAt: performance.now() + SUCCESS_TTL_MS };
      this.failure = undefined;
      return value;
    } catch (error: unknown) {
      const code = error instanceof CpanelError ? error.code : 'invalid_response';
      // Only fixed enum codes are logged; upstream messages/headers never are.
      this.logger.warn(`Hosting storage measurement unavailable (${code}).`);
      const value: HostingStorageStatsDto = {
        status: code === 'not_configured' ? 'not_configured' : 'unavailable', source: 'cpanel_uapi',
        measuredAt: null, quotaBytes: null, usedBytes: null, availableBytes: null, usagePercent: null,
        isUnlimited: false, errorCode: code,
      };
      this.success = undefined;
      this.failure = { value, retryAt: performance.now() + FAILURE_COOLDOWN_MS };
      return value;
    }
  }
}
