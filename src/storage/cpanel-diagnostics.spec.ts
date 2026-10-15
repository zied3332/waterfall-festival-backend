import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { cpanelResponseDiagnostics, cpanelHttpErrorCode } from './cpanel-diagnostics.js';

const lookupMock = jest.fn<() => Promise<{ address: string; family: number }[]>>();
jest.unstable_mockModule('node:dns/promises', () => ({ lookup: lookupMock }));
const { CpanelError } = await import('./cpanel-client.service.js');
const { diagnoseCpanel } = await import('./cpanel-diagnostic-command.js');
type Client = import('./cpanel-client.service.js').CpanelClientService;

describe('Sanitized cPanel diagnostic command', () => {
  const secrets = { CPANEL_HOST: 'https://fixture-cpanel.test:2083', CPANEL_USERNAME: 'fixture-private-user', CPANEL_API_TOKEN: 'fixture-private-token' };
  const client = { getDiskUsage: jest.fn<Client['getDiskUsage']>() };
  beforeEach(() => { lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); client.getDiskUsage.mockReset(); });
  afterEach(() => { jest.clearAllMocks(); });

  it('reports bounded classifications without copying headers, bodies, cookies or paths', async () => {
    const body = `Access denied. ${Object.values(secrets).join(' ')} /home/private`;
    const diagnostics = cpanelResponseDiagnostics(403, {
      'content-type': 'application/json', 'server': 'envoy', via: 'private-proxy-value',
      'set-cookie': ['secret-cookie=value'], 'x-request-id': 'private-request-id',
    }, body, body.length, false, true);
    client.getDiskUsage.mockRejectedValue(new CpanelError('access_restricted', diagnostics));
    const result = await diagnoseCpanel(new ConfigService(secrets), client as unknown as Client);
    expect(result).toMatchObject({ hostValid: true, dnsPublicIpv4Resolved: true, errorCode: 'access_restricted', diagnostics: { httpStatus: 403, contentType: 'json', jsonParseable: false, proxyHeadersPresent: true, serverSoftware: 'envoy', tlsAuthorized: true } });
    const output = JSON.stringify(result);
    for (const secret of [...Object.values(secrets), 'secret-cookie', 'private-proxy-value', 'private-request-id', '/home/private']) expect(output).not.toContain(secret);
  });

  it('does not infer an upstream identity or credentials failure from a bare 403', () => {
    const diagnostics = cpanelResponseDiagnostics(403, {}, '', 0, false, true);
    expect(diagnostics).toMatchObject({ uapiStatus: null, serverSoftware: 'unknown', errorHint: 'none' });
    expect(cpanelHttpErrorCode(403, diagnostics)).toBe('access_restricted');
  });

  it('recognizes cPanel/UAPI metadata without returning raw errors', () => {
    const body = '{"result":{"status":0,"errors":["Invalid token fixture-private-token"],"data":null}}';
    const diagnostics = cpanelResponseDiagnostics(403, { server: 'cpsrvd', 'content-type': 'application/json' }, body, body.length, false, true);
    expect(diagnostics).toMatchObject({ uapiStatus: 0, serverSoftware: 'cpanel', jsonParseable: true, errorHint: 'authentication_rejected' });
    expect(cpanelHttpErrorCode(403, diagnostics)).toBe('authentication_failed');
    expect(JSON.stringify(diagnostics)).not.toContain('fixture-private-token');
  });

  it('requires configuration and valid public DNS without contacting HTTP on preflight failure', async () => {
    expect(await diagnoseCpanel(new ConfigService({ ...secrets, CPANEL_API_TOKEN: '' }), client as unknown as Client)).toMatchObject({ errorCode: 'not_configured' });
    lookupMock.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    expect(await diagnoseCpanel(new ConfigService(secrets), client as unknown as Client)).toMatchObject({ errorCode: 'unsafe_destination' });
    expect(client.getDiskUsage).not.toHaveBeenCalled();
  });

  it('verifies supported metrics without outputting credentials or the raw response', async () => {
    client.getDiskUsage.mockResolvedValue({ status: 1, data: [{ id: 'diskusage', _count: '2', _max: '8', units: 'MB' }], internalSecret: secrets.CPANEL_API_TOKEN });
    expect(await diagnoseCpanel(new ConfigService(secrets), client as unknown as Client)).toMatchObject({ result: 'measurement_supported', diagnostics: null });
    expect(client.getDiskUsage).toHaveBeenCalledTimes(1);
  });
});
