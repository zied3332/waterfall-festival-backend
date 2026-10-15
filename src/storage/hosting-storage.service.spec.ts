import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { CpanelClientService, CpanelError } from './cpanel-client.service.js';
import { cpanelBytes, normalizeCpanelDiskUsage } from './cpanel-disk-parser.js';
import { HostingStorageService } from './hosting-storage.service.js';

function payload(overrides: Record<string, unknown> = {}) {
  return { status: 1, data: [{ id: 'diskusage', _count: '2', _max: '8', units: 'MB', zeroisunlimited: 1, ...overrides }] };
}

describe('Verified cPanel disk metrics', () => {
  it('parses the documented StatsBar envelope and raw binary units', () => {
    expect(normalizeCpanelDiskUsage({ module: 'StatsBar', func: 'get_stats', result: payload() })).toEqual({
      source: 'cpanel_uapi', status: 'ok', quotaBytes: 8388608, usedBytes: 2097152,
      availableBytes: 6291456, usagePercent: 25, isUnlimited: false,
    });
  });

  it.each([
    { input: '1.75 MB', unit: undefined, expected: 1835008 },
    { input: '1,024', unit: 'MB', expected: 1073741824 },
    { input: 2, unit: 'GB', expected: 2147483648 },
    { input: '0 bytes', unit: undefined, expected: 0 },
    { input: '1.5 KiB', unit: undefined, expected: 1536 },
    { input: '0.01', unit: 'MB', expected: 10486 },
    { input: '2 tib', unit: undefined, expected: 2199023255552 },
  ])('converts $input ($unit) to bytes', ({ input, unit, expected }) => {
    expect(cpanelBytes(input, unit)).toBe(expected);
  });

  it.each([null, undefined, '', -1, '-3 MB', 'NaN', Infinity, '1,5 GB', '<b>2 GB</b>', '2 unknown', true, {}, '99999999999999999999999 GB'])('rejects invalid quantities %j', input => {
    expect(cpanelBytes(input, 'MB')).toBeNull();
  });

  it('accepts formatted values when raw fields are absent and preserves raw-field priority', () => {
    expect(normalizeCpanelDiskUsage(payload({ _count: null, _max: null, count: '1.5 GiB', max: '2 GiB' }))).toMatchObject({ usedBytes: 1610612736, quotaBytes: 2147483648, usagePercent: 75 });
    expect(normalizeCpanelDiskUsage(payload({ count: 'different formatted output' })).usedBytes).toBe(2097152);
  });

  it.each(['unlimited', 'UNLIMITED', '\u221e', 0, '0'])('handles explicit unlimited quota %s', quota => {
    expect(normalizeCpanelDiskUsage(payload({ _max: quota }))).toMatchObject({ status: 'unlimited', quotaBytes: null, availableBytes: null, usagePercent: null, usedBytes: 2097152, isUnlimited: true });
  });

  it('requires the documented flag before treating zero quota as unlimited', () => {
    expect(normalizeCpanelDiskUsage(payload({ _max: '0', zeroisunlimited: 0 }))).toMatchObject({ status: 'ok', quotaBytes: 0, availableBytes: 0, usagePercent: null, isUnlimited: false });
    expect(normalizeCpanelDiskUsage(payload({ _count: '10' }))).toMatchObject({ availableBytes: 0, usagePercent: 125 });
  });

  it.each([
    null, { data: [] }, { status: 1, data: {} }, { status: 1, data: [] },
    payload({ _max: null }), payload({ _count: '-1' }), payload({ units: 'unknown' }),
    { status: 1, data: [{ id: 'bandwidthusage', count: '2 GB', max: '8 GB' }] },
    { status: 1, data: [...payload().data, ...payload().data] },
  ])('returns no invented metrics for invalid or unsupported data %j', value => {
    expect(() => normalizeCpanelDiskUsage(value)).toThrow(CpanelError);
  });

  it('classifies API-level permission and unsupported-function responses without echoing raw errors', () => {
    expect(() => normalizeCpanelDiskUsage({ status: 0, errors: ['Permission denied for fake-secret'] })).toThrow('permission_denied');
    expect(() => normalizeCpanelDiskUsage({ status: 0, errors: ['Unknown function get_stats'] })).toThrow('unsupported_metrics');
  });
});

