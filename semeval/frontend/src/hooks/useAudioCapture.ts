import { useEffect, useRef, useState, useCallback } from "react";
import { saveAudioChunk } from "../lib/idb";
import { useRecordingStore } from "../store/recordingStore";

export function useAudioCapture() {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkSeqRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const { isRecording, setAudioHealth } = useRecordingStore();

  const requestMicPermission = useCallback(async (deviceId: string = "default") => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId !== "default" ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setPermissionGranted(true);

      // Web Audio Context for RMS level meter
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Meter animation loop
      const pcmData = new Float32Array(analyser.fftSize);
      const updateMeter = () => {
        analyser.getFloatTimeDomainData(pcmData);
        let sumSquares = 0;
        for (let i = 0; i < pcmData.length; i++) {
          sumSquares += pcmData[i] * pcmData[i];
        }
        const rms = Math.sqrt(sumSquares / pcmData.length);
        const dbfs = 20 * Math.log10(Math.max(rms, 1e-5));
        const normalized = Math.max(0, Math.min(100, (dbfs + 60) * (100 / 60)));
        setMicVolume(normalized);

        setAudioHealth({
          rmsDbfs: Math.round(dbfs * 10) / 10,
          qualityGate: dbfs < -45 ? "LOW_CONFIDENCE" : dbfs > -1 ? "LOW_CONFIDENCE" : "PASS",
        });

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      return stream;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setPermissionGranted(false);
      return null;
    }
  }, [setAudioHealth]);

  const startCapture = useCallback(async (recordingId: string) => {
    let stream = mediaStreamRef.current;
    if (!stream) {
      stream = await requestMicPermission();
    }
    if (!stream) return;

    chunkSeqRef.current = 0;
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = async (e: BlobEvent) => {
      if (e.data.size > 0) {
        chunkSeqRef.current += 1;
        const seq = chunkSeqRef.current;
        const arrayBuffer = await e.data.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        await saveAudioChunk({
          id: `${recordingId}:${seq}`,
          recordingId,
          seq,
          blob: e.data,
          sha256,
          byteSize: e.data.size,
          createdAt: Date.now(),
          uploaded: false,
        });
      }
    };

    mediaRecorder.start(2000); // 2-second durable chunk interval
  }, [requestMicPermission]);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopCapture]);

  return {
    permissionGranted,
    micVolume,
    requestMicPermission,
    startCapture,
    stopCapture,
    isRecording,
  };
}
