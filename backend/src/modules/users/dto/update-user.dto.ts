import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'updated@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '$2b$10$...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  passwordHash?: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ example: '+77019876543' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional({ example: 'Senior Manager' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  position?: string;
}
