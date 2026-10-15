import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';

const requestMock = jest.fn<(url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest>();
const lookupMock = jest.fn<() => Promise<{ address: string; family: number }[]>>();
jest.unstable_mockModule('node:https', () => ({ request: requestMock }));
jest.unstable_mockModule('node:dns/promises', () => ({ lookup: lookupMock }));
const { CpanelClientService, CpanelHttpService, CpanelError, cpanelOrigin, publicCpanelAddress } = await import('./cpanel-client.service.js');

const token = 'fixture-token-for-cpanel-tests';
const configuration = { CPANEL_HOST: 'cpanel.fixture.test', CPANEL_USERNAME: 'fixtureuser', CPANEL_API_TOKEN: token };

describe('Secure cPanel read-only client', () => {
  let status: number;
  let contentType: string;
  let body: string;
  let hang: boolean;

  beforeEach(() => {
    status = 200; contentType = 'application/json'; body = '{"status":1,"data":[]}'; hang = false;
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    requestMock.mockImplementation((_url, _options, callback) => {
      const req = new EventEmitter() as ClientRequest;
      req.destroy = (error?: Error) => { if (error) req.emit('error', error); req.emit('close'); return req; };
      req.end = (() => {
        if (!hang) queueMicrotask(() => {
          const response = new EventEmitter() as IncomingMessage;
          response.statusCode = status; response.headers = { 'content-type': contentType };
          response.resume = () => response;
          callback(response);
          response.emit('data', Buffer.from(body)); response.emit('end'); req.emit('close');
        });
        return req;
      }) as ClientRequest['end'];
      return req;
    });
  });
  afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

  function client(overrides: Partial<typeof configuration> = {}) {
    return new CpanelClientService(new ConfigService({ ...configuration, ...overrides }), new CpanelHttpService());
  }

  it('constructs only the approved HTTPS GET with the correct authorization and verified TLS', async () => {
    expect(await client().getDiskUsage()).toEqual({ status: 1, data: [] });
    const [url, options] = requestMock.mock.calls[0];
    expect(url.href).toBe('https://cpanel.fixture.test:2083/execute/StatsBar/get_stats?display=diskusage&warnings=0&warnout=1');
    expect(options).toMatchObject({ method: 'GET', rejectUnauthorized: true, family: 4, headers: { Authorization: `cpanel fixtureuser:${token}`, Accept: 'application/json' } });
  });

  it.each(['CPANEL_HOST', 'CPANEL_USERNAME', 'CPANEL_API_TOKEN'] as const)('rejects missing %s without making a request', async key => {
    await expect(client({ [key]: '' }).getDiskUsage()).rejects.toMatchObject({ code: 'not_configured' });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it.each(['http://fixture.test', 'https://user:secret@fixture.test', 'https://fixture.test/cpsess123', 'https://fixture.test?x=1', 'https://fixture.test#x', 'https://fixture.test:80', 'https://127.0.0.1:2083', 'localhost', 'https://[::1]:2083', 'fixture.test/execute/Other/function'])('rejects unsafe host configuration %s', async host => {
    await expect(client({ CPANEL_HOST: host }).getDiskUsage()).rejects.toMatchObject({ code: 'invalid_configuration' });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('accepts only root HTTPS configuration and the documented secure ports', () => {
    expect(cpanelOrigin('https://cpanel.fixture.test:2083/').port).toBe('2083');
    expect(cpanelOrigin('https://cpanel.fixture.test/').port).toBe('');
    expect(cpanelOrigin('cpanel.fixture.test:443').port).toBe('');
  });

  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1'])('rejects private/reserved DNS results %s', async address => {
    await expect(publicCpanelAddress('cpanel.fixture.test', () => Promise.resolve([{ address }]))).rejects.toMatchObject({ code: 'unsafe_destination' });
  });

  it('rejects mixed public/private DNS results and pins a validated public address', async () => {
    await expect(publicCpanelAddress('fixture.test', () => Promise.resolve([{ address: '93.184.216.34' }, { address: '10.1.1.1' }]))).rejects.toMatchObject({ code: 'unsafe_destination' });
    expect(await publicCpanelAddress('fixture.test')).toBe('93.184.216.34');
  });

  it.each([{ status: 401, code: 'authentication_failed' }, { status: 403, code: 'access_restricted' }, { status: 400, code: 'invalid_request' }, { status: 302, code: 'unexpected_redirect' }, { status: 404, code: 'unsupported_metrics' }, { status: 500, code: 'upstream_error' }])('classifies HTTP $status without exposing the upstream body or following redirects', async fixture => {
    status = fixture.status; body = `secret ${token}`;
    const failure = await client().getDiskUsage().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CpanelError);
    expect(failure).toMatchObject({ code: fixture.code });
    expect(String(failure)).not.toContain(token);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { text: 'Access denied.\n', code: 'access_restricted', hint: 'access_denied' },
    { text: '{"errors":["API token is invalid"],"status":0,"data":null}', code: 'authentication_failed', hint: 'authentication_rejected' },
    { text: '{"errors":["Permission denied"],"status":0,"data":null}', code: 'permission_denied', hint: 'permission_rejected' },
    { text: 'Missing required parameter display', code: 'invalid_request', hint: 'invalid_request' },
    { text: 'Unknown function', code: 'unsupported_metrics', hint: 'unsupported_function' },
  ])('distinguishes HTTP 403 with $hint', async fixture => {
    status = 403; body = fixture.text;
    const failure: unknown = await client().getDiskUsage().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: fixture.code, diagnostics: { httpStatus: 403, errorHint: fixture.hint, contentType: 'json' } });
    expect(JSON.stringify(failure)).not.toContain(fixture.text);
  });

  it('recognizes a JSON-labelled plaintext denial without pretending it is a UAPI error', async () => {
    status = 403; body = 'Access denied.\n';
    await expect(client().getDiskUsage()).rejects.toMatchObject({
      code: 'access_restricted', diagnostics: { httpStatus: 403, jsonParseable: false, uapiStatus: null, bodyTruncated: false },
    });
  });

  it('bounds non-200 response inspection without retaining an oversized error body', async () => {
    status = 403; body = 'x'.repeat(65537) + token;
    const failure: unknown = await client().getDiskUsage().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'access_restricted', diagnostics: { httpStatus: 403, bodyTruncated: true } });
    expect(JSON.stringify(failure)).not.toContain(token);
  });

  it('rejects HTML, malformed JSON and oversized responses', async () => {
    contentType = 'text/html';
    await expect(client().getDiskUsage()).rejects.toMatchObject({ code: 'invalid_response' });
    contentType = 'application/json'; body = '{not json';
    await expect(client().getDiskUsage()).rejects.toMatchObject({ code: 'invalid_response' });
    body = 'x'.repeat(1024 * 1024 + 1);
    await expect(client().getDiskUsage()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('applies a deadline even when the connection never supplies a response', async () => {
    jest.useFakeTimers(); hang = true;
    const assertion = expect(client().getDiskUsage()).rejects.toMatchObject({ code: 'timeout' });
    await jest.advanceTimersByTimeAsync(10001);
    await assertion;
  });

  it('sanitizes network exceptions and rejects credential header injection', async () => {
    requestMock.mockImplementationOnce(() => { throw new Error(`upstream included ${token}`); });
    await expect(client().getDiskUsage()).rejects.toMatchObject({ code: 'network_error', message: 'cPanel metrics: network_error' });
    await expect(client({ CPANEL_API_TOKEN: 'fixture-token\r\nInjected: yes' }).getDiskUsage()).rejects.toMatchObject({ code: 'invalid_configuration' });
    await expect(client({ CPANEL_USERNAME: 'user:injected' }).getDiskUsage()).rejects.toMatchObject({ code: 'invalid_configuration' });
  });
});
