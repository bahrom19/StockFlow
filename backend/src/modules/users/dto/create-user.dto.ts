import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '$2b$10$...' })
  @IsString()
  @IsNotEmpty()
  passwordHash!: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ example: '+77011234567' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional({ example: 'Manager' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  position?: string;
}
