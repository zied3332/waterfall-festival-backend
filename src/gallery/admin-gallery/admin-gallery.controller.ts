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

const MAX_VIDEO_SIZE =
  100 * 1024 * 1024;

const MAX_UPLOAD_IMAGES = 10;

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const allowedVideoTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
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

const videoUploadOptions = {
  storage: memoryStorage(),

  limits: {
    fileSize: MAX_VIDEO_SIZE,
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
      !allowedVideoTypes.includes(
        file.mimetype,
      )
    ) {
      callback(
        new BadRequestException(
          "Only MP4, WebM, and MOV videos are allowed.",
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

type GalleryVideoUploadBody = {
  title?: string;
  description?: string;
  altText?: string;

  status?:
    | "DRAFT"
    | "PUBLISHED"
    | "ARCHIVED";

  isFeatured?: string;

  sortOrder?: string;

  showOnHomepage?: string;

  homepageSortOrder?: string;

  eventId?: string;
};

function validateStatus(
  status:
    | "DRAFT"
    | "PUBLISHED"
    | "ARCHIVED"
    | undefined,
): void {
  if (!status) {
    return;
  }

  const allowedStatuses = [
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED",
  ];

  if (
    !allowedStatuses.includes(status)
  ) {
    throw new BadRequestException(
      "Status must be DRAFT, PUBLISHED, or ARCHIVED.",
    );
  }
}

function parseNonNegativeInteger(
  value: string | undefined,
  fieldName: string,
  defaultValue = 0,
): number {
  if (
    value === undefined ||
    value.trim() === ""
  ) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0
  ) {
    throw new BadRequestException(
      `${fieldName} must be a non-negative integer.`,
    );
  }

  return parsedValue;
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  fieldName: string,
): number | undefined {
  if (
    value === undefined ||
    value.trim() === ""
  ) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    throw new BadRequestException(
      `${fieldName} must be a valid positive integer.`,
    );
  }

  return parsedValue;
}

function parseBoolean(
  value: string | undefined,
  defaultValue = false,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new BadRequestException(
    'Boolean values must be either "true" or "false".',
  );
}

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
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles(UserRole.ADMIN)
export class AdminGalleryController {
  constructor(
    private readonly galleryService:
      GalleryService,

    private readonly cloudinaryService:
      CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List all gallery media",
    description:
      "Returns all gallery images and videos for administration, including draft, published, and archived media.",
  })
  @ApiOkResponse({
    description:
      "Gallery media returned successfully.",
    type: GalleryImageResponseDto,
    isArray: true,
  })
  findAll() {
    return this.galleryService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary:
      "Get gallery media by ID",
    description:
      "Returns one gallery image or video for viewing or editing in the administration dashboard.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-media identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery media returned successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied gallery-media ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No gallery media item exists with the supplied ID.",
  })
  findOne(
    @Param(
      "id",
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.galleryService.findOne(
      id,
    );
  }

  @Patch(":id")
  @ApiOperation({
    summary:
      "Update gallery media",
    description:
      "Updates gallery image or video metadata, publishing status, featured state, homepage-reel state, display order, or associated event.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-media identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery media updated successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied ID or request body is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "The gallery media item or associated event was not found.",
  })
  update(
    @Param(
      "id",
      ParseIntPipe,
    )
    id: number,

    @Body()
    updateGalleryImageDto:
      UpdateGalleryImageDto,
  ) {
    return this.galleryService.update(
      id,
      updateGalleryImageDto,
    );
  }

  @Delete(":id")
  @ApiOperation({
    summary:
      "Delete gallery media",
    description:
      "Deletes a gallery media record and its associated Cloudinary image or video when a public ID is available.",
  })
  @ApiParam({
    name: "id",
    type: Number,
    required: true,
    example: 25,
    description:
      "Unique numeric gallery-media identifier.",
  })
  @ApiOkResponse({
    description:
      "Gallery media deleted successfully.",
    type: GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "The supplied gallery-media ID is not a valid integer.",
  })
  @ApiNotFoundResponse({
    description:
      "No gallery media item exists with the supplied ID.",
  })
  remove(
    @Param(
      "id",
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.galleryService.remove(
      id,
    );
  }

  @Post("test-upload")
  @ApiOperation({
    summary:
      "Test a single Cloudinary image upload",
    description:
      "Uploads one image directly to Cloudinary without creating a gallery database record.",
  })
  @ApiConsumes(
    "multipart/form-data",
  )
  @ApiBody({
    required: true,

    schema: {
      type: "object",

      required: [
        "image",
      ],

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
            },

            publicId: {
              type: "string",
            },

            width: {
              type: "integer",
            },

            height: {
              type: "integer",
            },

            format: {
              type: "string",
            },

            bytes: {
              type: "integer",
            },

            originalFilename: {
              type: "string",
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

        publicId:
          result.public_id,

        width:
          result.width,

        height:
          result.height,

        format:
          result.format,

        bytes:
          result.bytes,

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
      "Uploads between 1 and 10 images to Cloudinary and creates one gallery database record for each uploaded image.",
  })
  @ApiConsumes(
    "multipart/form-data",
  )
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
          maxItems:
            MAX_UPLOAD_IMAGES,

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
        },

        description: {
          type: "string",

          example:
            "Highlights from the latest Waterfall Festival event.",
        },

        altText: {
          type: "string",

          example:
            "Waterfall Festival visitors and performances",
        },

        status: {
          type: "string",

          enum: [
            "DRAFT",
            "PUBLISHED",
            "ARCHIVED",
          ],

          default:
            "DRAFT",
        },

        isFeatured: {
          type: "string",

          enum: [
            "true",
            "false",
          ],

          default:
            "false",
        },

        sortOrder: {
          type: "string",

          default:
            "0",

          description:
            "Non-negative integer sent as multipart form text.",
        },

        eventId: {
          type: "string",

          example:
            "12",

          description:
            "Optional positive event ID.",
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      "Images uploaded and gallery records created successfully.",

    type:
      GalleryUploadResponseDto,
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
    body:
      GalleryUploadBody,
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

    validateStatus(
      body.status,
    );

    const parsedSortOrder =
      parseNonNegativeInteger(
        body.sortOrder,
        "sortOrder",
      );

    const parsedEventId =
      parseOptionalPositiveInteger(
        body.eventId,
        "eventId",
      );

    const isFeatured =
      parseBoolean(
        body.isFeatured,
      );

    const uploadResults =
      await this.cloudinaryService.uploadGalleryImages(
        files,
      );

    const baseTitle =
      body.title.trim();

    const isMultipleUpload =
      files.length > 1;

    const createdItems =
      await Promise.all(
        uploadResults.map(
          (
            uploadResult,
            index,
          ) => {
            const title =
              isMultipleUpload
                ? `${baseTitle} ${index + 1}`
                : baseTitle;

            return this.galleryService.create(
              {
                mediaType:
                  "IMAGE",

                title,

                description:
                  body.description
                    ?.trim() ||
                  undefined,

                imageUrl:
                  uploadResult.secure_url,

                publicId:
                  uploadResult.public_id,

                width:
                  uploadResult.width,

                height:
                  uploadResult.height,

                altText:
                  body.altText
                    ?.trim() ||
                  title,

                status:
                  body.status ??
                  "DRAFT",

                isFeatured,

                sortOrder:
                  parsedSortOrder +
                  index,

                showOnHomepage:
                  false,

                homepageSortOrder:
                  0,

                eventId:
                  parsedEventId,
              },
            );
          },
        ),
      );

    return {
      success: true,

      count:
        createdItems.length,

      items:
        createdItems,
    };
  }

  @Post("upload/video")
  @ApiOperation({
    summary:
      "Upload a gallery video",
    description:
      "Uploads one MP4, WebM, or MOV video to Cloudinary and creates a gallery media record. The administrator can optionally publish the video and include it in the homepage reels carousel.",
  })
  @ApiConsumes(
    "multipart/form-data",
  )
  @ApiBody({
    required: true,

    schema: {
      type: "object",

      required: [
        "video",
        "title",
      ],

      properties: {
        video: {
          type: "string",

          format:
            "binary",

          description:
            "MP4, WebM, or MOV video. Maximum size: 100 MB.",
        },

        title: {
          type: "string",

          example:
            "Waterfall Festival Night Reel",
        },

        description: {
          type: "string",

          example:
            "Festival lights, fire performances, and crowd energy.",
        },

        altText: {
          type: "string",

          example:
            "Vertical video showing the Waterfall Festival crowd and stage.",
        },

        status: {
          type: "string",

          enum: [
            "DRAFT",
            "PUBLISHED",
            "ARCHIVED",
          ],

          default:
            "DRAFT",
        },

        isFeatured: {
          type: "string",

          enum: [
            "true",
            "false",
          ],

          default:
            "false",
        },

        sortOrder: {
          type: "string",

          default:
            "0",

          description:
            "Position in the public gallery.",
        },

        showOnHomepage: {
          type: "string",

          enum: [
            "true",
            "false",
          ],

          default:
            "false",

          description:
            "Whether this video should appear in the homepage reels carousel.",
        },

        homepageSortOrder: {
          type: "string",

          default:
            "0",

          description:
            "Position in the homepage reels carousel.",
        },

        eventId: {
          type: "string",

          example:
            "12",

          description:
            "Optional event ID associated with the video.",
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      "Video uploaded and gallery media record created successfully.",

    type:
      GalleryImageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "No video was supplied, the format is unsupported, or a form value is invalid.",
  })
  @ApiNotFoundResponse({
    description:
      "The supplied event ID does not belong to an existing event.",
  })
  @ApiPayloadTooLargeResponse({
    description:
      "The uploaded video exceeds the 100 MB limit.",
  })
  @UseInterceptors(
    FileInterceptor(
      "video",
      videoUploadOptions,
    ),
  )
  async uploadVideo(
    @UploadedFile()
    file:
      | Express.Multer.File
      | undefined,

    @Body()
    body:
      GalleryVideoUploadBody,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a video using the "video" field.',
      );
    }

    if (!body.title?.trim()) {
      throw new BadRequestException(
        "Title is required.",
      );
    }

    validateStatus(
      body.status,
    );

    const parsedSortOrder =
      parseNonNegativeInteger(
        body.sortOrder,
        "sortOrder",
      );

    const parsedHomepageSortOrder =
      parseNonNegativeInteger(
        body.homepageSortOrder,
        "homepageSortOrder",
      );

    const parsedEventId =
      parseOptionalPositiveInteger(
        body.eventId,
        "eventId",
      );

    const isFeatured =
      parseBoolean(
        body.isFeatured,
      );

    const showOnHomepage =
      parseBoolean(
        body.showOnHomepage,
      );

    const uploadResult =
      await this.cloudinaryService.uploadGalleryVideo(
        file,
      );

    /*
     * Cloudinary can generate a JPEG poster
     * from the first frame of the uploaded
     * video by changing the extension and
     * adding a video transformation.
     */
    const thumbnailUrl =
      this.createVideoThumbnailUrl(
        uploadResult.secure_url,
      );

    return this.galleryService.create({
      mediaType:
        "VIDEO",

      title:
        body.title.trim(),

      description:
        body.description
          ?.trim() ||
        undefined,

      imageUrl:
        uploadResult.secure_url,

      publicId:
        uploadResult.public_id,

      thumbnailUrl,

      duration:
        typeof uploadResult.duration ===
        "number"
          ? uploadResult.duration
          : undefined,

      width:
        uploadResult.width,

      height:
        uploadResult.height,

      altText:
        body.altText
          ?.trim() ||
        body.title.trim(),

      status:
        body.status ??
        "DRAFT",

      isFeatured,

      sortOrder:
        parsedSortOrder,

      showOnHomepage,

      homepageSortOrder:
        parsedHomepageSortOrder,

      eventId:
        parsedEventId,
    });
  }

  private createVideoThumbnailUrl(
    videoUrl: string,
  ): string | undefined {
    try {
      const uploadMarker =
        "/video/upload/";

      if (
        !videoUrl.includes(
          uploadMarker,
        )
      ) {
        return undefined;
      }

      const transformedUrl =
        videoUrl.replace(
          uploadMarker,
          `${uploadMarker}so_0,f_jpg,q_auto/`,
        );

      return transformedUrl.replace(
        /\.[^.\/]+$/,
        ".jpg",
      );
    } catch {
      return undefined;
    }
  }
}