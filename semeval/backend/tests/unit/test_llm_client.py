"""
Unit tests for the LLM Client JSON schema validation and mock generation.
"""

from __future__ import annotations

from typing import Any

import pytest
from jsonschema import validate
from jsonschema.exceptions import ValidationError

TEST_SCHEMA = {
    "type": "object",
    "required": ["sub_score", "reason"],
    "properties": {
        "sub_score": {"type": "integer", "minimum": 0, "maximum": 5},
        "reason": {"type": "string"},
    },
}


class TestLLMValidationBoundary:
    def test_schema_valid_output(self) -> None:
        valid_output: dict[str, Any] = {"sub_score": 4, "reason": "Clear coverage of topics."}
        validate(instance=valid_output, schema=TEST_SCHEMA)

    def test_schema_invalid_subscore_out_of_range(self) -> None:
        invalid_output: dict[str, Any] = {"sub_score": 10, "reason": "Out of range score."}
        with pytest.raises(ValidationError):
            validate(instance=invalid_output, schema=TEST_SCHEMA)

    def test_schema_missing_required_property(self) -> None:
        invalid_output: dict[str, Any] = {"sub_score": 4}
        with pytest.raises(ValidationError):
            validate(instance=invalid_output, schema=TEST_SCHEMA)
