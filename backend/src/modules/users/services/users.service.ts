import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repositories/users.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.usersRepository.findByEmailGlobal(
      createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const createdUser = await this.usersRepository.create({
      ...createUserDto,
      status: UserStatus.ACTIVE,
      isActive: true,
    });

    return UserEntity.fromPrisma(createdUser);
  }

  async findAll(currentUser: JwtPayload): Promise<UserEntity[]> {
    const users = await this.usersRepository.findAll(currentUser.companyId);
    return users.map((user) => UserEntity.fromPrisma(user));
  }

  async findById(id: string, currentUser: JwtPayload): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id, currentUser.companyId);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return UserEntity.fromPrisma(user);
  }

  async findByEmail(
    email: string,
    currentUser: JwtPayload,
  ): Promise<UserEntity> {
    const user = await this.usersRepository.findByEmail(
      email,
      currentUser.companyId,
    );

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return UserEntity.fromPrisma(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.usersRepository.findById(
        id,
        currentUser.companyId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      if (updateUserDto.email) {
        const existingUser = await this.usersRepository.findByEmail(
          updateUserDto.email,
          currentUser.companyId,
          tx,
        );
        if (existingUser && existingUser.id !== id) {
          throw new ConflictException('User with this email already exists');
        }
      }

      const updateData: Prisma.UserUpdateInput = { ...updateUserDto };
      const rowVer = existing.rowVersion ?? 0;
      const updatedUser = await this.usersRepository.update(
        id,
        updateData,
        currentUser.companyId,
        rowVer,
        tx,
      );

      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'User',
          entityId: id,
          action: 'UPDATE',
          before: { status: existing.status },
          after: { status: updatedUser.status },
        },
        tx,
      );

      return UserEntity.fromPrisma(updatedUser);
    });
  }

  async softDelete(id: string, currentUser: JwtPayload): Promise<UserEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.usersRepository.findById(
        id,
        currentUser.companyId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      const rowVer = existing.rowVersion ?? 0;
      const deletedUser = await this.usersRepository.softDelete(
        id,
        currentUser.companyId,
        rowVer,
        tx,
      );

      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'User',
          entityId: id,
          action: 'DELETE',
          before: { status: existing.status },
          after: null,
        },
        tx,
      );

      return UserEntity.fromPrisma(deletedUser);
    });
  }
}
