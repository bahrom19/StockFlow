import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { PermissionsRepository } from '../repositories/permissions.repository';

interface PermissionSeed {
  code: string;
  name: string;
  description: string;
  module: string;
}

/**
 * Standard set of permissions for the StockFlow system.
 * Automatically seeded into the database on module initialization.
 */
const SEED_PERMISSIONS: PermissionSeed[] = [
  // Products
  {
    code: 'products:create',
    name: 'Create Products',
    description: 'Allows creating new products',
    module: 'products',
  },
  {
    code: 'products:read',
    name: 'Read Products',
    description: 'Allows viewing products',
    module: 'products',
  },
  {
    code: 'products:update',
    name: 'Update Products',
    description: 'Allows editing products',
    module: 'products',
  },
  {
    code: 'products:delete',
    name: 'Delete Products',
    description: 'Allows deleting products',
    module: 'products',
  },
  // Inventory
  {
    code: 'inventory:create',
    name: 'Create Inventory Records',
    description: 'Allows creating warehouses and inventory records',
    module: 'inventory',
  },
  {
    code: 'inventory:read',
    name: 'Read Inventory',
    description: 'Allows viewing inventory levels',
    module: 'inventory',
  },
  {
    code: 'inventory:update',
    name: 'Update Inventory',
    description: 'Allows editing warehouses and inventory records',
    module: 'inventory',
  },
  {
    code: 'inventory:delete',
    name: 'Delete Inventory',
    description: 'Allows deleting warehouses and inventory records',
    module: 'inventory',
  },
  {
    code: 'inventory:adjust',
    name: 'Adjust Stock',
    description: 'Allows adjusting stock quantities',
    module: 'inventory',
  },
  {
    code: 'inventory:transfer',
    name: 'Transfer Stock',
    description: 'Allows transferring stock between warehouses',
    module: 'inventory',
  },
  // Customers / CRM
  {
    code: 'crm:create',
    name: 'Create Customers',
    description: 'Allows creating customers',
    module: 'crm',
  },
  {
    code: 'crm:read',
    name: 'Read Customers',
    description: 'Allows viewing customers',
    module: 'crm',
  },
  {
    code: 'crm:update',
    name: 'Update Customers',
    description: 'Allows editing customers',
    module: 'crm',
  },
  {
    code: 'crm:delete',
    name: 'Delete Customers',
    description: 'Allows deleting customers',
    module: 'crm',
  },
  // Suppliers
  {
    code: 'suppliers:create',
    name: 'Create Suppliers',
    description: 'Allows creating suppliers',
    module: 'suppliers',
  },
  {
    code: 'suppliers:read',
    name: 'Read Suppliers',
    description: 'Allows viewing suppliers',
    module: 'suppliers',
  },
  {
    code: 'suppliers:update',
    name: 'Update Suppliers',
    description: 'Allows editing suppliers',
    module: 'suppliers',
  },
  {
    code: 'suppliers:delete',
    name: 'Delete Suppliers',
    description: 'Allows deleting suppliers',
    module: 'suppliers',
  },
  // Purchasing
  {
    code: 'purchasing:create',
    name: 'Create Purchase Orders',
    description: 'Allows creating purchase orders',
    module: 'purchasing',
  },
  {
    code: 'purchasing:read',
    name: 'Read Purchase Orders',
    description: 'Allows viewing purchase orders',
    module: 'purchasing',
  },
  {
    code: 'purchasing:update',
    name: 'Update Purchase Orders',
    description: 'Allows editing purchase orders',
    module: 'purchasing',
  },
  {
    code: 'purchasing:delete',
    name: 'Delete Purchase Orders',
    description: 'Allows deleting purchase orders',
    module: 'purchasing',
  },
  // Users
  {
    code: 'users:create',
    name: 'Create Users',
    description: 'Allows creating users',
    module: 'users',
  },
  {
    code: 'users:read',
    name: 'Read Users',
    description: 'Allows viewing users',
    module: 'users',
  },
  {
    code: 'users:update',
    name: 'Update Users',
    description: 'Allows editing users',
    module: 'users',
  },
  {
    code: 'users:delete',
    name: 'Delete Users',
    description: 'Allows deleting users',
    module: 'users',
  },
  // Roles & Permissions (admin)
  {
    code: 'roles:create',
    name: 'Create Roles',
    description: 'Allows creating roles',
    module: 'roles',
  },
  {
    code: 'roles:read',
    name: 'Read Roles',
    description: 'Allows viewing roles',
    module: 'roles',
  },
  {
    code: 'roles:update',
    name: 'Update Roles',
    description: 'Allows editing roles',
    module: 'roles',
  },
  {
    code: 'roles:delete',
    name: 'Delete Roles',
    description: 'Allows deleting roles',
    module: 'roles',
  },
  {
    code: 'roles:assign',
    name: 'Assign Roles',
    description: 'Allows assigning roles to users',
    module: 'roles',
  },
  // Reports
  {
    code: 'reports:read',
    name: 'Read Reports',
    description: 'Allows viewing reports',
    module: 'reports',
  },
  // Finance
  {
    code: 'finance:read',
    name: 'Read Finance',
    description: 'Allows viewing all financial data',
    module: 'finance',
  },
  {
    code: 'finance:create',
    name: 'Create Finance',
    description: 'Allows creating financial records',
    module: 'finance',
  },
  {
    code: 'finance:update',
    name: 'Update Finance',
    description: 'Allows updating financial records',
    module: 'finance',
  },
  {
    code: 'finance:delete',
    name: 'Delete Finance',
    description: 'Allows deleting financial records',
    module: 'finance',
  },
  {
    code: 'finance:post',
    name: 'Post Journal Entries',
    description: 'Allows posting journal entries to the general ledger',
    module: 'finance',
  },
  {
    code: 'finance:period-close',
    name: 'Close Financial Period',
    description: 'Allows closing financial periods',
    module: 'finance',
  },
  {
    code: 'finance:reports',
    name: 'Financial Reports',
    description: 'Allows viewing financial reports',
    module: 'finance',
  },
  // Settings
  {
    code: 'settings:read',
    name: 'Read Settings',
    description: 'Allows viewing company settings',
    module: 'settings',
  },
  {
    code: 'settings:update',
    name: 'Update Settings',
    description: 'Allows editing company settings',
    module: 'settings',
  },
  // Billing
  {
    code: 'billing:create',
    name: 'Create Billing',
    description: 'Allows subscribing to plans and making payments',
    module: 'billing',
  },
  {
    code: 'billing:read',
    name: 'Read Billing',
    description: 'Allows viewing subscription, invoices, features',
    module: 'billing',
  },
  {
    code: 'billing:update',
    name: 'Update Billing',
    description: 'Allows changing plan, cancel/resume subscription',
    module: 'billing',
  },
  {
    code: 'billing:delete',
    name: 'Delete Billing',
    description: 'Allows deleting payment methods',
    module: 'billing',
  },
  {
    code: 'admin:billing',
    name: 'Billing Admin',
    description: 'Allows managing plans, overriding subscriptions',
    module: 'billing',
  },
  // Sales
  {
    code: 'sales:create',
    name: 'Create Sales',
    description: 'Allows creating sales',
    module: 'sales',
  },
  {
    code: 'sales:read',
    name: 'Read Sales',
    description: 'Allows viewing sales',
    module: 'sales',
  },
  {
    code: 'sales:update',
    name: 'Update Sales',
    description: 'Allows updating sales',
    module: 'sales',
  },
  {
    code: 'sales:refund',
    name: 'Refund Sales',
    description: 'Allows refunding completed sales',
    module: 'sales',
  },
  {
    code: 'sales:cancel',
    name: 'Cancel Sales',
    description: 'Allows cancelling sales',
    module: 'sales',
  },
  {
    code: 'sales:shift',
    name: 'Manage Cash Shifts',
    description: 'Allows opening/closing cash shifts',
    module: 'sales',
  },
];

