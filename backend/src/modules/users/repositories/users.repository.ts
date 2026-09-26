import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyMember, Prisma, User } from '@prisma/client';
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

  /**
   * Attach an existing user to a company. Caller must run inside the
   * provisioning transaction; CompanyMember @@unique([companyId, userId])
   * is the race backstop (P2002 → 409 via the global exception filter).
   */
  async createCompanyMember(
    userId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CompanyMember> {
    const client = tx ?? this.prismaService;
    return client.companyMember.create({
      data: { userId, companyId },
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
      // G16-B-01: company scope is part of the CAS predicate so a
      // cross-company write can never succeed even if a caller skipped the
      // scoped pre-check. Deny-by-default: foreign rows read as NotFound.
      const result = await client.user.updateMany({
        where: {
          id,
          rowVersion,
          members: { some: { companyId, deletedAt: null } },
        },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.user.findFirst({
          where: {
            id,
            deletedAt: null,
            members: { some: { companyId, deletedAt: null } },
          },
        });
        if (!existing) {
          throw new NotFoundException(`User with id ${id} not found`);
        }
        throw new ConflictException(
          `User ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      return (await this.findById(id, companyId, tx)) as User;
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
      // G16-B-01: same company-scoped CAS hardening as update().
      const result = await client.user.updateMany({
        where: {
          id,
          rowVersion,
          members: { some: { companyId, deletedAt: null } },
        },
        data: {
          deletedAt: new Date(),
          isActive: false,
          status: 'DELETED',
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.user.findFirst({
          where: {
            id,
            deletedAt: null,
            members: { some: { companyId, deletedAt: null } },
          },
        });
        if (!existing) {
          throw new NotFoundException(`User with id ${id} not found`);
        }
        throw new ConflictException(
          `User ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      // Re-read without the deletedAt filter (the row was just soft-deleted)
      // but still scoped to the caller's company.
      return (await client.user.findFirst({
        where: {
          id,
          members: { some: { companyId } },
        },
      })) as User;
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
