/// StockFlow color utilities for consistent status/state colors.
class StockFlowColors {
  StockFlowColors._();

  /// Returns the appropriate color for a given entity status string.
  static int statusColor(String status) {
    switch (status) {
      case 'DRAFT':
      case 'PENDING':
        return 0xFFFFA726; // Orange
      case 'COMPLETED':
      case 'ACTIVE':
      case 'PAID':
      case 'PRINTED':
        return 0xFF66BB6A; // Green
      case 'REFUNDED':
      case 'RETURNED':
        return 0xFF42A5F5; // Blue
      case 'CANCELLED':
      case 'DELETED':
      case 'VOID':
        return 0xFFEF5350; // Red
      case 'PARTIALLY_REFUNDED':
      case 'PARTIALLY_RECEIVED':
        return 0xFFAB47BC; // Purple
      default:
        return 0xFF9E9E9E; // Grey
    }
  }
}
