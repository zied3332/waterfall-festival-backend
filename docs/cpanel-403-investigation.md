# cPanel 403 investigation

## Verified request contract

The client uses a verified HTTPS GET on secure cPanel port 2083 for the configured
account, with the documented cPanel token authorization format. The fixed path
and parameters are:

```text
/execute/StatsBar/get_stats?display=diskusage&warnings=0&warnout=1
```

Official references:

- [UAPI StatsBar::get_stats](https://api.docs.cpanel.net/specifications/cpanel.openapi/resource-usage-and-statistics/statsbar-get_stats)
- [UAPI OpenAPI specification](https://api.docs.cpanel.net/_spec/specifications/cpanel.openapi.yaml)
- [cPanel token authentication](https://api.docs.cpanel.net/cpanel/tokens)
- [cPanel guidance on token/account mismatches](https://support.cpanel.net/hc/en-us/community/posts/23688507652759-Cpanel-user-token-access-denied)

The specification marks this operation read-only. `display` is required and
`diskusage` is supported. `warnings=0` returns all results. `warnout=1` includes
values at 100%, rather than hiding an exhausted quota. Both are valid optional
parameters. There is no documented extra StatsBar-specific token scope. cPanel
tokens authenticate the associated account; hosting package features/server
configuration can still limit which metrics are available. Do not confuse cPanel
account tokens with WHM root/reseller tokens or browser session cookies.

## Observed evidence

Read-only probes from the local development environment showed:

| Check | Observation |
| --- | --- |
| Configured origin matches the intended secure endpoint | Yes; no origin value is logged. |
| DNS | Resolves to a public IPv4 address. |
| Connection | TLS succeeds on port 2083, with certificate verification enabled. |
| Remote address | Matches the validated DNS address. |
| Proxy-identifying response headers | None observed; absence does not prove there is no origin-side firewall/proxy. |
| Without credentials | HTTP 200, HTML login-style response, no UAPI result. |
| With configured credentials | HTTP 403, JSON-labelled but non-JSON short access-denied response, no UAPI result. |
| Backend API behavior | An authorized hosting-statistics request returns HTTP 200 with an unavailable measurement; its nested error code reports an upstream failure. |

This rules out the backend JWT/ADMIN guard as the source of the observed upstream
403 and rules out a blanket port-2083 connectivity/TLS failure **from the local
machine**. It does not establish outbound connectivity from the production Node
process, nor prove which cPanel/fronting service rejected authentication.

The strongest current inference is rejection before UAPI dispatch, involving the
configured account/token pairing or an access policy at the hosting service.
There is no evidence that a missing StatsBar argument caused this denial. A
generic access-denied body does not distinguish a wrong/revoked token from an
IP/account/hosting access restriction. Provider-side logs are required to settle
that distinction.

The previous client discarded all non-200 bodies and labelled every 403
`permission_denied`. It now inspects a bounded body and produces safe
classifications:

| Evidence | Error code |
| --- | --- |
| HTTP 401 or explicit invalid/revoked/expired-token/authentication text | `authentication_failed` |
| Explicit permission/privilege denial | `permission_denied` |
| Ambiguous HTTP 403 or generic access-denied text | `access_restricted` |
| HTTP 400/422 or explicit invalid/missing arguments | `invalid_request` |
| Documented unsupported-function evidence / missing supported metric | `unsupported_metrics` |

The existing unavailable response shape is unchanged. Only the error-code
classification becomes more precise. Local media statistics remain independent.

## Safe diagnostic command

Build this revision first, then run:

```sh
npm run build
npm run diagnose:cpanel
```

The command loads existing backend environment variables, accepts **no command
arguments**, makes one authenticated read-only request to the fixed function,
does not retry, and does not start the API or connect to the database. It prints:

- Execution platform, fixed operation/parameters, and configuration/DNS booleans.
- HTTP status and a content-type category.
- A software-family classification and presence of known proxy headers.
- JSON parseability and numeric UAPI status if recognizable.
- A fixed error-hint classification, response byte count/truncation flag, and
  verified-TLS state when available.

It prints no hostname/account/token values, headers, cookies, raw upstream error
messages, response bodies, IP addresses, or filesystem paths. Exit code 0 means
supported metrics; exit code 2 means unavailable/failed diagnosis. HTTP 403 with
`access_restricted` is a valid diagnostic outcome, not a reason to weaken TLS or
substitute statistics. No public diagnostics endpoint is added.

To compare with the hosting environment, the reviewed diagnostic revision/build
must first be present there. From a cPanel terminal with the existing application
environment, the established deployment paths allow:

```sh
source "$HOME/nodevenv/waterfall-backend/22/bin/activate"
cd "$HOME/waterfall-backend"
npm run diagnose:cpanel
```

This task does not copy files, change cPanel settings, push, deploy, or execute
commands on the production server. Do not assume a local Windows result proves
production egress. Review/remove the diagnostic command when troubleshooting is
finished if it is no longer useful.

## Exact next actions

1. In the intended cPanel account, verify that `CPANEL_USERNAME` identifies that
   same account and that the token was created there, is valid, and has not been
   revoked. Replace any disclosed token privately; do not paste replacements into
   chat or command arguments. No production configuration is changed by this task.
2. Run the diagnostic from the actual backend hosting environment after the
   reviewed diagnostic revision is made available. Compare its sanitized facts
   with the local result, including public DNS and verified TLS connectivity.
3. If denial persists, give Namecheap support the request time, the fixed
   StatsBar URL path/parameters, and sanitized diagnostic output. Ask them to
   inspect cPanel authentication/API access logs and hosting firewall/account
   policies for the backend process's source IP. Do not send the token or full
   authorization header. Provider-only logs should confirm whether account/token
   authentication or a source-IP/account restriction rejected the request.

Do not disable TLS, disable security services, follow login redirects, grant
broader account privileges speculatively, or probe modifying APIs to bypass the
denial.
