import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ApiOkResponse,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { CashAccountEntity } from '../entities/cash-account.entity';
import { BankAccountEntity } from '../entities/bank-account.entity';
import { CashAccountMapper } from '../mappers/cash-account.mapper';
import { BankAccountMapper } from '../mappers/bank-account.mapper';

/**
 * G15-07-C3-D — contract freeze for deprecated balance fields.
 *
 * CashAccount/BankAccount openingBalance + currentBalance are dead
 * (never written, always the database default) and marked deprecated.
 * These tests prove backward compatibility: the fields remain present and
 * pass through unchanged, while the generated OpenAPI contract flags them
 * as deprecated. Removal is deferred to a future versioned workstream.
 */

const cashRow = {
  id: 'acc-1',
  companyId: 'comp-1',
  warehouseId: null,
  chartOfAccountId: null,
  name: 'Main Register',
  type: 'REGISTER',
  currency: 'KZT',
  openingBalance: new Decimal('0'),
  currentBalance: new Decimal('0'),
  isActive: true,
  description: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

const bankRow = {
  id: 'bank-1',
  companyId: 'comp-1',
  chartOfAccountId: null,
  bankName: 'National Bank',
  accountNumber: '123',
  accountName: null,
  iban: null,
  bic: null,
  currency: 'KZT',
  openingBalance: new Decimal('0'),
  currentBalance: new Decimal('0'),
  isDefault: false,
  isActive: true,
  lastReconciledAt: null,
  description: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

@Controller('__c3d_probe__')
class ProbeController {
  @Get('cash')
  @ApiOkResponse({ type: CashAccountEntity })
  cash(): CashAccountEntity {
    throw new Error('probe only');
  }

  @Get('bank')
  @ApiOkResponse({ type: BankAccountEntity })
  bank(): BankAccountEntity {
    throw new Error('probe only');
  }
}

describe('cash-account deprecation contract — G15-07-C3-D', () => {
  it('mapper output keeps both balance fields with unchanged values', () => {
    const cash = CashAccountMapper.toEntity(cashRow);
    expect(cash).toEqual(
      expect.objectContaining({
        openingBalance: '0',
        currentBalance: '0',
      }),
    );
    expect(Object.keys(cash)).toEqual(
      expect.arrayContaining(['openingBalance', 'currentBalance']),
    );

    const bank = BankAccountMapper.toEntity(bankRow);
    expect(bank).toEqual(
      expect.objectContaining({
        openingBalance: '0',
        currentBalance: '0',
      }),
    );
    expect(Object.keys(bank)).toEqual(
      expect.arrayContaining(['openingBalance', 'currentBalance']),
    );
  });

  it('generated OpenAPI marks all four fields deprecated', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('probe').setVersion('1').build(),
      );
      const schemas = document.components?.schemas ?? {};
      for (const schemaName of ['CashAccountEntity', 'BankAccountEntity']) {
        const schema: any = (schemas as any)[schemaName];
        expect(schema).toBeDefined();
        for (const field of ['openingBalance', 'currentBalance']) {
          expect(schema.properties?.[field]).toBeDefined();
          expect(schema.properties[field].deprecated).toBe(true);
        }
      }
    } finally {
      await app.close();
    }
  });
});
