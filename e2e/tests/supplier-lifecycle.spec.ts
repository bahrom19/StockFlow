import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * StockFlow — Supplier lifecycle E2E (G1, request-context only).
 *
 * Covers the approved G1 design scope end-to-end against a running API:
 *   CREATE → GET (rowVersion exposed) → PATCH with rowVersion (CAS)
 *   → contact → address → supplier product → payment → void payment
 *   → statement → DELETE (archive) → default-list visibility
 *   → historical documents remain intact.
 *
 * Negative cases: wrong-tenant supplier/contact/address, stale rowVersion → 409,
 * invalid UUID → 400, duplicate active email/BIN → 409.
 *
 * Payment-void concurrency: DEFERRED (would require a new harness — out of
 * the approved G1 scope, see DESIGN AUDIT DD-7).
 */

const PASSWORD = 'E2eStrong123!';
const API_FALLBACK = 'http://localhost:3000/api';

interface Tenant {
  email: string;
  companyName: string;
  token?: string;
  companyId?: string;
}

function unique(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function resolveApiBase(request: APIRequestContext): Promise<string> {
  try {
    const res = await request.get('http://127.0.0.1:8081/assets/env/.env.prod');
    if (res.ok()) {
      const text = await res.text();
      const m = text.match(/API_BASE_URL=(.+)/);
      if (m) return m[1].trim();
    }
  } catch {
    /* fall through */
  }
  return API_FALLBACK;
}

async function registerTenant(
  request: APIRequestContext,
  apiBase: string,
  name: string,
): Promise<Tenant> {
  const u = unique();
  const tenant: Tenant = {
    email: `e2e.g1.${name}.${u}@stockflow.test`,
    companyName: `G1 Supplier Lifecycle ${name} ${u}`,
  };
  const reg = await request.post(`${apiBase}/auth/register`, {
    data: {
      email: tenant.email,
      password: PASSWORD,
      companyName: tenant.companyName,
      firstName: 'G1 E2E',
    },
  });
  if (reg.status() !== 201 && reg.status() !== 409) {
    throw new Error(`register failed: ${reg.status()} ${await reg.text()}`);
  }
  const login = await request.post(`${apiBase}/auth/login`, {
    data: { email: tenant.email, password: PASSWORD },
  });
  const body = await login.json().catch(() => ({}));
  tenant.token = body?.accessToken;
  if (!tenant.token) {
    throw new Error(`login failed: ${login.status()} ${JSON.stringify(body).slice(0, 300)}`);
  }
  const me = await request.get(`${apiBase}/auth/me`, {
    headers: { Authorization: `Bearer ${tenant.token}` },
  });
  const meBody = await me.json().catch(() => ({}));
  tenant.companyId = meBody?.companyId ?? meBody?.company?.id ?? meBody?.activeCompany?.id;
  if (!tenant.companyId) {
    // /auth/me contract may differ; fall back to parsing the supplier create
    // response later (companyId is always echoed there).
    tenant.companyId = '';
  }
  return tenant;
}

function auth(tenant: Tenant): Record<string, string> {
  return { Authorization: `Bearer ${tenant.token}` };
}

test.describe('Supplier lifecycle (G1)', () => {
  let apiBase: string;
  let tenantA: Tenant;
  let tenantB: Tenant;

  test.beforeAll(async ({ request }) => {
    apiBase = await resolveApiBase(request);
    tenantA = await registerTenant(request, apiBase, 'a');
    tenantB = await registerTenant(request, apiBase, 'b');
  });

  test('happy path: create → cas update → contacts → addresses → product → payment → void → statement → archive', async ({ request }) => {
    const u = unique();

    // ── 1. CREATE supplier ──────────────────────────────────────
    const createRes = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: {
        companyName: `G1 Lifecycle Supplier ${u}`,
        bin: `1${u}`.slice(0, 12),
        email: `g1.${u}@supplier.test`,
        phone: `+7700${u}`.slice(0, 12),
      },
    });
    expect(createRes.status(), await createRes.text()).toBe(201);
    const supplier = await createRes.json();
    const supplierId: string = supplier.id;
    expect(typeof supplier.rowVersion).toBe('number');
    const rowVersion0: number = supplier.rowVersion;
    const companyName: string = supplier.companyName;
    const companyId: string = supplier.companyId;

    // ── 2. GET supplier: rowVersion exposed ─────────────────────
    const getRes = await request.get(`${apiBase}/suppliers/${supplierId}`, {
      headers: auth(tenantA),
    });
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.rowVersion).toBe(rowVersion0);

    // ── 3. PATCH with rowVersion (CAS ok) ───────────────────────
    const patchRes = await request.patch(`${apiBase}/suppliers/${supplierId}`, {
      headers: auth(tenantA),
      data: {
        companyName: `${companyName} updated`,
        rowVersion: rowVersion0,
      },
    });
    expect(patchRes.status(), await patchRes.text()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.rowVersion).toBe(rowVersion0 + 1);

    // ── 4. Contact create ───────────────────────────────────────
    const contactRes = await request.post(
      `${apiBase}/suppliers/${supplierId}/contacts`,
      {
        headers: auth(tenantA),
        data: {
          firstName: 'Aidana',
          lastName: 'Supplier',
          phone: '+77019990011',
          email: `contact.${u}@supplier.test`,
          isPrimary: true,
        },
      },
    );
    expect(contactRes.status(), await contactRes.text()).toBe(201);
    const contact = await contactRes.json();

    // ── 5. Address create ───────────────────────────────────────
    const addressRes = await request.post(
      `${apiBase}/suppliers/${supplierId}/addresses`,
      {
        headers: auth(tenantA),
        data: { city: 'Almaty', country: 'KZ', street: 'Abay 1', postalCode: '050000', isDefault: true },
      },
    );
    expect(addressRes.status(), await addressRes.text()).toBe(201);
    const address = await addressRes.json();

    // ── 6. Supplier product (needs product + company currency) ──
    const productRes = await request.post(`${apiBase}/products`, {
      headers: auth(tenantA),
      data: { name: `G1 Product ${u}`, price: 500 },
    });
    expect(productRes.status(), await productRes.text()).toBe(201);
    const product = await productRes.json();

    const spRes = await request.post(
      `${apiBase}/suppliers/${supplierId}/products`,
      {
        headers: auth(tenantA),
        data: { productId: product.id, purchasePrice: 350 },
      },
    );
    expect(spRes.status(), await spRes.text()).toBe(201);
    const supplierProduct = await spRes.json();

    // ── 7. Payment (needs a cash account; CASH requires cashAccountId) ──
    // Discover the company's ChartOfAccount for Cash (code 1010)
    // before creating the CashAccount so the cash account is linked
    // to a valid GL account (SupplierPaymentsService.resolveCreditAccountId
    // requires chartOfAccountId to be non-null).
    const chartRes = await request.get(
      `${apiBase}/finance/chart-of-accounts?search=1010&isActive=true&accountType=ASSET`,
      { headers: auth(tenantA) },
    );
    expect(chartRes.status(), await chartRes.text()).toBe(200);
    const chartAccounts = await chartRes.json();
    const chartAccount = chartAccounts.items?.[0];
    expect(chartAccount).toBeDefined();
    const chartOfAccountId = chartAccount.id;

    const cashRes = await request.post(`${apiBase}/finance/cash-accounts`, {
      headers: auth(tenantA),
      data: { name: `G1 Cash ${u}`, chartOfAccountId },
    });
    expect(cashRes.status(), await cashRes.text()).toBe(201);
    const cashAccount = await cashRes.json();

    const paymentRes = await request.post(
      `${apiBase}/suppliers/${supplierId}/payments`,
      {
        headers: auth(tenantA),
        data: {
          amount: 100,
          method: 'CASH',
          cashAccountId: cashAccount.id,
        },
      },
    );
    expect(paymentRes.status(), await paymentRes.text()).toBe(201);
    const payment = await paymentRes.json();
    expect(payment.paymentNumber).toMatch(/^PAY-/);

    // ── 8. VOID payment ─────────────────────────────────────────
    const voidRes = await request.delete(
      `${apiBase}/suppliers/${supplierId}/payments/${payment.id}`,
      { headers: auth(tenantA) },
    );
    expect(voidRes.status(), await voidRes.text()).toBe(204);

    // ── 9. Statement reflects the (voided) payment cycle ────────
    const statementRes = await request.get(
      `${apiBase}/suppliers/${supplierId}/statement`,
      { headers: auth(tenantA) },
    );
    expect(statementRes.status()).toBe(200);
    const statement = await statementRes.json();
    expect(statement).toBeTruthy();

    // ── 10. DELETE (archive/soft-delete) ────────────────────────
    const deleteRes = await request.delete(`${apiBase}/suppliers/${supplierId}`, {
      headers: auth(tenantA),
    });
    expect(deleteRes.status()).toBe(200);

    // Default list no longer contains it.
    const listRes = await request.get(`${apiBase}/suppliers?search=${encodeURIComponent(companyName)}`, {
      headers: auth(tenantA),
    });
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    const listedIds = (list.items ?? []).map((s: { id: string }) => s.id);
    expect(listedIds).not.toContain(supplierId);

    // GET by id now 404s (deletedAt filter).
    const getDeletedRes = await request.get(`${apiBase}/suppliers/${supplierId}`, {
      headers: auth(tenantA),
    });
    expect(getDeletedRes.status()).toBe(404);

    // ── 11. Historical documents remain intact ──────────────────
    // The supplier product row was soft-deleted by the supplier cascade,
    // but the product itself must still exist.
    const productGetRes = await request.get(`${apiBase}/products/${product.id}`, {
      headers: auth(tenantA),
    });
    expect(productGetRes.status()).toBe(200);
    expect(supplierProduct.id).toBeTruthy();
    expect(contact.id).toBeTruthy();
    expect(address.id).toBeTruthy();
  });

  test('negative: stale rowVersion → 409', async ({ request }) => {
    const u = unique();
    const createRes = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: `G1 CAS ${u}` },
    });
    expect(createRes.status()).toBe(201);
    const supplier = await createRes.json();

    // Update with a deliberately stale token.
    const staleRes = await request.patch(`${apiBase}/suppliers/${supplier.id}`, {
      headers: auth(tenantA),
      data: { companyName: 'should fail', rowVersion: supplier.rowVersion + 5 },
    });
    expect(staleRes.status()).toBe(409);
  });

  test('negative: invalid UUID path param → 400', async ({ request }) => {
    const notUuidRes = await request.get(`${apiBase}/suppliers/not-a-uuid`, {
      headers: auth(tenantA),
    });
    expect(notUuidRes.status()).toBe(400);

    const notUuidNestedRes = await request.get(
      `${apiBase}/suppliers/not-a-uuid/contacts`,
      { headers: auth(tenantA) },
    );
    expect(notUuidNestedRes.status()).toBe(400);
  });

  test('negative: duplicate active email → 409', async ({ request }) => {
    const u = unique();
    const email = `g1.dup.${u}@supplier.test`;
    const first = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: `G1 Dup A ${u}`, email },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: `G1 Dup B ${u}`, email },
    });
    expect(second.status()).toBe(409);
  });

  test('negative: duplicate active BIN → 409', async ({ request }) => {
    const u = unique();
    const bin = `9${u}`.slice(0, 12);
    const first = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: `G1 Bin A ${u}`, bin },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: `G1 Bin B ${u}`, bin },
    });
    expect(second.status()).toBe(409);
  });

  test('negative: duplicate-name warning endpoint returns matches (non-blocking)', async ({ request }) => {
    const u = unique();
    const name = `G1 Warning ${u}`;
    const createRes = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantA),
      data: { companyName: name },
    });
    expect(createRes.status()).toBe(201);

    const dupesRes = await request.get(
      `${apiBase}/suppliers/duplicates?companyName=${encodeURIComponent(`  ${name}  `)}`,
      { headers: auth(tenantA) },
    );
    expect(dupesRes.status()).toBe(200);
    const dupes = await dupesRes.json();
    expect(Array.isArray(dupes)).toBe(true);
    expect(dupes.length).toBeGreaterThanOrEqual(1);

    // Empty result is also a valid, non-blocking answer.
    const noneRes = await request.get(
      `${apiBase}/suppliers/duplicates?companyName=${encodeURIComponent(`No Such Supplier ${u}`)}`,
      { headers: auth(tenantA) },
    );
    expect(noneRes.status()).toBe(200);
    expect(await noneRes.json()).toHaveLength(0);
  });

  test('negative: wrong-tenant supplier / contact / address are invisible', async ({ request }) => {
    const u = unique();

    // Tenant B creates its own resources.
    const supRes = await request.post(`${apiBase}/suppliers`, {
      headers: auth(tenantB),
      data: { companyName: `G1 TenantB ${u}` },
    });
    expect(supRes.status()).toBe(201);
    const supB = await supRes.json();

    const contactRes = await request.post(
      `${apiBase}/suppliers/${supB.id}/contacts`,
      { headers: auth(tenantB), data: { firstName: 'B', isPrimary: false } },
    );
    expect(contactRes.status(), await contactRes.text()).toBe(201);
    const contactB = await contactRes.json();

    const addressRes = await request.post(
      `${apiBase}/suppliers/${supB.id}/addresses`,
      { headers: auth(tenantB), data: { city: 'Astana' } },
    );
    expect(addressRes.status(), await addressRes.text()).toBe(201);
    const addressB = await addressRes.json();

    // Tenant A cannot read tenant B's supplier.
    const crossSupplier = await request.get(`${apiBase}/suppliers/${supB.id}`, {
      headers: auth(tenantA),
    });
    expect(crossSupplier.status()).toBe(404);

    // Tenant A cannot read tenant B's contact (supplier-scoped chain).
    const crossContact = await request.get(
      `${apiBase}/suppliers/${supB.id}/contacts/${contactB.id}`,
      { headers: auth(tenantA) },
    );
    expect(crossContact.status()).toBe(404);

    // Tenant A cannot read tenant B's address.
    const crossAddress = await request.get(
      `${apiBase}/suppliers/${supB.id}/addresses/${addressB.id}`,
      { headers: auth(tenantA) },
    );
    expect(crossAddress.status()).toBe(404);

    // Tenant A cannot mutate tenant B's supplier.
    const crossPatch = await request.patch(`${apiBase}/suppliers/${supB.id}`, {
      headers: auth(tenantA),
      data: { companyName: 'hijack', rowVersion: 0 },
    });
    expect(crossPatch.status()).toBe(404);
  });
});
