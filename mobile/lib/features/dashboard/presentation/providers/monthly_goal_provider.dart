import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local owner-configured monthly sales goal (UI-only, no backend).
///
/// Persisted in SharedPreferences under the key `monthly_goal`. `null` (or a
/// non-positive value) means "goal not set" — the Revenue card hides the
/// progress bar and prompts the owner to set one.
///
/// Decision (Stage E — docs/ux/dashboard_stage_e_revenue_goal.md): the goal is
/// an owner preference stored locally; NO backend/API change and NO new
/// network requests.
///
/// Implementation note: reads/writes go through `SharedPreferences.getInstance()`
/// directly rather than `preferencesStorageProvider` — that provider creates a
/// fresh, un-initialized `PreferencesStorage()` instance (the one initialized
/// in `main.dart` is never wired into it), so persistence through it would
/// silently no-op. Direct `getInstance()` is the canonical API and works in
/// both production and tests (`SharedPreferences.setMockInitialValues`).
final monthlyGoalProvider =
    StateNotifierProvider<MonthlyGoalNotifier, double?>((ref) {
  return MonthlyGoalNotifier();
});

class MonthlyGoalNotifier extends StateNotifier<double?> {
  static const String storageKey = 'monthly_goal';
  bool _loaded = false;

  MonthlyGoalNotifier() : super(null);

  /// Loads the persisted goal once. Idempotent — safe to call on every
  /// dashboard mount; no request is made and the value is read from local
  /// storage only.
  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final value = prefs.getDouble(storageKey);
      state = (value != null && value > 0) ? value : null;
    } catch (_) {
      state = null; // storage unavailable — treat as "not set"
    }
  }

  /// Persists [goal], normalized to 2 decimals. A null / non-positive goal
  /// removes the stored value and hides the progress bar.
  Future<void> setGoal(double? goal) async {
    final normalized = (goal != null && goal > 0)
        ? double.parse(goal.toStringAsFixed(2))
        : null;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (normalized == null) {
        await prefs.remove(storageKey);
      } else {
        await prefs.setDouble(storageKey, normalized);
      }
    } catch (_) {
      // Best-effort: keep the in-memory value even if persistence fails.
    }
    state = normalized;
  }
}
