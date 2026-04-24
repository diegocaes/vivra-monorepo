import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

const PENDING_REF_KEY = 'pending_referral';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [refCode, setRefCode] = useState('');
  const [showRefField, setShowRefField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Pre-fill ref code from deep link or from previously stored pending one
  useEffect(() => {
    (async () => {
      if (params.ref) {
        const cleaned = String(params.ref).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleaned) {
          setRefCode(cleaned);
          setShowRefField(true);
          return;
        }
      }
      const stored = await AsyncStorage.getItem(PENDING_REF_KEY);
      if (stored) {
        setRefCode(stored);
        setShowRefField(true);
      }
    })();
  }, [params.ref]);

  async function handleRegister() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    // Validate ref code up-front if provided
    const cleanRef = refCode.trim().toUpperCase();
    if (cleanRef) {
      const { data: code } = await supabase
        .from('referral_codes')
        .select('user_id')
        .eq('code', cleanRef)
        .maybeSingle();
      if (!code) {
        Alert.alert(
          'Código inválido',
          'El código de referido no existe. Puedes continuar sin código o corregirlo.',
        );
        return;
      }
    }

    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        Alert.alert('Este email ya tiene cuenta', 'Inicia sesión en lugar de crear una nueva.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    if (cleanRef) {
      await AsyncStorage.setItem(PENDING_REF_KEY, cleanRef);
    }

    if (signUpData.session) {
      router.replace('/onboarding' as any);
    } else {
      Alert.alert(
        '¡Cuenta creada!',
        'Revisa tu email para confirmar. Después inicia sesión.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }],
      );
    }
  }

  async function handleAppleSignUp() {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No se recibió el token de Apple');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
      // _layout.tsx routes automatically: no pets → onboarding, has pets → app
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Error', error.message ?? 'Error al continuar con Apple');
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No auth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success') {
        const { params: urlParams, errorCode } = QueryParams.getQueryParams(result.url);
        if (errorCode) throw new Error(errorCode);

        const accessToken = urlParams['access_token'];
        const refreshToken = urlParams['refresh_token'];

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al continuar con Google');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>Vivra</Text>
            <Text style={styles.subtitle}>Crea tu cuenta</Text>
          </View>

          {/* Social sign-up — faster path */}
          <View style={styles.socialSection}>
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={Radius.md}
                style={styles.appleButton}
                onPress={handleAppleSignUp}
              />
            )}
            <Button
              title="Continuar con Google"
              onPress={handleGoogleSignUp}
              variant="outline"
              loading={googleLoading}
              disabled={appleLoading || loading}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o con email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / password form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              style={styles.input}
              placeholder="Contraseña (mín. 8 caracteres)"
              placeholderTextColor={Colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirmar contraseña"
              placeholderTextColor={Colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {showRefField ? (
              <View>
                <Text style={styles.refLabel}>Código de referido</Text>
                <TextInput
                  style={[styles.input, styles.refInput]}
                  placeholder="Ej: TINTO2847"
                  placeholderTextColor={Colors.muted}
                  value={refCode}
                  onChangeText={(t) => setRefCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Text style={styles.refHint}>
                  Si alguien te invitó, recibes 7 días Premium gratis
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowRefField(true)} style={styles.refToggle}>
                <Text style={styles.refToggleText}>¿Tienes un código de referido?</Text>
              </TouchableOpacity>
            )}

            <Button
              title="Crear cuenta"
              onPress={handleRegister}
              loading={loading}
              disabled={googleLoading || appleLoading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.footerLink}>Inicia sesión</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.muted,
  },
  socialSection: {
    gap: Spacing.md,
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.muted,
    fontSize: FontSize.sm,
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.ink,
  },
  refLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  refInput: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  refHint: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
  refToggle: {
    paddingVertical: Spacing.xs,
    alignSelf: 'center',
  },
  refToggleText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Colors.muted,
    fontSize: FontSize.sm,
  },
  footerLink: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
