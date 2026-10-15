import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HostingStorageStatsDto {
  @ApiProperty({ enum: ['ok', 'unavailable', 'unlimited', 'not_configured'] })
  status!: 'ok' | 'unavailable' | 'unlimited' | 'not_configured';
  @ApiProperty({ enum: ['cpanel_uapi'], description: 'Legacy compatibility identifier only; the integration is disabled.' }) source!: 'cpanel_uapi';
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) measuredAt!: string | null;
  @ApiProperty({ type: Number, nullable: true }) quotaBytes!: number | null;
  @ApiProperty({ type: Number, nullable: true }) usedBytes!: number | null;
  @ApiProperty({ type: Number, nullable: true }) availableBytes!: number | null;
  @ApiProperty({ type: Number, nullable: true }) usagePercent!: number | null;
  @ApiProperty() isUnlimited!: boolean;
  @ApiPropertyOptional({ description: 'Sanitized failure classification. Never contains upstream text or configuration values.' })
  errorCode?: 'integration_disabled';
}
