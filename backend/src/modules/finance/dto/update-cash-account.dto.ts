import { PartialType } from '@nestjs/swagger';
import { CreateCashAccountDto } from './create-cash-account.dto';

export class UpdateCashAccountDto extends PartialType(CreateCashAccountDto) {}
