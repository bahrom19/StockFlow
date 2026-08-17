import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

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
                ],
              ),
            ),
    );
  }
}
