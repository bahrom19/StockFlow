// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AppNotificationImpl _$$AppNotificationImplFromJson(
        Map<String, dynamic> json) =>
    _$AppNotificationImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      titleKey: json['titleKey'] as String,
      bodyKey: json['bodyKey'] as String?,
      params: json['params'] as Map<String, dynamic>?,
      entityType: json['entityType'] as String?,
      entityId: json['entityId'] as String?,
      readAt: json['readAt'] as String?,
      createdAt: json['createdAt'] as String,
    );

Map<String, dynamic> _$$AppNotificationImplToJson(
        _$AppNotificationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'titleKey': instance.titleKey,
      'bodyKey': instance.bodyKey,
      'params': instance.params,
      'entityType': instance.entityType,
      'entityId': instance.entityId,
      'readAt': instance.readAt,
      'createdAt': instance.createdAt,
    };

_$NotificationListResponseImpl _$$NotificationListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$NotificationListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$NotificationListResponseImplToJson(
        _$NotificationListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$UnreadCountResponseImpl _$$UnreadCountResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$UnreadCountResponseImpl(
      count: (json['count'] as num).toInt(),
    );

Map<String, dynamic> _$$UnreadCountResponseImplToJson(
        _$UnreadCountResponseImpl instance) =>
    <String, dynamic>{
      'count': instance.count,
    };
