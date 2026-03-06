import shlex
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from desloppify.languages._framework.generic_parts.parsers import ToolParserError

SubprocessRun = Callable[..., subprocess.CompletedProcess[str]]

@dataclass(frozen=True)
class ToolRunResult:
    """Structured execution result for generic-tool detector commands."""

    entries: list[dict]
    status: Literal["ok", "empty", "error"]
    error_kind: str | None = None
    message: str | None = None
    returncode: int | None = None


def resolve_command_argv(cmd: str) -> list[str]:
    """Return argv for subprocess.run without relying on shell=True."""
    try:
        argv = shlex.split(cmd, posix=True)
        # Quote each argument to prevent injection
        argv = [shlex.quote(arg) for arg in argv]
        return argv
    except ValueError:
        # Log the error for debugging
        print(f"ValueError when splitting command: {cmd}")
        return []  # Or raise an exception, depending on desired behavior


def run_tool_result(
    cmd: str,
    path: Path,
    parser: Callable[[str, Path], list[dict]],
    *,
    run_subprocess: SubprocessRun | None = None,
) -> ToolRunResult:
    """Run an external tool and parse its output with explicit failure status."""
    runner = run_subprocess or subprocess.run
    try:
        argv = resolve_command_argv(cmd)
        if not argv:
            return ToolRunResult(
                entries=[],
                status="error",
                error_kind="invalid_command",
                message=f"Invalid command: {cmd}",
            )
        result = runner(
            argv,
            shell=False,
            cwd=str(path),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as exc:
        return ToolRunResult(
            entries=[],
            status="error",
            error_kind="tool_not_found",
            message=str(exc),
        )
    except subprocess.TimeoutExpired as exc:
        return ToolRunResult(
            entries=[],
            status="error",
            error_kind="tool_timeout",
            message=str(exc),
        )
    output = (result.stdout or "") + (result.stderr or "")
    if not output.strip():
        if result.returncode not in (0, None):
            return ToolRunResult(
                entries=[],
                status="error",
                error_kind="tool_failed_no_output",
                message=f"tool exited with code {result.returncode} and produced no output",
                returncode=result.returncode,
            )
        return ToolRunResult(
            entries=[],
            status="empty",
            returncode=result.returncode,
        )
    try:
        parsed = parser(output, path)
    except ToolParserError as exc:
        logger.debug("Parser decode error for tool output: %s", exc)
        return ToolRunResult(
            entries=[],
            status="error",
            error_kind="parser_error",
            message=str(exc),
            returncode=result.returncode,
        )
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        logger.debug("Skipping tool output due to parser exception: %s", exc)
        return ToolRunResult(
            entries=[],
            status="error",
            error_kind="parser_exception",
            message=str(exc),
            returncode=result.returncode,
        )
    if not isinstance(parsed, list):
        return ToolRunResult(
            entries=[],
            status="error",
            error_kind="parser_shape_error",
            message="parser returned non-list output",
            returncode=result.returncode,
        )
    if not parsed:
        if result.returncode not in (0, None):
            preview = _output_preview(output)
            return ToolRunResult(
                entries=[],
                status="error",
                error_kind="tool_failed_unparsed_output",
                message=(
                    f"tool exited with code {result.returncode} and produced no parseable entries"
                    + (f": {preview}" if preview else "")
                ),
                returncode=result.returncode,
            )
        return ToolRunResult(
            entries=[],
            status="empty",
            returncode=result.returncode,
        )
    return ToolRunResult(
        entries=parsed,
        status="ok",
        returncode=result.returncode,
    )
