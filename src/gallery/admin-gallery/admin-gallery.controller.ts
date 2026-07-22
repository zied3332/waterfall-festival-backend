import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  Body
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
  @Post("upload")
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
async uploadImage(
  @UploadedFile() file: Express.Multer.File | undefined,
  @Body() body: {
    title?: string;
    description?: string;
    altText?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    isFeatured?: string;
    sortOrder?: string;
    eventId?: string;
  },
) {
  if (!file) {
    throw new BadRequestException(
      'Please upload an image using the "image" field.',
    );
  }

  if (!body.title?.trim()) {
    throw new BadRequestException("Title is required.");
  }

  const uploadResult =
    await this.cloudinaryService.uploadImage(file);

  return this.galleryService.create({
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    imageUrl: uploadResult.secure_url,
    altText: body.altText?.trim() || undefined,
    status: body.status ?? "DRAFT",
    isFeatured: body.isFeatured === "true",
    sortOrder: body.sortOrder
      ? Number(body.sortOrder)
      : 0,
    eventId: body.eventId
      ? Number(body.eventId)
      : undefined,
  });
}
}