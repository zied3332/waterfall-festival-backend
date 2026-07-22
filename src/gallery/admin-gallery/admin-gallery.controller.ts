import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { CloudinaryService } from "../../cloudinary/cloudinary.service.js";
import { GalleryService } from "../gallery.service.js";

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const imageUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (
      error: Error | null,
      acceptFile: boolean,
    ) => void,
  ) => {
    if (!allowedImageTypes.includes(file.mimetype)) {
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
};

type GalleryUploadBody = {
  title?: string;
  description?: string;
  altText?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured?: string;
  sortOrder?: string;
  eventId?: string;
};

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
    FileInterceptor("image", imageUploadOptions),
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
    FilesInterceptor(
      "images",
      10,
      imageUploadOptions,
    ),
  )
  async uploadImages(
    @UploadedFiles()
    files: Express.Multer.File[] | undefined,
    @Body() body: GalleryUploadBody,
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'Please upload at least one image using the "images" field.',
      );
    }

    if (!body.title?.trim()) {
      throw new BadRequestException(
        "Title is required.",
      );
    }

    const allowedStatuses = [
      "DRAFT",
      "PUBLISHED",
      "ARCHIVED",
    ];

    if (
      body.status &&
      !allowedStatuses.includes(body.status)
    ) {
      throw new BadRequestException(
        "Status must be DRAFT, PUBLISHED, or ARCHIVED.",
      );
    }

    const parsedSortOrder = body.sortOrder
      ? Number(body.sortOrder)
      : 0;

    if (!Number.isInteger(parsedSortOrder)) {
      throw new BadRequestException(
        "sortOrder must be a valid integer.",
      );
    }

    const parsedEventId = body.eventId
      ? Number(body.eventId)
      : undefined;

    if (
      parsedEventId !== undefined &&
      (!Number.isInteger(parsedEventId) ||
        parsedEventId <= 0)
    ) {
      throw new BadRequestException(
        "eventId must be a valid positive integer.",
      );
    }

    const uploadResults =
      await this.cloudinaryService.uploadImages(files);

    const baseTitle = body.title.trim();
    const isMultipleUpload = files.length > 1;

    const createdImages = await Promise.all(
      uploadResults.map((uploadResult, index) => {
        const title = isMultipleUpload
          ? `${baseTitle} ${index + 1}`
          : baseTitle;

        return this.galleryService.create({
          title,
          description:
            body.description?.trim() || undefined,
          imageUrl: uploadResult.secure_url,
          altText:
            body.altText?.trim() || title,
          status: body.status ?? "DRAFT",
          isFeatured:
            body.isFeatured === "true",
          sortOrder: parsedSortOrder + index,
          eventId: parsedEventId,
        });
      }),
    );

    return {
      success: true,
      count: createdImages.length,
      images: createdImages,
    };
  }
}