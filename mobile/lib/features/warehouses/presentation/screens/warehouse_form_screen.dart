import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

/// Warehouse create/edit form.
class WarehouseFormScreen extends ConsumerStatefulWidget {
  final String? warehouseId;

  const WarehouseFormScreen({super.key, this.warehouseId});

  @override
  ConsumerState<WarehouseFormScreen> createState() => _WarehouseFormScreenState();
}

class _WarehouseFormScreenState extends ConsumerState<WarehouseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _codeCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _managerCtrl;
  bool _isDefault = false;
  bool _isLoading = false;
  bool _isSaving = false;
  Warehouse? _existing;

  bool get _isEditing => widget.warehouseId != null;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _codeCtrl = TextEditingController();
    _addressCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _managerCtrl = TextEditingController();
    if (_isEditing) {
      _isLoading = true;
      Future.microtask(_load);
    }
  }

  Future<void> _load() async {
    final repo = ref.read(warehouseListProvider.notifier);
    final current = ref.read(warehouseListProvider);
    if (current is WarehouseListLoaded) {
      final match = current.warehouses
          .where((w) => w.id == widget.warehouseId)
          .toList();
      if (match.isNotEmpty) {
        _fill(match.first);
        return;
      }
    }
    // Fall back to repository lookup.
    final invRepo = ref.read(inventoryRepositoryProvider);
    final result = await invRepo.getWarehouseById(widget.warehouseId!);
    if (result is InvSuccess && (result as InvSuccess<Warehouse>).data.id.isNotEmpty) {
      _fill((result as InvSuccess<Warehouse>).data);
    }
  }

  void _fill(Warehouse w) {
    if (!mounted) return;
    setState(() {
      _existing = w;
      _nameCtrl.text = w.name;
      _codeCtrl.text = w.code;
      _addressCtrl.text = w.address ?? '';
      _phoneCtrl.text = w.phone ?? '';
      _managerCtrl.text = w.managerName ?? '';
      _isDefault = w.isDefault;
      _isLoading = false;
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final notifier = ref.read(warehouseListProvider.notifier);
    final ok = _isEditing
        ? await notifier.update(
            widget.warehouseId!,
            UpdateWarehouseRequest(
              name: _nameCtrl.text,
              code: _codeCtrl.text,
              address: _addressCtrl.text.isNotEmpty ? _addressCtrl.text : null,
              phone: _phoneCtrl.text.isNotEmpty ? _phoneCtrl.text : null,
              managerName:
                  _managerCtrl.text.isNotEmpty ? _managerCtrl.text : null,
              isDefault: _isDefault,
              rowVersion: _existing?.rowVersion ?? 0,
            ),
          )
        : await notifier.create(
            CreateWarehouseRequest(
              name: _nameCtrl.text,
              code: _codeCtrl.text,
              address: _addressCtrl.text.isNotEmpty ? _addressCtrl.text : null,
              phone: _phoneCtrl.text.isNotEmpty ? _phoneCtrl.text : null,
              managerName:
                  _managerCtrl.text.isNotEmpty ? _managerCtrl.text : null,
              isDefault: _isDefault,
            ),
          );

    if (!mounted) return;
    setState(() => _isSaving = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isEditing ? 'Warehouse updated' : 'Warehouse created')),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEditing ? 'Update failed' : 'Create failed'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _managerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Edit Warehouse' : 'New Warehouse')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : Form(
              key: _formKey,
              child: ListView(
                padding: AppSpacing.screenPadding,
                children: [
                  _field(_nameCtrl, 'Warehouse Name *',
                      hint: 'e.g. Main Store', required: true),
                  const SizedBox(height: AppSpacing.sm),
                  _field(_codeCtrl, 'Code *', hint: 'e.g. MAIN',
                      required: true),
                  const SizedBox(height: AppSpacing.sm),
                  _field(_addressCtrl, 'Address'),
                  const SizedBox(height: AppSpacing.sm),
                  _field(_phoneCtrl, 'Phone'),
                  const SizedBox(height: AppSpacing.sm),
                  _field(_managerCtrl, 'Manager Name'),
                  const SizedBox(height: AppSpacing.sm),
                  SwitchListTile(
                    title: const Text('Default warehouse'),
                    subtitle: const Text(
                        'New stock will be assigned to this warehouse'),
                    value: _isDefault,
                    onChanged: (v) => setState(() => _isDefault = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton(
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
                        : Text(_isEditing ? 'Save Changes' : 'Create Warehouse'),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? hint,
    bool required = false,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null,
    );
  }
}

