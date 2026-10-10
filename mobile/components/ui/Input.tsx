/**
 * Form inputs.
 *
 * Designed to match the web app's field styles closely: soft borders, brand
 * focus ring, error text, and helper text. `error` is treated as either a
 * boolean (presence) or a string (message) for ergonomic form usage.
 */
import React, { forwardRef, useCallback, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string | boolean;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: TextInputProps['style'];
}

const InputBase = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightElement,
      containerStyle,
      style,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);

    const hasError = error === true || typeof error === 'string' && error.length > 0;
    const errorMessage = typeof error === 'string' ? error : undefined;

    const borderColor = hasError
      ? colors.danger
      : focused
        ? colors.brand
        : colors.border;

    const background = focused ? colors.surface : colors.surfaceAlt;

    const handleFocus = useCallback(
      (e: any) => {
        setFocused(true);
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e: any) => {
        setFocused(false);
        onBlur?.(e);
      },
      [onBlur],
    );

    return (
      <View style={containerStyle}>
        {label ? (
          <Text style={[typography.smallStrong, styles.label, { color: colors.text }]}>
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: background,
              borderColor,
              borderWidth: focused ? 1.5 : 1,
              shadowColor: focused && !hasError ? colors.brand : 'transparent',
              shadowOpacity: focused && !hasError ? 0.08 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
          ]}
        >
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            {...rest}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={colors.textSubtle}
            style={[
              typography.body,
              styles.input,
              { color: colors.text },
              style,
            ]}
            cursorColor={colors.brand}
            selectionColor={Platform.OS === 'ios' ? colors.brand : undefined}
          />
          {rightElement ? <View style={styles.icon}>{rightElement}</View> : null}
        </View>
        {hasError && errorMessage ? (
          <Text style={[typography.small, styles.helper, { color: colors.danger }]}>
            {errorMessage}
          </Text>
        ) : helperText ? (
          <Text style={[typography.small, styles.helper, { color: colors.textMuted }]}>
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  },
);

InputBase.displayName = 'Input';

export const Input = InputBase;

export interface PasswordInputProps extends Omit<InputProps, 'rightElement'> {}

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>((props, ref) => {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);

  const toggle = useCallback(() => setHidden((v) => !v), []);

  return (
    <Input
      {...props}
      ref={ref}
      secureTextEntry={hidden}
      rightElement={
        <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          {hidden ? (
            <Eye size={18} color={colors.textMuted} />
          ) : (
            <EyeOff size={18} color={colors.textMuted} />
          )}
        </Pressable>
      }
    />
  );
});

PasswordInput.displayName = 'PasswordInput';

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  helper: {
    marginTop: spacing.xs,
  },
});
