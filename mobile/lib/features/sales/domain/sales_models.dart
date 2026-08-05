import 'package:freezed_annotation/freezed_annotation.dart';

part 'sales_models.freezed.dart';
part 'sales_models.g.dart';

// ──────────────────────────────────
// Enums
// ──────────────────────────────────
enum SaleStatus {
  @JsonValue('DRAFT')
  draft,
  @JsonValue('PENDING')
  pending,
  @JsonValue('COMPLETED')
  completed,
  @JsonValue('REFUNDED')
  refunded,
  @JsonValue('CANCELLED')
  cancelled,
  @JsonValue('PARTIALLY_REFUNDED')
  partiallyRefunded;

  String get label {
    switch (this) {
      case SaleStatus.draft:
        return 'Draft';
      case SaleStatus.pending:
        return 'Pending';
      case SaleStatus.completed:
        return 'Completed';
      case SaleStatus.refunded:
        return 'Refunded';
      case SaleStatus.cancelled:
        return 'Cancelled';
      case SaleStatus.partiallyRefunded:
        return 'Partially Refunded';
    }
  }
}

enum PaymentMethodType {
  @JsonValue('CASH')
  cash,
  @JsonValue('CARD')
  card,
  @JsonValue('QR')
  qr,
  @JsonValue('BANK_TRANSFER')
  bankTransfer,
  @JsonValue('MOBILE_WALLET')
  mobileWallet,
  @JsonValue('GIFT_CARD')
  giftCard,
  @JsonValue('STORE_CREDIT')
  storeCredit;

  String get label {
    switch (this) {
      case PaymentMethodType.cash:
        return 'Cash';
      case PaymentMethodType.card:
        return 'Card';
      case PaymentMethodType.qr:
        return 'QR';
      case PaymentMethodType.bankTransfer:
        return 'Bank Transfer';
      case PaymentMethodType.mobileWallet:
        return 'Mobile Wallet';
      case PaymentMethodType.giftCard:
        return 'Gift Card';
      case PaymentMethodType.storeCredit:
        return 'Store Credit';
    }
  }

  /// Wire value used by the API.
  String get wire => switch (this) {
        PaymentMethodType.cash => 'CASH',
        PaymentMethodType.card => 'CARD',
        PaymentMethodType.qr => 'QR',
        PaymentMethodType.bankTransfer => 'BANK_TRANSFER',
        PaymentMethodType.mobileWallet => 'MOBILE_WALLET',
        PaymentMethodType.giftCard => 'GIFT_CARD',
        PaymentMethodType.storeCredit => 'STORE_CREDIT',
      };
}

// ──────────────────────────────────
// Sale Entity (matches SaleEntity from backend)
// ──────────────────────────────────
@freezed
class Sale with _$Sale {
  const factory Sale({
    required String id,
    required String companyId,
    required String warehouseId,
    required String cashierId,
    String? customerId,
    required String saleNumber,
    required String status,
    required String subtotal,
    required String discount,
    required String tax,
    required String total,
    required String paidAmount,
    required String changeAmount,
    required String currency,
    String? notes,
    @Default(0) int rowVersion,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
    @Default([]) List<SaleItem> items,
    @Default([]) List<Payment> payments,
    @Default([]) List<Receipt> receipts,
  }) = _Sale;

  factory Sale.fromJson(Map<String, dynamic> json) => _$SaleFromJson(json);
}