describe('Hosting metrics cache and safe failures', () => {
  const client = { getDiskUsage: jest.fn<CpanelClientService['getDiskUsage']>() };
  let service: HostingStorageService;
  const clock = jest.fn<() => number>();

  beforeEach(() => {
    client.getDiskUsage.mockReset().mockResolvedValue(payload());
    clock.mockReset().mockReturnValue(0);
    jest.spyOn(performance, 'now').mockImplementation(clock);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new HostingStorageService(client as unknown as CpanelClientService);
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('deduplicates concurrent requests and caches normalized measurements for five minutes', async () => {
    const [first, concurrent] = await Promise.all([service.getStats(), service.getStats()]);
    expect(first).toEqual(concurrent);
    expect(first.status).toBe('ok');
    expect(first.measuredAt).not.toBeNull();
    first.usedBytes = 999;
    clock.mockReturnValue(299999);
    expect(await service.getStats()).toEqual(concurrent);
    expect(client.getDiskUsage).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(300001);
    client.getDiskUsage.mockResolvedValueOnce(payload({ _count: '4' }));
    expect((await service.getStats()).usagePercent).toBe(50);
    expect(client.getDiskUsage).toHaveBeenCalledTimes(2);
  });

  it('caches verified unlimited measurements as successful results', async () => {
    client.getDiskUsage.mockResolvedValue(payload({ _max: 'unlimited' }));
    expect((await service.getStats()).status).toBe('unlimited');
    await service.getStats();
    expect(client.getDiskUsage).toHaveBeenCalledTimes(1);
  });

  it('uses a separate short failure cooldown and retries after it expires', async () => {
    client.getDiskUsage.mockRejectedValueOnce(new CpanelError('permission_denied'));
    expect(await service.getStats()).toMatchObject({ status: 'unavailable', errorCode: 'permission_denied', measuredAt: null, usedBytes: null, quotaBytes: null });
    clock.mockReturnValue(29999);
    expect((await service.getStats()).status).toBe('unavailable');
    expect(client.getDiskUsage).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(30001);
    expect((await service.getStats()).status).toBe('ok');
    expect(client.getDiskUsage).toHaveBeenCalledTimes(2);
  });

  it('never presents an expired successful value as current after a failed refresh', async () => {
    await service.getStats(); clock.mockReturnValue(300001);
    client.getDiskUsage.mockRejectedValueOnce(new CpanelError('timeout'));
    expect(await service.getStats()).toMatchObject({ status: 'unavailable', usedBytes: null, quotaBytes: null, measuredAt: null, errorCode: 'timeout' });
  });

  it('returns not_configured independently of local media scanning', async () => {
    client.getDiskUsage.mockRejectedValueOnce(new CpanelError('not_configured'));
    expect(await service.getStats()).toMatchObject({ status: 'not_configured', usedBytes: null, isUnlimited: false });
  });

  it('never returns or logs raw exceptions, upstream fields, or credentials', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn');
    client.getDiskUsage.mockRejectedValueOnce(new Error('fixture-user fixture-host fixture-secret /home/private'));
    const response = await service.getStats();
    const output = JSON.stringify([response, warning.mock.calls]);
    expect(response).toMatchObject({ status: 'unavailable', errorCode: 'invalid_response' });
    expect(output).not.toMatch(/fixture-user|fixture-host|fixture-secret|\/home\/private/);
    clock.mockReturnValue(30001);
    client.getDiskUsage.mockResolvedValueOnce(payload({ _count: 'invalid fixture-secret' }));
    expect((await service.getStats()).status).toBe('unavailable');
  });
});
