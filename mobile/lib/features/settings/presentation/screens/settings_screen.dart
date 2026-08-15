import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/constants/app_constants.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/localization/locale_provider.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  (user?.fullName ?? 'U').substring(0, 1).toUpperCase(),
                  style: TextStyle(
                      color: theme.colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(user?.fullName ?? context.l10n.user),
              subtitle: Text(user?.email ?? ''),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(RouteNames.profile),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(context.l10n.preferences, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: Text(context.l10n.darkMode),
                  subtitle: Text(context.l10n.darkModeSubtitle),
                  secondary: const Icon(Icons.dark_mode_outlined),
                  value: theme.brightness == Brightness.dark,
                  onChanged: (_) {},
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.language_outlined),
                  title: Text(context.l10n.language),
                  subtitle: Text(
                    localeDisplayNames[ref.watch(localeProvider).languageCode] ??
                        context.l10n.english,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showLanguageDialog(context, ref),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.payments_outlined),
                  title: Text(context.l10n.currency),
                  subtitle: Text(
                    currencyDisplayNames[ref.watch(currencyProvider)] ??
                        context.l10n.kztTenge,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showCurrencyDialog(context, ref),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: Text(context.l10n.notifications),
                  subtitle: Text(context.l10n.manageNotifications),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(context.l10n.about, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text(context.l10n.version),
                  subtitle: const Text(AppConstants.appVersion),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text(context.l10n.termsOfService),
                  trailing: const Icon(Icons.open_in_new),
                  onTap: () {},
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.shield_outlined),
                  title: Text(context.l10n.privacyPolicy),
                  trailing: const Icon(Icons.open_in_new),
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => ref.read(authStateProvider.notifier).logout(),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
              icon: const Icon(Icons.logout, color: Colors.red),
              label: Text(context.l10n.signOut,
                  style: const TextStyle(color: Colors.red)),
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  /// Minimal language picker (Phase 0 mechanism — no UI-string migration).
  Future<void> _showLanguageDialog(BuildContext context, WidgetRef ref) async {
    final current = ref.read(localeProvider).languageCode;
    final selected = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(dialogContext.l10n.language),
        children: [
          for (final code in supportedLocaleCodes)
            ListTile(
              title: Text(localeDisplayNames[code] ?? code),
              trailing: code == current ? const Icon(Icons.check) : null,
              onTap: () => Navigator.of(dialogContext).pop(code),
            ),
        ],
      ),
    );
    if (selected != null) {
      await ref.read(localeProvider.notifier).setLocale(selected);
    }
  }

  /// Currency picker (Phase 4) — all codes from the backend Currency enum.
  Future<void> _showCurrencyDialog(BuildContext context, WidgetRef ref) async {
    final current = ref.read(currencyProvider);
    final selected = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(dialogContext.l10n.currency),
        children: [
          for (final code in supportedCurrencyCodes)
            ListTile(
              title: Text(currencyDisplayNames[code] ?? code),
              trailing: code == current ? const Icon(Icons.check) : null,
              onTap: () => Navigator.of(dialogContext).pop(code),
            ),
        ],
      ),
    );
    if (selected != null) {
      await ref.read(currencyProvider.notifier).setCurrency(selected);
    }
  }
}
