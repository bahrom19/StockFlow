import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/utils/pdf_downloader.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/payments/data/payment_pdf_export.dart';
import 'package:stockflow/features/payments/data/payments_repository.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/payments/presentation/labels.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

/// Screen 2 — Payment Details.
///
/// Desktop table (Date · Receipt · Cashier · Customer · Warehouse ·
/// Method · Amount · Status) with search, method filter, sort, pagination
/// and CSV export. The same table backs the per-method deep-link from the
/// analytics dashboard (`?method=CASH&from=...&to=...`).
class PaymentDetailsScreen extends ConsumerStatefulWidget {
  static const String route = '/payments/details';

  final String? initialMethod;
  final DateTime? from;
  final DateTime? to;

  const PaymentDetailsScreen({super.key, this.initialMethod, this.from, this.to});

  @override
  ConsumerState<PaymentDetailsScreen> createState() =>
      _PaymentDetailsScreenState();
}

class _PaymentDetailsScreenState extends ConsumerState<PaymentDetailsScreen> {
  static const _pageSize = 50;

  // Semantic index of the money column inside the exported rows/headers
  // (date · receipt · cashier · customer · warehouse · method · amount ·
  // status). Passed explicitly to the PDF exporter so the amount column is
  // identified by position, never by localized display text (Сумма/Сома).
  static const int _amountColumnIndex = 6;

  final _searchController = TextEditingController();
  Timer? _searchDebounce;
  int _requestSeq = 0; // discards stale responses on rapid search changes
  String _query = '';
  String? _method;
  String _sortBy = 'createdAt';
  String _sortOrder = 'desc';
  int _page = 1;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _error;
  List<Sale> _sales = const [];
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _method = widget.initialMethod;
    _load(reset: true);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final seq = ++_requestSeq;
    if (reset) {
      _page = 1;
      setState(() {
        _isLoading = true;
        _error = null;
      });
    } else {
      setState(() => _isLoadingMore = true);
    }

    final repo = ref.read(paymentsRepositoryProvider);
    final result = await repo.getSalesPage(
      page: _page,
      limit: _pageSize,
      method: _method,
      search: _query.isEmpty ? null : _query,
      sortBy: _sortBy,
      sortOrder: _sortOrder,
    );

