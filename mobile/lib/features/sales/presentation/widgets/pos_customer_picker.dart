import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/features/customers/data/customers_repository.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';

/// Opens a customer picker dialog.
///
/// Returns the selected [Customer], or the newly created customer when the
/// cashier uses the inline "New customer" form. Returns `null` on cancel.
Future<Customer?> showPosCustomerPicker(BuildContext context) {
  return showDialog<Customer>(
    context: context,
    barrierDismissible: true,
    builder: (_) => const _PosCustomerPickerDialog(),
  );
}

class _PosCustomerPickerDialog extends ConsumerStatefulWidget {
  const _PosCustomerPickerDialog();

  @override
  ConsumerState<_PosCustomerPickerDialog> createState() =>
      _PosCustomerPickerDialogState();
}

class _PosCustomerPickerDialogState
    extends ConsumerState<_PosCustomerPickerDialog> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<Customer> _customers = [];
  bool _isLoading = false;
  bool _isCreateMode = false;
  String? _error;

  // Create form controllers
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _isCreating = false;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _fetch(query);
    });
  }

  Future<void> _fetch(String query) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final repo = ref.read(customersRepositoryProvider);
    final result = await repo.list(
      search: query.trim().isEmpty ? null : query.trim(),
      limit: 20,
    );
    if (!mounted) return;
    if (result is CustomersSuccess<CustomerListResponse>) {
      setState(() {
        _customers = result.data.items;
        _isLoading = false;
      });
    } else {
      setState(() {
        _error = (result as CustomersFailure).error.message;
        _isLoading = false;
      });
    }
  }

  Future<void> _createCustomer() async {
    if (_firstNameCtrl.text.trim().isEmpty &&
        _lastNameCtrl.text.trim().isEmpty &&
        _phoneCtrl.text.trim().isEmpty) {
      setState(() => _error = context.l10n.posCustomerNameOrPhone);
      return;
    }
    setState(() {
      _isCreating = true;
      _error = null;
    });
    final repo = ref.read(customersRepositoryProvider);
    final result = await repo.create(CreateCustomerRequest(
      type: 'PERSON',
      firstName: _firstNameCtrl.text.trim().isNotEmpty
          ? _firstNameCtrl.text.trim()
          : null,
      lastName:
          _lastNameCtrl.text.trim().isNotEmpty ? _lastNameCtrl.text.trim() : null,
      phone: _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : null,
      email: _emailCtrl.text.trim().isNotEmpty ? _emailCtrl.text.trim() : null,
      isActive: true,
    ));
    if (!mounted) return;
    if (result is CustomersSuccess<Customer>) {
      Navigator.of(context).pop(result.data);
    } else {
      setState(() {
        _error = (result as CustomersFailure).error.message;
        _isCreating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.people_outline, size: 22),
          const SizedBox(width: AppSpacing.xs),
          Text(_isCreateMode
              ? context.l10n.posNewCustomer
              : context.l10n.posSelectCustomer),
        ],
      ),
      content: SizedBox(
        width: 420,
        height: _isCreateMode ? 340 : 400,
        child: _isCreateMode ? _buildCreateForm(theme) : _buildSearchList(theme),
      ),
      actions: [
        if (!_isCreateMode)
          TextButton.icon(
            onPressed: () => setState(() => _isCreateMode = true),
            icon: const Icon(Icons.person_add_alt, size: 18),
            label: Text(context.l10n.posNewCustomer),
          ),
        if (_isCreateMode)
          TextButton(
            onPressed: () => setState(() => _isCreateMode = false),
            child: Text(context.l10n.posBackToSearch),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(context.l10n.cancel),
        ),
      ],
    );
  }

  Widget _buildSearchList(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _searchController,
          autofocus: true,
          decoration: InputDecoration(
            hintText: context.l10n.posCustomerSearchHint,
            prefixIcon: const Icon(Icons.search, size: 20),
            suffixIcon: _isLoading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
            isDense: true,
            filled: true,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              borderSide: BorderSide.none,
            ),
          ),
          onChanged: _search,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Text(_error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error)),
          ),
        Expanded(
          child: _customers.isEmpty
              ? Center(
                  child: Text(
                    _isLoading
                        ? context.l10n.posSearching
                        : context.l10n.posNoCustomersFound,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                )
              : ListView.builder(
                  itemCount: _customers.length,
                  itemBuilder: (context, index) {
                    final c = _customers[index];
                    return ListTile(
                      dense: true,
                      leading: CircleAvatar(
                        radius: 16,
                        backgroundColor: theme.colorScheme.primaryContainer,
                        child: Text(
                          c.displayName.substring(0, 1).toUpperCase(),
                          style: theme.textTheme.labelMedium,
                        ),
                      ),
                      title: Text(c.displayName,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(
                        c.phoneOrMobile.isNotEmpty
                            ? c.phoneOrMobile
                            : (c.email ?? ''),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => Navigator.of(context).pop(c),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildCreateForm(ThemeData theme) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _firstNameCtrl,
            autofocus: true,
            decoration: InputDecoration(
              labelText: context.l10n.posFirstName,
              isDense: true,
              filled: true,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _lastNameCtrl,
            decoration: InputDecoration(
              labelText: context.l10n.posLastName,
              isDense: true,
              filled: true,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: context.l10n.phone,
              isDense: true,
              filled: true,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: context.l10n.posEmailOptional,
              isDense: true,
              filled: true,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error)),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: _isCreating ? null : _createCustomer,
            icon: _isCreating
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check, size: 18),
            label: Text(_isCreating
                ? context.l10n.posCreating
                : context.l10n.posCreateAndSelect),
          ),
        ],
      ),
    );
  }
}
