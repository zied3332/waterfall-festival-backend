import type { IncomingHttpHeaders } from 'node:http';
import type { CpanelErrorCode } from './cpanel-client.service.js';

export type CpanelErrorHint = 'authentication_rejected' | 'permission_rejected' | 'access_denied' | 'invalid_request' | 'unsupported_function' | 'none';

export interface CpanelResponseDiagnostics {
  httpStatus: number;
  contentType: 'json' | 'html' | 'text' | 'other';
  serverSoftware: 'cpanel' | 'nginx' | 'apache' | 'envoy' | 'squid' | 'litespeed' | 'unknown';
  proxyHeadersPresent: boolean;
  jsonParseable: boolean;
  uapiStatus: 0 | 1 | null;
  errorHint: CpanelErrorHint;
  bodyBytes: number;
  bodyTruncated: boolean;
  tlsAuthorized: boolean | null;
}

export function cpanelErrorHint(text: string): CpanelErrorHint {
  if (/invalid.{0,40}(?:token|password|login)|(?:token|authentication|login).{0,40}(?:invalid|expired|revoked|failed|rejected)/i.test(text)) return 'authentication_rejected';
  if (/permission denied|insufficient (?:permission|privilege)|do not have permission|not authorized to (?:use|execute|access)/i.test(text)) return 'permission_rejected';
  if (/unknown function|invalid (?:api )?function|unsupported (?:function|metric)|not supported|(?:function|feature|metric).{0,30}(?:not available|disabled)/i.test(text)) return 'unsupported_function';
  if (/invalid (?:parameter|request)|missing.{0,30}(?:required|parameter)|required parameter/i.test(text)) return 'invalid_request';
  if (/access denied|blocked|administrative rules|forbidden/i.test(text)) return 'access_denied';
  return 'none';
}

export function cpanelHintCode(hint: CpanelErrorHint): CpanelErrorCode {
  return hint === 'authentication_rejected' ? 'authentication_failed'
    : hint === 'permission_rejected' ? 'permission_denied'
      : hint === 'unsupported_function' ? 'unsupported_metrics'
        : hint === 'invalid_request' ? 'invalid_request'
          : hint === 'access_denied' ? 'access_restricted' : 'upstream_error';
}

export function cpanelResponseDiagnostics(status: number, headers: IncomingHttpHeaders, body: string, bytes: number, truncated: boolean, tlsAuthorized: boolean | null): CpanelResponseDiagnostics {
  const type = String(headers['content-type'] ?? '').toLowerCase();
  const server = String(headers.server ?? '').toLowerCase();
  let jsonParseable = false;
  let uapiStatus: 0 | 1 | null = null;
  try {
    const parsed: unknown = JSON.parse(body);
    jsonParseable = true;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const root = parsed as Record<string, unknown>;
      const result = root.result ?? root;
      if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
        const envelope = result as Record<string, unknown>;
        if ('data' in envelope || 'errors' in envelope) {
          if (envelope.status === 0 || envelope.status === '0') uapiStatus = 0;
          if (envelope.status === 1 || envelope.status === '1') uapiStatus = 1;
        }
      }
    }
  } catch { /* No response content is retained in diagnostics. */ }
  return {
    httpStatus: status,
    contentType: type.includes('application/json') ? 'json' : type.includes('text/html') ? 'html' : type.includes('text/plain') ? 'text' : 'other',
    serverSoftware: /cpanel|cpsrvd/.test(server) ? 'cpanel' : (['nginx', 'apache', 'envoy', 'squid', 'litespeed'] as const).find(value => server.includes(value)) ?? 'unknown',
    proxyHeadersPresent: Boolean(headers.via || headers['proxy-authenticate'] || headers['x-squid-error'] || headers['x-mitmproxy-blocked-reason']),
    jsonParseable, uapiStatus, errorHint: cpanelErrorHint(body), bodyBytes: bytes,
    bodyTruncated: truncated, tlsAuthorized,
  };
}

export function cpanelHttpErrorCode(status: number, diagnostics: CpanelResponseDiagnostics): CpanelErrorCode {
  if (status === 401) return 'authentication_failed';
  if (status >= 300 && status < 400) return 'unexpected_redirect';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status === 404) return 'unsupported_metrics';
  if (status === 403) return diagnostics.errorHint === 'none' ? 'access_restricted' : cpanelHintCode(diagnostics.errorHint);
  return 'upstream_error';
}
