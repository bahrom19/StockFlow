/**
 * G14-03-07: Supplier primary Contact / default Address partial unique
 * indexes — integration tests against real PostgreSQL.
 *
 * Proves the database itself enforces at most one ACTIVE primary contact
 * and one ACTIVE default address per supplier, and that the repositories
 * map the unique violation (P2002) to ConflictException (HTTP 409).
 */

import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SupplierContactsRepository } from '../repositories/supplier-contacts.repository';
import { SupplierAddressesRepository } from '../repositories/supplier-addresses.repository';

const TEST_PREFIX = 'E2E-G140307-';

const prisma = new PrismaService();
const contactsRepo = new SupplierContactsRepository(prisma);
const addressesRepo = new SupplierAddressesRepository(prisma);

let companyId: string;
let supplierId: string;
let otherSupplierId: string;

beforeAll(async () => {
  const company = await prisma.company.create({
    data: {
      name: `${TEST_PREFIX}Company`,
      bin: '000000000101',
      address: 'Test',
      phone: '+000000000101',
    },
  });
  companyId = company.id;
  const supplier = await prisma.supplier.create({
    data: { companyId, companyName: `${TEST_PREFIX}Supplier` },
  });
  supplierId = supplier.id;
  const other = await prisma.supplier.create({
    data: { companyId, companyName: `${TEST_PREFIX}Other` },
  });
  otherSupplierId = other.id;
});

afterAll(async () => {
  await prisma.supplierContact.deleteMany({ where: { supplierId: { in: [supplierId, otherSupplierId] } } });
  await prisma.supplierAddress.deleteMany({ where: { supplierId: { in: [supplierId, otherSupplierId] } } });
  await prisma.supplier.deleteMany({ where: { id: { in: [supplierId, otherSupplierId] } } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
});

describe('SupplierContact primary uniqueness (G14-03-07)', () => {
  it('allows a normal primary contact creation', async () => {
    const created = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'Primary',
      isPrimary: true,
    } as never);
    expect(created.isPrimary).toBe(true);
    await prisma.supplierContact.deleteMany({ where: { id: created.id } });
  });

  it('rejects a second active primary with P2002 at the DB level', async () => {
    const first = await prisma.supplierContact.create({
      data: { supplierId, firstName: 'A', isPrimary: true },
    });
    await expect(
      prisma.supplierContact.create({
        data: { supplierId, firstName: 'B', isPrimary: true },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await prisma.supplierContact.deleteMany({ where: { id: first.id } });
  });

  it('maps concurrent-duplicate P2002 to ConflictException in the repository', async () => {
    const first = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'A',
      isPrimary: true,
    } as never);
    await expect(
      contactsRepo.create({
        supplier: { connect: { id: supplierId } },
        firstName: 'B',
        isPrimary: true,
      } as never),
    ).rejects.toThrow(ConflictException);
    await prisma.supplierContact.deleteMany({ where: { id: first.id } });
  });

  it('allows non-primary contacts without restriction', async () => {
    const a = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'A',
    } as never);
    const b = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'B',
    } as never);
    expect(a.isPrimary).toBe(false);
    expect(b.isPrimary).toBe(false);
    await prisma.supplierContact.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it('allows a new primary after the previous one is soft-deleted', async () => {
    const old = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'Old',
      isPrimary: true,
    } as never);
    await contactsRepo.softDelete(old.id, supplierId, old.rowVersion);
    const fresh = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'New',
      isPrimary: true,
    } as never);
    expect(fresh.isPrimary).toBe(true);
    await prisma.supplierContact.deleteMany({ where: { id: fresh.id } });
  });

  it('keeps suppliers independent (other supplier primary does not conflict)', async () => {
    const other = await contactsRepo.create({
      supplier: { connect: { id: otherSupplierId } },
      firstName: 'Other',
      isPrimary: true,
    } as never);
    const own = await contactsRepo.create({
      supplier: { connect: { id: supplierId } },
      firstName: 'Own',
      isPrimary: true,
    } as never);
    expect(own.isPrimary).toBe(true);
    await prisma.supplierContact.deleteMany({ where: { id: { in: [other.id, own.id] } } });
  });
});

describe('SupplierAddress default uniqueness (G14-03-07)', () => {
  it('allows a normal default address creation', async () => {
    const created = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'Almaty',
      isDefault: true,
    } as never);
    expect(created.isDefault).toBe(true);
    await prisma.supplierAddress.deleteMany({ where: { id: created.id } });
  });

  it('rejects a second active default with P2002 at the DB level', async () => {
    const first = await prisma.supplierAddress.create({
      data: { supplierId, city: 'A', isDefault: true },
    });
    await expect(
      prisma.supplierAddress.create({
        data: { supplierId, city: 'B', isDefault: true },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await prisma.supplierAddress.deleteMany({ where: { id: first.id } });
  });

  it('maps concurrent-duplicate P2002 to ConflictException in the repository', async () => {
    const first = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'A',
      isDefault: true,
    } as never);
    await expect(
      addressesRepo.create({
        supplier: { connect: { id: supplierId } },
        city: 'B',
        isDefault: true,
      } as never),
    ).rejects.toThrow(ConflictException);
    await prisma.supplierAddress.deleteMany({ where: { id: first.id } });
  });

  it('allows non-default addresses without restriction', async () => {
    const a = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'A',
    } as never);
    const b = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'B',
    } as never);
    expect(a.isDefault).toBe(false);
    expect(b.isDefault).toBe(false);
    await prisma.supplierAddress.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it('allows a new default after the previous one is soft-deleted', async () => {
    const old = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'Old',
      isDefault: true,
    } as never);
    await addressesRepo.softDelete(old.id, supplierId, old.rowVersion);
    const fresh = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'New',
      isDefault: true,
    } as never);
    expect(fresh.isDefault).toBe(true);
    await prisma.supplierAddress.deleteMany({ where: { id: fresh.id } });
  });

  it('keeps suppliers independent (other supplier default does not conflict)', async () => {
    const other = await addressesRepo.create({
      supplier: { connect: { id: otherSupplierId } },
      city: 'Other',
      isDefault: true,
    } as never);
    const own = await addressesRepo.create({
      supplier: { connect: { id: supplierId } },
      city: 'Own',
      isDefault: true,
    } as never);
    expect(own.isDefault).toBe(true);
    await prisma.supplierAddress.deleteMany({ where: { id: { in: [other.id, own.id] } } });
  });
});
