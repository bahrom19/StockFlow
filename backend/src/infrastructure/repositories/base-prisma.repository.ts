import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseRepository } from '../../domain/repositories/base.repository';

@Injectable()
export class PrismaBaseRepository<T> extends BaseRepository<T> {
  constructor(protected readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<T | null> {
    void id;
    return null;
  }

  async findAll(): Promise<T[]> {
    return [];
  }

  async create(data: Partial<T>): Promise<T> {
    void data;
    throw new Error(
      'PrismaBaseRepository is a scaffold; implement per aggregate.',
    );
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    void id;
    void data;
    throw new Error(
      'PrismaBaseRepository is a scaffold; implement per aggregate.',
    );
  }

  async delete(id: string): Promise<void> {
    void id;
  }
}
