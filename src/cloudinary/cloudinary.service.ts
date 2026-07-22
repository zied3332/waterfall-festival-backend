import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  v2 as Cloudinary,
  type UploadApiResponse,
} from "cloudinary";

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject("CLOUDINARY")
    private readonly cloudinary: typeof Cloudinary,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    try {
      return await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const uploadStream =
            this.cloudinary.uploader.upload_stream(
              {
                folder: "waterfall-festival/gallery",
                resource_type: "image",
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
    } catch {
      throw new InternalServerErrorException(
        "Failed to upload image to Cloudinary.",
      );
    }
  }
}