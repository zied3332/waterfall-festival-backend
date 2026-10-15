import { CpanelError } from './cpanel-client.service.js';
import type { HostingStorageStatsDto } from './hosting-storage.dto.js';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// StatsBar's documented example represents 1024 MB as 1 GB. These are
// cPanel binary display units, not generic SI megabytes from another API.
const UNITS: Record<string, number> = {
  B: 1, BYTE: 1, BYTES: 1, KB: 1024, KIB: 1024,
  MB: 1024 ** 2, MIB: 1024 ** 2, GB: 1024 ** 3, GIB: 1024 ** 3,
  TB: 1024 ** 4, TIB: 1024 ** 4,
};

export function cpanelBytes(value: unknown, unit?: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = String(value).trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return null;
  const units = match[2] ?? (typeof unit === 'string' ? unit.trim() : '');
  const factor = UNITS[units.toUpperCase()];
  if (!factor) return null;
  const bytes = Number(match[1].replaceAll(',', '')) * factor;
  const rounded = Math.round(bytes);
  return Number.isFinite(bytes) && Number.isSafeInteger(rounded) && rounded >= 0 ? rounded : null;
}

function unlimited(value: unknown): boolean {
  return typeof value === 'string' && /^(?:unlimited|∞)$/i.test(value.trim());
}

export function normalizeCpanelDiskUsage(value: unknown): Omit<HostingStorageStatsDto, 'measuredAt'> {
  const root = record(value);
  if (!root || (root.module !== undefined && root.module !== 'StatsBar') || (root.func !== undefined && root.func !== 'get_stats')) throw new CpanelError('invalid_response');
  const result = 'result' in root ? record(root.result) : root;
  if (!result) throw new CpanelError('invalid_response');
  if (result.status !== 1 && result.status !== '1') {
    if (result.status !== 0 && result.status !== '0') throw new CpanelError('invalid_response');
    // Inspect upstream text only for classification. Never return or log it.
    const errors = Array.isArray(result.errors) ? result.errors.filter(error => typeof error === 'string').join(' ') : '';
    throw new CpanelError(/permission|denied|unauthori[sz]ed|privilege|access/i.test(errors) ? 'permission_denied'
      : /unsupported|not supported|unknown function|not available|disabled/i.test(errors) ? 'unsupported_metrics' : 'upstream_error');
  }
  if (!Array.isArray(result.data)) throw new CpanelError('invalid_response');
  const rows = result.data.map(record).filter(row => row?.id === 'diskusage' || row?.name === 'diskusage');
  if (!rows.length) throw new CpanelError('unsupported_metrics');
  if (rows.length !== 1) throw new CpanelError('invalid_response');
  const row = rows[0]!;
  const used = cpanelBytes(row._count ?? row.count, row.units);
  const quotaValue = row._max ?? row.max;
  const quota = cpanelBytes(quotaValue, row.units);
  const zeroIsUnlimited = row.zeroisunlimited === 1 || row.zeroisunlimited === '1' || row.zeroisunlimited === true;
  const isUnlimited = unlimited(quotaValue) || (quota === 0 && zeroIsUnlimited);
  if (used === null || (!isUnlimited && quota === null)) throw new CpanelError('unsupported_metrics');
  return {
    source: 'cpanel_uapi', status: isUnlimited ? 'unlimited' : 'ok',
    quotaBytes: isUnlimited ? null : quota, usedBytes: used,
    availableBytes: !isUnlimited && quota !== null ? Math.max(0, quota - used) : null,
    usagePercent: !isUnlimited && quota !== null && quota > 0 ? used / quota * 100 : null,
    isUnlimited,
  };
}
