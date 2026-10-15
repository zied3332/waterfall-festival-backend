import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

export type CpanelErrorCode = 'not_configured' | 'invalid_configuration' | 'unsafe_destination' | 'authentication_failed' | 'permission_denied' | 'timeout' | 'network_error' | 'invalid_response' | 'unsupported_metrics' | 'upstream_error' | 'unexpected_redirect';

export class CpanelError extends Error {
  constructor(readonly code: CpanelErrorCode) { super(`cPanel metrics: ${code}`); }
}

const privateAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateAddresses.addSubnet(address, prefix, 'ipv4');

export function cpanelOrigin(host: string): URL {
  // Accept a bare DNS hostname (default port 2083) or a root HTTPS URL.
  // Reject credentials, sessions, API paths, queries, fragments and IP literals.
  if (!/^(?:https:\/\/)?[a-zA-Z0-9.-]+(?::(?:2083|443))?\/?$/.test(host)) throw new CpanelError('invalid_configuration');
  const url = new URL(host.startsWith('https://') ? host : `https://${host.replace(/\/$/, '')}${host.includes(':') ? '' : ':2083'}`);
  const labels = url.hostname.split('.');
  if (isIP(url.hostname) || labels.length < 2 || labels.some(label => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))
    || !['', '443', '2083'].includes(url.port) || url.protocol !== 'https:') throw new CpanelError('invalid_configuration');
  return url;
}

export async function publicCpanelAddress(host: string, resolveAddresses: (host: string) => Promise<{ address: string }[]> = host => lookup(host, { family: 4, all: true })) {
  const addresses = await resolveAddresses(host);
  // Pin the connection to a validated public IPv4 address, preventing a second
  // DNS resolution from rebinding the request to an internal address.
  if (!addresses.length || addresses.some(item => isIP(item.address) !== 4 || privateAddresses.check(item.address, 'ipv4'))) {
    throw new CpanelError('unsafe_destination');
  }
  return addresses[0].address;
}

@Injectable()
export class CpanelHttpService {
  getDiskUsage(url: URL, authorization: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = request(url, {
        method: 'GET', family: 4,
        rejectUnauthorized: true,
        headers: { Authorization: authorization, Accept: 'application/json' },
        lookup: (hostname, _options, callback) => {
          void publicCpanelAddress(hostname).then(address => callback(null, address, 4))
            .catch((error: unknown) => callback(error instanceof CpanelError ? error : new CpanelError('network_error'), '', 4));
        },
      }, response => {
        const status = response.statusCode ?? 0;
        if (status !== 200) {
          response.resume();
          const code = status === 401 ? 'authentication_failed' : status === 403 ? 'permission_denied'
            : status >= 300 && status < 400 ? 'unexpected_redirect' : status === 404 ? 'unsupported_metrics' : 'upstream_error';
          reject(new CpanelError(code)); return;
        }
        if (!response.headers['content-type']?.toLowerCase().includes('application/json')) {
          response.resume(); reject(new CpanelError('invalid_response')); return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) { req.destroy(new CpanelError('invalid_response')); return; }
          chunks.push(chunk);
        });
        response.on('error', () => reject(new CpanelError('network_error')));
        response.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown); }
          catch { reject(new CpanelError('invalid_response')); }
        });
      });
      // Includes DNS, connection, TLS and body reads. No redirects are followed.
      const timer = setTimeout(() => req.destroy(new CpanelError('timeout')), 10000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', (error: Error) => reject(error instanceof CpanelError ? error : new CpanelError('network_error')));
      req.end();
    });
  }
}

@Injectable()
export class CpanelClientService {
  constructor(private readonly config: ConfigService, private readonly http: CpanelHttpService) {}

  async getDiskUsage(): Promise<unknown> {
    const host = this.config.get<string>('CPANEL_HOST')?.trim();
    const username = this.config.get<string>('CPANEL_USERNAME')?.trim();
    const token = this.config.get<string>('CPANEL_API_TOKEN')?.trim();
    if (!host || !username || !token) throw new CpanelError('not_configured');
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username) || !/^[\x21-\x7e]{16,512}$/.test(token)) throw new CpanelError('invalid_configuration');
    let url: URL;
    try { url = new URL('/execute/StatsBar/get_stats?display=diskusage&warnings=0&warnout=1', cpanelOrigin(host)); }
    catch { throw new CpanelError('invalid_configuration'); }
    try { return await this.http.getDiskUsage(url, `cpanel ${username}:${token}`); }
    catch (error: unknown) { throw error instanceof CpanelError ? error : new CpanelError('network_error'); }
  }
}
