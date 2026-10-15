import { ApiProperty } from '@nestjs/swagger';
import { GalleryImageResponseDto } from './gallery-image-response.dto.js';

export class GalleryCleanupSummaryDto {
  @ApiProperty({ example: 0 }) pending!: number;
  @ApiProperty({ example: 2 }) succeeded!: number;
  @ApiProperty({ example: 0 }) failed!: number;
}

export class GalleryDeletionResponseDto {
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ enum: ['completed', 'cleanup_pending', 'cleanup_failed'] }) status!: string;
  @ApiProperty({ example: 3 }) requestedCount!: number;
  @ApiProperty({ type: [Number], example: [12, 18] }) deletedIds!: number[];
  @ApiProperty({ type: [Number], example: [27] }) notFoundIds!: number[];
  @ApiProperty({ type: [Number], description: 'Deleted records whose legacy Cloudinary assets were deliberately preserved.' }) preservedAssetIds!: number[];
  @ApiProperty({ type: GalleryCleanupSummaryDto }) cleanup!: GalleryCleanupSummaryDto;
}

export class GallerySingleDeletionResponseDto extends GalleryImageResponseDto {
  @ApiProperty({ type: GalleryDeletionResponseDto }) deletion!: GalleryDeletionResponseDto;
}
