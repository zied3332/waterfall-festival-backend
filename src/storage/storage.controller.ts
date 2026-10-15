import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { StorageStatsDto } from './storage-stats.dto.js';
import { StorageService } from './storage.service.js';
import { HostingStorageService } from './hosting-storage.service.js';
import { HostingStorageStatsDto } from './hosting-storage.dto.js';

@ApiTags('Admin Storage')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'A valid administrator JWT is required.' })
@ApiForbiddenResponse({ description: 'The authenticated user must have the ADMIN role.' })
@Controller('admin/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StorageController {
  constructor(private readonly storage: StorageService, private readonly hosting: HostingStorageService) {}

  @Get('hosting')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ deprecated: true, summary: 'Legacy hosting statistics compatibility', description: 'Hosting quota integration is disabled. Returns unavailable with null measurements. Use /admin/storage/stats for measured platform media usage.' })
  @ApiOkResponse({ type: HostingStorageStatsDto })
  getHostingStats(): Promise<HostingStorageStatsDto> {
    return this.hosting.getStats();
  }

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Measure local media storage', description: 'Read-only metadata measurements of the actual gallery image/video and event poster directories. Complete snapshots may be reused for five seconds. Inspect status and warnings: incomplete measurements have null overall totals and percentages.' })
  @ApiOkResponse({ type: StorageStatsDto })
  getStats(): Promise<StorageStatsDto> {
    return this.storage.getStats();
  }
}
