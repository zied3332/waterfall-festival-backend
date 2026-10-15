import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { CpanelClientService, CpanelError, CpanelHttpService, cpanelOrigin, publicCpanelAddress } from './cpanel-client.service.js';
import { normalizeCpanelDiskUsage } from './cpanel-disk-parser.js';

export async function diagnoseCpanel(configuration: ConfigService, client = new CpanelClientService(configuration, new CpanelHttpService())) {
  const report = {
    executionPlatform: process.platform,
    method: 'GET', path: '/execute/StatsBar/get_stats',
    parameters: { display: 'diskusage', warnings: 0, warnout: 1 },
    configurationPresent: ['CPANEL_HOST', 'CPANEL_USERNAME', 'CPANEL_API_TOKEN'].every(key => Boolean(configuration.get<string>(key)?.trim())),
    hostValid: false, dnsPublicIpv4Resolved: false,
  };
  try {
    if (!report.configurationPresent) throw new CpanelError('not_configured');
    const origin = cpanelOrigin(configuration.get<string>('CPANEL_HOST')!.trim());
    report.hostValid = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        publicCpanelAddress(origin.hostname),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new CpanelError('timeout')), 10000); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
    report.dnsPublicIpv4Resolved = true;
    normalizeCpanelDiskUsage(await client.getDiskUsage());
    return { ...report, result: 'measurement_supported' as const, errorCode: null, diagnostics: null };
  } catch (error: unknown) {
    const failure = error instanceof CpanelError ? error : new CpanelError('network_error');
    return { ...report, result: 'unavailable' as const, errorCode: failure.code, diagnostics: failure.diagnostics ?? null };
  }
}

// A one-shot, read-only CLI, not a public diagnostic endpoint. Importing this
// module in tests does not load environment files or contact the live account.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    if (process.argv.length > 2) {
      console.log(JSON.stringify({ result: 'no_arguments_accepted' }));
      process.exitCode = 2; return;
    }
    loadEnv({ quiet: true });
    const report = await diagnoseCpanel(new ConfigService());
    console.log(JSON.stringify(report, null, 2));
    if (report.result !== 'measurement_supported') process.exitCode = 2;
  })().catch(() => {
    console.log(JSON.stringify({ result: 'diagnostic_failed' }));
    process.exitCode = 2;
  });
}
