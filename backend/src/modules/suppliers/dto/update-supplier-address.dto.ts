import { PartialType } from '@nestjs/swagger';
import { CreateSupplierAddressDto } from './create-supplier-address.dto';

export class UpdateSupplierAddressDto extends PartialType(
  CreateSupplierAddressDto,
) {}
