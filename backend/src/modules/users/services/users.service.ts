import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
    private readonly configService: ConfigService,
  ) {}

  /**
   * Bcrypt cost. Expression is intentionally identical to AuthService so the
   * two can never diverge (see G16-B-01 design audit §4 for the caveat that
   * no `auth` config namespace is registered today, hence the default 12).
   */
  private get bcryptRounds(): number {
    return this.configService.get<number>('auth.bcryptRounds') ?? 12;
  }

  /**
   * Provision a user into the caller's company (G16-B-01, Option B).
   *
   * - Accepts plaintext `password` only; hashes server-side with bcrypt.
   * - companyId comes ONLY from the authenticated JWT, never from the body.
   * - User + CompanyMember + CREATE audit commit atomically; any failure
   *   rolls everything back (no orphan user may survive).
   * - No roleId in this workstream: roles are granted afterwards via the
   *   existing POST roles/assign flow. A member without roles is fail-closed.
   */
  async create(
    createUserDto: CreateUserDto,
    currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existingUser = await this.usersRepository.findByEmailGlobal(
        createUserDto.email,
        tx,
      );

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(
        createUserDto.password,
        this.bcryptRounds,
      );

      const createdUser = await this.usersRepository.create(
        {
          email: createUserDto.email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          phone: createUserDto.phone,
          position: createUserDto.position,
          status: UserStatus.ACTIVE,
          isActive: true,
        },
        tx,
      );

      await this.usersRepository.createCompanyMember(
        createdUser.id,
        currentUser.companyId,
        tx,
      );

      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'User',
          entityId: createdUser.id,
          action: 'CREATE',
          before: null,
          after: { email: createdUser.email },
        },
        tx,
      );

      const scoped = await this.usersRepository.findById(
        createdUser.id,
        currentUser.companyId,
        tx,
      );
      if (!scoped) {
        // Defensive: member was just created in this transaction.
        throw new NotFoundException(
          `User with id ${createdUser.id} not found`,
        );
      }

      return UserEntity.fromPrisma(scoped);
    });
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

      const updateData: Prisma.UserUpdateInput = {};
      if (updateUserDto.email !== undefined) {
        updateData.email = updateUserDto.email;
      }
      if (updateUserDto.firstName !== undefined) {
        updateData.firstName = updateUserDto.firstName;
      }
      if (updateUserDto.lastName !== undefined) {
        updateData.lastName = updateUserDto.lastName;
      }
      if (updateUserDto.phone !== undefined) {
        updateData.phone = updateUserDto.phone;
      }
      if (updateUserDto.position !== undefined) {
        updateData.position = updateUserDto.position;
      }
      if (updateUserDto.password !== undefined) {
        // Password rotation: hash server-side, never accept client hashes.
        // Membership and roles are intentionally untouched here.
        updateData.passwordHash = await bcrypt.hash(
          updateUserDto.password,
          this.bcryptRounds,
        );
      }
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
