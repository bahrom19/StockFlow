/// Attention Event — presentation-layer model for the Dashboard v3.3
/// Action Center (see docs/ux/dashboard_v33_action_center.md).
///
/// Every event is derived ONLY from data that is already loaded on the
/// Dashboard (see [source]) — the Action Center never issues new backend
/// requests.
library;

/// Severity category. Drives color, ordering and default visibility:
/// Critical → Attention → Opportunities (Opportunities are collapsed by
/// default whenever any Critical/Attention event exists).
enum AttentionCategory { critical, attention, opportunity }

/// A single actionable item surfaced by the Action Center.
///
/// Each row carries the full owner-facing story:
///  - [title]   — what the owner sees (the problem)
///  - [reason]  — why this is happening (root cause)
///  - [action]  — what to do about it (recommended action)
///  - [impact]  — approximate business impact, where computable from data
///  - [details] — optional nested detail lines (e.g. top-3 low-stock items
///    with SKU/stock/warehouse). Rendered as a compact sub-list.
///  - [detailsMore] — optional muted footer note under [details] (e.g.
///    "+4 more") when the underlying data set is larger than the shown top
///    items. Keeps the event compact without hiding the full scope.
///  - [ctaLabel]/[ctaRoute] — the explicit action button (null route →
///    informational row only); [ctaQueryParameters] are appended to
///    [ctaRoute] when navigating (e.g. `/products?stock=low`)
///  - [source]  — which already-loaded provider/endpoint backs this event
class AttentionEvent {
  final AttentionCategory category;
  final double weight; // urgency within its category (higher = shown first)
  final String title;
  final String reason;
  final String action;
  final String? impact;
  final List<String>? details;
  final String? detailsMore;
  final String ctaLabel;
  final String? ctaRoute;
  final Map<String, String>? ctaQueryParameters;
  final String source;

  const AttentionEvent({
    required this.category,
    required this.weight,
    required this.title,
    required this.reason,
    required this.action,
    this.impact,
    this.details,
    this.detailsMore,
    required this.ctaLabel,
    this.ctaRoute,
    this.ctaQueryParameters,
    required this.source,
  });

  /// The location pushed when the CTA is tapped: [ctaRoute] with
  /// [ctaQueryParameters] encoded into its query string (null route → null).
  Uri? get ctaUri {
    final route = ctaRoute;
    if (route == null) return null;
    return Uri(
      path: route,
      queryParameters:
          (ctaQueryParameters == null || ctaQueryParameters!.isEmpty)
              ? null
              : ctaQueryParameters,
    );
  }
}
