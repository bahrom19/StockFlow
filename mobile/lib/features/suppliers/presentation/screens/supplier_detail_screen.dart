import 'package:flutter/material.dart';
import 'package:stockflow/core/company/company_provider.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_product_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/record_supplier_payment_sheet.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_header_card.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_contacts_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_addresses_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_performance_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_finance_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_invoices_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_purchase_analytics_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_order_pipeline_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_reliability_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_return_summary_section.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_products_section.dart';
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
  SupplierPaymentAging? _paymentAging;
  bool _isLoadingPaymentAging = false;
  String? _paymentAgingError;
  SupplierReturnSummary? _returnSummary;
  bool _isLoadingReturnSummary = false;
  String? _returnSummaryError;
  SupplierPerformance? _performance;
  bool _isLoadingPerformance = false;
  String? _performanceError;
  SupplierOrderPipeline? _orderPipeline;
  bool _isLoadingOrderPipeline = false;
  String? _orderPipelineError;
  bool _isLoadingReliability = false;
  String? _reliabilityError;
  // G5: Purchase Invoices
  List<PurchaseInvoice> _invoices = [];
  bool _isLoadingInvoices = false;
  String? _invoicesError;
  int _invoicePage = 1;
  int _invoiceTotal = 0;
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
    // Also load product purchases, reliability, payment aging, and performance
    _loadProductPurchases();
    _loadReliability();
    _loadPaymentAging();
    _loadReturnSummary();
    _loadPerformance();
    _loadOrderPipeline();
    _loadInvoices();
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

  Future<void> _loadPaymentAging() async {
    if (!mounted) return;
    setState(() {
      _isLoadingPaymentAging = true;
      _paymentAgingError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getPaymentAging(widget.supplierId);
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierPaymentAging>) {
        _paymentAging = result.data;
      } else if (result is SuppliersFailure<SupplierPaymentAging>) {
        _paymentAgingError = result.error.message;
      }
      _isLoadingPaymentAging = false;
    });
  }

  Future<void> _loadReturnSummary() async {
    if (!mounted) return;
    setState(() {
      _isLoadingReturnSummary = true;
      _returnSummaryError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getReturnSummary(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierReturnSummary>) {
        _returnSummary = result.data;
      } else if (result is SuppliersFailure<SupplierReturnSummary>) {
        _returnSummaryError = result.error.message;
      }
      _isLoadingReturnSummary = false;
    });
  }

  Future<void> _loadPerformance() async {
    if (!mounted) return;
    setState(() {
      _isLoadingPerformance = true;
      _performanceError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getPerformance(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierPerformance>) {
        _performance = result.data;
      } else if (result is SuppliersFailure<SupplierPerformance>) {
        _performanceError = result.error.message;
      }
      _isLoadingPerformance = false;
    });
  }

  Future<void> _loadOrderPipeline() async {
    if (!mounted) return;
    setState(() {
      _isLoadingOrderPipeline = true;
      _orderPipelineError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getOrderPipeline(
      widget.supplierId,
      dateFrom: _purchaseDateFrom,
      dateTo: _purchaseDateTo,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<SupplierOrderPipeline>) {
        _orderPipeline = result.data;
      } else if (result is SuppliersFailure<SupplierOrderPipeline>) {
        _orderPipelineError = result.error.message;
      }
      _isLoadingOrderPipeline = false;
    });
  }

  // G5: Load purchase invoices for this supplier
  Future<void> _loadInvoices() async {
    if (!mounted) return;
    setState(() {
      _isLoadingInvoices = true;
      _invoicesError = null;
    });
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getSupplierInvoiceList(
      widget.supplierId,
      page: _invoicePage,
      limit: 10,
    );
    if (!mounted) return;
    setState(() {
      if (result is SuppliersSuccess<PurchaseInvoiceListResponse>) {
        _invoices = result.data.items;
        _invoiceTotal = result.data.total;
      } else if (result is SuppliersFailure<PurchaseInvoiceListResponse>) {
        _invoicesError = result.error.message;
      }
      _isLoadingInvoices = false;
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
              SupplierHeaderCard(supplier: supplier),
              const SizedBox(height: 24),

              // ── Contacts Section ──────────────────────────────
              SupplierContactsSection(
                contacts: _contacts,
                onAdd: () => _showContactDialog(),
                onEdit: (c) => _showContactDialog(contact: c),
                onDelete: _deleteContact,
              ),
              const SizedBox(height: 24),

              // ── Addresses Section ─────────────────────────────
              SupplierAddressesSection(
                addresses: _addresses,
                onAdd: () => _showAddressDialog(),
                onEdit: (a) => _showAddressDialog(address: a),
                onDelete: _deleteAddress,
              ),
              const SizedBox(height: 24),

              // ── Performance Overview ──────────────────────────
              SupplierPerformanceSection(
                performance: _performance,
                isLoading: _isLoadingPerformance,
                error: _performanceError,
                onRetry: _loadPerformance,
              ),
              const SizedBox(height: 24),

              // ── Finance Section ──────────────────────────────
              SupplierFinanceSection(
                financeSummary: _financeSummary,
                payments: _payments,
                paymentAging: _paymentAging,
                isLoadingPaymentAging: _isLoadingPaymentAging,
                companyCurrency: ref.read(companyCurrencyProvider),
                onAddPayment: () => _showAddPaymentDialog(),
                onVoidPayment: _voidPayment,
              ),
              const SizedBox(height: 24),

              // ── Purchase Invoices Section (G5) ──────────────
              SupplierInvoicesSection(
                invoices: _invoices,
                isLoading: _isLoadingInvoices,
                error: _invoicesError,
                invoicePage: _invoicePage,
                invoiceTotal: _invoiceTotal,
                onRetry: _loadInvoices,
                onLoadMore: () {
                  _invoicePage++;
                  _loadInvoices();
                },
              ),
              const SizedBox(height: 24),

              // ── Purchase Analytics Section ───────────────────
              SupplierPurchaseAnalyticsSection(
                purchaseSummary: _purchaseSummary,
                isLoading: _isLoadingPurchaseSummary,
                error: _purchaseSummaryError,
                productPurchases: _productPurchases,
                isLoadingProductPurchases: _isLoadingProductPurchases,
                productPurchasesError: _productPurchasesError,
                productPurchaseTotal: _productPurchaseTotal,
                companyCurrency: ref.read(companyCurrencyProvider),
                onRetry: _loadPurchaseSummary,
                onRetryProducts: _loadProductPurchases,
                onPeriodChanged: _onPeriodChanged,
                onSearchChanged: (value) {
                  _productPurchaseSearch = value.isEmpty ? null : value;
                  _productPurchasePage = 1;
                  _loadProductPurchases();
                },
                onLoadMoreProducts: () {
                  _productPurchasePage++;
                  _loadProductPurchases();
                },
                onShowPriceHistory: _showPriceHistoryDialog,
              ),
              const SizedBox(height: 24),

              // ── Order Pipeline Section ──────────────────────
              SupplierOrderPipelineSection(
                orderPipeline: _orderPipeline,
                isLoading: _isLoadingOrderPipeline,
                error: _orderPipelineError,
                onRetry: _loadOrderPipeline,
              ),
              const SizedBox(height: 24),

              // ── Supplier Reliability Section ────────────────
              SupplierReliabilitySection(
                reliability: _reliability,
                isLoading: _isLoadingReliability,
                error: _reliabilityError,
                companyCurrency: ref.read(companyCurrencyProvider),
                onRetry: _loadReliability,
              ),
              const SizedBox(height: 24),

              // ── Return Analysis Section ───────────────────────
              SupplierReturnSummarySection(
                returnSummary: _returnSummary,
                isLoading: _isLoadingReturnSummary,
                error: _returnSummaryError,
                companyCurrency: ref.read(companyCurrencyProvider),
                onRetry: _loadReturnSummary,
              ),
              const SizedBox(height: 24),

              // ── Products Section ─────────────────────────────
              SupplierProductsSection(
                products: _supplierProducts,
                onAdd: () => _showAddProductDialog(),
                onEdit: _showEditProductDialog,
                onDelete: _confirmDeleteProduct,
              ),

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

  // ── Order Pipeline section → extracted to SupplierOrderPipelineSection
  // ── Finance section → extracted to SupplierFinanceSection
  // ── Invoices section → extracted to SupplierInvoicesSection
  // ── Purchase Analytics section → extracted to SupplierPurchaseAnalyticsSection
  // ── Reliability section → extracted to SupplierReliabilitySection
  // ── Return Summary section → extracted to SupplierReturnSummarySection
  // ── Products section → extracted to SupplierProductsSection

  // ── Payment actions ────────────────────────────────────

  Future<void> _showAddPaymentDialog() async {
    if (!mounted || _supplier == null) return;
    final payment = await RecordSupplierPaymentSheet.show(
      context: context,
      supplierId: widget.supplierId,
      companyCurrency: ref.read(companyCurrencyProvider),
    );
    if (payment != null && mounted) {
      await _refreshFinanceData();
    }
  }

  Future<void> _voidPayment(SupplierPayment payment) async {
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.voidPayment),
        content: Text(context.l10n.voidPaymentConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.l10n.voidPayment),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.voidPayment(widget.supplierId, payment.id);
    if (!mounted) return;
    if (result is SuppliersFailure) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text((result as SuppliersFailure).error.message)),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.paymentVoided)),
      );
      _refreshFinanceData();
    }
  }

  Future<void> _refreshFinanceData() async {
    final repo = ref.read(suppliersRepositoryProvider);
    final results = await Future.wait([
      repo.getFinanceSummary(widget.supplierId),
      repo.getPayments(widget.supplierId),
      repo.getPaymentAging(widget.supplierId),
      repo.getSupplierInvoiceList(widget.supplierId, page: _invoicePage, limit: 10),
    ]);
    if (!mounted) return;
    setState(() {
      if (results[0] is SuppliersSuccess<SupplierFinanceSummary>) {
        _financeSummary = (results[0] as SuppliersSuccess<SupplierFinanceSummary>).data;
      }
      if (results[1] is SuppliersSuccess<SupplierPaymentListResponse>) {
        _payments = (results[1] as SuppliersSuccess<SupplierPaymentListResponse>).data.items;
      }
      if (results[2] is SuppliersSuccess<SupplierPaymentAging>) {
        _paymentAging = (results[2] as SuppliersSuccess<SupplierPaymentAging>).data;
      }
      if (results[3] is SuppliersSuccess<PurchaseInvoiceListResponse>) {
        _invoices = (results[3] as SuppliersSuccess<PurchaseInvoiceListResponse>).data.items;
        _invoiceTotal = (results[3] as SuppliersSuccess<PurchaseInvoiceListResponse>).data.total;
      }
    });
  }

  void _onPeriodChanged(String? value) {
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
    _loadReturnSummary();
  }

  // ── Price History Dialog ──────────────────────────────

  Future<void> _showPriceHistoryDialog(String productId, String productName) async {
    if (!mounted) return;
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getPriceHistory(widget.supplierId, productId,
        dateFrom: _purchaseDateFrom, dateTo: _purchaseDateTo);
    if (!mounted) return;
    if (result is SuppliersSuccess<SupplierPriceHistory>) {
      _showPriceHistoryDialogContent(result.data);
    } else if (result is SuppliersFailure<SupplierPriceHistory>) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error.message)),
      );
    }
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
        Text(CurrencyCatalog.format(value, code: ref.read(companyCurrencyProvider)),
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: highlighted ? FontWeight.w700 : FontWeight.w600,
              color: highlighted ? theme.colorScheme.primary : null,
            )),
      ],
    );
  }

  void _showPriceHistoryDialogContent(SupplierPriceHistory history) {
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${context.l10n.priceHistory} — ${history.productName}'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (history.sku != null)
                  Text('SKU: ${history.sku}',
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    if (history.currentQuotedPrice != null)
                      _analyticsStat(context.l10n.currentQuotedPrice, '₸${history.currentQuotedPrice}', theme),
                    _analyticsStat(context.l10n.avgCost, '₸${history.averageUnitCost}', theme),
                    _analyticsStat(context.l10n.minMaxCost, '₸${history.minUnitCost} / ₸${history.maxUnitCost}', theme),
                  ],
                ),
                const SizedBox(height: 16),
                if (history.pricePoints.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(context.l10n.noPriceHistory,
                        style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                  )
                else ...[
                  Text(context.l10n.priceTrend,
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  ...history.pricePoints.map((pp) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 80,
                          child: Text(pp.invoiceDate.substring(0, 10),
                              style: theme.textTheme.bodySmall),
                        ),
                        Expanded(
                          child: Text(pp.invoiceNumber,
                              style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                        ),
                        SizedBox(
                          width: 70,
                          child: Text('₸${pp.unitCost}',
                              style: theme.textTheme.bodySmall, textAlign: TextAlign.end),
                        ),
                        SizedBox(
                          width: 50,
                          child: Text('×${pp.quantity}',
                              style: theme.textTheme.bodySmall, textAlign: TextAlign.end),
                        ),
                      ],
                    ),
                  )),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(context.l10n.close),
          ),
        ],
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
