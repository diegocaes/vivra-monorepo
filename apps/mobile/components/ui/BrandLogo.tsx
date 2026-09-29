import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** Original Vivra artwork, shared across the app without tinting or cropping. */
export function BrandLogo({ width = 140, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={require('../../assets/images/vivra-logo-transparent.png')} accessibilityLabel="Vivra" accessible resizeMode="contain" style={[{ width, height: width * 234 / 800 }, style]} />;
}
