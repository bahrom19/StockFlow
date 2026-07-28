import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

class SupplierFormScreen extends ConsumerStatefulWidget {
  final Supplier? supplier;
  const SupplierFormScreen({super.key, this.supplier});
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

  @override
  void initState() {
    super.initState();
    final s = widget.supplier;
    _nameCtrl = TextEditingController(text: s?.companyName ?? '');
    _binCtrl = TextEditingController(text: s?.bin ?? '');
    _emailCtrl = TextEditingController(text: s?.email ?? '');
    _phoneCtrl = TextEditingController(text: s?.phone ?? '');
    _websiteCtrl = TextEditingController(text: s?.website ?? '');
    _notesCtrl = TextEditingController(text: s?.notes ?? '');
    _isActive = s?.isActive ?? true;
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

  bool get _isEditing => widget.supplier != null;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    final repo = ref.read(suppliersRepositoryProvider);

    SuppliersResult<Supplier> result;
    if (_isEditing) {
      result = await repo.update(widget.supplier!.id, {
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
        SnackBar(content: Text(_isEditing ? 'Supplier updated' : 'Supplier created')),
      );
      context.pop();
    } else if (result is SuppliersFailure && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text((result as SuppliersFailure).error.message), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Edit Supplier' : 'New Supplier')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Company Name *', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _binCtrl, decoration: const InputDecoration(labelText: 'BIN', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
              keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextFormField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
              keyboardType: TextInputType.phone),
            const SizedBox(height: 12),
            TextFormField(controller: _websiteCtrl, decoration: const InputDecoration(labelText: 'Website', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextFormField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()),
              maxLines: 3),
            const SizedBox(height: 16),
            SwitchListTile(title: const Text('Active'), value: _isActive, onChanged: (v) => setState(() => _isActive = v)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(_isEditing ? 'Update' : 'Create'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
