import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:uuid/uuid.dart';

/// Record Payment bottom sheet for the Supplier Detail screen.
///
/// The idempotency key is created once when this form is opened. It is kept for
/// every retry of this logical payment and is never shared with another form.
class RecordSupplierPaymentSheet extends ConsumerStatefulWidget {
  final String supplierId;
  final String companyCurrency;

  const RecordSupplierPaymentSheet({
    super.key,
    required this.supplierId,
    required this.companyCurrency,
  });

  static Future<SupplierPayment?> show({
    required BuildContext context,
    required String supplierId,
    required String companyCurrency,
  }) {
    return showModalBottomSheet<SupplierPayment>(
      context: context,
      isScrollControlled: true,
      builder: (_) => RecordSupplierPaymentSheet(
        supplierId: supplierId,
        companyCurrency: companyCurrency,
      ),
    );
  }

  @override
  ConsumerState<RecordSupplierPaymentSheet> createState() =>
      _RecordSupplierPaymentSheetState();
}

class _RecordSupplierPaymentSheetState
    extends ConsumerState<RecordSupplierPaymentSheet> {
  String? _selectedInvoiceId;
  final _amountController = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  String _method = 'BANK_TRANSFER';
  String? _selectedCashAccountId;
  String? _selectedBankAccountId;
  final _referenceController = TextEditingController();
  final _notesController = TextEditingController();

  late final String _idempotencyKey;

  List<SupplierInvoiceLite> _invoices = [];
  List<CashAccountLite> _cashAccounts = [];
  List<BankAccountLite> _bankAccounts = [];
  bool _isLoadingData = true;
  String? _dataError;
  bool _isSubmitting = false;
  String? _submitError;
  bool _canRetrySubmit = false;

  @override
  void initState() {
    super.initState();
    _idempotencyKey = const Uuid().v4();
    _loadData();
  }

  Future<void> _loadData() async {
    if (mounted) {
      setState(() {
        _isLoadingData = true;
        _dataError = null;
      });
    }

    final repo = ref.read(suppliersRepositoryProvider);
    final results = await Future.wait([
      repo.getSupplierInvoices(widget.supplierId, status: 'APPROVED'),
      repo.getCashAccounts(),
      repo.getBankAccounts(),
    ]);
    if (!mounted) return;

    final invoiceResult =
        results[0] as SuppliersResult<List<SupplierInvoiceLite>>;
    final cashResult = results[1] as SuppliersResult<List<CashAccountLite>>;
    final bankResult = results[2] as SuppliersResult<List<BankAccountLite>>;

    String? dataError;
    if (invoiceResult is SuppliersFailure<List<SupplierInvoiceLite>>) {
      dataError = invoiceResult.error.message;
    } else if (cashResult is SuppliersFailure<List<CashAccountLite>>) {
      dataError = cashResult.error.message;
    } else if (bankResult is SuppliersFailure<List<BankAccountLite>>) {
      dataError = bankResult.error.message;
    }

    setState(() {
      _dataError = dataError == null
          ? null
          : localizedErrorLabel(context.l10n, dataError);
      _invoices = invoiceResult is SuppliersSuccess<List<SupplierInvoiceLite>>
          ? invoiceResult.data
              .where((invoice) =>
                  invoice.currency == widget.companyCurrency &&
                  (_outstanding(invoice)?.isPositive ?? false))
              .toList()
          : [];
      _cashAccounts = cashResult is SuppliersSuccess<List<CashAccountLite>>
          ? cashResult.data
              .where((account) => account.currency == widget.companyCurrency)
              .toList()
          : [];
      _bankAccounts = bankResult is SuppliersSuccess<List<BankAccountLite>>
          ? bankResult.data
              .where((account) => account.currency == widget.companyCurrency)
              .toList()
          : [];
      _isLoadingData = false;
    });
  }

  Money? _parseMoney(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    final parts = trimmed.split('.');
    if (parts.length == 2 && parts[1].length > 2) {
      final extra = parts[1].substring(2);
      if (extra.split('').any((digit) => digit != '0')) return null;
      return Money.tryParse(
        '${parts[0]}.${parts[1].substring(0, 2)}',
        widget.companyCurrency,
      );
    }
    return Money.tryParse(trimmed, widget.companyCurrency);
  }

  Money? _outstanding(SupplierInvoiceLite invoice) {
    if (invoice.currency != widget.companyCurrency) return null;
    final total = _parseMoney(invoice.grandTotal);
    final paid = _parseMoney(invoice.paidAmount);
    if (total == null || paid == null) return null;
    final outstanding = total - paid;
    return outstanding.isPositive ? outstanding : null;
  }

  SupplierInvoiceLite? _selectedInvoice() {
    for (final invoice in _invoices) {
      if (invoice.id == _selectedInvoiceId) return invoice;
    }
    return null;
  }

  void _setValidationError(String message) {
    setState(() {
      _submitError = message;
      _canRetrySubmit = false;
    });
  }

  Future<void> _onSave() async {
    final invoice = _selectedInvoice();
    if (invoice == null) {
      _setValidationError(context.l10n.requiredField(context.l10n.invoice));
      return;
    }
    if (invoice.currency != widget.companyCurrency) {
      _setValidationError(context.l10n.currencyMismatch);
      return;
    }

    final outstanding = _outstanding(invoice);
    final amount = _parseMoney(_amountController.text);
    if (amount == null) {
      _setValidationError(context.l10n.requiredField(context.l10n.amount));
      return;
    }
    if (!amount.isPositive) {
      _setValidationError(
          context.l10n.greaterThanZero(context.l10n.amount));
      return;
    }
    if (outstanding == null || amount > outstanding) {
      _setValidationError(context.l10n.exceedOutstanding(
          outstanding?.toDecimalString() ?? '-'));
      return;
    }
    if (!const {'CASH', 'BANK_TRANSFER', 'CARD'}.contains(_method)) {
      _setValidationError(context.l10n.validationError);
      return;
    }
    if (_method == 'CASH' && _selectedCashAccountId == null) {
      _setValidationError(
          context.l10n.requiredField(context.l10n.cashAccount));
      return;
    }
    if (_method == 'BANK_TRANSFER' && _selectedBankAccountId == null) {
      _setValidationError(
          context.l10n.requiredField(context.l10n.bankAccount));
      return;
    }

    setState(() {
      _submitError = null;
      _canRetrySubmit = false;
      _isSubmitting = true;
    });

    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.createPayment(
      supplierId: widget.supplierId,
      idempotencyKey: _idempotencyKey,
      request: CreateSupplierPaymentRequest(
        purchaseInvoiceId: invoice.id,
        amount: amount.toApiNumber().toDouble(),
        method: _method,
        cashAccountId: _method == 'CASH' ? _selectedCashAccountId : null,
        bankAccountId:
            _method == 'BANK_TRANSFER' ? _selectedBankAccountId : null,
        currency: widget.companyCurrency,
        paymentDate:
            '${_paymentDate.year.toString().padLeft(4, '0')}-${_paymentDate.month.toString().padLeft(2, '0')}-${_paymentDate.day.toString().padLeft(2, '0')}',
        reference: _referenceController.text.trim().isEmpty
            ? null
            : _referenceController.text.trim(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      ),
    );

    if (!mounted) return;
    if (result is SuppliersSuccess<SupplierPayment>) {
      Navigator.of(context).pop(result.data);
      return;
    }

    final failure = (result as SuppliersFailure<SupplierPayment>).error;
    setState(() {
      _submitError = _mapError(failure);
      _canRetrySubmit = _isRetryable(failure);
      _isSubmitting = false;
    });
  }

  bool _isIdempotencyConflict(Failure error) {
    final message = error.message.toLowerCase();
    return message.contains('idempot') ||
        message.contains('same key') ||
        message.contains('duplicate key');
  }

  bool _isRetryable(Failure error) =>
      error is NetworkFailure ||
      error is ConflictFailure ||
      (error is ValidationFailure && _isIdempotencyConflict(error));

  String _mapError(Failure error) {
    if (error is NotFoundFailure) return context.l10n.notFound;
    if (error is ConflictFailure) return context.l10n.conflictRetry;
    if (error is NetworkFailure) {
      return localizedErrorLabel(context.l10n, error.message);
    }
    if (error is ValidationFailure) {
      final message = error.message.toLowerCase();
      if (_isIdempotencyConflict(error)) return context.l10n.conflictRetry;
      if (message.contains('currency')) return context.l10n.currencyMismatch;
      if (message.contains('outstand') || message.contains('overpay')) {
        return context.l10n.exceedOutstanding('-');
      }
      return context.l10n.validationError;
    }
    return context.l10n.paymentFailed;
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    final canSave = _selectedInvoiceId != null &&
        _amountController.text.trim().isNotEmpty &&
        !_isSubmitting;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + inset),
      child: SafeArea(
        top: false,
        child: _isLoadingData
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : _dataError != null
                ? _ErrorState(message: _dataError!, onRetry: _loadData)
                : SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildHeader(context),
                        const SizedBox(height: 16),
                        _CurrencyBanner(currency: widget.companyCurrency),
                        const SizedBox(height: 12),
                        _buildInvoicePicker(context),
                        const SizedBox(height: 16),
                        _buildAmountField(context),
                        const SizedBox(height: 16),
                        _buildDatePicker(context),
                        const SizedBox(height: 16),
                        _buildMethodPicker(context),
                        if (_method == 'CASH') ...[
                          const SizedBox(height: 16),
                          _buildCashAccountPicker(context),
                        ],
                        if (_method == 'BANK_TRANSFER') ...[
                          const SizedBox(height: 16),
                          _buildBankAccountPicker(context),
                        ],
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _referenceController,
                          decoration: InputDecoration(
                            labelText: context.l10n.reference,
                            border: const OutlineInputBorder(),
                          ),
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(100),
                          ],
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _notesController,
                          decoration: InputDecoration(
                            labelText: context.l10n.notes,
                            border: const OutlineInputBorder(),
                          ),
                          maxLines: 3,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(500),
                          ],
                        ),
                        if (_submitError != null) ...[
                          const SizedBox(height: 16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.error_outline,
                                  color: Theme.of(context).colorScheme.error),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _submitError!,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .error),
                                ),
                              ),
                              if (_canRetrySubmit)
                                TextButton.icon(
                                  onPressed: _isSubmitting ? null : _onSave,
                                  icon: const Icon(Icons.refresh, size: 16),
                                  label: Text(context.l10n.retry),
                                ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: TextButton(
                                onPressed: _isSubmitting
                                    ? null
                                    : () => Navigator.of(context).pop(),
                                child: Text(context.l10n.cancel),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilledButton(
                                onPressed: canSave ? _onSave : null,
                                child: _isSubmitting
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2),
                                      )
                                    : Text(context.l10n.save),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Text(
      context.l10n.recordPayment,
      style: Theme.of(context).textTheme.titleMedium,
    );
  }

  Widget _buildInvoicePicker(BuildContext context) {
    final theme = Theme.of(context);
    return DropdownButtonFormField<String>(
      value: _selectedInvoiceId,
      decoration: InputDecoration(
        labelText: context.l10n.invoice,
        hintText: context.l10n.selectInvoice,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      items: _invoices.map((invoice) {
        final outstanding = _outstanding(invoice);
        return DropdownMenuItem<String>(
          value: invoice.id,
          child: SizedBox(
            width: MediaQuery.of(context).size.width * 0.68,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(invoice.invoiceNumber,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600)),
                Text(
                  '${_formatCurrency(invoice.grandTotal)} / ${context.l10n.totalPaid}: ${_formatCurrency(invoice.paidAmount)} / ${context.l10n.outstanding}: ${_formatCurrency(outstanding?.toDecimalString() ?? '0')} / ${invoice.status} / ${invoice.currency}',
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
        );
      }).toList(),
      onChanged: (value) => setState(() {
        _selectedInvoiceId = value;
        _submitError = null;
        _canRetrySubmit = false;
      }),
    );
  }

  Widget _buildAmountField(BuildContext context) {
    return TextFormField(
      controller: _amountController,
      decoration: InputDecoration(
        labelText: context.l10n.amount,
        border: const OutlineInputBorder(),
        prefixText: '${widget.companyCurrency} ',
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
        LengthLimitingTextInputFormatter(15),
      ],
      onChanged: (_) => setState(() {
        _submitError = null;
        _canRetrySubmit = false;
      }),
    );
  }

  Widget _buildDatePicker(BuildContext context) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _paymentDate,
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (picked != null) {
          setState(() {
            _paymentDate = picked;
            _submitError = null;
            _canRetrySubmit = false;
          });
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: context.l10n.paymentDate,
          border: const OutlineInputBorder(),
          suffixIcon: const Icon(Icons.calendar_today, size: 20),
        ),
        child: Text(
          '${_paymentDate.year.toString().padLeft(4, '0')}-${_paymentDate.month.toString().padLeft(2, '0')}-${_paymentDate.day.toString().padLeft(2, '0')}',
        ),
      ),
    );
  }

  Widget _buildMethodPicker(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: _method,
      decoration: InputDecoration(
        labelText: context.l10n.method,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      items: [
        DropdownMenuItem(
            value: 'CASH', child: Text(context.l10n.paymentMethodCash)),
        DropdownMenuItem(
            value: 'BANK_TRANSFER',
            child: Text(context.l10n.paymentMethodBankTransfer)),
        DropdownMenuItem(
            value: 'CARD', child: Text(context.l10n.paymentMethodCard)),
      ],
      onChanged: (value) {
        if (value == null) return;
        setState(() {
          _method = value;
          _selectedCashAccountId = null;
          _selectedBankAccountId = null;
          _submitError = null;
          _canRetrySubmit = false;
        });
      },
    );
  }

  Widget _buildCashAccountPicker(BuildContext context) {
    return _AccountDropdown(
      value: _selectedCashAccountId,
      labelText: context.l10n.cashAccount,
      items: _cashAccounts
          .map((account) => DropdownMenuItem<String>(
                value: account.id,
                child: Text(account.name),
              ))
          .toList(),
      onChanged: (value) => setState(() {
        _selectedCashAccountId = value;
        _submitError = null;
        _canRetrySubmit = false;
      }),
    );
  }

  Widget _buildBankAccountPicker(BuildContext context) {
    return _AccountDropdown(
      value: _selectedBankAccountId,
      labelText: context.l10n.bankAccount,
      items: _bankAccounts
          .map((account) => DropdownMenuItem<String>(
                value: account.id,
                child: Text(
                    '${account.accountName ?? account.bankName} - ${account.accountNumber}'),
              ))
          .toList(),
      onChanged: (value) => setState(() {
        _selectedBankAccountId = value;
        _submitError = null;
        _canRetrySubmit = false;
      }),
    );
  }

  String _formatCurrency(String amount) {
    final money = _parseMoney(amount);
    return CurrencyCatalog.format(
      money ?? 0,
      code: widget.companyCurrency,
    );
  }
}

class _CurrencyBanner extends StatelessWidget {
  final String currency;

  const _CurrencyBanner({required this.currency});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.monetization_on_outlined,
              size: 16, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 8),
          Text(
            currency,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
        ],
      ),
    );
  }
}

class _AccountDropdown extends StatelessWidget {
  final String? value;
  final String labelText;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _AccountDropdown({
    required this.value,
    required this.labelText,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: labelText,
        hintText: context.l10n.selectAccount,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline,
            size: 48, color: Theme.of(context).colorScheme.error),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh, size: 16),
          label: Text(context.l10n.retry),
        ),
      ],
    );
  }
}
