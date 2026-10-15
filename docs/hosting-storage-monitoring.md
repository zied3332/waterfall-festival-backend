# Hosting statistics integration retired

The backend no longer reads cPanel API credentials or requests hosting quotas.
`GET /admin/storage/hosting` remains authenticated and deprecated, returning
`status: unavailable`, `errorCode: integration_disabled`, null measurements and
`isUnlimited: false`. The legacy `source: cpanel_uapi` value is retained only for
the existing frontend parser; it indicates no active measurement.

Use `GET /admin/storage/stats` for actual uploaded-media bytes/counts. Its
response and admin authorization are unchanged. See
[media monitoring](storage-monitoring.md) and the
[current deployment/frontend compatibility guide](backend-deployment.md).

No production environment variables were changed. Existing GitHub SSH secret
names are still used for deployment transport, independently of this retired
API integration. The cPanel HTTP diagnostic CLI and quota workflow are removed.
