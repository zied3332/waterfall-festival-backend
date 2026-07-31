import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";

import { Roles } from "../../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../auth/guards/roles.guard.js";
import { CloudinaryService } from "../../cloudinary/cloudinary.service.js";
import { UserRole } from "../../generated/prisma/enums.js";
import {
  GalleryImageResponseDto,
  GalleryUploadResponseDto,
} from "../dto/gallery-image-response.dto.js";
import { UpdateGalleryImageDto } from "../dto/update-gallery-image.dto.js";
import { GalleryService } from "../gallery.service.js";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const MAX_UPLOAD_IMAGES = 10;

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const imageUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (
      error: Error | null,
      acceptFile: boolean,
    ) => void,
  ) => {
    if (
      !allowedImageTypes.includes(
        file.mimetype,
      )
    ) {
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
  status?:
    | "DRAFT"
    | "PUBLISHED"
    | "ARCHIVED";
  isFeatured?: string;
  sortOrder?: string;
  eventId?: string;
};

@ApiTags("Admin Gallery")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({
  description:
    "A valid administrator JWT access token is required.",
})
@ApiForbiddenResponse({
  description:
    "The authenticated user does not have administrator permission.",
})
@Controller("admin/gallery")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminGalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List all gallery images",
    description:
      "Returns all gallery images for administration, including draft, published, and archived images.",
  })
  @ApiOkResponse({
    description:
      "Gallery images returned successfully.",
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findAll() {
    return this.galleryService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary:
      "Get a gallery image by ID",
    description:
      "Returns one gallery image for viewing or editing in the administration dashboard.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-image identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery image returned successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied gallery-image ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No gallery image exists with the supplied ID.",
  })
  findOne(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.galleryService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary:
      "Update a gallery image",
    description:
      "Updates the metadata, publishing status, feature status, display order, or associated event of a gallery image.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-image identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery image updated successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied ID or request body is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "The gallery image or associated event was not found.",
  })
  update(
    @Param("id", ParseIntPipe)
    id: number,
    @Body()
    updateGalleryImageDto: UpdateGalleryImageDto,
  ) {
    return this.galleryService.update(
      id,
      updateGalleryImageDto,
    );
  }

  @Delete(":id")
  @ApiOperation({
    summary:
      "Delete a gallery image",
    description:
      "Deletes a gallery image record from the database.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-image identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery image deleted successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied gallery-image ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No gallery image exists with the supplied ID.",
  })
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.galleryService.remove(id);
  }

  @Post("test-upload")
  @ApiOperation({
    summary:
      "Test a single Cloudinary image upload",
    description:
      "Uploads one image directly to Cloudinary without creating a gallery database record. This endpoint is intended for testing the upload configuration.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    required: true,
    schema: {
      type: "object",
      required: ["image"],
      properties: {
        image: {
          type: "string",
          format: "binary",
          description:
            "JPG, PNG, or WebP image. Maximum size: 5 MB.",
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      "Image uploaded to Cloudinary successfully.",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        image: {
          type: "object",
          properties: {
            url: {
              type: "string",
              format: "uri",
              example:
                "https://res.cloudinary.com/example/image/upload/gallery/test.webp",
            },
            publicId: {
              type: "string",
              example:
                "waterfall-festival/gallery/test",
            },
            width: {
              type: "integer",
              example: 1920,
            },
            height: {
              type: "integer",
              example: 1080,
            },
            format: {
              type: "string",
              example: "webp",
            },
            bytes: {
              type: "integer",
              example: 458213,
            },
            originalFilename: {
              type: "string",
              example: "festival-stage",
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "No image was supplied or the file format is unsupported.",
  })
  @ApiPayloadTooLargeResponse({
    description:
      "The uploaded image exceeds the 5 MB limit.",
  })
  @UseInterceptors(
    FileInterceptor(
      "image",
      imageUploadOptions,
    ),
  )
  async testUpload(
    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Please upload an image using the "image" field.',
      );
    }

    const result =
      await this.cloudinaryService.uploadImage(
        file,
      );

    return {
      success: true,
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        originalFilename:
          result.original_filename,
      },
    };
  }

  @Post("upload")
  @ApiOperation({
    summary:
      "Upload gallery images",
    description:
      "Uploads between 1 and 10 images to Cloudinary and creates one gallery database record for each uploaded image. Each file can be up to 5 MB.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    required: true,
    schema: {
      type: "object",
      required: [
        "images",
        "title",
      ],
      properties: {
        images: {
          type: "array",
          minItems: 1,
          maxItems: MAX_UPLOAD_IMAGES,
          items: {
            type: "string",
            format: "binary",
          },
          description:
            "Between 1 and 10 JPG, PNG, or WebP images. Maximum size: 5 MB per image.",
        },
        title: {
          type: "string",
          example:
            "Waterfall Festival Gallery",
          description:
            "Base title for the uploaded images. When multiple files are uploaded, a number is appended to each title.",
        },
        description: {
          type: "string",
          example:
            "Highlights from the latest Waterfall Festival event.",
          description:
            "Optional description assigned to every uploaded image.",
        },
        altText: {
          type: "string",
          example:
            "Waterfall Festival visitors and performances",
          description:
            "Optional alternative text assigned to every uploaded image.",
        },
        status: {
          type: "string",
          enum: [
            "DRAFT",
            "PUBLISHED",
            "ARCHIVED",
          ],
          default: "DRAFT",
          example: "PUBLISHED",
        },
        isFeatured: {
          type: "string",
          enum: ["true", "false"],
          default: "false",
          example: "false",
          description:
            "Multipart form value indicating whether the uploaded images are featured.",
        },
        sortOrder: {
          type: "string",
          default: "0",
          example: "0",
          description:
            "Non-negative integer sent as a multipart form string. Each subsequent image receives the next sort-order value.",
        },
        eventId: {
          type: "string",
          example: "12",
          description:
            "Optional positive event ID sent as a multipart form string.",
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      "Images uploaded and gallery records created successfully.",
    type: GalleryUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "No files were supplied, a file type is unsupported, or a form value is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "The supplied event ID does not belong to an existing event.",
  })
  @ApiPayloadTooLargeResponse({
    description:
      "One of the uploaded images exceeds the 5 MB file-size limit.",
  })
  @UseInterceptors(
    FilesInterceptor(
      "images",
      MAX_UPLOAD_IMAGES,
      imageUploadOptions,
    ),
  )
  async uploadImages(
    @UploadedFiles()
    files:
      | Express.Multer.File[]
      | undefined,
    @Body()
    body: GalleryUploadBody,
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

    const parsedSortOrder =
      body.sortOrder
        ? Number(body.sortOrder)
        : 0;

    if (
      !Number.isInteger(
        parsedSortOrder,
      ) ||
      parsedSortOrder < 0
    ) {
      throw new BadRequestException(
        "sortOrder must be a non-negative integer.",
      );
    }

    const parsedEventId =
      body.eventId
        ? Number(body.eventId)
        : undefined;

    if (
      parsedEventId !== undefined &&
      (!Number.isInteger(
        parsedEventId,
      ) ||
        parsedEventId <= 0)
    ) {
      throw new BadRequestException(
        "eventId must be a valid positive integer.",
      );
    }

    const uploadResults =
      await this.cloudinaryService.uploadImages(
        files,
      );

    const baseTitle =
      body.title.trim();

    const isMultipleUpload =
      files.length > 1;

    const createdImages =
      await Promise.all(
        uploadResults.map(
          (uploadResult, index) => {
            const title =
              isMultipleUpload
                ? `${baseTitle} ${index + 1}`
                : baseTitle;

            return this.galleryService.create({
              title,
              description:
                body.description?.trim() ||
                undefined,
              imageUrl:
                uploadResult.secure_url,
              altText:
                body.altText?.trim() ||
                title,
              status:
                body.status ?? "DRAFT",
              isFeatured:
                body.isFeatured === "true",
              sortOrder:
                parsedSortOrder + index,
              eventId: parsedEventId,
            });
          },
        ),
      );

    return {
      success: true,
      count: createdImages.length,
      images: createdImages,
    };
  }
}