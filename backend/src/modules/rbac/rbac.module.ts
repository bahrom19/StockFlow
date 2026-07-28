import { Global, Module } from '@nestjs/common';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { RolesGuard } from './guards/roles.guard';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { PermissionsSeedService } from './services/permissions-seed.service';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';

@Global()
@Module({
  controllers: [PermissionsController, RolesController],
  providers: [
    // Repositories
    PermissionsRepository,
    RolesRepository,
    // Services
    PermissionsService,
    RolesService,
    PermissionsSeedService,
    // Guards (used via DI)
    RolesGuard,
  ],
  exports: [RolesGuard, RolesRepository],
})
export class RbacModule {}
