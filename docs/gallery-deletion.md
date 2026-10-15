# Admin gallery deletion

All endpoints below require `Authorization: Bearer <JWT>` and the `ADMIN` role.
Swagger schemas are available under `/api/docs`.

## Batch request

```http
DELETE /admin/gallery/batch
Content-Type: application/json
Authorization: Bearer <admin JWT>

{"ids":[12,18,27]}
```

The body accepts only `ids`: an array of 1–100 unique integers in the inclusive
range 1–2147483647. Numeric strings, duplicates, fractions, empty arrays, extra
fields, nulls, zero, and negative values return HTTP 400. Paths and URLs cannot
be supplied in a deletion request. An existing VIDEO in the selection rejects
the entire batch with HTTP 400. Nonexistent IDs are reported separately.

Example HTTP 200 response after local cleanup completed:

```json
{
  "operationId": "7358c4c1-4ee7-4cdd-8a83-f10d602bcab8",
  "status": "completed",
  "requestedCount": 3,
  "deletedIds": [12, 18],
  "notFoundIds": [27],
  "preservedAssetIds": [],
  "cleanup": { "pending": 0, "succeeded": 2, "failed": 0 }
}
```

`deletedIds` and `notFoundIds` follow request order. HTTP 200 means the database
deletion committed; clients must inspect cleanup status before claiming that
files were removed. Counts describe local cleanup tasks, not all requested IDs.

| Status | Meaning |
| --- | --- |
| `completed` | All verified local tasks succeeded, or there were no local tasks. |
| `cleanup_pending` | Tasks remain pending after an interruption. |
| `cleanup_failed` | At least one cleanup attempt failed; other tasks may still be pending. |

`preservedAssetIds` identifies deleted gallery records whose Cloudinary media or
thumbnail assets were deliberately retained. `completed` does not imply that
these retained remote assets were deleted. Missing physical local files count
as successful cleanup. A filesystem failure counts as failed, never succeeded.

Unsafe paths, unverified providers, mismatched local URLs/public IDs, and
unverified separate local thumbnails reject the database deletion with HTTP
400. Shared references or assets already reserved by another cleanup operation
return HTTP 409. Shared references reject a batch even when both owners were
selected. Validation failures delete no records or files.

## Single deletion and metadata compatibility

`DELETE /admin/gallery/:id` retains support for both IMAGE and VIDEO records and
HTTP 404 for missing IDs. Existing deleted-record fields remain at the top level;
an added `deletion` property contains the same operation result as batch deletion.
The single route now commits database deletion before attempting file cleanup.

Image and video upload routes, public/gallery listings, event relationships,
homepage reel selection, and ordinary metadata updates retain their behavior.
`PATCH /admin/gallery/:id` rejects `imageUrl`, `publicId`, `thumbnailUrl`, and
`mediaType`: these storage ownership fields cannot be changed through metadata
updates. Existing clients must omit those fields from PATCH bodies. Use the
existing upload endpoints to create replacement media.

## Operation recovery

| Endpoint | HTTP success | Response |
| --- | --- | --- |
| `GET /admin/gallery/operations` | 200 | Up to 100 newest pending/failed operation summaries. |
| `GET /admin/gallery/operations/:operationId` | 200 | One deletion result. |
| `POST /admin/gallery/operations/:operationId/retry` | 200 | Result after retrying pending and failed tasks. |

Operation IDs must be UUIDs; malformed IDs return 400 and unknown IDs return
404. All operation routes require JWT and ADMIN authorization. The discovery
endpoint supports recovery when the original response was lost. If more than
100 operations need cleanup, completing the newest ones exposes older work in
subsequent discovery calls.

Cleanup is attempted during the deletion request after its database transaction
commits. There is no background worker or automatic timer. An administrator
must explicitly retry failed/interrupted work. Retries recheck storage safety
and live references, skip succeeded tasks, and safely accept already-missing
files. Attempt counts and sanitized failure details persist in
`GalleryCleanupTask`. Repeating the original batch request creates a new
operation and reports previously deleted IDs as missing; retrying the original
operation handles its existing cleanup tasks.

The lifecycle is:

1. Lock media reference tables and validate selected records and ownership.
2. Atomically create the operation/tasks and delete gallery records.
3. Commit; no physical deletion occurs before this point.
4. For each task, lock media reference tables, recheck references and paths,
   attempt unlink, and persist its outcome in a separate transaction.

A crash after unlink but before recording success leaves a retryable task;
the next unlink sees ENOENT and records success. If cleanup bookkeeping fails,
the task remains durable. A database outage can prevent an HTTP result from
being returned; use operation discovery once database access returns.

## Migration and production review

Pending additive migration:
`prisma/migrations/20261015000000_gallery_cleanup/migration.sql`.
It adds `GalleryDeletionOperation` and `GalleryCleanupTask`, with a restrictive
foreign key, unique storage public ID, lookup index, and task state/attempt
constraints. It does not alter existing media or delete existing data. UUIDs
and task update timestamps are generated by the application/Prisma client.
The migration was reviewed and schema-validated but has not been applied to
any database during this implementation.

Before releasing this code, review and apply the migration through the approved
deployment process. Exercise migration execution and concurrent delete/retry
behavior against an isolated PostgreSQL database first; current automated
tests use database mocks, HTTP requests with real JWT/role guards, and isolated
temporary filesystem directories. No production media or data was used.

Storage and operational assumptions:

- Run a single storage-owning instance, or give every API replica the same
  persistent uploads volume. Separate local volumes cannot verify global
  cleanup accurately. Retain the database and uploads volume across restarts.
- Uploads must live in real directories: symlink/junction roots, ancestors, and
  leaf entries are refused. Canonical paths are checked again on every retry.
  OS permissions must prevent untrusted processes from replacing directories
  during check/unlink. Portable Node path checks cannot make an adversarial
  concurrent directory replacement atomic.
- Exact uploader-generated `/uploads/<publicId>` URLs verify local ownership.
  Absolute or malformed local URLs require an explicit ownership review before
  they can be deleted. Unknown storage providers are rejected.
- Legacy Cloudinary assets remain untouched; the existing Cloudinary module is
  retained. Remote ownership verification/cleanup is outside this API.
- Database locks serialize cleanup and temporarily block writes to GalleryImage,
  Event, TicketPreview, ExperienceImage, WebsiteSettings, and GalleryCleanupTask.
  Monitor contention and request durations; each transaction has a 30-second
  timeout. No external queue or scheduler is introduced.
- Shared-reference checks inspect current gallery URLs/public IDs/thumbnails,
  event hero URLs/public IDs, ticket images, experience images, and website
  branding images. Extend the reference query and lock list whenever another
  database field starts storing media references. Arbitrary text and external
  websites are not reference registries.
- Keep cleanup task rows as tombstones and never reuse deleted storage names.
  Operation/task retention is deliberately not automated. Resolve an unsafe or
  newly shared reference before retrying its task; do not bypass safety checks.

No remote pushes, deployments, or database migrations were performed.
