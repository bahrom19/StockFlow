import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

// ──────────────────────────────────
// Login
// ──────────────────────────────────
@freezed
class LoginRequest with _$LoginRequest {
  const factory LoginRequest({
    required String email,
    required String password,
  }) = _LoginRequest;

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);
}

@freezed
class LoginResponse with _$LoginResponse {
  const factory LoginResponse({
    required String accessToken,
    required String refreshToken,
    String? expiresIn,
    String? refreshExpiresIn,
    required CurrentUser user,
  }) = _LoginResponse;

  factory LoginResponse.fromJson(Map<String, dynamic> json) =>
      _$LoginResponseFromJson(json);
}

// ──────────────────────────────────
// Refresh
// ──────────────────────────────────
@freezed
class RefreshRequest with _$RefreshRequest {
  const factory RefreshRequest({
    required String refreshToken,
  }) = _RefreshRequest;

  factory RefreshRequest.fromJson(Map<String, dynamic> json) =>
      _$RefreshRequestFromJson(json);
}

@freezed
class RefreshResponse with _$RefreshResponse {
  const factory RefreshResponse({
    required String accessToken,
    required String refreshToken,
    String? expiresIn,
    String? refreshExpiresIn,
    required CurrentUser user,
  }) = _RefreshResponse;

  factory RefreshResponse.fromJson(Map<String, dynamic> json) =>
      _$RefreshResponseFromJson(json);
}

// ──────────────────────────────────
// Current User (Profile)
// ──────────────────────────────────
@freezed
class CurrentUser with _$CurrentUser {
  const factory CurrentUser({
    required String id,
    required String email,
    String? firstName,
    String? lastName,
    required String companyId,
    @Default(<String>[]) List<String> roles,
    @Default(<String>[]) List<String> permissions,
    String? phone,
  }) = _CurrentUser;

  factory CurrentUser.fromJson(Map<String, dynamic> json) =>
      _$CurrentUserFromJson(json);
}

/// Extension providing computed properties for CurrentUser.
extension CurrentUserExtensions on CurrentUser {
  /// Full name computed from firstName + lastName.
  String get fullName {
    if (firstName != null && lastName != null) {
      return '$firstName $lastName';
    }
    return firstName ?? lastName ?? email;
  }
}
