# Phase 1: media storage monitoring

`GET /admin/storage/stats` measures the regular supported media files stored by
the existing local gallery and event-poster uploaders. It requires the existing
JWT bearer authentication and `ADMIN` authorization. Missing, expired, or invalid
tokens return 401; authenticated non-admin users receive 403. Unauthorized
requests are rejected before filesystem scanning. Swagger documents the endpoint
under **Admin Storage** at `/api/docs`.

```http
GET /admin/storage/stats
Authorization: Bearer <admin access token>
```

There is no public equivalent and no request-controlled filesystem path. Query
parameters cannot override the measured directories. Responses include
`Cache-Control: no-store` so browsers and proxies do not retain admin statistics.

## Upload paths and Namecheap configuration

Both existing uploaders capture `resolve(process.cwd(), 'uploads')` when they are
constructed. Gallery uploads use `gallery/images` and `gallery/videos`; event
posters use `events`. The static `/uploads/` mount in `src/main.ts` uses the same
working-directory layout. No upload destination or URL has changed.

The monitoring service reads each uploader's captured root through
`getUploadsRoot()`. It does not infer an application root from source files,
compiled output, or a later working directory. Even if the process working
directory changes after service construction, monitoring continues measuring the
directories used by those uploader instances.

For the confirmed Namecheap layout, cPanel must start the existing application
with working directory `/home/watezkir/waterfall-backend`, yielding:

| Category | Existing destination |
| --- | --- |
| Gallery images | `/home/watezkir/waterfall-backend/uploads/gallery/images/` |
| Gallery videos | `/home/watezkir/waterfall-backend/uploads/gallery/videos/` |
| Event posters | `/home/watezkir/waterfall-backend/uploads/events/` |

These paths are deployment configuration, not hardcoded application logic. No
`STORAGE_UPLOADS_DIR` variable is introduced: a monitoring-only override could
silently measure a different directory from the one receiving uploads. Preserve
the existing cPanel application working directory and persistent uploads folder.
Production paths and permissions were not inspected remotely during this task.

The runtime user needs directory enumeration and metadata access. Monitoring
does not create missing directories. Uploaders continue creating directories on
their normal upload paths. Existing JWT/database/environment requirements are
unchanged; this feature requires no migration, new secrets, or cPanel API access.

## Measurement rules

- Gallery images: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Gallery videos: `.mp4`, `.webm`, `.mov`.
- Event posters: the image extensions above plus `.avif`.
- Extensions are case-insensitive and match existing uploader/controller MIME
  rules. Metadata scanning does not inspect file contents or verify codecs/MIME
  signatures. A supported extension identifies the category, not media validity.
- Only immediate regular files are counted. Nested directories, backups,
  databases, unsupported extensions, and symbolic links are not scanned.
- File sizes are logical byte lengths from filesystem metadata. Allocated blocks,
  hosting quotas, database sizes, Cloudinary assets, and hard-link deduplication
  are outside Phase 1. Separate regular directory entries count separately.
- Directories are streamed asynchronously, one metadata operation at a time.
  Concurrent requests share one scan. Complete snapshots are cached in the
  current process for up to 5,000 milliseconds; incomplete scans are not cached.
  There is no background scheduler. Replicas have independent caches and need
  access to the same persistent media storage to report comparable statistics.
- `scanStartedAt` and `measuredAt` delimit a live scan, not an atomic filesystem
  snapshot. Uploads or deletions during scanning can affect observations.
- Linked directories, linked ancestors, non-directory path components, and
  invalid roots are rejected. File symlinks are skipped, including links that
  point inside uploads. Paths are revalidated during the scan. Filesystem
  permissions must prevent untrusted processes from swapping directories during
  checks: portable Node path APIs do not provide an atomic directory traversal
  boundary against a malicious concurrent filesystem writer.

## Response and incomplete measurements

Byte values are canonical. Averages retain fractional bytes rather than rounding.
Percentages use each category's byte share of the complete total. Empty readable
directories report zero, including zero average/largest sizes and percentages.

Directory status values:

| Status | Meaning |
| --- | --- |
| `ok` | The supported regular files were measured completely. |
| `missing` | The directory or one of its required parent directories is absent. |
| `unavailable` | Directory access/iteration failed, including permission errors. |
| `unsafe` | The root or a directory component failed path safety checks. |
| `partial` | Some file metadata could not be measured, including files disappearing during enumeration. |

Missing, unavailable, and unsafe directories have null size/count fields, never
successful zero usage. Partial directory values describe only the files actually
observed. If any category is incomplete, `total.files`, `total.bytes`, and all
percentages are null. `observed` sums available observations, not an authoritative
overall total. Overall status is `ok` only when every category is complete,
`partial` when some observations are available, and `unavailable` otherwise.

Warnings contain only category names and sanitized codes, deduplicated per scan.
Examples: `directory_missing`, `directory_unavailable`, `unsafe_directory`,
`metadata_unavailable`, `file_disappeared`, `invalid_file_size`, and
`symlink_skipped`. A skipped symlink is excluded by design and does not invalidate
an otherwise complete measurement. Internal diagnostics use NestJS logging;
responses contain no absolute paths, filenames, exception text, or stack traces.

Example based on isolated test fixtures (timestamps illustrate a request): two
images of 100 and 300 bytes, one 600-byte video, and one 1,000-byte AVIF poster.

```json
{
  "scanStartedAt": "2026-10-15T03:00:00.000Z",
  "measuredAt": "2026-10-15T03:00:00.010Z",
  "status": "ok",
  "cacheTtlMs": 5000,
  "gallery": {
    "images": { "status": "ok", "count": 2, "totalBytes": 400, "averageBytes": 200, "largestBytes": 300 },
    "videos": { "status": "ok", "count": 1, "totalBytes": 600, "averageBytes": 600, "largestBytes": 600 }
  },
  "events": {
    "posters": { "status": "ok", "count": 1, "totalBytes": 1000, "averageBytes": 1000, "largestBytes": 1000 }
  },
  "total": { "files": 4, "bytes": 2000 },
  "observed": { "files": 4, "bytes": 2000 },
  "percentages": { "images": 20, "videos": 30, "posters": 50 },
  "warnings": []
}
```

## Validation

Service tests use isolated temporary directories and deterministic injected
filesystem errors. HTTP tests use real JWT/role guards and temporary fixtures;
module integration tests mock database access. Production media is not used.

```sh
npm test -- --runInBand
npm run lint:check
npm run build
npx tsc --project tsconfig.spec.json --noEmit
```

This phase adds no frontend dashboard, hosting quotas, cPanel integration, upload
blocking, storage mutations, or automatic cleanup.
