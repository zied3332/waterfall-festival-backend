import {
  Module,
} from "@nestjs/common";

import {
  LocalUploadService,
} from "./local-upload.service.js";

@Module({
  providers: [
    LocalUploadService,
  ],

  exports: [
    LocalUploadService,
  ],
})
export class UploadsModule {}