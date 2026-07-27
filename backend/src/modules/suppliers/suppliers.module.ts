import { Module } from '@nestjs/common';
import { SuppliersController } from './controllers/suppliers.controller';
import { SuppliersService } from './services/suppliers.service';
import { SuppliersRepository } from './repositories/suppliers.repository';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersRepository],
})
export class SuppliersModule {}
