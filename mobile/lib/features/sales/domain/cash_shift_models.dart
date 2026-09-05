/// Cash Shift domain models — mirrors the backend `CashShiftEntity`.
///
/// Backend contract (all amounts are DECIMAL strings):
///  - POST  /sales/cash-shifts/open        { warehouseId, openingBalance, notes? }
///  - POST  /sales/cash-shifts/close       ?warehouseId= { actualClosingBalance?, notes? }
///  - POST  /sales/cash-shifts/cash-in     ?warehouseId= { amount, reason? }
///  - POST  /sales/cash-shifts/cash-out    ?warehouseId= { amount, reason? }
///  - GET   /sales/cash-shifts/x-report    ?warehouseId=
///  - GET   /sales/cash-shifts/z-report/:id
///  - GET   /sales/cash-shifts             (paginated list)
class CashShift {
  final String id;
  final String companyId;
  final String warehouseId;
  final String cashierId;
  final String status; // OPEN | CLOSED
  final String currency;
  final DateTime openedAt;
  final DateTime? closedAt;
  final String openingBalance;
  final String closingBalance;
  final String cashSales;
  final String cardSales;
  final String qrSales;
  final String bankTransferSales;
  final String mobileWalletSales;
  final String totalSales;
  final String cashIn;
  final String cashOut;
  final String expectedClosing;
  final String difference;
  final String? notes;
  final int rowVersion;

  const CashShift({
    required this.id,
    required this.companyId,
    required this.warehouseId,
    required this.cashierId,
    required this.status,
    this.currency = 'KZT',
    required this.openedAt,
    this.closedAt,
    this.openingBalance = '0.0000',
    this.closingBalance = '0.0000',
    this.cashSales = '0.0000',
    this.cardSales = '0.0000',
    this.qrSales = '0.0000',
    this.bankTransferSales = '0.0000',
    this.mobileWalletSales = '0.0000',
    this.totalSales = '0.0000',
    this.cashIn = '0.0000',
    this.cashOut = '0.0000',
    this.expectedClosing = '0.0000',
    this.difference = '0.0000',
    this.notes,
    this.rowVersion = 0,
  });

  factory CashShift.fromJson(Map<String, dynamic> json) {
    DateTime parse(String? v) =>
        DateTime.tryParse(v ?? '') ?? DateTime.now();
    return CashShift(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      warehouseId: json['warehouseId'] as String,
      cashierId: json['cashierId'] as String,
      status: (json['status'] as String?) ?? 'OPEN',
      currency: (json['currency'] as String?) ?? 'KZT',
      openedAt: parse(json['openedAt'] as String?),
      closedAt: json['closedAt'] != null
          ? parse(json['closedAt'] as String?)
          : null,
      openingBalance: _str(json['openingBalance']),
      closingBalance: _str(json['closingBalance']),
      cashSales: _str(json['cashSales']),
      cardSales: _str(json['cardSales']),
      qrSales: _str(json['qrSales']),
      bankTransferSales: _str(json['bankTransferSales']),
      mobileWalletSales: _str(json['mobileWalletSales']),
      totalSales: _str(json['totalSales']),
      cashIn: _str(json['cashIn']),
      cashOut: _str(json['cashOut']),
      expectedClosing: _str(json['expectedClosing']),
      difference: _str(json['difference']),
      notes: json['notes'] as String?,
      rowVersion: (json['rowVersion'] as int?) ?? 0,
    );
  }

  static String _str(dynamic v) => v?.toString() ?? '0.0000';

  double get openingBalanceValue => double.tryParse(openingBalance) ?? 0;
  double get closingBalanceValue => double.tryParse(closingBalance) ?? 0;
  double get cashSalesValue => double.tryParse(cashSales) ?? 0;
  double get cardSalesValue => double.tryParse(cardSales) ?? 0;
  double get qrSalesValue => double.tryParse(qrSales) ?? 0;
  double get bankTransferSalesValue => double.tryParse(bankTransferSales) ?? 0;
  double get mobileWalletSalesValue =>
      double.tryParse(mobileWalletSales) ?? 0;
  double get totalSalesValue => double.tryParse(totalSales) ?? 0;

  /// Sum of the five per-method buckets (invariant: == totalSales).
  double get methodsSum =>
      cashSalesValue +
      cardSalesValue +
      qrSalesValue +
      bankTransferSalesValue +
      mobileWalletSalesValue;
  double get cashInValue => double.tryParse(cashIn) ?? 0;
  double get cashOutValue => double.tryParse(cashOut) ?? 0;
  double get expectedClosingValue => double.tryParse(expectedClosing) ?? 0;
  double get differenceValue => double.tryParse(difference) ?? 0;

  bool get isOpen => status == 'OPEN';
}

/// POST /sales/cash-shifts/open
class OpenShiftRequest {
  final String warehouseId;
  final double openingBalance;
  final String? notes;

  final String currency;

  const OpenShiftRequest({
    required this.warehouseId,
    required this.openingBalance,
    this.notes,
    this.currency = 'KZT',
  });

  Map<String, dynamic> toJson() => {
        'warehouseId': warehouseId,
        'openingBalance': openingBalance,
        'currency': currency,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

/// POST /sales/cash-shifts/close
class CloseShiftRequest {
  final double? actualClosingBalance;
  final String? notes;

  const CloseShiftRequest({this.actualClosingBalance, this.notes});

  Map<String, dynamic> toJson() => {
        if (actualClosingBalance != null)
          'actualClosingBalance': actualClosingBalance,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

/// POST /sales/cash-shifts/cash-in | cash-out
class CashInOutRequest {
  final double amount;
  final String? reason;

  const CashInOutRequest({required this.amount, this.reason});

  Map<String, dynamic> toJson() => {
        'amount': amount,
        if (reason != null && reason!.isNotEmpty) 'reason': reason,
      };
}

/// Paginated response of GET /sales/cash-shifts
class CashShiftListResponse {
  final List<CashShift> items;
  final int total;
  final int page;
  final int limit;

  const CashShiftListResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory CashShiftListResponse.fromJson(Map<String, dynamic> json) {
    final raw = json['items'] as List<dynamic>? ?? const [];
    return CashShiftListResponse(
      items: raw
          .map((e) => CashShift.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as int?) ?? raw.length,
      page: (json['page'] as int?) ?? 1,
      limit: (json['limit'] as int?) ?? 20,
    );
  }
}
