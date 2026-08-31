import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import type { Notification } from '@vivra/shared/lib/database';

/**
 * Tipo de notificación → icono. Las claves son los tipos REALES que escriben
 * send-push y el dashboard web; antes eran 'vaccine'/'weight'/'preventive',
 * que no los produce nadie, así que todo caía en la campana genérica.
 * Gemelo del ICONO_POR_TIPO de la web (pages/notificaciones.astro).
 */
const ICON_MAP: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  vaccine_due: { name: 'medkit', color: Colors.good },
  weight_stale: { name: 'scale', color: Colors.accent },
  preventive_due: { name: 'shield-checkmark', color: Colors.warn },
  food_low: { name: 'restaurant', color: Colors.accentDark },
  birthday: { name: 'gift', color: '#E879F9' },
  re_engagement: { name: 'paw', color: Colors.muted },
  score_improved: { name: 'heart', color: Colors.accent },
  vet_visit: { name: 'medical', color: '#E879F9' },
  flight: { name: 'airplane', color: Colors.accent },
  general: { name: 'notifications', color: Colors.muted },
  // Tipos históricos, para que las filas viejas no salgan con campana gris.
  weight_reminder: { name: 'scale', color: Colors.accent },
  vaccine_reminder: { name: 'medkit', color: Colors.good },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

export default function NotificacionesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const dismiss = async (id: string) => {
    await supabase.from('notifications').update({ dismissed: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.markAll}>Leer todo</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {!loading && notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>Aquí aparecerán recordatorios y alertas de tu mascota</Text>
          </View>
        ) : (
          notifications.map(notif => {
            const iconConfig = ICON_MAP[notif.type] ?? ICON_MAP.general;
            return (
              <TouchableOpacity
                key={notif.id}
                activeOpacity={0.7}
                onPress={() => {
                  markAsRead(notif.id);
                  if (notif.href) {
                    router.back();
                    setTimeout(() => router.push(notif.href as any), 150);
                  }
                }}
              >
                <Card style={!notif.read ? styles.unreadCard : undefined}>
                  <View style={styles.notifRow}>
                    <View style={[styles.iconCircle, { backgroundColor: iconConfig.color + '18' }]}>
                      <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTitleRow}>
                        <Text style={[styles.notifTitle, !notif.read && styles.unreadText]} numberOfLines={1}>{notif.title}</Text>
                        <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                      </View>
                      <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => dismiss(notif.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.dismissBtn}
                    >
                      <Ionicons name="close" size={16} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                  {!notif.read && <View style={styles.unreadDot} />}
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  markAll: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: FontWeight.medium },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, marginTop: Spacing.xs, textAlign: 'center' },
  // Notification item
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.xs },
  notifTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, flex: 1 },
  notifTime: { fontSize: FontSize.xs, color: Colors.muted, flexShrink: 0 },
  notifMessage: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2, lineHeight: 20 },
  dismissBtn: { paddingLeft: Spacing.xs },
  // Unread
  unreadCard: { backgroundColor: Colors.accentLight, borderColor: Colors.accent + '30' },
  unreadText: { color: Colors.ink },
  unreadDot: {
    position: 'absolute', top: Spacing.md, left: Spacing.sm,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent,
  },
});
