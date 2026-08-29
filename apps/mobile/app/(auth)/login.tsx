import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { friendlyError } from '@vivra/shared';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa tu email y contraseña');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      console.warn('[login] email sign-in error:', error.message);
      Alert.alert('Error', friendlyError(error));
    }
  }

  async function handleAppleLogin() {
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
    } catch (error: any) {
      // User cancellation is not an error worth surfacing.
      if (error.code === 'ERR_REQUEST_CANCELED') return;
      console.warn('[login] Apple sign-in error:', error?.message);
      Alert.alert('Error', friendlyError(error));
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleGoogleLogin() {
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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === 'success') {
        const { url } = result;
        // Extract tokens from both hash fragment and query params
        const { params, errorCode } = QueryParams.getQueryParams(url);

        if (errorCode) {
          throw new Error(errorCode);
        }

        const accessToken = params['access_token'];
        const refreshToken = params['refresh_token'];

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    } catch (error: any) {
      console.warn('[login] Google sign-in error:', error?.message);
      Alert.alert('Error', friendlyError(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.logo}>Vivra</Text>
          <Text style={styles.subtitle}>La vida de tu mascota, en un solo lugar</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            testID="login-email"
            accessibilityLabel="Email"
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
            testID="login-password"
            accessibilityLabel="Contraseña"
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={Colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <Button
            title="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.md}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          )}

          <Button
            title="Continuar con Google"
            onPress={handleGoogleLogin}
            variant="outline"
            loading={googleLoading}
            disabled={appleLoading}
          />

          <TouchableOpacity style={styles.forgotLink}>
            <Link href="/(auth)/forgot-password">
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </Link>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <Link href="/(auth)/register">
            <Text style={styles.footerLink}>Regístrate</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
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
    fontSize: FontSize.md,
    color: Colors.muted,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
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
  appleButton: {
    width: '100%',
    height: 50,
  },
  forgotLink: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  linkText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
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
