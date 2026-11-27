import { useState, useRef, useEffect, useCallback } from 'react';
import { startLiveVoiceMonitor, LiveVoiceMonitorHandle } from '../../utils/liveVoiceMonitor';

export interface UseVoiceRecorderOptions {
  onAudioCaptured: (audioBase64: string, mimeType: string, liveAutoSend: boolean) => Promise<void>;
}

export function useVoiceRecorder({ onAudioCaptured }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceBands, setVoiceBands] = useState<[number, number, number, number, number]>([
    18, 28, 22, 34, 18,
  ]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceMonitorRef = useRef<LiveVoiceMonitorHandle | null>(null);
  const onAudioCapturedRef = useRef(onAudioCaptured);
  onAudioCapturedRef.current = onAudioCaptured;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      voiceMonitorRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stopRecordingNow = useCallback((): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    voiceMonitorRef.current?.stop();
    voiceMonitorRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(
    async (liveAutoSend: boolean): Promise<void> => {
      setMicError(null);
      if (isRecording) {
        stopRecordingNow();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        setRecordingSeconds(0);
        const supportedMimes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
        ];
        const chosenMime =
          typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
            ? supportedMimes.find((m) => MediaRecorder.isTypeSupported(m))
            : undefined;
        const mediaRecorder = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime })
          : new MediaRecorder(stream);
        const mimeType = mediaRecorder.mimeType || chosenMime || 'audio/webm';
        mediaRecorderRef.current = mediaRecorder;

        voiceMonitorRef.current = startLiveVoiceMonitor({
          stream,
          speechThreshold: 0.022,
          silenceDurationMs: 1650,
          onLevelChange: (_level, bands) => {
            setVoiceBands(bands);
          },
          onSilenceAfterSpeech: () => {
            stopRecordingNow();
          },
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (timerRef.current) clearInterval(timerRef.current);
          voiceMonitorRef.current?.stop();
          voiceMonitorRef.current = null;
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size === 0) return;

          try {
            setIsTranscribing(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64Audio = (reader.result as string)?.split(',')[1];
                if (!base64Audio) return;
                await onAudioCapturedRef.current(base64Audio, mimeType, liveAutoSend);
              } catch (innerErr: unknown) {
                console.error('Erro no envio de voz Live:', innerErr);
                setMicError('Erro ao processar áudio com o Agente Live.');
              } finally {
                setIsTranscribing(false);
              }
            };
            reader.readAsDataURL(audioBlob);
          } catch (err: unknown) {
            console.error('Erro na gravação Live:', err);
            setIsTranscribing(false);
          }
        };

        mediaRecorder.start(250);
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        console.warn('Microfone indisponível ou permissão negada:', err);
        setMicError('Autorize o microfone no navegador para usar o ditado e o modo Live API.');
        setIsRecording(false);
      }
    },
    [isRecording, stopRecordingNow]
  );

  return {
    isRecording,
    recordingSeconds,
    isTranscribing,
    micError,
    setMicError,
    voiceBands,
    stopRecordingNow,
    toggleRecording,
  };
}
