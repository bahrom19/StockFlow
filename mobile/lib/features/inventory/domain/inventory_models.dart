import 'package:freezed_annotation/freezed_annotation.dart';

part 'inventory_models.freezed.dart';
part 'inventory_models.g.dart';

// ──────────────────────────────────
// Warehouse
// ──────────────────────────────────
@freezed
class Warehouse with _$Warehouse {
  const factory Warehouse({
    required String id,
    required String companyId,
    required String name,
    required String code,
    String? address,
    String? phone,
    String? managerName,
    @Default(false) bool isDefault,
    @Default(true) bool isActive,
    @Default(0) int rowVersion,
    required String createdAt,
    required String updatedAt,
    String? deletedAt,
  }) = _Warehouse;

  factory Warehouse.fromJson(Map<String, dynamic> json) =>
      _$WarehouseFromJson(json);
}

// ──────────────────────────────────
// StockItem (matches StockEntity)
// ──────────────────────────────────
@freezed
class StockItem with _$StockItem {
  const factory StockItem({
    required String id,
    required String companyId,
    required String productId,
    required String warehouseId,
    @Default('') String productName,
    @Default('') String productSku,
    @Default(0) int quantity,
    @Default(0) int reservedQuantity,
    @Default(0) int availableQuantity,
    @Default(5) int minQuantity,
    @Default(200) int maxQuantity,
    @Default(0) int rowVersion,
    required String createdAt,
    required String updatedAt,
    Warehouse? warehouse,
  }) = _StockItem;

  factory StockItem.fromJson(Map<String, dynamic> json) =>
      _$StockItemFromJson(json);
}

// ──────────────────────────────────
// Stock List Response
// ──────────────────────────────────
@freezed
class StockListResponse with _$StockListResponse {
  const factory StockListResponse({
    required List<StockItem> items,
    required int total,
  }) = _StockListResponse;

  factory StockListResponse.fromJson(Map<String, dynamic> json) =>
      _$StockListResponseFromJson(json);
}

// ──────────────────────────────────
// Stock Movement
// ──────────────────────────────────
@freezed
class StockMovement with _$StockMovement {
  const factory StockMovement({
    required String id,
    required String companyId,
    required String productId,
    required String warehouseId,
    required String type,
    required int quantity,
    required int beforeQuantity,
    required int afterQuantity,
    String? referenceType,
    String? referenceId,
    String? comment,
    String? createdBy,
    required String createdAt,
  }) = _StockMovement;

  factory StockMovement.fromJson(Map<String, dynamic> json) =>
      _$StockMovementFromJson(json);
}

// ──────────────────────────────────
// Warehouse DTOs
// ──────────────────────────────────
@freezed
class CreateWarehouseRequest with _$CreateWarehouseRequest {
  const factory CreateWarehouseRequest({
    required String name,
    required String code,
    String? address,
    String? phone,
    String? managerName,
    @Default(false) bool isDefault,
  }) = _CreateWarehouseRequest;

  factory CreateWarehouseRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateWarehouseRequestFromJson(json);
}

@freezed
class UpdateWarehouseRequest with _$UpdateWarehouseRequest {
  const factory UpdateWarehouseRequest({
    String? name,
    String? code,
    String? address,
    String? phone,
    String? managerName,
    bool? isDefault,
    @Default(0) int rowVersion,
  }) = _UpdateWarehouseRequest;

  factory UpdateWarehouseRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateWarehouseRequestFromJson(json);
}

// ──────────────────────────────────
// DTOs
// ──────────────────────────────────
@freezed
class AdjustStockDto with _$AdjustStockDto {
  const factory AdjustStockDto({
    required String productId,
    required String warehouseId,
    required int quantity,
    String? reason,
    String? referenceType,
    String? referenceId,
    String? comment,
  }) = _AdjustStockDto;

  factory AdjustStockDto.fromJson(Map<String, dynamic> json) =>
      _$AdjustStockDtoFromJson(json);
}

@freezed
class TransferStockDto with _$TransferStockDto {
  const factory TransferStockDto({
    required String productId,
    required String fromWarehouseId,
    required String toWarehouseId,
    required int quantity,
    String? comment,
  }) = _TransferStockDto;

  factory TransferStockDto.fromJson(Map<String, dynamic> json) =>
      _$TransferStockDtoFromJson(json);
}

// ──────────────────────────────────
// Movement type helpers
// ──────────────────────────────────
extension MovementTypeX on String {
  String get movementLabel {
    switch (this) {
      case 'SALE': return 'Sale';
      case 'PURCHASE': return 'Purchase';
      case 'TRANSFER_IN': return 'Transfer In';
      case 'TRANSFER_OUT': return 'Transfer Out';
      case 'ADJUSTMENT': return 'Adjustment';
      case 'RETURN': return 'Return';
      case 'LOSS': return 'Loss';
      case 'CORRECTION': return 'Correction';
      default: return this;
    }
  }
}

// ──────────────────────────────────
// Inventory State
// ──────────────────────────────────
sealed class InventoryState {
  const InventoryState();
}

class InventoryLoading extends InventoryState {
  const InventoryLoading();
}

class InventoryLoaded extends InventoryState {
  final List<StockItem> items;
  final int total;
  final bool isRefreshing;
  final String search;
  final String? warehouseFilter;
  final List<Warehouse> warehouses;

  const InventoryLoaded({
    required this.items,
    required this.total,
    required this.warehouses,
    this.isRefreshing = false,
    this.search = '',
    this.warehouseFilter,
  });

  InventoryLoaded copyWith({
    List<StockItem>? items,
    int? total,
    bool? isRefreshing,
    String? search,
    String? warehouseFilter,
    List<Warehouse>? warehouses,
  }) {
    return InventoryLoaded(
      items: items ?? this.items,
      total: total ?? this.total,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      search: search ?? this.search,
      warehouseFilter: warehouseFilter ?? this.warehouseFilter,
      warehouses: warehouses ?? this.warehouses,
    );
  }
}

class InventoryEmpty extends InventoryState {
  final String message;
  const InventoryEmpty([this.message = 'No inventory items found']);
}

class InventoryError extends InventoryState {
  final String message;
  const InventoryError(this.message);
}

// ──────────────────────────────────
// Movements State
// ──────────────────────────────────
sealed class MovementsState {
  const MovementsState();
}

class MovementsLoading extends MovementsState {
  const MovementsLoading();
}

class MovementsLoaded extends MovementsState {
  final List<StockMovement> movements;
  const MovementsLoaded(this.movements);
}

class MovementsEmpty extends MovementsState {
  const MovementsEmpty();
}

class MovementsError extends MovementsState {
  final String message;
  const MovementsError(this.message);
}
