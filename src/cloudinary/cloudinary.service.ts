import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  v2 as Cloudinary,
  type UploadApiResponse,
} from "cloudinary";

const CLOUDINARY_PROVIDER = "CLOUDINARY";

const GALLERY_IMAGES_FOLDER =
  "waterfall-festival/gallery/images";

const GALLERY_VIDEOS_FOLDER =
  "waterfall-festival/gallery/videos";

const EVENT_IMAGES_FOLDER =
  "waterfall-festival/events";

type CloudinaryResourceType =
  | "image"
  | "video";

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY_PROVIDER)
    private readonly cloudinary: typeof Cloudinary,
  ) {}

  private uploadBuffer(
    file: Express.Multer.File,
    folder: string,
    resourceType: CloudinaryResourceType,
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream =
          this.cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: resourceType,
            },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              if (!result) {
                reject(
                  new Error(
                    "Cloudinary returned no upload result.",
                  ),
                );
                return;
              }

              resolve(result);
            },
          );

        uploadStream.end(file.buffer);
      },
    );
  }

  private async deleteResource(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<void> {
    try {
      const result =
        await this.cloudinary.uploader.destroy(
          publicId,
          {
            resource_type: resourceType,
            invalidate: true,
          },
        );

      if (
        result.result !== "ok" &&
        result.result !== "not found"
      ) {
        throw new Error(
          `Cloudinary deletion failed with result: ${result.result}`,
        );
      }
    } catch {
      throw new InternalServerErrorException(
        `Failed to delete the ${resourceType} from Cloudinary.`,
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return this.uploadGalleryImage(file);
  }

  async uploadImages(
    files: Express.Multer.File[],
  ): Promise<UploadApiResponse[]> {
    return this.uploadGalleryImages(files);
  }

  async uploadGalleryImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    try {
      return await this.uploadBuffer(
        file,
        GALLERY_IMAGES_FOLDER,
        "image",
      );
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload the gallery image to Cloudinary.",
      );
    }
  }

  async uploadGalleryImages(
    files: Express.Multer.File[],
  ): Promise<UploadApiResponse[]> {
    try {
      return await Promise.all(
        files.map((file) =>
          this.uploadBuffer(
            file,
            GALLERY_IMAGES_FOLDER,
            "image",
          ),
        ),
      );
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload one or more gallery images to Cloudinary.",
      );
    }
  }

  async uploadGalleryVideo(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    try {
      return await this.uploadBuffer(
        file,
        GALLERY_VIDEOS_FOLDER,
        "video",
      );
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload the gallery video to Cloudinary.",
      );
    }
  }

  async uploadGalleryVideos(
    files: Express.Multer.File[],
  ): Promise<UploadApiResponse[]> {
    try {
      return await Promise.all(
        files.map((file) =>
          this.uploadBuffer(
            file,
            GALLERY_VIDEOS_FOLDER,
            "video",
          ),
        ),
      );
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload one or more gallery videos to Cloudinary.",
      );
    }
  }

  async uploadEventHeroImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    try {
      return await this.uploadBuffer(
        file,
        EVENT_IMAGES_FOLDER,
        "image",
      );
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload the event hero image to Cloudinary.",
      );
    }
  }

  async deleteImage(
    publicId: string,
  ): Promise<void> {
    await this.deleteResource(
      publicId,
      "image",
    );
  }

  async deleteVideo(
    publicId: string,
  ): Promise<void> {
    await this.deleteResource(
      publicId,
      "video",
    );
  }
}