    if (!mounted || seq != _requestSeq) return;
    if (result is PaymentsFailure<SaleListResponse>) {
      setState(() {
        _isLoading = false;
        _isLoadingMore = false;
        _error = result.error.message;
      });
      return;
    }
    final page = (result as PaymentsSuccess<SaleListResponse>).data;
    setState(() {
      _isLoading = false;
      _isLoadingMore = false;
      _error = null;
      _sales = reset ? page.items : [..._sales, ...page.items];
      _total = page.total;
    });
  }

  void _setMethod(String? method) {
    if (method == _method) return;
    _method = method;
    _searchDebounce?.cancel();
    _load(reset: true);
  }

  void _setSort(String column) {
    if (_sortBy == column) {
      _sortOrder = _sortOrder == 'desc' ? 'asc' : 'desc';
    } else {
      _sortBy = column;
      _sortOrder = 'desc';
    }
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.paymentDetailsTitle,
            subtitle: _subtitle(context),
            actions: [
              IconButton(
                tooltip: context.l10n.exportPdf,
                onPressed: _sales.isEmpty ? null : _exportPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 20),
              ),
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () => _load(reset: true),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: _isLoading && _sales.isEmpty
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : EntityTable<Sale>(
                    items: _sales,
                    total: _total,
                    hasMore: _sales.length < _total,
                    isLoading: _isLoading,
                    isLoadingMore: _isLoadingMore,
                    onLoadMore: () {
                      _page++;
                      _load();
                    },
                    search: _query,
                    searchHint: context.l10n.detailsSearchHint,
                    onSearch: (q) {
                      _query = q;
                      _searchDebounce?.cancel();
                      _searchDebounce = Timer(
                        const Duration(milliseconds: 350),
                        () => _load(reset: true),
                      );
                    },
                    filters: _methodFilters(),
                    activeFilter: _method,
                    onFilter: _setMethod,
                    onRefresh: () => _load(reset: true),
                    exportFileName: 'payment_details.csv',
                    exportHeaders: _exportHeaders(context),
                    exportRows: _exportRows,
                    columns: [
                      DataColumn(
                        label:
                            Text(context.l10n.date, style: theme.textTheme.labelMedium),
                        onSort: (_, __) => _setSort('createdAt'),
                        numeric: false,
                      ),
                      DataColumn(
                        label: Text(context.l10n.receipt,
                            style: theme.textTheme.labelMedium),
                        onSort: (_, __) => _setSort('saleNumber'),
                      ),
                      DataColumn(label: Text(context.l10n.cashier)),
                      DataColumn(label: Text(context.l10n.customer)),
                      DataColumn(label: Text(context.l10n.warehouse)),
                      DataColumn(label: Text(context.l10n.method)),
                      DataColumn(
                        label:
                            Text(context.l10n.amount, style: theme.textTheme.labelMedium),
                        numeric: true,
                        onSort: (_, __) => _setSort('total'),
                      ),
                      DataColumn(label: Text(context.l10n.status)),
                    ],
                    buildRow: (s) => DataRow(
                      cells: [
                        DataCell(Text(
                          Formatters.dateTime(s.createdAt),
                          style: theme.textTheme.bodySmall,
                        )),
                        DataCell(Text(
                          s.saleNumber,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        )),
                        DataCell(Text(_shortId(s.cashierId))),
                        DataCell(Text(
                          s.customerId == null ? '—' : _shortId(s.customerId!),
                        )),
                        DataCell(Text(_shortId(s.warehouseId))),
                        DataCell(_MethodCell(payments: s.payments)),
                        DataCell(Text(context.money(
                          s.payments.fold(0.0,
                              (sum, p) => sum + (double.tryParse(p.amount) ?? 0)),
                        ))),
                        DataCell(_StatusCell(status: s.status)),
                      ],
                    ),
                    onRowTap: (s) => context.push('/sales/${s.id}'),
                    emptyTitle: context.l10n.noPaymentsFound,
                    emptySubtitle: _method == null
                        ? context.l10n.noPaymentsYetSubtitle
                        : context.l10n
                            .noMethodPaymentsMatch(paymentMethodRawLabel(_method!, context.l10n)),
                    emptyIcon: Icons.payments_outlined,
                    errorMessage: _error,
                    onRetry: () => _load(reset: true),
                  ),
          ),
        ],
      ),
    );
  }

  String _subtitle(BuildContext context) {
    final l10n = context.l10n;
    final parts = <String>[
      if (_method != null)
        l10n.filteredBy(paymentMethodFilterLabel(_method!, l10n)),
      l10n.transactionsCount(_total),
    ];
    return parts.join(' · ');
  }

  List<String> _exportHeaders(BuildContext context) {
    final l10n = context.l10n;
    return [
      l10n.date,
      l10n.receipt,
      l10n.cashier,
      l10n.customer,
      l10n.warehouse,
      l10n.method,
      l10n.amount,
      l10n.status,
    ];
  }

  List<EntityFilter> _methodFilters() {
    final l10n = context.l10n;
    return [
      EntityFilter(l10n.all, null),
      for (final meta in PaymentMethodMeta.all)
        EntityFilter(paymentMethodLabel(meta.code, l10n), meta.code),
    ];
  }

  String _shortId(String id) => id.length <= 8 ? id : id.substring(0, 8);

  /// Same row shape as the CSV export — reused by the PDF export.
  List<List<String>> _exportRows() {
    return [
      for (final s in _sales)
        for (final p in s.payments)
          [
            Formatters.dateTime(s.createdAt),
            s.saleNumber,
            _shortId(s.cashierId),
            s.customerId == null ? '' : _shortId(s.customerId!),
            _shortId(s.warehouseId),
            p.method,
            p.amount,
            s.status,
          ],
    ];
  }

  Future<void> _exportPdf() async {
    final rows = _exportRows();
    if (rows.isEmpty) return;
    try {
      final bytes = await PaymentPdfExport.build(
        title: context.l10n.paymentDetailsTitle,
        currency: context.currencyCode,
        subtitle: _subtitle(context),
        headers: _exportHeaders(context),
        rows: rows,
        amountColumnIndex: _amountColumnIndex,
        l10n: context.l10n,
      );
      await PdfDownloader.download('payment_details.pdf', bytes);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.exportedRowsAsPdf(rows.length))),
      );
    } on UnsupportedError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.message ?? context.l10n.pdfExportNotSupported,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.pdfExportFailed(e.toString()))),
      );
    }
  }
}

/// Renders the payment method(s) of a sale with their brand colors.
class _MethodCell extends StatelessWidget {
  final List<Payment> payments;

  const _MethodCell({required this.payments});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (payments.isEmpty) {
      return Text('—', style: theme.textTheme.bodySmall);
    }
    return Wrap(
      spacing: 4,
      runSpacing: 2,
      children: [
        for (final p in payments)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: PaymentMethodMeta.byCode(p.method).color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              paymentMethodLabel(p.method, context.l10n),
              style: theme.textTheme.labelSmall?.copyWith(
                color: PaymentMethodMeta.byCode(p.method).color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

class _StatusCell extends StatelessWidget {
  final String status;

  const _StatusCell({required this.status});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isRefund = status == 'REFUNDED' || status == 'PARTIALLY_REFUNDED';
    final color = isRefund
        ? const Color(0xFFFB8C00)
        : status == 'COMPLETED'
            ? const Color(0xFF0F9D58)
            : theme.colorScheme.onSurfaceVariant;

    return Text(
      paymentStatusLabel(status, context.l10n),
      style: theme.textTheme.labelSmall?.copyWith(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
