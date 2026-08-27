"""
Prompt injection detector for presenter transcripts.
Flags attempts to hijack agent rubrics or inject instructions into transcript data.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"give\s+me\s+(a\s+)?100",
    r"give\s+me\s+(a\s+)?full\s+score",
    r"disregard\s+(the\s+)?rubric",
    r"system\s*:\s*",
    r"you\s+are\s+now\s+a",
    r"forget\s+everything",
    r"new\s+rule\s*:",
    r"override\s+score",
]


@dataclass(frozen=True)
class InjectionCheckResult:
    is_detected: bool
    pattern_matched: str | None
    flag_reason: str | None


def detect_prompt_injection(transcript_text: str) -> InjectionCheckResult:
    """
    Scans transcript text for known prompt injection signatures.
    Returns an InjectionCheckResult. Flags to organizer; does NOT mutate transcript.
    """
    for pattern in INJECTION_PATTERNS:
        match = re.search(pattern, transcript_text, re.IGNORECASE)
        if match:
            return InjectionCheckResult(
                is_detected=True,
                pattern_matched=match.group(0),
                flag_reason=f"Matched injection signature: '{match.group(0)}'",
            )
    return InjectionCheckResult(is_detected=False, pattern_matched=None, flag_reason=None)
