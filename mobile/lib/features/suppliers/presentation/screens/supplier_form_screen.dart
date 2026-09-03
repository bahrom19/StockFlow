import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';

/// Supplier create/edit form.
///
/// Editing is driven by either an already-loaded [supplier] entity or a
/// [supplierId] (loaded by id on open) — mirroring the Customer/Product/
/// Warehouse edit patterns. When only an id is provided the form shows a
/// loading state and fetches the supplier before populating the fields.
class SupplierFormScreen extends ConsumerStatefulWidget {
  final Supplier? supplier;
  final String? supplierId;

  const SupplierFormScreen({super.key, this.supplier, this.supplierId});

  @override
  ConsumerState<SupplierFormScreen> createState() => _SupplierFormScreenState();
}

class _SupplierFormScreenState extends ConsumerState<SupplierFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _binCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _websiteCtrl;
  late TextEditingController _notesCtrl;
  bool _isActive = true;
  bool _isSaving = false;
  bool _isLoading = false;
  Supplier? _existing;
  List<SupplierContact> _contacts = [];
  List<SupplierAddress> _addresses = [];

  bool get _isEditing => widget.supplier != null || widget.supplierId != null;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _binCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _websiteCtrl = TextEditingController();
    _notesCtrl = TextEditingController();

    final s = widget.supplier;
    if (s != null) {
      _fill(s);
    } else if (widget.supplierId != null) {
      _isLoading = true;
      Future.microtask(_load);
    }
  }

  Future<void> _load() async {
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.getById(widget.supplierId!);
    if (!mounted) return;
    if (result is SuppliersSuccess) {
      final supplier = (result as SuppliersSuccess<Supplier>).data;
      setState(() => _fill(supplier));
      _loadContactsAndAddresses();
    } else {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localizedErrorLabel(
            context.l10n,
            (result as SuppliersFailure).error.message,
          )),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _fill(Supplier s) {
    _existing = s;
    _nameCtrl.text = s.companyName;
    _binCtrl.text = s.bin ?? '';
    _emailCtrl.text = s.email ?? '';
    _phoneCtrl.text = s.phone ?? '';
    _websiteCtrl.text = s.website ?? '';
    _notesCtrl.text = s.notes ?? '';
    _isActive = s.isActive;
    _isLoading = false;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _binCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _websiteCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    final repo = ref.read(suppliersRepositoryProvider);

    final editingId =
        _existing?.id ?? widget.supplier?.id ?? widget.supplierId;

    SuppliersResult<Supplier> result;
    if (_isEditing && editingId != null) {
      result = await repo.update(editingId, {
        'companyName': _nameCtrl.text,
        'bin': _binCtrl.text.isNotEmpty ? _binCtrl.text : null,
        'email': _emailCtrl.text.isNotEmpty ? _emailCtrl.text : null,
        'phone': _phoneCtrl.text.isNotEmpty ? _phoneCtrl.text : null,
        'website': _websiteCtrl.text.isNotEmpty ? _websiteCtrl.text : null,
        'notes': _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
        'isActive': _isActive,
      });
    } else {
      result = await repo.create(CreateSupplierRequest(
        companyName: _nameCtrl.text,
        bin: _binCtrl.text.isNotEmpty ? _binCtrl.text : null,
        email: _emailCtrl.text.isNotEmpty ? _emailCtrl.text : null,
        phone: _phoneCtrl.text.isNotEmpty ? _phoneCtrl.text : null,
        website: _websiteCtrl.text.isNotEmpty ? _websiteCtrl.text : null,
        notes: _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
        isActive: _isActive,
      ));
    }

    setState(() => _isSaving = false);
    if (result is SuppliersSuccess && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isEditing
                ? context.l10n.supplierUpdated
                : context.l10n.supplierCreated,
          ),
        ),
      );
      context.pop();
    } else if (result is SuppliersFailure && mounted) {
      // Render-time localization: canonical ErrorHandler fallbacks get the
      // localized label (RU/KK); backend/freeform messages pass through.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localizedErrorLabel(
            context.l10n,
            (result as SuppliersFailure).error.message,
          )),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEditing ? context.l10n.editSupplier : context.l10n.newSupplier,
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.companyNameRequired,
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        v == null || v.isEmpty ? context.l10n.required : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _binCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.bin,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _emailCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.email,
                      border: const OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phoneCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.phone,
                      border: const OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _websiteCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.website,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notesCtrl,
                    decoration: InputDecoration(
                      labelText: context.l10n.notes,
                      border: const OutlineInputBorder(),
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: Text(context.l10n.statusActive),
                    value: _isActive,
                    onChanged: (v) => setState(() => _isActive = v),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _isSaving ? null : _save,
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _isEditing
                                  ? context.l10n.update
                                  : context.l10n.create,
                            ),
                    ),
                  ),
                  // G2: Contacts & Addresses sections (edit mode only)
                  if (_isEditing && _existing != null) ...[
                    const SizedBox(height: 32),
                    _buildContactsSection(),
                    const SizedBox(height: 24),
                    _buildAddressesSection(),
                  ],
                ],
              ),
            ),
    );
  }

  // ── G2: Load contacts and addresses ────────────────────────

  Future<void> _loadContactsAndAddresses() async {
    final supplierId = _existing?.id ?? widget.supplierId;
    if (supplierId == null) return;
    final repo = ref.read(suppliersRepositoryProvider);
    final contactsResult = await repo.getContacts(supplierId);
    final addressesResult = await repo.getAddresses(supplierId);
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

  // ── G2: Contacts section ───────────────────────────────────

  Widget _buildContactsSection() {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.people_outline, size: 20, color: theme.colorScheme.primary),
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
                  context.l10n.noSuppliersFound, // reuse generic empty text
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ..._contacts.map((c) => ListTile(
                dense: true,
                leading: CircleAvatar(
                  radius: 16,
                  child: Text((c.firstName ?? c.email ?? '?')[0].toUpperCase(),
                      style: const TextStyle(fontSize: 12)),
                ),
                title: Text(c.displayName),
                subtitle: Text([c.position, c.phone ?? c.email].where((e) => e != null && e.isNotEmpty).join(' · ')),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (c.isPrimary)
                      Chip(
                        label: Text(context.l10n.primaryContact, style: const TextStyle(fontSize: 10)),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                      ),
                    PopupMenuButton<String>(
                      onSelected: (v) {
                        if (v == 'edit') _showContactDialog(contact: c);
                        if (v == 'delete') _deleteContact(c);
                      },
                      itemBuilder: (_) => [
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

  // ── G2: Addresses section ──────────────────────────────────

  Widget _buildAddressesSection() {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.location_on_outlined, size: 20, color: theme.colorScheme.primary),
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
                  context.l10n.noSuppliersFound,
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ..._addresses.map((a) => ListTile(
                dense: true,
                leading: Icon(Icons.location_on, size: 20, color: theme.colorScheme.outline),
                title: Text(a.displayAddress),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (a.isDefault)
                      Chip(
                        label: Text(context.l10n.defaultAddress, style: const TextStyle(fontSize: 10)),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                      ),
                    PopupMenuButton<String>(
                      onSelected: (v) {
                        if (v == 'edit') _showAddressDialog(address: a);
                        if (v == 'delete') _deleteAddress(a);
                      },
                      itemBuilder: (_) => [
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

  // ── G2: Contact dialog ─────────────────────────────────────

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
          title: Text(contact == null ? context.l10n.newContact : context.l10n.edit),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: firstNameCtrl, decoration: InputDecoration(labelText: context.l10n.firstName)),
                const SizedBox(height: 8),
                TextField(controller: lastNameCtrl, decoration: InputDecoration(labelText: context.l10n.lastName)),
                const SizedBox(height: 8),
                TextField(controller: phoneCtrl, decoration: InputDecoration(labelText: context.l10n.phone), keyboardType: TextInputType.phone),
                const SizedBox(height: 8),
                TextField(controller: emailCtrl, decoration: InputDecoration(labelText: context.l10n.email), keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 8),
                TextField(controller: positionCtrl, decoration: InputDecoration(labelText: context.l10n.position)),
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
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.l10n.cancel)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(context.l10n.save)),
          ],
        ),
      ),
    );

    if (result != true || !mounted) return;
    final supplierId = _existing?.id ?? widget.supplierId;
    if (supplierId == null) return;
    final repo = ref.read(suppliersRepositoryProvider);

    if (contact == null) {
      await repo.createContact(supplierId, CreateSupplierContactRequest(
        firstName: firstNameCtrl.text.isNotEmpty ? firstNameCtrl.text : null,
        lastName: lastNameCtrl.text.isNotEmpty ? lastNameCtrl.text : null,
        phone: phoneCtrl.text.isNotEmpty ? phoneCtrl.text : null,
        email: emailCtrl.text.isNotEmpty ? emailCtrl.text : null,
        position: positionCtrl.text.isNotEmpty ? positionCtrl.text : null,
        isPrimary: isPrimary,
      ));
    } else {
      await repo.updateContact(supplierId, contact.id, {
        'firstName': firstNameCtrl.text.isNotEmpty ? firstNameCtrl.text : null,
        'lastName': lastNameCtrl.text.isNotEmpty ? lastNameCtrl.text : null,
        'phone': phoneCtrl.text.isNotEmpty ? phoneCtrl.text : null,
        'email': emailCtrl.text.isNotEmpty ? emailCtrl.text : null,
        'position': positionCtrl.text.isNotEmpty ? positionCtrl.text : null,
        'isPrimary': isPrimary,
      });
    }
    _loadContactsAndAddresses();
  }

  Future<void> _deleteContact(SupplierContact contact) async {
    final supplierId = _existing?.id ?? widget.supplierId;
    if (supplierId == null) return;
    final repo = ref.read(suppliersRepositoryProvider);
    await repo.deleteContact(supplierId, contact.id);
    _loadContactsAndAddresses();
  }

  // ── G2: Address dialog ─────────────────────────────────────

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
          title: Text(address == null ? context.l10n.newAddress : context.l10n.edit),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: streetCtrl, decoration: InputDecoration(labelText: context.l10n.address)),
                const SizedBox(height: 8),
                TextField(controller: cityCtrl, decoration: InputDecoration(labelText: context.l10n.city)),
                const SizedBox(height: 8),
                TextField(controller: countryCtrl, decoration: InputDecoration(labelText: context.l10n.country)),
                const SizedBox(height: 8),
                TextField(controller: postalCtrl, decoration: InputDecoration(labelText: context.l10n.postalCode)),
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
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.l10n.cancel)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(context.l10n.save)),
          ],
        ),
      ),
    );

    if (result != true || !mounted) return;
    final supplierId = _existing?.id ?? widget.supplierId;
    if (supplierId == null) return;
    final repo = ref.read(suppliersRepositoryProvider);

    if (address == null) {
      await repo.createAddress(supplierId, CreateSupplierAddressRequest(
        city: cityCtrl.text.isNotEmpty ? cityCtrl.text : null,
        country: countryCtrl.text.isNotEmpty ? countryCtrl.text : null,
        street: streetCtrl.text.isNotEmpty ? streetCtrl.text : null,
        postalCode: postalCtrl.text.isNotEmpty ? postalCtrl.text : null,
        isDefault: isDefault,
      ));
    } else {
      await repo.updateAddress(supplierId, address.id, {
        'city': cityCtrl.text.isNotEmpty ? cityCtrl.text : null,
        'country': countryCtrl.text.isNotEmpty ? countryCtrl.text : null,
        'street': streetCtrl.text.isNotEmpty ? streetCtrl.text : null,
        'postalCode': postalCtrl.text.isNotEmpty ? postalCtrl.text : null,
        'isDefault': isDefault,
      });
    }
    _loadContactsAndAddresses();
  }

  Future<void> _deleteAddress(SupplierAddress address) async {
    final supplierId = _existing?.id ?? widget.supplierId;
    if (supplierId == null) return;
    final repo = ref.read(suppliersRepositoryProvider);
    await repo.deleteAddress(supplierId, address.id);
    _loadContactsAndAddresses();
  }
}
