/**
 * Auth layout.
 *
 * Deliberately thin: no chrome of its own.
 *
 * An earlier version put the JID mark and tagline in a shared header here, but
 * that forces the sign-up form — which is long — into a second scroll view
 * beneath a fixed header. Instead each auth screen owns one scroll view and
 * composes `<AuthHero>` + form, so the whole flow scrolls as a unit and the
 * keyboard never traps a field under a static header.
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 240,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}