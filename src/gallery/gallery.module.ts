import {
  Module,
} from "@nestjs/common";

import {
  AuthModule,
} from "../auth/auth.module.js";

import {
  PrismaModule,
} from "../prisma/prisma.module.js";

import {
  UploadsModule,
} from "../uploads/uploads.module.js";

import {
  AdminGalleryController,
} from "./admin-gallery/admin-gallery.controller.js";

import {
  GalleryController,
} from "./gallery.controller.js";

import {
  GalleryService,
} from "./gallery.service.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UploadsModule,
  ],

  controllers: [
    GalleryController,
    AdminGalleryController,
  ],

  providers: [
    GalleryService,
  ],
})
export class GalleryModule {}