import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    data: Prisma.UserCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const client = tx ?? this.prismaService;
    return client.user.create({ data });
  }

  async findAll(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User[]> {
    const client = tx ?? this.prismaService;
    return client.user.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            companyId,
            deletedAt: null,
          },
        },
      },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null> {
    const client = tx ?? this.prismaService;
    return client.user.findFirst({
      where: {
        id,
        deletedAt: null,
        members: {
          some: {
            companyId,
            deletedAt: null,
          },
        },
      },
    });
  }

  async findByEmail(
    email: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null> {
    const client = tx ?? this.prismaService;
    return client.user.findFirst({
      where: {
        email,
        deletedAt: null,
        members: {
          some: {
            companyId,
            deletedAt: null,
          },
        },
      },
    });
  }

  async findByEmailGlobal(
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User | null> {
    const client = tx ?? this.prismaService;
    return client.user.findUnique({
      where: { email },
    });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const client = tx ?? this.prismaService;

    if (rowVersion !== undefined) {
      const result = await client.user.updateMany({
        where: { id, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.user.findFirst({
          where: { id },
        });
        if (!existing) {
          throw new NotFoundException(`User with id ${id} not found`);
        }
        throw new ConflictException(
          `User ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return client.user.findUnique({ where: { id } }) as Promise<User>;
    }

    // Legacy path without rowVersion
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return client.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const client = tx ?? this.prismaService;

    if (rowVersion !== undefined) {
      const result = await client.user.updateMany({
        where: { id, rowVersion },
        data: {
          deletedAt: new Date(),
          isActive: false,
          status: 'DELETED',
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.user.findFirst({
          where: { id },
        });
        if (!existing) {
          throw new NotFoundException(`User with id ${id} not found`);
        }
        throw new ConflictException(
          `User ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.user.findUnique({ where: { id } }) as Promise<User>;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return client.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        status: 'DELETED',
      },
    });
  }
}
