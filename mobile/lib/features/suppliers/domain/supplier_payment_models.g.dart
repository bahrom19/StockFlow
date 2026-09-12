// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier_payment_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SupplierPaymentImpl _$$SupplierPaymentImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierPaymentImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      supplierId: json['supplierId'] as String,
      purchaseInvoiceId: json['purchaseInvoiceId'] as String,
      paymentNumber: json['paymentNumber'] as String,
      paymentDate: DateTime.parse(json['paymentDate'] as String),
      amount: json['amount'] as String,
      method: json['method'] as String,
      cashAccountId: json['cashAccountId'] as String?,
      bankAccountId: json['bankAccountId'] as String?,
      currency: json['currency'] as String,
      reference: json['reference'] as String?,
      notes: json['notes'] as String?,
      createdBy: json['createdBy'] as String?,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
    );

Map<String, dynamic> _$$SupplierPaymentImplToJson(
        _$SupplierPaymentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'supplierId': instance.supplierId,
      'purchaseInvoiceId': instance.purchaseInvoiceId,
      'paymentNumber': instance.paymentNumber,
      'paymentDate': instance.paymentDate.toIso8601String(),
      'amount': instance.amount,
      'method': instance.method,
      'cashAccountId': instance.cashAccountId,
      'bankAccountId': instance.bankAccountId,
      'currency': instance.currency,
      'reference': instance.reference,
      'notes': instance.notes,
      'createdBy': instance.createdBy,
      'rowVersion': instance.rowVersion,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
    };

_$SupplierPaymentListResponseImpl _$$SupplierPaymentListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierPaymentListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => SupplierPayment.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$SupplierPaymentListResponseImplToJson(
        _$SupplierPaymentListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CreateSupplierPaymentRequestImpl _$$CreateSupplierPaymentRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateSupplierPaymentRequestImpl(
      purchaseInvoiceId: json['purchaseInvoiceId'] as String,
      amount: (json['amount'] as num).toDouble(),
      method: json['method'] as String,
      cashAccountId: json['cashAccountId'] as String?,
      bankAccountId: json['bankAccountId'] as String?,
      currency: json['currency'] as String?,
      paymentDate: json['paymentDate'] as String?,
      reference: json['reference'] as String?,
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CreateSupplierPaymentRequestImplToJson(
        _$CreateSupplierPaymentRequestImpl instance) =>
    <String, dynamic>{
      'purchaseInvoiceId': instance.purchaseInvoiceId,
      'amount': instance.amount,
      'method': instance.method,
      'cashAccountId': instance.cashAccountId,
      'bankAccountId': instance.bankAccountId,
      'currency': instance.currency,
      'paymentDate': instance.paymentDate,
      'reference': instance.reference,
      'notes': instance.notes,
    };

_$SupplierFinanceSummaryImpl _$$SupplierFinanceSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierFinanceSummaryImpl(
      supplierId: json['supplierId'] as String,
      totalInvoiced: json['totalInvoiced'] as String,
      totalPaid: json['totalPaid'] as String,
      totalReturned: json['totalReturned'] as String,
      outstanding: json['outstanding'] as String,
      invoiceCount: (json['invoiceCount'] as num).toInt(),
      paymentCount: (json['paymentCount'] as num).toInt(),
      lastPaymentDate: json['lastPaymentDate'] == null
          ? null
          : DateTime.parse(json['lastPaymentDate'] as String),
      lastPaymentAmount: json['lastPaymentAmount'] as String?,
    );

Map<String, dynamic> _$$SupplierFinanceSummaryImplToJson(
        _$SupplierFinanceSummaryImpl instance) =>
    <String, dynamic>{
      'supplierId': instance.supplierId,
      'totalInvoiced': instance.totalInvoiced,
      'totalPaid': instance.totalPaid,
      'totalReturned': instance.totalReturned,
      'outstanding': instance.outstanding,
      'invoiceCount': instance.invoiceCount,
      'paymentCount': instance.paymentCount,
      'lastPaymentDate': instance.lastPaymentDate?.toIso8601String(),
      'lastPaymentAmount': instance.lastPaymentAmount,
    };

_$SupplierInvoiceLiteImpl _$$SupplierInvoiceLiteImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierInvoiceLiteImpl(
      id: json['id'] as String,
      invoiceNumber: json['invoiceNumber'] as String,
      grandTotal: json['grandTotal'] as String,
      paidAmount: json['paidAmount'] as String,
      status: json['status'] as String,
      currency: json['currency'] as String,
      dueDate: json['dueDate'] == null
          ? null
          : DateTime.parse(json['dueDate'] as String),
    );

Map<String, dynamic> _$$SupplierInvoiceLiteImplToJson(
        _$SupplierInvoiceLiteImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'invoiceNumber': instance.invoiceNumber,
      'grandTotal': instance.grandTotal,
      'paidAmount': instance.paidAmount,
      'status': instance.status,
      'currency': instance.currency,
      'dueDate': instance.dueDate?.toIso8601String(),
    };

_$CashAccountLiteImpl _$$CashAccountLiteImplFromJson(
        Map<String, dynamic> json) =>
    _$CashAccountLiteImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      currency: json['currency'] as String,
      type: json['type'] as String?,
    );

Map<String, dynamic> _$$CashAccountLiteImplToJson(
        _$CashAccountLiteImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'currency': instance.currency,
      'type': instance.type,
    };

_$BankAccountLiteImpl _$$BankAccountLiteImplFromJson(
        Map<String, dynamic> json) =>
    _$BankAccountLiteImpl(
      id: json['id'] as String,
      bankName: json['bankName'] as String,
      accountNumber: json['accountNumber'] as String,
      accountName: json['accountName'] as String?,
      currency: json['currency'] as String,
    );

Map<String, dynamic> _$$BankAccountLiteImplToJson(
        _$BankAccountLiteImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'bankName': instance.bankName,
      'accountNumber': instance.accountNumber,
      'accountName': instance.accountName,
      'currency': instance.currency,
    };
