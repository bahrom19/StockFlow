import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/features/customers/data/customers_repository.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';

/// Customer create/edit form (Person or Company).
class CustomerFormScreen extends ConsumerStatefulWidget {
  final String? customerId;
  final Customer? customer;

  const CustomerFormScreen({super.key, this.customerId, this.customer});

  @override
  ConsumerState<CustomerFormScreen> createState() => _CustomerFormScreenState();
}

class _CustomerFormScreenState extends ConsumerState<CustomerFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _companyCtrl;
  late final TextEditingController _firstCtrl;
  late final TextEditingController _lastCtrl;
  late final TextEditingController _iinCtrl;
  late final TextEditingController _binCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _notesCtrl;
  CustomerType _type = CustomerType.person;
  bool _isActive = true;
  bool _isSaving = false;
  bool _isLoading = false;
  Customer? _existing;

  bool get _isEditing => widget.customerId != null || widget.customer != null;

  @override
  void initState() {
    super.initState();
    _companyCtrl = TextEditingController();
    _firstCtrl = TextEditingController();
    _lastCtrl = TextEditingController();
    _iinCtrl = TextEditingController();
    _binCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _notesCtrl = TextEditingController();

    final c = widget.customer;
    if (c != null) {
      _fill(c);
    } else if (widget.customerId != null) {
      _isLoading = true;
      Future.microtask(_load);
    }
  }

  Future<void> _load() async {
    final repo = ref.read(customersRepositoryProvider);
    final result = await repo.getById(widget.customerId!);
    if (!mounted) return;
    if (result is CustomersSuccess) {
      final customer = (result as CustomersSuccess<Customer>).data;
      setState(() => _fill(customer));
    } else {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text((result as CustomersFailure).error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  void _fill(Customer c) {
    _existing = c;
    _companyCtrl.text = c.companyName ?? '';
    _firstCtrl.text = c.firstName ?? '';
    _lastCtrl.text = c.lastName ?? '';
    _iinCtrl.text = c.iin ?? '';
    _binCtrl.text = c.bin ?? '';
    _emailCtrl.text = c.email ?? '';
    _phoneCtrl.text = c.phone ?? '';
    _notesCtrl.text = c.notes ?? '';
    _type = CustomerType.fromApi(c.type);
    _isActive = c.isActive;
    _isLoading = false;
  }

  @override
  void dispose() {
    _companyCtrl.dispose();
    _firstCtrl.dispose();
    _lastCtrl.dispose();
    _iinCtrl.dispose();
    _binCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    final repo = ref.read(customersRepositoryProvider);

    final base = {
      'type': _type == CustomerType.company ? 'COMPANY' : 'PERSON',
      'firstName': _firstCtrl.text.trim().isNotEmpty ? _firstCtrl.text.trim() : null,
      'lastName': _lastCtrl.text.trim().isNotEmpty ? _lastCtrl.text.trim() : null,
      'companyName': _companyCtrl.text.trim().isNotEmpty ? _companyCtrl.text.trim() : null,
      'iin': _iinCtrl.text.trim().isNotEmpty ? _iinCtrl.text.trim() : null,
      'bin': _binCtrl.text.trim().isNotEmpty ? _binCtrl.text.trim() : null,
      'email': _emailCtrl.text.trim().isNotEmpty ? _emailCtrl.text.trim() : null,
      'phone': _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : null,
      'notes': _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : null,
      'isActive': _isActive,
    };

    final editingId =
        _existing?.id ?? widget.customer?.id ?? widget.customerId;

    CustomersResult<Customer> result;
    if (_isEditing && editingId != null) {
      result = await repo.update(editingId, base);
    } else {
      result = await repo.create(CreateCustomerRequest(
        type: base['type']! as String,
        firstName: base['firstName'] as String?,
        lastName: base['lastName'] as String?,
        companyName: base['companyName'] as String?,
        iin: base['iin'] as String?,
        bin: base['bin'] as String?,
        email: base['email'] as String?,
        phone: base['phone'] as String?,
        notes: base['notes'] as String?,
        isActive: _isActive,
      ));
    }

    setState(() => _isSaving = false);
    if (!mounted) return;
    if (result is CustomersSuccess) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isEditing ? 'Customer updated' : 'Customer created')),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text((result as CustomersFailure).error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Edit Customer' : 'New Customer')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screenPadding,
          children: [
            SegmentedButton<CustomerType>(
              segments: const [
                ButtonSegment(
                  value: CustomerType.person,
                  label: Text('Person'),
                  icon: Icon(Icons.person_outline, size: 18),
                ),
                ButtonSegment(
                  value: CustomerType.company,
                  label: Text('Company'),
                  icon: Icon(Icons.business_outlined, size: 18),
                ),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() => _type = s.first),
            ),
            const SizedBox(height: AppSpacing.md),
            if (_type == CustomerType.company) ...[
              _field(_companyCtrl, 'Company Name',
                  required: true, autofocus: true),
              const SizedBox(height: AppSpacing.sm),
              _field(_binCtrl, 'BIN'),
            ] else ...[
              _field(_firstCtrl, 'First Name', autofocus: true),
              const SizedBox(height: AppSpacing.sm),
              _field(_lastCtrl, 'Last Name'),
              const SizedBox(height: AppSpacing.sm),
              _field(_iinCtrl, 'IIN'),
            ],
            const SizedBox(height: AppSpacing.sm),
            _field(_phoneCtrl, 'Phone', keyboardType: TextInputType.phone),
            const SizedBox(height: AppSpacing.sm),
            _field(_emailCtrl, 'Email', keyboardType: TextInputType.emailAddress),
            const SizedBox(height: AppSpacing.sm),
            _field(_notesCtrl, 'Notes', maxLines: 3),
            const SizedBox(height: AppSpacing.sm),
            SwitchListTile(
              title: const Text('Active'),
              contentPadding: EdgeInsets.zero,
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
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
                  : Text(_isEditing ? 'Save Changes' : 'Create Customer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    bool autofocus = false,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      autofocus: autofocus,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null,
    );
  }
}
