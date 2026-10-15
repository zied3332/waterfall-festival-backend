import { ApiProperty } from '@nestjs/swagger';

export type DirectoryStatus = 'ok' | 'missing' | 'unavailable' | 'unsafe' | 'partial';
export type StorageCategory = 'gallery.images' | 'gallery.videos' | 'events.posters';

export class MediaDirectoryStatsDto {
  @ApiProperty({ enum: ['ok', 'missing', 'unavailable', 'unsafe', 'partial'] })
  status!: DirectoryStatus;
  @ApiProperty({ type: Number, nullable: true, description: 'Regular supported files observed; null when the directory cannot be measured.' })
  count!: number | null;
  @ApiProperty({ type: Number, nullable: true }) totalBytes!: number | null;
  @ApiProperty({ type: Number, nullable: true }) averageBytes!: number | null;
  @ApiProperty({ type: Number, nullable: true }) largestBytes!: number | null;
}

export class GalleryStorageStatsDto {
  @ApiProperty({ type: MediaDirectoryStatsDto }) images!: MediaDirectoryStatsDto;
  @ApiProperty({ type: MediaDirectoryStatsDto }) videos!: MediaDirectoryStatsDto;
}

export class EventStorageStatsDto {
  @ApiProperty({ type: MediaDirectoryStatsDto }) posters!: MediaDirectoryStatsDto;
}

export class StorageTotalsDto {
  @ApiProperty({ type: Number, nullable: true }) files!: number | null;
  @ApiProperty({ type: Number, nullable: true }) bytes!: number | null;
}

export class StoragePercentagesDto {
  @ApiProperty({ type: Number, nullable: true }) images!: number | null;
  @ApiProperty({ type: Number, nullable: true }) videos!: number | null;
  @ApiProperty({ type: Number, nullable: true }) posters!: number | null;
}

export class StorageWarningDto {
  @ApiProperty({ enum: ['gallery.images', 'gallery.videos', 'events.posters'] }) category!: StorageCategory;
  @ApiProperty({ description: 'Sanitized warning code; contains no server paths or file names.' }) code!: string;
}

export class StorageStatsDto {
  @ApiProperty({ format: 'date-time' }) measuredAt!: string;
  @ApiProperty({ format: 'date-time' }) scanStartedAt!: string;
  @ApiProperty({ enum: ['ok', 'partial', 'unavailable'] }) status!: 'ok' | 'partial' | 'unavailable';
  @ApiProperty({ example: 5000, description: 'Maximum successful snapshot cache lifetime in milliseconds.' }) cacheTtlMs!: number;
  @ApiProperty({ type: GalleryStorageStatsDto }) gallery!: GalleryStorageStatsDto;
  @ApiProperty({ type: EventStorageStatsDto }) events!: EventStorageStatsDto;
  @ApiProperty({ type: StorageTotalsDto, description: 'Null unless all three directories were measured completely.' }) total!: StorageTotalsDto;
  @ApiProperty({ type: StorageTotalsDto, description: 'Observed supported files, including incomplete scans. Not an authoritative total.' }) observed!: StorageTotalsDto;
  @ApiProperty({ type: StoragePercentagesDto, description: 'Percent of measured bytes, or null when any category is incomplete. Empty media yields zeros.' }) percentages!: StoragePercentagesDto;
  @ApiProperty({ type: [StorageWarningDto] }) warnings!: StorageWarningDto[];
}
