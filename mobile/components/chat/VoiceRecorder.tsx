/**
 * Voice recording, driven by a single gesture responder.
 *
 * Design constraints, and why they shaped the code:
 *
 * 1. **The button must survive the press.** If the mic button is replaced by the
 *    recording bar the instant recording starts, the finger is left hovering over
 *    a new view and the platform never delivers `onPressOut` — the recording can
 *    then never be stopped. So press-in/out and the slide-to-cancel drag are all
 *    expressed through *one* `PanResponder` on a view that stays mounted. Grant
 *    arms the recording, release ends it, move drags it.
 *
 * 2. **An accidental recording is worse than no feature.** Recording does not
 *    begin until the press has been held for `HOLD_TO_ARM_MS`, so a brush of the
 *    screen captures nothing.
 *
 * 3. **A real waveform, not a progress bar.** `useAudioRecorderState` is polled
 *    for `metering` (dBFS) and folded into a 0..1 curve. A voice note drawn as a
 *    plain rectangle reads as a file attachment rather than as speech.
 *
 * The Composer owns the button's appearance and calls `begin`/`end` from the
 * responder; this module owns all recording state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

import { MAX_VOICE_MS, MIN_VOICE_MS } from './VoiceMessage';

export interface VoiceClip {
  uri: string;
  durationMs: number;
  /** Normalised 0..1 amplitude samples, newest last. */
  amplitudes: number[];
}

/** How long the mic must be held before recording actually starts. */
const HOLD_TO_ARM_MS = 180;
/** Leftward drag, in px, that arms a cancel. */
export const CANCEL_THRESHOLD_PX = 88;
/** Poll rate for duration/metering. */
const METER_INTERVAL_MS = 100;
/** Newest amplitude samples retained for the waveform. */
const MAX_AMPLITUDE_SAMPLES = 72;

export type RecorderPhase = 'idle' | 'arming' | 'recording';

/** Maps expo-audio's dBFS metering onto 0..1. */
function normaliseMetering(db: number | undefined): number {
  if (db === undefined || db <= -60) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export interface VoiceRecorderController {
  phase: RecorderPhase;
  durationMs: number;
  amplitudes: number[];
  /** Live leftward drag in px. Negative is toward cancel. */
  dragX: number;
  cancelArmed: boolean;
  isRecording: boolean;
  /** Attach to the mic control so one responder drives everything. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  begin: () => void;
  /** Ends the recording, sending the clip unless a cancel is armed. */
  end: () => void;
  /** Discards without sending. */
  cancel: () => void;
}

export function useVoiceRecorder(options: {
  onSend: (clip: VoiceClip) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}): VoiceRecorderController {
  const { onSend, onCancel, onError } = options;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const [dragX, setDragX] = useState(0);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const captured = useRef<number[]>([]);
  const cancelArmed = useRef(false);
  const inFlight = useRef(false);

  // Latest callbacks, so the responder can be created exactly once.
  const sendRef = useRef(onSend);
  const cancelRef = useRef(onCancel);
  const errorRef = useRef(onError);
  sendRef.current = onSend;
  cancelRef.current = onCancel;
  errorRef.current = onError;

  const reset = useCallback(() => {
    setPhase('idle');
    setAmplitudes([]);
    setDragX(0);
    captured.current = [];
    cancelArmed.current = false;
    inFlight.current = false;
  }, []);

  const stop = useCallback(async () => {
    if (!inFlight.current) return;
    inFlight.current = false;

    const cancelled = cancelArmed.current;
    const uri = recorder.uri ?? recorder.getStatus().url;
    const samples = captured.current;

    try {
      await recorder.stop();
    } catch {
      // The native stop can throw on some Android builds when the file handle
      // is already closed; the URI captured above is still usually valid.
    }

    reset();

    if (cancelled || !uri) {
      cancelRef.current();
      return;
    }

    // Shorter than this is a tap, not a message. A clipped syllable is worse than
    // sending nothing, so it is discarded silently rather than confirmed.
    if (Date.now() - startedAt.current < MIN_VOICE_MS) {
      cancelRef.current();
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    sendRef.current({ uri, durationMs: Date.now() - startedAt.current, amplitudes: samples });
  }, [recorder, reset]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const begin = useCallback(() => {
    if (inFlight.current) return;
    cancelArmed.current = false;
    setDragX(0);

    holdTimer.current = setTimeout(async () => {
      holdTimer.current = null;

      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          errorRef.current('Allow microphone access in Settings to send a voice message.');
          return;
        }

        await recorder.prepareToRecordAsync({ isMeteringEnabled: true });
        recorder.record();

        inFlight.current = true;
        startedAt.current = Date.now();
        captured.current = [];
        setAmplitudes([]);
        setPhase('recording');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } catch (error) {
        inFlight.current = false;
        errorRef.current(error instanceof Error ? error.message : 'Could not start recording.');
      }
    }, HOLD_TO_ARM_MS);
  }, [recorder]);

  const end = useCallback(() => {
    if (holdTimer.current) {
      // Released before arming: nothing was captured, so there is nothing to do.
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      return;
    }
    void stopRef.current();
  }, []);

  const cancel = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    cancelArmed.current = true;
    if (inFlight.current) {
      void stopRef.current();
    } else {
      cancelRef.current();
      reset();
    }
  }, [reset]);

  // Fold metering into the waveform while recording.
  const { metering, durationMillis, isRecording } = state;
  useEffect(() => {
    if (phase !== 'recording' || !isRecording) return;
    const sample = normaliseMetering(metering);
    captured.current = [...captured.current, sample].slice(-MAX_AMPLITUDE_SAMPLES);
    setAmplitudes(captured.current);
  }, [metering, phase, isRecording]);

  // Hard ceiling, so a forgotten recording cannot run for minutes and then fail
  // to upload.
  useEffect(() => {
    if (phase === 'recording' && durationMillis >= MAX_VOICE_MS) {
      void stopRef.current();
    }
  }, [durationMillis, phase]);

  // Leaving the thread mid-sentence must not leave the mic hot.
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // Unmount teardown: nothing to report.
      }
    };
  }, [recorder]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only claim the gesture after a real horizontal drag, so a plain press
        // is not stolen from a parent ScrollView.
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6,
        onPanResponderGrant: () => begin(),
        onPanResponderMove: (_event, gesture) => {
          setDragX(Math.min(0, gesture.dx));
          cancelArmed.current = gesture.dx <= -CANCEL_THRESHOLD_PX;
        },
        onPanResponderRelease: () => end(),
        onPanResponderTerminate: () => end(),
      }),
    [begin, end],
  );

  return {
    phase,
    durationMs: durationMillis,
    amplitudes,
    dragX,
    cancelArmed: cancelArmed.current || dragX <= -CANCEL_THRESHOLD_PX,
    isRecording: phase === 'recording',
    panHandlers: responder.panHandlers,
    begin,
    end,
    cancel,
  };
}