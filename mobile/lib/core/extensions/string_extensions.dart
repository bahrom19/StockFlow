/// String Extensions for StockFlow
extension StringExtensions on String? {
  bool get isNullOrEmpty => this == null || this!.isEmpty;
  bool get isNotNullOrEmpty => this != null && this!.isNotEmpty;

  bool get isValidEmail {
    if (isNullOrEmpty) return false;
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    return emailRegex.hasMatch(this!);
  }

  bool get isValidPhone {
    if (isNullOrEmpty) return false;
    final phoneRegex = RegExp(r'^\+?[\d\s\-()]{7,20}$');
    return phoneRegex.hasMatch(this!);
  }

  String capitalize() {
    if (isNullOrEmpty) return this ?? '';
    return '${this![0].toUpperCase()}${this!.substring(1)}';
  }

  String truncate(int maxLength) {
    if (isNullOrEmpty) return this ?? '';
    if (this!.length <= maxLength) return this!;
    return '${this!.substring(0, maxLength)}...';
  }
}
