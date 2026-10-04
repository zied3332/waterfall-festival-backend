import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";

import {
  basename,
  extname,
  join,
  normalize,
  resolve,
} from "node:path";

import {
  randomUUID,
} from "node:crypto";

type LocalUploadResult = {
  url: string;
  publicId: string;
  originalFilename: string;
  bytes: number;
};

@Injectable()
export class LocalUploadService {
  private readonly uploadsRoot =
    resolve(
      process.cwd(),
      "uploads",
    );

  private readonly galleryImagesDirectory =
    join(
      this.uploadsRoot,
      "gallery",
      "images",
    );

  private readonly galleryVideosDirectory =
    join(
      this.uploadsRoot,
      "gallery",
      "videos",
    );

  async uploadGalleryImage(
    file: Express.Multer.File,
  ): Promise<LocalUploadResult> {
    return this.saveFile(
      file,
      this.galleryImagesDirectory,
      "gallery/images",
    );
  }

  async uploadGalleryImages(
    files: Express.Multer.File[],
  ): Promise<LocalUploadResult[]> {
    return Promise.all(
      files.map((file) =>
        this.uploadGalleryImage(file),
      ),
    );
  }

  async uploadGalleryVideo(
    file: Express.Multer.File,
  ): Promise<LocalUploadResult> {
    return this.saveFile(
      file,
      this.galleryVideosDirectory,
      "gallery/videos",
    );
  }

  async deleteFile(
    publicId: string,
  ): Promise<void> {
    /*
     * Only delete files that belong to the gallery.
     * This prevents arbitrary filesystem paths from
     * being passed to this method.
     */
    const normalizedPublicId =
      normalize(publicId)
        .replaceAll("\\", "/")
        .replace(/^\/+/, "");

    if (
      !normalizedPublicId.startsWith(
        "gallery/images/",
      ) &&
      !normalizedPublicId.startsWith(
        "gallery/videos/",
      )
    ) {
      return;
    }

    const absolutePath =
      resolve(
        this.uploadsRoot,
        normalizedPublicId,
      );

    /*
     * Additional path-traversal protection.
     */
    if (
      !absolutePath.startsWith(
        `${this.uploadsRoot}${process.platform === "win32" ? "\\" : "/"}`,
      )
    ) {
      return;
    }

    try {
      await unlink(
        absolutePath,
      );
    } catch (error: unknown) {
      /*
       * If the file is already gone, deleting the
       * database record should still be allowed.
       */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }

      throw new InternalServerErrorException(
        "Failed to delete the gallery media file from local storage.",
      );
    }
  }

  private async saveFile(
    file: Express.Multer.File,
    directory: string,
    publicDirectory: string,
  ): Promise<LocalUploadResult> {
    try {
      await mkdir(
        directory,
        {
          recursive: true,
        },
      );

      const extension =
        this.getSafeExtension(
          file,
        );

      const filename =
        `${Date.now()}-${randomUUID()}${extension}`;

      const absolutePath =
        join(
          directory,
          filename,
        );

      await writeFile(
        absolutePath,
        file.buffer,
      );

      const publicId =
        `${publicDirectory}/${filename}`;

      return {
        url:
          `/uploads/${publicId}`,

        publicId,

        originalFilename:
          basename(
            file.originalname,
          ),

        bytes:
          file.size,
      };
    } catch {
      throw new InternalServerErrorException(
        "Failed to save the uploaded media file.",
      );
    }
  }

  private getSafeExtension(
    file: Express.Multer.File,
  ): string {
    switch (
      file.mimetype
    ) {
      case "image/jpeg":
        return ".jpg";

      case "image/png":
        return ".png";

      case "image/webp":
        return ".webp";

      case "video/mp4":
        return ".mp4";

      case "video/webm":
        return ".webm";

      case "video/quicktime":
        return ".mov";

      default: {
        /*
         * Normally the Multer file filter rejects
         * unsupported types before reaching here.
         */
        const originalExtension =
          extname(
            file.originalname,
          )
            .toLowerCase();

        return originalExtension;
      }
    }
  }
}