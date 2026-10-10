/**
 * Platform integrations: dialling, WhatsApp, clipboard, share sheet.
 *
 * All wrapped here so screens never import `Linking`/`Clipboard` directly and
 * the fallbacks stay consistent.
 */
import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

/** Normalises a Nigerian number to the 11-digit form `wa.me` expects. */
const normaliseNigerianNumber = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
};

/** Opens the phone dialler. The user still has to press call. */
export const callPhone = async (raw: string): Promise<boolean> => {
  const number = raw.replace(/[^\d+]/g, '');
  if (!number) return false;
  const url = Platform.select({ ios: `tel:${number}`, default: `tel:${number}` }) as string;
  const supported = await Linking.canOpenURL(url);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
};

/**
 * Opens a WhatsApp chat.
 *
 * Uses `wa.me` (a universal link) rather than the `whatsapp://` scheme so the
 * same code works on iOS, Android and web without branching. If the app is not
 * installed the host shows the "install WhatsApp" page instead of failing
 * silently, which is a better outcome than a dead button.
 */
export const openWhatsApp = async (raw: string, message?: string): Promise<boolean> => {
  const number = normaliseNigerianNumber(raw);
  if (!number) return false;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `https://wa.me/${number}${text}`;
  await WebBrowser.openBrowserAsync(url);
  return true;
};

/** True when this contact method is offered for the listing. */
export const contactAllowed = (
  preference: 'whatsapp' | 'phone' | 'chat' | 'all',
  method: 'whatsapp' | 'phone' | 'chat',
): boolean => preference === 'all' || preference === method;

export const copyToClipboard = async (value: string): Promise<void> => {
  await Clipboard.setStringAsync(value);
};

export const shareText = async (message: string, url?: string): Promise<void> => {
  await Share.share({ message: url ? `${message}\n${url}` : message });
};

/** Opens an external link in an in-app browser tab, not a full screen takeover. */
export const openExternal = async (url: string): Promise<void> => {
  await WebBrowser.openBrowserAsync(url);
};

/**
 * Copy-with-fallback.
 *
 * Clipboard access can be denied or unsupported on some Android builds; rather
 * than silently doing nothing, tell the user what happened.
 */
export const copyOrAlert = async (label: string, value: string): Promise<boolean> => {
  try {
    await copyToClipboard(value);
    return true;
  } catch {
    Alert.alert('Could not copy', label);
    return false;
  }
};