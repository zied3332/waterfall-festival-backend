import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EventsModule } from '../events/events.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { STORAGE_FILESYSTEM, storageFilesystem } from './storage-filesystem.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';
import { CpanelClientService, CpanelHttpService } from './cpanel-client.service.js';
import { HostingStorageService } from './hosting-storage.service.js';

@Module({
  imports: [AuthModule, EventsModule, UploadsModule],
  controllers: [StorageController],
  providers: [StorageService, HostingStorageService, CpanelClientService, CpanelHttpService, { provide: STORAGE_FILESYSTEM, useValue: storageFilesystem }],
})
export class StorageModule {}
