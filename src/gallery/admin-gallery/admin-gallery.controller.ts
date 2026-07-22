import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { CloudinaryService } from "../../cloudinary/cloudinary.service.js";
import { GalleryService } from "../gallery.service.js";

@Controller("admin/gallery")
export class AdminGalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  findAll() {
    return this.galleryService.findAll();
  }

  @Post("test-upload")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              "Only JPG, PNG, and WEBP images are allowed.",
            ),
            false,
          );

          return;
        }

        callback(null, true);
      },
    }),
  )
  async testUpload(
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Please upload an image using the "image" field.',
      );
    }

    const result =
      await this.cloudinaryService.uploadImage(file);

    return {
      success: true,
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        originalFilename: result.original_filename,
      },
    };
  }
}