// ──────────────────────────────────
// Sale Item (matches SaleItemEntity)
// ──────────────────────────────────
@freezed
class SaleItem with _$SaleItem {
  const factory SaleItem({
    required String id,
    required String saleId,
    required String productId,
    required int quantity,
    required String unitPrice,
    required String costPrice,
    required String discount,
    required String subtotal,
    required String total,
    required String margin,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _SaleItem;

  factory SaleItem.fromJson(Map<String, dynamic> json) =>
      _$SaleItemFromJson(json);
}

// ──────────────────────────────────
// Payment (matches PaymentEntity)
// ──────────────────────────────────
@freezed
class Payment with _$Payment {
  const factory Payment({
    required String id,
    required String saleId,
    required String method,
    required String amount,
    String? reference,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Payment;

  factory Payment.fromJson(Map<String, dynamic> json) =>
      _$PaymentFromJson(json);
}

// ──────────────────────────────────
// Receipt (matches ReceiptEntity)
// ──────────────────────────────────
@freezed
class Receipt with _$Receipt {
  const factory Receipt({
    required String id,
    required String receiptNumber,
    required String saleId,
    required String status,
    @Default(false) bool printed,
    @Default(false) bool emailed,
    String? pdfUrl,
    String? qrCode,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Receipt;

  factory Receipt.fromJson(Map<String, dynamic> json) =>
      _$ReceiptFromJson(json);
}

// ──────────────────────────────────
// Requests
// ──────────────────────────────────
@freezed
class CreateSaleRequest with _$CreateSaleRequest {
  const factory CreateSaleRequest({
    required String warehouseId,
    String? customerId,
    String? saleNumber,
    @Default('KZT') String currency,
    String? notes,
    required List<CreateSaleItem> items,
    required List<CreatePayment> payments,
  }) = _CreateSaleRequest;

  factory CreateSaleRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSaleRequestFromJson(json);
}

@freezed
class CreateSaleItem with _$CreateSaleItem {
  const factory CreateSaleItem({
    required String productId,
    required int quantity,
    required double unitPrice,
    double? costPrice,
    @Default(0) double discount,
  }) = _CreateSaleItem;

  factory CreateSaleItem.fromJson(Map<String, dynamic> json) =>
      _$CreateSaleItemFromJson(json);
}

@freezed
class CreatePayment with _$CreatePayment {
  const factory CreatePayment({
    required String method,
    required double amount,
    String? reference,
  }) = _CreatePayment;

  factory CreatePayment.fromJson(Map<String, dynamic> json) =>
      _$CreatePaymentFromJson(json);
}

// ──────────────────────────────────
// Paginated Response
// ──────────────────────────────────
@freezed
class SaleListResponse with _$SaleListResponse {
  const factory SaleListResponse({
    required List<Sale> items,
    required int total,
    required int page,
    required int limit,
  }) = _SaleListResponse;

  factory SaleListResponse.fromJson(Map<String, dynamic> json) =>
      _$SaleListResponseFromJson(json);
}

// ──────────────────────────────────
// Cart Item (local state, not from API)
// ──────────────────────────────────
class CartItem {
  final String productId;
  final String productName;
  final String productSku;
  final String? barcode;
  final int quantity;
  final double unitPrice;
  final double costPrice;
  final double discount;

  const CartItem({
    required this.productId,
    required this.productName,
    required this.productSku,
    this.barcode,
    required this.quantity,
    required this.unitPrice,
    required this.costPrice,
    this.discount = 0,
  });

  double get subtotal => unitPrice * quantity;
  double get total => subtotal - discount;

  CartItem copyWith({
    String? productId,
    String? productName,
    String? productSku,
    String? barcode,
    int? quantity,
    double? unitPrice,
    double? costPrice,
    double? discount,
  }) {
    return CartItem(
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      productSku: productSku ?? this.productSku,
      barcode: barcode ?? this.barcode,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      costPrice: costPrice ?? this.costPrice,
      discount: discount ?? this.discount,
    );
  }

  Map<String, dynamic> toJson() => {
    'productId': productId,
    'productName': productName,
    'productSku': productSku,
    'barcode': barcode,
    'quantity': quantity,
    'unitPrice': unitPrice,
    'costPrice': costPrice,
    'discount': discount,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CartItem &&
          runtimeType == other.runtimeType &&
          productId == other.productId;

  @override
  int get hashCode => productId.hashCode;
}


