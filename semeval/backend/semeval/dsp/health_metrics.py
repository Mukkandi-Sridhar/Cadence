"""
AudioHealthAgent DSP calculations (pure DSP — no LLM).
Computes RMS level, SNR estimate, clipping ratio, silence ratio, speech-to-total ratio.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class AudioHealthMetrics:
    rms_dbfs: float
    snr_db: float
    clipping_ratio: float
    silence_ratio: float
    speech_ratio: float
    estimated_distance_proxy: float
    warnings: list[dict[str, str | int]]
    quality_gate: str  # "PASS", "LOW_CONFIDENCE", "FAIL"


def calculate_audio_health(
    pcm_data: Sequence[float] | np.ndarray,
    sample_rate: int = 16000,
    rms_too_quiet_dbfs: float = -45.0,
    rms_clipping_dbfs: float = -1.0,
    snr_low_confidence_db: float = 10.0,
) -> AudioHealthMetrics:
    """
    Computes RMS level, SNR estimate, clipping ratio, silence ratio, speech ratio.
    Pure DSP math — numpy based.
    """
    samples = np.asarray(pcm_data, dtype=np.float32)
    if len(samples) == 0:
        return AudioHealthMetrics(
            rms_dbfs=-96.0,
            snr_db=0.0,
            clipping_ratio=0.0,
            silence_ratio=1.0,
            speech_ratio=0.0,
            estimated_distance_proxy=10.0,
            warnings=[{
                "code": "MIC_MUTED",
                "message": "No audio samples received",
                "start_ms": 0,
                "end_ms": 0,
            }],
            quality_gate="FAIL",
        )

    # 1. RMS level in dBFS
    rms = np.sqrt(np.mean(samples**2)) + 1e-12
    rms_dbfs = float(20 * np.log10(rms))

    # 2. Clipping ratio (samples >= 0.99 or <= -0.99)
    clipped_count = np.sum(np.abs(samples) >= 0.99)
    clipping_ratio = float(clipped_count / len(samples))

    # 3. Silence ratio & Speech ratio using frame-based energy
    frame_len = int(sample_rate * 0.03)  # 30ms frames
    num_frames = len(samples) // frame_len
    warnings: list[dict[str, str | int]] = []

    if num_frames > 0:
        frames = samples[: num_frames * frame_len].reshape(num_frames, frame_len)
        frame_energies = np.mean(frames**2, axis=1) + 1e-12
        frame_db = 10 * np.log10(frame_energies)

        noise_floor_db = float(np.percentile(frame_db, 10))
        peak_speech_db = float(np.percentile(frame_db, 90))
        snr_db = float(peak_speech_db - noise_floor_db)

        speech_mask = frame_db > (noise_floor_db + 6.0)
        speech_ratio = float(np.mean(speech_mask))
        silence_ratio = 1.0 - speech_ratio
    else:
        snr_db = 15.0
        speech_ratio = 0.8
        silence_ratio = 0.2

    # 4. Proxy distance estimate (in meters, based on inverse square law proxy)
    dist_proxy = float(max(0.2, min(5.0, 10 ** ((-20.0 - rms_dbfs) / 20.0))))

    # Quality Gate Rules
    quality_gate = "PASS"

    if rms_dbfs < rms_too_quiet_dbfs:
        warnings.append({
            "code": "TOO_QUIET",
            "message": f"Audio is too quiet ({rms_dbfs:.1f} dBFS). Move closer to the microphone.",
            "start_ms": 0,
            "end_ms": int(len(samples) / sample_rate * 1000),
        })
        quality_gate = "LOW_CONFIDENCE"

    if clipping_ratio > 0.01 or rms_dbfs > rms_clipping_dbfs:
        warnings.append({
            "code": "CLIPPING",
            "message": (
                f"Microphone is clipping/distorting ({clipping_ratio*100:.1f}% clipped)."
                " Lower gain."
            ),
            "start_ms": 0,
            "end_ms": int(len(samples) / sample_rate * 1000),
        })
        quality_gate = "LOW_CONFIDENCE"

    if snr_db < snr_low_confidence_db:
        warnings.append({
            "code": "HEAVY_NOISE",
            "message": f"Heavy background noise detected (SNR {snr_db:.1f} dB).",
            "start_ms": 0,
            "end_ms": int(len(samples) / sample_rate * 1000),
        })
        quality_gate = "LOW_CONFIDENCE"

    if rms_dbfs < -60.0:
        quality_gate = "FAIL"

    return AudioHealthMetrics(
        rms_dbfs=round(rms_dbfs, 2),
        snr_db=round(snr_db, 2),
        clipping_ratio=round(clipping_ratio, 4),
        silence_ratio=round(silence_ratio, 4),
        speech_ratio=round(speech_ratio, 4),
        estimated_distance_proxy=round(dist_proxy, 2),
        warnings=warnings,
        quality_gate=quality_gate,
    )
