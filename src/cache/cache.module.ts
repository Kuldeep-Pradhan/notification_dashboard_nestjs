import { Module, Global } from '@nestjs/common';
import { TemplateCacheService } from './template-cache.service';

@Global()
@Module({
  providers: [TemplateCacheService],
  exports: [TemplateCacheService],
})
export class CacheModule {}
