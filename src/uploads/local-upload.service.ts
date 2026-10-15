import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  mkdir,
  lstat,
  realpath,
  unlink,
  writeFile,
} from "node:fs/promises";

import {
  basename,
  extname,
  join,
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

  getUploadsRoot(): string {
    return this.uploadsRoot;
  }

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
    await this.validateDeletionPath(publicId);
    const absolutePath = resolve(this.uploadsRoot, publicId);

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

  async validateDeletionPath(publicId: string): Promise<void> {
    if (!/^gallery\/(images|videos)\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|mp4|webm|mov)$/.test(publicId)) {
      throw new BadRequestException('Unsafe gallery storage path.');
    }
    // Check every component, including the root and leaf. Windows junctions
    // are reported as symbolic links by lstat. Never follow them for deletion.
    let current = this.uploadsRoot;
    for (const part of ['', ...publicId.split('/')]) {
      current = part ? join(current, part) : current;
      try {
        const stat = await lstat(current);
        const canonical = await realpath(current);
        const expected = resolve(current);
        if (stat.isSymbolicLink() || (process.platform === 'win32' ? canonical.toLowerCase() !== expected.toLowerCase() : canonical !== expected)) {
          throw new BadRequestException('Linked gallery storage paths are unsafe.');
        }
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
        throw error;
      }
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
