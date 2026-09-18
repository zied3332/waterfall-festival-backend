import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";

import {
  extname,
  join,
  resolve,
} from "node:path";

import {
  randomUUID,
} from "node:crypto";

@Injectable()
export class LocalImageStorageService {
  private readonly logger =
    new Logger(
      LocalImageStorageService.name,
    );

  private readonly uploadsRoot =
    resolve(
      process.cwd(),
      "uploads",
    );

  private readonly eventPostersDirectory =
    join(
      this.uploadsRoot,
      "events",
    );

  /*
   * ============================================================
   * SAVE EVENT POSTER
   * ============================================================
   */

  async saveEventPoster(
    eventId: number,
    file: Express.Multer.File,
  ): Promise<{
    url: string;
    filename: string;
  }> {
    await this.ensureEventPostersDirectory();

    const extension =
      this.getSafeExtension(
        file,
      );

    const filename =
      `event-${eventId}-${Date.now()}-${randomUUID()}${extension}`;

    const absolutePath =
      join(
        this.eventPostersDirectory,
        filename,
      );

    try {
      await writeFile(
        absolutePath,
        file.buffer,
      );
    } catch (
      error: unknown
    ) {
      this.logger.error(
        `Could not save poster for event ${eventId}.`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new InternalServerErrorException(
        "The event poster could not be saved.",
      );
    }

    return {
      filename,

      url:
        `/uploads/events/${filename}`,
    };
  }

  /*
   * ============================================================
   * DELETE EVENT POSTER
   * ============================================================
   */

  async deleteEventPoster(
    imageUrl:
      | string
      | null
      | undefined,
  ): Promise<void> {
    if (!imageUrl) {
      return;
    }

    /*
     * We only delete images managed by this
     * local-storage service.
     *
     * Old Cloudinary URLs or any external URL
     * are deliberately ignored.
     */
    if (
      !imageUrl.startsWith(
        "/uploads/events/",
      )
    ) {
      return;
    }

    const filename =
      imageUrl.replace(
        "/uploads/events/",
        "",
      );

    /*
     * Prevent a malformed database value from
     * escaping the event uploads directory.
     */
    if (
      !filename ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("..")
    ) {
      this.logger.warn(
        `Refusing to delete invalid event poster path: ${imageUrl}`,
      );

      return;
    }

    const absolutePath =
      join(
        this.eventPostersDirectory,
        filename,
      );

    try {
      await unlink(
        absolutePath,
      );

      this.logger.log(
        `Deleted event poster: ${filename}`,
      );
    } catch (
      error: unknown
    ) {
      if (
        this.isFileNotFoundError(
          error,
        )
      ) {
        /*
         * The database may reference a file
         * that was already manually removed.
         *
         * That should not make deleting or
         * updating an event fail.
         */
        this.logger.warn(
          `Event poster was already missing: ${filename}`,
        );

        return;
      }

      throw error;
    }
  }

  /*
   * ============================================================
   * PRIVATE HELPERS
   * ============================================================
   */

  private async ensureEventPostersDirectory():
    Promise<void> {
    await mkdir(
      this.eventPostersDirectory,
      {
        recursive: true,
      },
    );
  }

  private getSafeExtension(
    file: Express.Multer.File,
  ): string {
    const extensionByMimeType:
      Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/avif": ".avif",
      };

    const mimeExtension =
      extensionByMimeType[
        file.mimetype
      ];

    if (mimeExtension) {
      return mimeExtension;
    }

    const originalExtension =
      extname(
        file.originalname,
      ).toLowerCase();

    if (
      [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".avif",
      ].includes(
        originalExtension,
      )
    ) {
      return originalExtension ===
        ".jpeg"
        ? ".jpg"
        : originalExtension;
    }

    return ".jpg";
  }

  private isFileNotFoundError(
    error: unknown,
  ): boolean {
    return (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      (
        error as {
          code?: string;
        }
      ).code === "ENOENT"
    );
  }
}