# Phase 3A: cPanel account storage monitoring

## API contract

`GET /admin/storage/hosting` uses the existing JWT bearer authentication and
`ADMIN` role authorization. Missing/invalid/expired tokens return 401 and
authenticated non-admin requests return 403 before any cPanel request.

The endpoint returns normalized account disk quota and account disk usage, with
`Cache-Control: no-store`. It is independent of the local media measurements at
`GET /admin/storage/stats`; that endpoint and its response contract are unchanged.
Account usage is not server filesystem capacity, and it is not just gallery or
event-poster storage. Provider accounting may include other account resources.

| Field | Meaning |
| --- | --- |
| `status` | `ok`, `unlimited`, `unavailable`, or `not_configured`. |
| `source` | Always `cpanel_uapi`. |
| `measuredAt` | Timestamp when a valid upstream measurement was normalized; null on failure. Cache reads retain the original timestamp. |
| `quotaBytes` | Verified account quota, or null for unavailable/unlimited quota. |
| `usedBytes` | Verified account usage, or null when a complete supported measurement is unavailable. |
| `availableBytes` | `max(0, quotaBytes - usedBytes)` for a finite quota, otherwise null. |
| `usagePercent` | `usedBytes / quotaBytes * 100` for a finite positive quota; otherwise null. Can exceed 100 for an over-quota account. |
| `isUnlimited` | True only when upstream explicitly reports unlimited quota. |
| `errorCode` | Optional sanitized failure classification. Contains no upstream text or configuration values. |

## Approved cPanel function and normalization

The only upstream request is the documented read-only UAPI function:

```text
GET /execute/StatsBar/get_stats?display=diskusage&warnings=0&warnout=1
```

Documentation references:

- [StatsBar::get_stats](https://api.docs.cpanel.net/specifications/cpanel.openapi/resource-usage-and-statistics/statsbar-get_stats)
- [Official downloadable UAPI OpenAPI specification](https://api.docs.cpanel.net/_spec/specifications/cpanel.openapi.yaml)
- [cPanel API token authentication](https://api.docs.cpanel.net/cpanel/tokens)

The official specification documents a `diskusage` row with `_count`, `_max`,
`units`, formatted `count`/`max`, and `zeroisunlimited`. It shows 1024 MB as
1 GB. The parser therefore uses cPanel's binary display units (1024-based),
including explicit KiB/MiB/GiB/TiB spellings. Other APIs' generic SI units are not
being interpreted by this parser.

Raw `_count` and `_max` take priority, interpreted using the row's units.
Formatted `count`/`max` are fallbacks when raw values are absent. Numeric strings,
strict thousands separators, unit case/spacing and fractional quantities are
supported. Conversion rounds only the final byte value to the nearest integer;
the upstream measurement's own precision is retained. Missing, negative,
non-finite, unsafe-size, malformed, or unknown-unit values are not fabricated.

Only the unique `diskusage` row is used. A bandwidth row or filesystem-free-space
statistic cannot substitute for account quota. Both the documented wrapped
`result` envelope and direct UAPI result envelope are validated. API status must
indicate success. Explicit unlimited text, the infinity symbol, or zero quota
with the documented `zeroisunlimited` flag yields `status: unlimited`. Zero
without that flag is finite zero quota and has null percentage.

## Configuration and request security

The server reads only these existing backend configuration names:

- `CPANEL_HOST`
- `CPANEL_USERNAME`
- `CPANEL_API_TOKEN`

No values are included in this document, API responses, or logs. Do not place
these settings in frontend environment variables or commit an environment file.
There is no credential query/body parameter and no client-supplied upstream URL,
username, API module/function, or path override.

Host configuration accepts a bare DNS hostname (default secure port 2083), an
explicit secure port, or a root HTTPS URL. HTTPS URLs without an explicit port
use standard port 443. Only 2083/443 are allowed. URL credentials, session/API
paths, query strings, fragments, IP literals, insecure HTTP, and malformed
hostnames are rejected. The fixed request path is built in server code.

The transport uses Node's HTTPS client with certificate verification explicitly
enabled, a ten-second total deadline covering DNS/TLS/body reads, and a one-MiB
JSON response limit. It never follows redirects. DNS resolves public IPv4
addresses only, rejects private/reserved/link-local/loopback addresses (including
mixed public/private results), and pins the socket lookup to a validated public
address. IPv6-only endpoints are currently unsupported. No TLS bypass or proxy
endpoint is introduced.

Authentication uses the documented cPanel token header, constructed internally.
Full request headers, raw responses, upstream exception text, usernames, host
values, tokens, and internal filesystem paths are never returned or logged.
Internal NestJS diagnostics include only fixed error codes.

## Cache and failures

Successful validated finite and unlimited measurements are cached in memory for
five minutes. Concurrent requests share one in-flight measurement. Only the
normalized response is cached; credentials and raw upstream responses are not.
Cache values are copied before returning them to callers.

Failures use a separate 30-second cooldown rather than the successful cache.
After cooldown, the next administrator request retries. Expired success data is
not served as current when a refresh fails. Cache and cooldown are per process;
there is no background polling, database persistence, or deployment change.

Error codes distinguish missing/invalid configuration, unsafe destinations,
HTTP authentication/permission failures, timeouts, network failures, malformed
responses, unsupported metrics, upstream failures and rejected redirects. Missing
configuration returns `not_configured`; other failures return `unavailable` with
null measurement values. Upstream error text is not exposed.

## Live verification result

Subsequent [403 investigation](./cpanel-403-investigation.md) found a non-JSON,
pre-UAPI access-denied response. The current client classifies an ambiguous 403
as `access_restricted`; the `permission_denied` example below records the original
probe before that diagnostic refinement. Explicit permission failures retain
`permission_denied`. The investigation includes the safe one-shot diagnostic.

The local environment contained all three required configuration values. A
read-only live request to the configured account returned upstream HTTP 403.
A second check through the new local NestJS endpoint, using isolated local JWT
authentication and no database access, returned this sanitized response:

```json
{
  "status": "unavailable",
  "source": "cpanel_uapi",
  "measuredAt": null,
  "quotaBytes": null,
  "usedBytes": null,
  "availableBytes": null,
  "usagePercent": null,
  "isUnlimited": false,
  "errorCode": "permission_denied"
}
```

**Live account quota and usage have not been verified.** HTTP 403 does not prove
which account/token/hosting access policy rejected the request. The account
owner or hosting provider must verify the configured HTTPS endpoint, API-token
permissions/validity, and whether read-only UAPI access is allowed from the
backend's network. Recheck after that access issue is resolved. No alternative
API, insecure port, redirect, TLS bypass, hardcoded quota, or screenshot-derived
usage value was substituted.

## Automated validation and scope

Automated tests mock HTTPS/DNS and cPanel response data. They never contact the
live account. Fixtures cover documented shapes, conversions, unlimited quotas,
invalid/missing data, authentication/permission errors, timeouts, response size,
redirects, SSRF defenses, cache/cooldown expiry, concurrency, secret sanitization,
admin authorization and local-media endpoint compatibility.

```sh
npm test -- --runInBand
npm run lint:check
npm run build
npx tsc --project tsconfig.spec.json --noEmit
```

This phase does not change frontend components, deployment configuration,
production files, database schema, storage destinations, upload behavior, or
hosting account data. No cPanel modifying/administrative functions are called.
