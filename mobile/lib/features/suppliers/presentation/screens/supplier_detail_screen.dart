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
    ]);

    final supplierResult = results[0] as SuppliersResult<Supplier>;
    final contactsResult = results[1] as SuppliersResult<List<SupplierContact>>;
    final addressesResult = results[2] as SuppliersResult<List<SupplierAddress>>;

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
      _isLoading = false;
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