@Injectable()
export class PermissionsSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsSeedService.name);

  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    // Step 1: Upsert all seed permissions into the permission table
    let count = 0;
    for (const permission of SEED_PERMISSIONS) {
      await this.permissionsRepository.upsertByCode(permission.code, {
        code: permission.code,
        name: permission.name,
        description: permission.description,
        module: permission.module,
      });
      count++;
    }
    this.logger.log(`Seeded ${count} permissions`);

    // Step 2: Assign any new/updated permissions to existing Admin roles
    await this.assignPermissionsToAdminRoles();
  }

  /**
   * Ensures all existing Admin roles have all current permissions assigned.
   * This handles the case where new permissions are added after an Admin
   * role was already created (e.g. during company registration).
   */
  private async assignPermissionsToAdminRoles(): Promise<void> {
    // Fetch all permissions currently in the database
    const allPermissions = await this.prismaService.permission.findMany({
      select: { id: true },
    });

    if (allPermissions.length === 0) {
      return;
    }

    const allPermissionIds = allPermissions.map((p) => p.id);

    // Find all Admin roles that are not deleted
    const adminRoles = await this.prismaService.role.findMany({
      where: {
        name: 'Admin',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (adminRoles.length === 0) {
      return;
    }

    const adminRoleIds = adminRoles.map((r) => r.id);

    // Find which permissions are already assigned to each Admin role
    const existingAssignments =
      await this.prismaService.rolePermission.findMany({
        where: {
          roleId: { in: adminRoleIds },
        },
        select: { roleId: true, permissionId: true },
      });

    // Build a set of (roleId, permissionId) pairs that already exist
    const assignedSet = new Set(
      existingAssignments.map((a) => `${a.roleId}:${a.permissionId}`),
    );

    // For each Admin role, find permissions not yet assigned
    const newAssignments: { roleId: string; permissionId: string }[] = [];

    for (const roleId of adminRoleIds) {
      for (const permissionId of allPermissionIds) {
        if (!assignedSet.has(`${roleId}:${permissionId}`)) {
          newAssignments.push({ roleId, permissionId });
        }
      }
    }

    if (newAssignments.length > 0) {
      await this.prismaService.rolePermission.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
      this.logger.log(
        `Assigned ${newAssignments.length} new permissions to Admin roles`,
      );
    }
  }
}
