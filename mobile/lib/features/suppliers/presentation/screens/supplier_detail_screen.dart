import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_product_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

class SupplierDetailScreen extends ConsumerStatefulWidget {
  final String supplierId;
  const SupplierDetailScreen({super.key, required this.supplierId});

  @override
  ConsumerState<SupplierDetailScreen> createState() =>
      _SupplierDetailScreenState();
}

class _SupplierDetailScreenState extends ConsumerState<SupplierDetailScreen> {
  Supplier? _supplier;
  List<SupplierContact> _contacts = [];
  List<SupplierAddress> _addresses = [];
  SupplierFinanceSummary? _financeSummary;
  List<SupplierPayment> _payments = [];
  List<SupplierProduct> _supplierProducts = [];
  SupplierPurchaseSummary? _purchaseSummary;
  bool _isLoadingPurchaseSummary = false;
  String? _purchaseSummaryError;
  List<ProductPurchaseDetail> _productPurchases = [];
  bool _isLoadingProductPurchases = false;
  String? _productPurchasesError;
  int _productPurchasePage = 1;
  int _productPurchaseTotal = 0;
  String? _productPurchaseSearch;
  String? _purchaseDateFrom;
  String? _purchaseDateTo;
  SupplierReliability? _reliability;
  bool _isLoadingReliability = false;
  String? _reliabilityError;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);

    final results = await Future.wait([
      repo.getById(widget.supplierId),
      repo.getContacts(widget.supplierId),
      repo.getAddresses(widget.supplierId),
      repo.getFinanceSummary(widget.supplierId),
      repo.getPayments(widget.supplierId),
      repo.getSupplierProducts(widget.supplierId),
    ]);

    final supplierResult = results[0] as SuppliersResult<Supplier>;
    final contactsResult = results[1] as SuppliersResult<List<SupplierContact>>;
    final addressesResult = results[2] as SuppliersResult<List<SupplierAddress>>;
    final financeResult = results[3] as SuppliersResult<SupplierFinanceSummary>;
    final paymentsResult = results[4] as SuppliersResult<SupplierPaymentListResponse>;
    final productsResult = results[5] as SuppliersResult<SupplierProductListResponse>;

    if (!mounted) return;

    if (supplierResult is SuppliersFailure<Supplier>) {
      setState(() {
        _error = localizedErrorLabel(
          context.l10n,
          supplierResult.error.message,
        );
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _supplier = (supplierResult as SuppliersSuccess<Supplier>).data;
      _contacts = contactsResult is SuppliersSuccess<List<SupplierContact>>
          ? contactsResult.data
          : [];
      _addresses = addressesResult is SuppliersSuccess<List<SupplierAddress>>
          ? addressesResult.data
          : [];
      _financeSummary = financeResult is SuppliersSuccess<SupplierFinanceSummary>
          ? financeResult.data
          : null;
      _payments = paymentsResult is SuppliersSuccess<SupplierPaymentListResponse>
          ? paymentsResult.data.items
          : [];
      _supplierProducts = productsResult is SuppliersSuccess<SupplierProductListResponse>
          ? productsResult.data.items
          : [];
      _isLoading = false;
    });

    // Load purchase analytics after main data
    _loadPurchaseSummary();
  }

  Future<void> _loadPurchaseSummary() async {
    if (!mounted) return;
    setState(() {
      _isLoadingPurchaseSummary = true;
      _purchaseSummaryError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getPurchaseSummary(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierPurchaseSummary>) {
        _purchaseSummary = result.data;
      } else if (result is SuppliersFailure<SupplierPurchaseSummary>) {
        _purchaseSummaryError = result.error.message;
      }
      _isLoadingPurchaseSummary = false;
    });
    // Also load product purchases and reliability
    _loadProductPurchases();
    _loadReliability();
  }

  Future<void> _loadProductPurchases() async {
    if (!mounted) return;
    setState(() {
      _isLoadingProductPurchases = true;
      _productPurchasesError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getProductPurchases(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
      page: _productPurchasePage,
      search: _productPurchaseSearch,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<ProductPurchaseListResponse>) {
        _productPurchases = result.data.items;
        _productPurchaseTotal = result.data.total;
      } else if (result is SuppliersFailure<ProductPurchaseListResponse>) {
        _productPurchasesError = result.error.message;
      }
      _isLoadingProductPurchases = false;
    });
  }

  Future<void> _loadReliability() async {
    if (!mounted) return;
    setState(() {
      _isLoadingReliability = true;
      _reliabilityError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getReliability(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierReliability>) {
        _reliability = result.data;
      } else if (result is SuppliersFailure<SupplierReliability>) {
        _reliabilityError = result.error.message;
      }
      _isLoadingReliability = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(context.l10n.suppliers)),
        body: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: Text(context.l10n.suppliers)),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline,
                  size: 64, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(_error!),
              const SizedBox(height: 16),
              FilledButton.tonalIcon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: Text(context.l10n.retry),
              ),
            ],
          ),
        ),
      );
    }

    final supplier = _supplier!;

    return Scaffold(
      appBar: AppBar(
        title: Text(supplier.companyName),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: context.l10n.edit,
            onPressed: () async {
              await context.push(
                '/suppliers/${widget.supplierId}/edit',
              );
              // Refresh after returning from edit
              _load();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header / General Info ─────────────────────────
              _buildHeader(supplier, theme),
              const SizedBox(height: 24),

              // ── Contacts Section ──────────────────────────────
              _buildContactsSection(theme),
              const SizedBox(height: 24),

              // ── Addresses Section ─────────────────────────────
              _buildAddressesSection(theme),
              const SizedBox(height: 24),

              // ── Finance Section ──────────────────────────────
              _buildFinanceSection(theme),
              const SizedBox(height: 24),

              // ── Purchase Analytics Section ───────────────────
              _buildPurchaseAnalyticsSection(theme),
              const SizedBox(height: 24),

              // ── Supplier Reliability Section ────────────────
              _buildReliabilitySection(theme),
              const SizedBox(height: 24),

              // ── Products Section ─────────────────────────────
              _buildProductsSection(theme),

              // ── Notes ─────────────────────────────────────────
              if (supplier.notes != null && supplier.notes!.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text(context.l10n.notes, style: theme.textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(supplier.notes!, style: theme.textTheme.bodyMedium),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(Supplier supplier, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    supplier.companyName,
                    style: theme.textTheme.headlineSmall,
                  ),
                ),
                StatusBadge(
                  status: supplier.isActive ? 'ACTIVE' : 'INACTIVE',
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (supplier.bin != null && supplier.bin!.isNotEmpty)
              _infoRow(Icons.numbers, context.l10n.bin, supplier.bin!, theme),
            if (supplier.email != null && supplier.email!.isNotEmpty)
              _infoRow(
                  Icons.email_outlined, context.l10n.email, supplier.email!, theme),
            if (supplier.phone != null && supplier.phone!.isNotEmpty)
              _infoRow(
                  Icons.phone_outlined, context.l10n.phone, supplier.phone!, theme),
            if (supplier.website != null && supplier.website!.isNotEmpty)
              _infoRow(Icons.language, context.l10n.website, supplier.website!,
                  theme),
            const Divider(height: 24),
            _infoRow(
              Icons.access_time,
              context.l10n.createdAt,
              supplier.createdAt.toString().substring(0, 10),
              theme,
            ),
            _infoRow(
              Icons.update,
              context.l10n.updatedAt,
              supplier.updatedAt.toString().substring(0, 10),
              theme,
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.outline),
          const SizedBox(width: 8),
          Text('$label: ', style: theme.textTheme.bodySmall),
          Expanded(
            child: Text(value, style: theme.textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _buildContactsSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.people_outline,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.contacts, style: theme.textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  tooltip: context.l10n.newContact,
                  onPressed: () => _showContactDialog(),
                ),
              ],
            ),
            if (_contacts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  context.l10n.noContacts,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ..._contacts.map((c) => ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      child: Text(
                        (c.firstName ?? c.email ?? '?')[0].toUpperCase(),
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    title: Text(c.displayName),
                    subtitle: Text(
                      [c.position, c.phone ?? c.email]
                          .where((e) => e != null && e.isNotEmpty)
                          .join(' · '),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (c.isPrimary)
                          Chip(
                            label: Text(context.l10n.primaryContact,
                                style: const TextStyle(fontSize: 10)),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'edit') _showContactDialog(contact: c);
                            if (v == 'delete') _deleteContact(c);
                          },
                          itemBuilder: (_) => [
                            PopupMenuItem(
                                value: 'edit', child: Text(context.l10n.edit)),
                            PopupMenuItem(
                                value: 'delete',
                                child: Text(context.l10n.delete)),
                          ],
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildAddressesSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.addresses, style: theme.textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  tooltip: context.l10n.newAddress,
                  onPressed: () => _showAddressDialog(),
                ),
              ],
            ),
            if (_addresses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  context.l10n.noAddresses,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ..._addresses.map((a) => ListTile(
                    dense: true,
                    leading: Icon(Icons.location_on,
                        size: 20, color: theme.colorScheme.outline),
                    title: Text(a.displayAddress),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (a.isDefault)
                          Chip(
                            label: Text(context.l10n.defaultAddress,
                                style: const TextStyle(fontSize: 10)),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'edit') _showAddressDialog(address: a);
                            if (v == 'delete') _deleteAddress(a);
                          },
                          itemBuilder: (_) => [
                            PopupMenuItem(
                                value: 'edit', child: Text(context.l10n.edit)),
                            PopupMenuItem(
                                value: 'delete',
                                child: Text(context.l10n.delete)),
                          ],
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  // ── Contact Dialog (reuses G2 pattern) ──────────────────────

  Future<void> _showContactDialog({SupplierContact? contact}) async {
    final firstNameCtrl = TextEditingController(text: contact?.firstName ?? '');
    final lastNameCtrl = TextEditingController(text: contact?.lastName ?? '');
    final phoneCtrl = TextEditingController(text: contact?.phone ?? '');
    final emailCtrl = TextEditingController(text: contact?.email ?? '');
    final positionCtrl = TextEditingController(text: contact?.position ?? '');
    bool isPrimary = contact?.isPrimary ?? false;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(
              contact == null ? context.l10n.newContact : context.l10n.edit),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: firstNameCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.firstName)),
                const SizedBox(height: 8),
                TextField(
                    controller: lastNameCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.lastName)),
                const SizedBox(height: 8),
                TextField(
                    controller: phoneCtrl,
                    decoration: InputDecoration(labelText: context.l10n.phone),
                    keyboardType: TextInputType.phone),
                const SizedBox(height: 8),
                TextField(
                    controller: emailCtrl,
                    decoration: InputDecoration(labelText: context.l10n.email),
                    keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 8),
                TextField(
                    controller: positionCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.position)),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: Text(context.l10n.primaryContact),
                  value: isPrimary,
                  onChanged: (v) => setDialogState(() => isPrimary = v),
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(context.l10n.cancel)),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(context.l10n.save)),
          ],
        ),
      ),
    );

    if (result != true || !mounted) return;
    final repo = ref.read(suppliersRepositoryProvider);

    if (contact == null) {
      await repo.createContact(
          widget.supplierId,
          CreateSupplierContactRequest(
            firstName:
                firstNameCtrl.text.isNotEmpty ? firstNameCtrl.text : null,
            lastName:
                lastNameCtrl.text.isNotEmpty ? lastNameCtrl.text : null,
            phone: phoneCtrl.text.isNotEmpty ? phoneCtrl.text : null,
            email: emailCtrl.text.isNotEmpty ? emailCtrl.text : null,
            position:
                positionCtrl.text.isNotEmpty ? positionCtrl.text : null,
            isPrimary: isPrimary,
          ));
    } else {
      await repo.updateContact(widget.supplierId, contact.id, {
        'firstName':
            firstNameCtrl.text.isNotEmpty ? firstNameCtrl.text : null,
        'lastName':
            lastNameCtrl.text.isNotEmpty ? lastNameCtrl.text : null,
        'phone': phoneCtrl.text.isNotEmpty ? phoneCtrl.text : null,
        'email': emailCtrl.text.isNotEmpty ? emailCtrl.text : null,
        'position':
            positionCtrl.text.isNotEmpty ? positionCtrl.text : null,
        'isPrimary': isPrimary,
      });
    }
    _loadContactsAndAddresses();
  }

  Future<void> _deleteContact(SupplierContact contact) async {
    final repo = ref.read(suppliersRepositoryProvider);
    await repo.deleteContact(widget.supplierId, contact.id);
    _loadContactsAndAddresses();
  }

  // ── Address Dialog (reuses G2 pattern) ─────────────────────

  Future<void> _showAddressDialog({SupplierAddress? address}) async {
    final cityCtrl = TextEditingController(text: address?.city ?? '');
    final countryCtrl = TextEditingController(text: address?.country ?? '');
    final streetCtrl = TextEditingController(text: address?.street ?? '');
    final postalCtrl = TextEditingController(text: address?.postalCode ?? '');
    bool isDefault = address?.isDefault ?? false;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(
              address == null ? context.l10n.newAddress : context.l10n.edit),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: streetCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.address)),
                const SizedBox(height: 8),
                TextField(
                    controller: cityCtrl,
                    decoration: InputDecoration(labelText: context.l10n.city)),
                const SizedBox(height: 8),
                TextField(
                    controller: countryCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.country)),
                const SizedBox(height: 8),
                TextField(
                    controller: postalCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.postalCode)),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: Text(context.l10n.defaultAddress),
                  value: isDefault,
                  onChanged: (v) => setDialogState(() => isDefault = v),
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(context.l10n.cancel)),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(context.l10n.save)),
          ],
        ),
      ),
    );

    if (result != true || !mounted) return;
    final repo = ref.read(suppliersRepositoryProvider);

    if (address == null) {
      await repo.createAddress(
          widget.supplierId,
          CreateSupplierAddressRequest(
            city: cityCtrl.text.isNotEmpty ? cityCtrl.text : null,
            country: countryCtrl.text.isNotEmpty ? countryCtrl.text : null,
            street: streetCtrl.text.isNotEmpty ? streetCtrl.text : null,
            postalCode:
                postalCtrl.text.isNotEmpty ? postalCtrl.text : null,
            isDefault: isDefault,
          ));
    } else {
      await repo.updateAddress(widget.supplierId, address.id, {
        'city': cityCtrl.text.isNotEmpty ? cityCtrl.text : null,
        'country': countryCtrl.text.isNotEmpty ? countryCtrl.text : null,
        'street': streetCtrl.text.isNotEmpty ? streetCtrl.text : null,
        'postalCode':
            postalCtrl.text.isNotEmpty ? postalCtrl.text : null,
        'isDefault': isDefault,
      });
    }
    _loadContactsAndAddresses();
  }

  Future<void> _deleteAddress(SupplierAddress address) async {
    final repo = ref.read(suppliersRepositoryProvider);
    await repo.deleteAddress(widget.supplierId, address.id);
    _loadContactsAndAddresses();
  }

  // ── Finance Section ────────────────────────────────────────

  Widget _buildFinanceSection(ThemeData theme) {
    final summary = _financeSummary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.account_balance_wallet,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.financeSummary,
                    style: theme.textTheme.titleSmall),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: () => _showAddPaymentDialog(),
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(context.l10n.addPayment),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (summary != null) ...[
              Row(
                children: [
                  _financeStat(context.l10n.totalInvoiced, summary.totalInvoiced,
                      theme),
                  const SizedBox(width: 16),
                  _financeStat(context.l10n.totalPaid, summary.totalPaid, theme),
                  const SizedBox(width: 16),
                  _financeStat(context.l10n.outstanding, summary.outstanding,
                      theme),
                ],
              ),
              const SizedBox(height: 12),
            ],
            if (_payments.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noPayments,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              )
            else
              ..._payments.map((p) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      p.method == 'CASH'
                          ? Icons.money
                          : Icons.account_balance,
                      size: 20,
                    ),
                    title: Text(p.paymentNumber),
                    subtitle: Text(
                      '${p.paymentDate.toString().substring(0, 10)} • ${p.method}',
                    ),
                    trailing: Text(
                      '+₸${p.amount}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600),
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _financeStat(String label, String value, ThemeData theme) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 2),
          Text('₸$value',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Future<void> _showAddPaymentDialog() async {
    // TODO: implement payment dialog in future iteration
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.addPayment)),
    );
  }

  // ── Purchase Analytics Section ──────────────────────────

  Widget _buildPurchaseAnalyticsSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.analytics_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.purchaseAnalytics,
                    style: theme.textTheme.titleSmall),
                const Spacer(),
                // Period selector
                PopupMenuButton<String?>(
                  icon: Icon(Icons.date_range,
                      size: 20, color: theme.colorScheme.onSurfaceVariant),
                  onSelected: (value) {
                    final now = DateTime.now();
                    setState(() {
                      if (value == null) {
                        _purchaseDateFrom = null;
                        _purchaseDateTo = null;
                      } else if (value == '3m') {
                        _purchaseDateFrom = DateTime(now.year, now.month - 3, now.day).toIso8601String().substring(0, 10);
                        _purchaseDateTo = null;
                      } else if (value == '6m') {
                        _purchaseDateFrom = DateTime(now.year, now.month - 6, now.day).toIso8601String().substring(0, 10);
                        _purchaseDateTo = null;
                      } else if (value == '1y') {
                        _purchaseDateFrom = DateTime(now.year - 1, now.month, now.day).toIso8601String().substring(0, 10);
                        _purchaseDateTo = null;
                      } else if (value == 'ytd') {
                        _purchaseDateFrom = DateTime(now.year, 1, 1).toIso8601String().substring(0, 10);
                        _purchaseDateTo = null;
                      }
                    });
                    _productPurchasePage = 1;
                    _loadPurchaseSummary();
                    _loadProductPurchases();
                    _loadReliability();
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(value: null, child: Text(context.l10n.periodAllTime)),
                    PopupMenuItem(value: '3m', child: Text(context.l10n.periodLast3Months)),
                    PopupMenuItem(value: '6m', child: Text(context.l10n.periodLast6Months)),
                    PopupMenuItem(value: '1y', child: Text(context.l10n.periodLastYear)),
                    PopupMenuItem(value: 'ytd', child: Text(context.l10n.periodYearToDate)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Loading state
            if (_isLoadingPurchaseSummary)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            // Error state
            else if (_purchaseSummaryError != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    Text(
                      _purchaseSummaryError!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: _loadPurchaseSummary,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(context.l10n.retry),
                    ),
                  ],
                ),
              )
            // Data state
            else if (_purchaseSummary != null) ...[
              // Summary stats
              Wrap(
                spacing: 16,
                runSpacing: 12,
                children: [
                  _analyticsStat(context.l10n.totalInvoiced, '₸${_purchaseSummary!.totalInvoiced}', theme),
                  _analyticsStat(context.l10n.returned, '₸${_purchaseSummary!.totalReturned}', theme),
                  _analyticsStat(context.l10n.netPurchaseSpend, '₸${_purchaseSummary!.netPurchaseSpend}', theme, highlighted: true),
                  _analyticsStat(context.l10n.purchasedQuantity, '${_purchaseSummary!.totalPurchasedQuantity}', theme),
                  _analyticsStat(context.l10n.weightedAvgCost, '₸${_purchaseSummary!.weightedAverageUnitCost}', theme),
                  _analyticsStat(context.l10n.invoices, '${_purchaseSummary!.invoiceCount}', theme),
                  _analyticsStat(context.l10n.returned, '${_purchaseSummary!.returnCount}', theme),
                ],
              ),
              const SizedBox(height: 16),
              // Current financials
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              Row(
                children: [
                  _analyticsStat(context.l10n.currentPaid, '₸${_purchaseSummary!.currentTotalPaid}', theme),
                  const SizedBox(width: 24),
                  _analyticsStat(context.l10n.outstanding, '₸${_purchaseSummary!.currentOutstanding}', theme),
                ],
              ),
              if (_purchaseSummary!.firstPurchaseDate != null || _purchaseSummary!.lastPurchaseDate != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (_purchaseSummary!.firstPurchaseDate != null)
                      _analyticsStat(context.l10n.firstPurchase, _purchaseSummary!.firstPurchaseDate!.substring(0, 10), theme),
                    if (_purchaseSummary!.firstPurchaseDate != null && _purchaseSummary!.lastPurchaseDate != null)
                      const SizedBox(width: 24),
                    if (_purchaseSummary!.lastPurchaseDate != null)
                      _analyticsStat(context.l10n.lastPurchase, _purchaseSummary!.lastPurchaseDate!.substring(0, 10), theme),
                  ],
                ),
              ],
              // Monthly spend
              if (_purchaseSummary!.monthlySpend.isNotEmpty) ...[
                const SizedBox(height: 16),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 12),
                Text(context.l10n.monthlySpend, style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                ..._purchaseSummary!.monthlySpend.map((m) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 70,
                        child: Text(m.month, style: theme.textTheme.bodySmall),
                      ),
                      Expanded(
                        child: LinearProgressIndicator(
                          value: _maxMonthlySpend > 0
                              ? (double.tryParse(m.amount) ?? 0) / _maxMonthlySpend
                              : 0,
                          minHeight: 14,
                          borderRadius: BorderRadius.circular(4),
                          backgroundColor: theme.colorScheme.surfaceContainerHighest,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 90,
                        child: Text(
                          '₸${m.amount}',
                          style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                          textAlign: TextAlign.end,
                        ),
                      ),
                    ],
                  ),
                )),
              ],
              // ── Product Purchase Detail ───────────────
              const SizedBox(height: 16),
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.shopping_cart_outlined,
                      size: 18, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(context.l10n.productPurchaseDetail,
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: 8),
              // Search field
              SizedBox(
                height: 36,
                child: TextField(
                  decoration: InputDecoration(
                    hintText: context.l10n.searchProducts,
                    prefixIcon: const Icon(Icons.search, size: 18),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  onChanged: (value) {
                    _productPurchaseSearch = value.isEmpty ? null : value;
                    _productPurchasePage = 1;
                    _loadProductPurchases();
                  },
                ),
              ),
              const SizedBox(height: 8),
              // Product purchase list
              if (_isLoadingProductPurchases)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (_productPurchasesError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(_productPurchasesError!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.error)),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: _loadProductPurchases,
                        icon: const Icon(Icons.refresh, size: 16),
                        label: Text(context.l10n.retry),
                      ),
                    ],
                  ),
                )
              else if (_productPurchases.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(context.l10n.noProductPurchases,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                )
              else ...[
                ..._productPurchases.map((p) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.productName,
                                      style: theme.textTheme.bodyMedium?.copyWith(
                                          fontWeight: FontWeight.w600)),
                                  if (p.sku != null && p.sku!.isNotEmpty)
                                    Text('SKU: ${p.sku}',
                                        style: theme.textTheme.bodySmall?.copyWith(
                                            color: theme.colorScheme.onSurfaceVariant)),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('₸${p.netPurchaseSpend}',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w700)),
                                Text('${context.l10n.netQty}: ${p.netPurchasedQuantity}',
                                    style: theme.textTheme.bodySmall),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 12,
                          runSpacing: 4,
                          children: [
                            _analyticsStat(context.l10n.totalSpend, '₸${p.totalPurchaseSpend}', theme),
                            _analyticsStat(context.l10n.qtyReturned, '${p.totalReturnedQuantity}', theme),
                            _analyticsStat(context.l10n.avgCost, '₸${p.weightedAverageUnitCost}', theme),
                            _analyticsStat(context.l10n.minMaxCost, '₸${p.minUnitCost} / ₸${p.maxUnitCost}', theme),
                            _analyticsStat(context.l10n.invoices, '${p.invoiceCount}', theme),
                            if (p.lastPurchaseDate != null)
                              _analyticsStat(context.l10n.lastPurchase, p.lastPurchaseDate!.substring(0, 10), theme),
                          ],
                        ),
                      ],
                    ),
                  ),
                )),
                // Load more / pagination
                if (_productPurchases.length < _productPurchaseTotal)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Center(
                      child: TextButton(
                        onPressed: () {
                          _productPurchasePage++;
                          _loadProductPurchases();
                        },
                        child: Text(context.l10n.loadMore),
                      ),
                    ),
                  ),
              ],
            ]
            // Empty state
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noPurchaseData,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              ),
          ],
        ),
      ),
    );
  }

  double get _maxMonthlySpend {
    if (_purchaseSummary == null || _purchaseSummary!.monthlySpend.isEmpty) return 0;
    return _purchaseSummary!.monthlySpend
        .map((m) => double.tryParse(m.amount) ?? 0)
        .reduce((a, b) => a > b ? a : b);
  }

  Widget _analyticsStat(String label, String value, ThemeData theme, {bool highlighted = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: highlighted ? FontWeight.w700 : FontWeight.w600,
              color: highlighted ? theme.colorScheme.primary : null,
            )),
      ],
    );
  }

  // ── Supplier Reliability Section ──────────────────────

  Widget _buildReliabilitySection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.local_shipping_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.supplierReliability,
                    style: theme.textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 12),
            if (_isLoadingReliability)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (_reliabilityError != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    Text(
                      _reliabilityError!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: _loadReliability,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(context.l10n.retry),
                    ),
                  ],
                ),
              )
            else if (_reliability != null) ...[
              // On-time delivery rate
              Row(
                children: [
                  _analyticsStat(context.l10n.onTimeDeliveryRate, '${_reliability!.onTimeDeliveryRate}%', theme),
                  const SizedBox(width: 16),
                  _analyticsStat(context.l10n.avgLeadTime, '${_reliability!.averageLeadTimeDays} ${context.l10n.days}', theme),
                ],
              ),
              if (_reliability!.minLeadTimeDays != null || _reliability!.maxLeadTimeDays != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (_reliability!.minLeadTimeDays != null)
                      _analyticsStat(context.l10n.minLeadTime, '${_reliability!.minLeadTimeDays} ${context.l10n.days}', theme),
                    if (_reliability!.minLeadTimeDays != null && _reliability!.maxLeadTimeDays != null)
                      const SizedBox(width: 16),
                    if (_reliability!.maxLeadTimeDays != null)
                      _analyticsStat(context.l10n.maxLeadTime, '${_reliability!.maxLeadTimeDays} ${context.l10n.days}', theme),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              // Order status breakdown
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _analyticsStat(context.l10n.ordersReceived, '${_reliability!.ordersReceived}', theme),
                  _analyticsStat(context.l10n.ordersPartiallyReceived, '${_reliability!.ordersPartiallyReceived}', theme),
                  _analyticsStat(context.l10n.ordersCancelled, '${_reliability!.ordersCancelled}', theme),
                  _analyticsStat(context.l10n.cancellationRate, '${_reliability!.cancellationRate}%', theme),
                ],
              ),
              // Recent deliveries
              if (_reliability!.recentDeliveries.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 12),
                Text(context.l10n.recentDeliveries,
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                ..._reliability!.recentDeliveries.map((d) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(d.orderNumber,
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          d.receiptDate != null ? d.receiptDate!.substring(0, 10) : '—',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      SizedBox(
                        width: 50,
                        child: d.leadTimeDays != null
                            ? Text('${d.leadTimeDays}d', style: theme.textTheme.bodySmall)
                            : Text('—', style: theme.textTheme.bodySmall),
                      ),
                      SizedBox(
                        width: 24,
                        child: d.onTime == true
                            ? const Icon(Icons.check_circle, size: 16, color: Colors.green)
                            : d.onTime == false
                                ? const Icon(Icons.cancel, size: 16, color: Colors.red)
                                : const Icon(Icons.help_outline, size: 16, color: Colors.grey),
                      ),
                    ],
                  ),
                )),
              ],
            ]
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noOrderData,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              ),
          ],
        ),
      ),
    );
  }

  // ── Products Section ────────────────────────────────────

  Widget _buildProductsSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.inventory_2, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.supplierProducts, style: theme.textTheme.titleSmall),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: () => _showAddProductDialog(),
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(context.l10n.addProduct),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_supplierProducts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noProducts,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              )
            else
              ..._supplierProducts.map((sp) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: sp.isPreferred
                        ? const Icon(Icons.star, size: 20, color: Colors.amber)
                        : Icon(Icons.inventory_2, size: 20, color: theme.colorScheme.onSurfaceVariant),
                    title: Text(sp.product.name),
                    subtitle: Text([
                      if (sp.product.sku != null) 'SKU: ${sp.product.sku}',
                      if (sp.supplierSku != null) 'Sup: ${sp.supplierSku}',
                    ].join(' • ')),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (sp.purchasePrice != null)
                          Text('₸${sp.purchasePrice}',
                              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(width: 8),
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            if (value == 'edit') _showEditProductDialog(sp);
                            if (value == 'delete') _confirmDeleteProduct(sp);
                          },
                          itemBuilder: (context) => [
                            PopupMenuItem(value: 'edit', child: Text(context.l10n.edit)),
                            PopupMenuItem(value: 'delete', child: Text(context.l10n.delete)),
                          ],
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddProductDialog() async {
    if (!mounted) return;
    // State for the dialog
    String? selectedProductId;
    String selectedProductName = '';
    String selectedProductSku = '';
    final supplierSkuCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    bool isPreferred = false;
    bool isLoadingProducts = true;
    String? productsError;
    List<Product> availableProducts = [];
    String searchQuery = '';
    bool showProductsList = false;
    bool isSubmitting = false;

    // Fetch available products
    final productsRepo = ref.read(productsRepositoryProvider);
    final productsResult = await productsRepo.list(limit: 50);
    if (productsResult is ProductsSuccess<ProductListResponse>) {
      availableProducts = productsResult.data.items;
    } else if (productsResult is ProductsFail) {
      productsError = (productsResult as ProductsFail).error.message;
    }
    isLoadingProducts = false;
    if (!mounted) return;

    final repo = ref.read(suppliersRepositoryProvider);
    await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          // Filter products based on search
          final filteredProducts = searchQuery.isEmpty
              ? availableProducts
              : availableProducts.where((p) {
                  final nameMatch = p.name.toLowerCase().contains(searchQuery.toLowerCase());
                  final skuMatch = p.sku?.toLowerCase().contains(searchQuery.toLowerCase()) ?? false;
                  return nameMatch || skuMatch;
                }).toList();

          return AlertDialog(
            title: Text(context.l10n.addProduct),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product selector
                  Text(context.l10n.selectProduct, style: Theme.of(ctx).textTheme.labelLarge),
                  const SizedBox(height: 8),
                  if (selectedProductId != null)
                    Card(
                      child: ListTile(
                        dense: true,
                        leading: const Icon(Icons.inventory_2, size: 20),
                        title: Text(selectedProductName),
                        subtitle: selectedProductSku.isNotEmpty ? Text('SKU: $selectedProductSku') : null,
                        trailing: IconButton(
                          icon: const Icon(Icons.close, size: 16),
                          onPressed: () => setDialogState(() {
                            selectedProductId = null;
                            selectedProductName = '';
                            selectedProductSku = '';
                          }),
                        ),
                      ),
                    )
                  else ...[
                    if (isLoadingProducts)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (productsError != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Column(
                          children: [
                            Text(productsError!, style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: Theme.of(ctx).colorScheme.error)),
                            const SizedBox(height: 8),
                            TextButton.icon(
                              onPressed: () async {
                                setDialogState(() { isLoadingProducts = true; productsError = null; });
                                final result = await ref.read(productsRepositoryProvider).list(limit: 50);
                                if (result is ProductsSuccess<ProductListResponse>) {
                                  setDialogState(() { availableProducts = result.data.items; });
                                } else if (result is ProductsFail) {
                                  final fail = result as ProductsFail;
                                  setDialogState(() { productsError = fail.error.message; });
                                }
                                setDialogState(() => isLoadingProducts = false);
                              },
                              icon: const Icon(Icons.refresh, size: 16),
                              label: Text(context.l10n.cancel),
                            ),
                          ],
                        ),
                      )
                    else ...[
                      TextField(
                        decoration: InputDecoration(
                          hintText: context.l10n.productSelectorHint,
                          prefixIcon: const Icon(Icons.search, size: 20),
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        onChanged: (v) => setDialogState(() {
                          searchQuery = v;
                          showProductsList = v.isNotEmpty;
                        }),
                      ),
                      if (showProductsList && filteredProducts.isNotEmpty)
                        Container(
                          constraints: const BoxConstraints(maxHeight: 200),
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            border: Border.all(color: Theme.of(ctx).colorScheme.outline),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: filteredProducts.length,
                            itemBuilder: (context, index) {
                              final product = filteredProducts[index];
                              return ListTile(
                                dense: true,
                                title: Text(product.name),
                                subtitle: product.sku != null ? Text('SKU: ${product.sku}') : null,
                                onTap: () => setDialogState(() {
                                  selectedProductId = product.id;
                                  selectedProductName = product.name;
                                  selectedProductSku = product.sku ?? '';
                                  showProductsList = false;
                                  searchQuery = '';
                                }),
                              );
                            },
                          ),
                        ),
                      if (showProductsList && filteredProducts.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(context.l10n.noData, style: Theme.of(ctx).textTheme.bodySmall),
                        ),
                    ],
                  ],
                  const SizedBox(height: 16),
                  // Supplier SKU
                  TextField(
                    controller: supplierSkuCtrl,
                    decoration: InputDecoration(labelText: context.l10n.supplierSku),
                  ),
                  const SizedBox(height: 12),
                  // Supplier quoted price
                  TextField(
                    controller: priceCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.supplierQuotedPrice,
                      suffixText: '₸',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                  const SizedBox(height: 12),
                  // Preferred supplier
                  SwitchListTile(
                    title: Text(context.l10n.preferredSupplier),
                    value: isPreferred,
                    onChanged: (v) => setDialogState(() => isPreferred = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 12),
                  // Notes
                  TextField(
                    controller: notesCtrl,
                    decoration: InputDecoration(labelText: context.l10n.notes),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(context.l10n.cancel),
              ),
              FilledButton(
                onPressed: isSubmitting ? null : () async {
                  if (selectedProductId == null) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text(context.l10n.selectProductRequired)),
                    );
                    return;
                  }
                  setDialogState(() => isSubmitting = true);
                  final price = double.tryParse(priceCtrl.text);
                  final createResult = await repo.createSupplierProduct(
                    widget.supplierId,
                    CreateSupplierProductRequest(
                      productId: selectedProductId!,
                      supplierSku: supplierSkuCtrl.text.isNotEmpty ? supplierSkuCtrl.text : null,
                      purchasePrice: price,
                      isPreferred: isPreferred,
                      notes: notesCtrl.text.isNotEmpty ? notesCtrl.text : null,
                    ),
                  );
                  if (!ctx.mounted) return;
                  if (createResult is SuppliersSuccess) {
                    Navigator.pop(ctx, true);
                  } else if (createResult is SuppliersFailure) {
                    setDialogState(() => isSubmitting = false);
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text((createResult as SuppliersFailure).error.message)),
                    );
                  }
                },
                child: isSubmitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(context.l10n.save),
              ),
            ],
          );
        },
      ),
    ).then((result) {
      if (result == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.supplierProductSaved)),
        );
        _loadSupplierProducts();
      }
    });
  }

  Future<void> _showEditProductDialog(SupplierProduct sp) async {
    if (!mounted) return;
    final supplierSkuCtrl = TextEditingController(text: sp.supplierSku ?? '');
    final priceCtrl = TextEditingController(text: sp.purchasePrice?.toString() ?? '');
    final notesCtrl = TextEditingController(text: sp.notes ?? '');
    bool isPreferred = sp.isPreferred;
    bool isSubmitting = false;

    final repo = ref.read(suppliersRepositoryProvider);
    await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(context.l10n.edit),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product name (read-only)
                Text(context.l10n.product, style: Theme.of(ctx).textTheme.labelLarge),
                const SizedBox(height: 4),
                Text(sp.product.name, style: Theme.of(ctx).textTheme.bodyLarge),
                if (sp.product.sku != null)
                  Text('SKU: ${sp.product.sku}', style: Theme.of(ctx).textTheme.bodySmall),
                const SizedBox(height: 16),
                // Supplier SKU
                TextField(
                  controller: supplierSkuCtrl,
                  decoration: InputDecoration(labelText: context.l10n.supplierSku),
                ),
                const SizedBox(height: 12),
                // Supplier quoted price
                TextField(
                  controller: priceCtrl,
                  decoration: InputDecoration(
                    labelText: context.l10n.supplierQuotedPrice,
                    suffixText: '₸',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 12),
                // Preferred supplier
                SwitchListTile(
                  title: Text(context.l10n.preferredSupplier),
                  value: isPreferred,
                  onChanged: (v) => setDialogState(() => isPreferred = v),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 12),
                // Notes
                TextField(
                  controller: notesCtrl,
                  decoration: InputDecoration(labelText: context.l10n.notes),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(ctx, false),
              child: Text(context.l10n.cancel),
            ),
            FilledButton(
              onPressed: isSubmitting ? null : () async {
                setDialogState(() => isSubmitting = true);
                final price = double.tryParse(priceCtrl.text);
                final updateResult = await repo.updateSupplierProduct(
                  widget.supplierId,
                  sp.id,
                  {
                    'supplierSku': supplierSkuCtrl.text.isNotEmpty ? supplierSkuCtrl.text : null,
                    'purchasePrice': price,
                    'isPreferred': isPreferred,
                    'notes': notesCtrl.text.isNotEmpty ? notesCtrl.text : null,
                  },
                );
                if (!ctx.mounted) return;
                if (updateResult is SuppliersSuccess) {
                  Navigator.pop(ctx, true);
                } else if (updateResult is SuppliersFailure) {
                  setDialogState(() => isSubmitting = false);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text((updateResult as SuppliersFailure).error.message)),
                  );
                }
              },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(context.l10n.save),
            ),
          ],
        ),
      ),
    ).then((result) {
      if (result == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.supplierProductSaved)),
        );
        _loadSupplierProducts();
      }
    });
  }

  Future<void> _confirmDeleteProduct(SupplierProduct sp) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.confirmRemoval),
        content: Text('${context.l10n.remove} ${sp.product.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.l10n.cancel)),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(context.l10n.delete)),
        ],
      ),
    );
    if (confirmed == true) {
      final repo = ref.read(suppliersRepositoryProvider);
      await repo.deleteSupplierProduct(widget.supplierId, sp.id);
      _loadSupplierProducts();
    }
  }

  Future<void> _loadSupplierProducts() async {
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getSupplierProducts(widget.supplierId);
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierProductListResponse>) {
        _supplierProducts = result.data.items;
      }
    });
  }

  Future<void> _loadContactsAndAddresses() async {
    final repo = ref.read(suppliersRepositoryProvider);
    final contactsResult = await repo.getContacts(widget.supplierId);
    final addressesResult = await repo.getAddresses(widget.supplierId);
    if (!mounted) return;
    setState(() {
      if (contactsResult is SuppliersSuccess<List<SupplierContact>>) {
        _contacts = contactsResult.data;
      }
      if (addressesResult is SuppliersSuccess<List<SupplierAddress>>) {
        _addresses = addressesResult.data;
      }
    });
  }
}
