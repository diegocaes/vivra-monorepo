import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { PREMIUM_FEATURES } from '../constants/revenueCat';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { track } from '../lib/analytics';

const PRIVACY_URL = 'https://vivrapet.com/privacy';
const TERMS_URL = 'https://vivrapet.com/terms';

export default function PaywallScreen() {
  const router = useRouter();
  const { packages, purchase, restore, isLoading, refresh } = useSubscription();

  const monthly = packages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY);
  const yearly = packages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL);

  async function handlePurchase(pkg: typeof monthly) {
    if (!pkg) return;
    // Se registran intento y resultado por separado: la diferencia entre los
    // dos ES la tasa de abandono en el momento de pagar.
    const plan = pkg === yearly ? 'anual' : 'mensual';
    track('click', `compra_intento_${plan}`);
    const success = await purchase(pkg);
    track('click', `compra_${success ? 'exito' : 'abandono'}_${plan}`);
    if (success) {
      router.back();
    }
  }

  async function handleRestore() {
    track('click', 'restaurar_compra');
    const success = await restore();
    if (success) {
      Alert.alert('Compra restaurada', 'Tu suscripción Premium ha sido restaurada.');
      router.back();
    } else {
      Alert.alert('Sin compras', 'No se encontraron compras anteriores.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={Colors.muted} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="star" size={32} color={Colors.white} />
          </View>
          <Text style={styles.title}>Vivra Premium</Text>
          <Text style={styles.subtitle}>Cuiden juntos a su mascota y sepan en qué gastan</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {PREMIUM_FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={20} color={Colors.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingContainer}>
          {isLoading ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <>
              {/* Yearly — best value */}
              {yearly && (
                <TouchableOpacity
                  style={[styles.planCard, styles.planCardHighlight]}
                  onPress={() => handlePurchase(yearly)}
                >
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>Mejor precio</Text>
                  </View>
                  <Text style={styles.planName}>Anual</Text>
                  <Text style={styles.planPrice}>
                    {yearly.product.priceString}
                    <Text style={styles.planPeriod}>/año</Text>
                  </Text>
                  <Text style={styles.planSavings}>
                    {monthly ? `Ahorra vs mensual` : ''}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Monthly */}
              {monthly && (
                <TouchableOpacity
                  style={styles.planCard}
                  onPress={() => handlePurchase(monthly)}
                >
                  <Text style={styles.planName}>Mensual</Text>
                  <Text style={styles.planPrice}>
                    {monthly.product.priceString}
                    <Text style={styles.planPeriod}>/mes</Text>
                  </Text>
                  <Text style={styles.planTrial}>7 días gratis</Text>
                </TouchableOpacity>
              )}

              {/* Fallback if packages not loaded yet */}
              {!monthly && !yearly && (
                <View style={styles.fallbackContainer}>
                  <Text style={styles.fallbackText}>
                    No se pudieron cargar los planes. Verifica tu conexión.
                  </Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Apple-required full disclosure (Guideline 3.1.2) — right next to the purchase buttons */}
        <View style={styles.disclosureBox}>
          <Text style={styles.disclosureTitle}>Detalles de la suscripción</Text>
          <Text style={styles.disclosureText}>
            • El plan mensual incluye 7 días de prueba gratis. Al final de la prueba,
            se cobrará {monthly?.product.priceString ?? 'el precio mostrado'} al mes.
          </Text>
          <Text style={styles.disclosureText}>
            • El plan anual se cobra {yearly?.product.priceString ?? 'una sola vez al año'} por 12 meses.
          </Text>
          <Text style={styles.disclosureText}>
            • La suscripción se renueva automáticamente al final de cada período, a menos
            que la canceles al menos 24 horas antes del final del período en curso.
          </Text>
          <Text style={styles.disclosureText}>
            • El pago se cargará a tu cuenta de Apple al confirmar la compra.
          </Text>
          <Text style={styles.disclosureText}>
            • Puedes gestionar o cancelar tu suscripción en Ajustes → Apple ID → Suscripciones.
          </Text>
        </View>

        {/* Legal links — required by App Store Review */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>Términos de uso (EULA)</Text>
          </TouchableOpacity>
          <Text style={styles.legalLinkSep}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLink}>Política de privacidad</Text>
          </TouchableOpacity>
        </View>

        {/* Restore */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.restoreText}>Restaurar compra</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginRight: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  featureDesc: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  pricingContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  planCardHighlight: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  bestValueBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  bestValueText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  planPrice: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  planPeriod: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    color: Colors.muted,
  },
  planSavings: {
    fontSize: FontSize.sm,
    color: Colors.good,
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
  planTrial: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
  fallbackContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  retryText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  disclosureBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.xs,
  },
  disclosureTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  disclosureText: {
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
  },
  legalLink: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  legalLinkSep: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  restoreText: {
    fontSize: FontSize.md,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
});
