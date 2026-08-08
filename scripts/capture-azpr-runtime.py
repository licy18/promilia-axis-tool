from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    import frida
except ImportError as error:
    raise SystemExit(
        "Python package 'frida' is required. Install frida-tools before capture."
    ) from error


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = (
    PROJECT_ROOT / "src/data/generated/runtime-capture-hook-manifest.json"
)
AGENT_PATH = (
    PROJECT_ROOT
    / "runtime-capture/frida/azpr-runtime-capture-agent.js"
)
CAPTURE_TOOL_NAME = "promilia-axis-controlled-frida-capture"
CAPTURE_TOOL_VERSION = "1.2.0"
CAPTURE_KINDS = ("all", "role-sp", "kibo-energy", "toughness")
ENEMY_SETTLEMENT_EVIDENCE_PATH = (
    PROJECT_ROOT
    / "scripts/machine-axis/evidence/enemy-toughness-settlement-runtime-evidence.json"
)


class JsonLinesWriter:
    def __init__(self, output_path: Path, overwrite: bool) -> None:
        if output_path.exists() and not overwrite:
            raise FileExistsError(
                f"Capture output already exists: {output_path}. Use --overwrite explicitly."
            )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path = output_path
        self.handle = output_path.open("w", encoding="utf-8", newline="\n")
        self.event_count = 0
        self.event_received = threading.Event()
        self.diagnostics: list[dict[str, Any]] = []

    def write(self, record: dict[str, Any]) -> None:
        self.handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        self.handle.write("\n")
        self.handle.flush()
        if record.get("recordType") == "event":
            self.event_count += 1
            self.event_received.set()

    def close(self) -> None:
        self.handle.close()

    def add_diagnostic(self, diagnostic: dict[str, Any]) -> None:
        self.diagnostics.append(diagnostic)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Explicit controlled Azur Promilia runtime capture host."
    )
    parser.add_argument("--pid", type=int)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--capture-session-id")
    parser.add_argument("--action-id")
    parser.add_argument("--actor-id")
    parser.add_argument("--target-id")
    parser.add_argument("--slot-id")
    parser.add_argument("--kibo-id", type=int)
    parser.add_argument("--source-element-config-id", type=int)
    parser.add_argument("--capture-kind", choices=CAPTURE_KINDS, default="all")
    parser.add_argument("--duration", type=float, default=30.0)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--confirm-controlled-session", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--preflight", action="store_true")
    return parser.parse_args()


def main() -> int:
    options = parse_arguments()
    if options.preflight:
        return run_capture_preflight(options)
    if options.self_test:
        return run_self_test(options)
    validate_capture_options(options)
    return run_game_capture(options)


def validate_capture_options(options: argparse.Namespace) -> None:
    if not options.confirm_controlled_session:
        raise SystemExit(
            "Refusing to attach without --confirm-controlled-session. "
            "The host never launches the game or bypasses anti-cheat."
        )
    missing = [
        name
        for name in ("pid", "output", "action_id", "actor_id", "target_id")
        if getattr(options, name) in (None, "")
    ]
    if missing:
        raise SystemExit(f"Missing required capture arguments: {', '.join(missing)}")
    if options.duration < 0:
        raise SystemExit("--duration must be zero or positive")
    has_slot_id = bool(options.slot_id)
    has_kibo_id = options.kibo_id is not None
    if has_slot_id != has_kibo_id:
        raise SystemExit("--slot-id and --kibo-id must be provided together")
    if has_kibo_id and options.kibo_id <= 0:
        raise SystemExit("--kibo-id must be a positive integer")
    if options.capture_kind == "kibo-energy" and not has_slot_id:
        raise SystemExit(
            "--capture-kind kibo-energy requires --slot-id and --kibo-id"
        )
    if options.capture_kind in ("role-sp", "toughness") and has_slot_id:
        raise SystemExit(
            f"--slot-id and --kibo-id are not valid for --capture-kind {options.capture_kind}"
        )


def run_capture_preflight(options: argparse.Namespace) -> int:
    manifest_path = options.manifest.resolve()
    manifest = read_json(manifest_path)
    validate_manifest(manifest)
    evidence = read_json(ENEMY_SETTLEMENT_EVIDENCE_PATH)
    client_sources = [
        ("gameAssembly", evidence["reviewedBinary"]),
        ("il2CppDump", evidence["reviewedIl2CppDump"]),
        ("il2CppScript", evidence["reviewedIl2CppScript"]),
    ]
    client_identities = []
    for kind, expected in client_sources:
        source_path = Path(expected["path"])
        exists = source_path.is_file()
        actual_size = source_path.stat().st_size if exists else None
        actual_sha256 = sha256_file(source_path) if exists else None
        client_identities.append(
            {
                "kind": kind,
                "path": str(source_path).replace("\\", "/"),
                "exists": exists,
                "expectedBytes": expected["bytes"],
                "actualBytes": actual_size,
                "expectedSha256": expected["sha256"],
                "actualSha256": actual_sha256,
                "matches": bool(
                    exists
                    and actual_size == expected["bytes"]
                    and actual_sha256 == expected["sha256"]
                ),
            }
        )

    process_candidates = []
    for process in frida.get_local_device().enumerate_processes(scope="full"):
        parameters = process.parameters or {}
        process_path = str(parameters.get("path") or "").replace("\\", "/")
        if process.name.lower() == "azurpromilia.exe" or process_path.lower().endswith(
            "/azurpromilia.exe"
        ):
            process_candidates.append(
                {
                    "pid": process.pid,
                    "name": process.name,
                    "path": process_path or None,
                }
            )

    identities_match = all(row["matches"] for row in client_identities)
    source_process_detected = len(process_candidates) > 0
    if not identities_match:
        status = "blocked-client-identity-mismatch"
        blocker = "machine-axis-controlled-capture-client-identity-mismatch"
    elif not source_process_detected:
        status = "blocked-source-game-process-required"
        blocker = "machine-axis-controlled-capture-source-game-process-required"
    else:
        status = "blocked-formal-scenario-and-explicit-attach-confirmation-required"
        blocker = "machine-axis-controlled-capture-formal-scenario-unverified"

    report = {
        "schemaVersion": 1,
        "reportName": "AzPrMachineAxisEnemyToughnessControlledCapturePreflight",
        "phase": "M12-B3-OPT-T3",
        "checkedAt": datetime.now(UTC).isoformat(),
        "status": status,
        "blockerCode": blocker,
        "realCaptureClaimAllowed": False,
        "attachAttempted": False,
        "automaticLaunchAttempted": False,
        "antiCheatBypassAttempted": False,
        "manifest": {
            "path": str(manifest_path).replace("\\", "/"),
            "manifestId": manifest["manifestId"],
            "bytes": manifest_path.stat().st_size,
            "sha256": sha256_file(manifest_path),
        },
        "clientIdentities": client_identities,
        "tooling": {
            "captureToolName": CAPTURE_TOOL_NAME,
            "captureToolVersion": CAPTURE_TOOL_VERSION,
            "fridaVersion": getattr(frida, "__version__", "unknown"),
            "captureHostSha256": sha256_file(Path(__file__).resolve()),
            "agentSha256": sha256_file(AGENT_PATH),
        },
        "processProbe": {
            "kind": "frida-local-device-full-enumeration-no-attach",
            "sourceGameProcessDetected": source_process_detected,
            "candidates": process_candidates,
        },
        "scenarioProbe": {
            "policyId": "m12c-zero-distance-passive-boss-v1",
            "required": {
                "distance": 0,
                "enemyStationary": True,
                "enemyDoesNotAttack": True,
                "reactiveStimuliDisabled": True,
            },
            "verified": False,
            "reason": "source client process and operator-controlled formal scenario are not available to this preflight",
        },
        "captureRequirements": {
            "captureKind": "toughness",
            "controlledSessionConfirmationRequired": True,
            "operatorExecutesCombat": True,
            "leavesOpen": evidence["conclusion"]["leavesOpen"],
            "requiredCorrelation": [
                "eventIdentity",
                "sourceSequencePath",
                "captureSequence",
                "clientFrameCount",
                "threadId",
                "clientDeltaTimeSeconds",
                "hookInvocationIdentity",
            ],
        },
        "character112001Probe": {
            "status": "blocked-no-real-controlled-action-executed",
            "requiredObservations": [
                "single-packet-damage-or-overlimit-hp-toughness-break-order",
                "191f-wrapper-applies-to-current-packet-or-not",
                "128f-watcher-order-relative-to-same-packet-break",
                "authoritative-break-event-and-cursor",
                "observer-active-at-break",
            ],
            "equivalentProbeAllowed": True,
            "equivalentCallChainProofRequired": True,
        },
        "formalGate": {
            "formalReady": False,
            "formalScore": None,
            "blockerCode": "machine-axis-enemy-settlement-client-order-open",
        },
        "requiredOperatorSteps": [
            "Launch the bound TC client manually and complete login without disabling or bypassing anti-cheat.",
            "Enter the zero-distance stationary non-attacking boss scenario and prepare 112001 or a proven equivalent consumer probe.",
            "Provide the AzurPromilia.exe PID and explicitly confirm the controlled Frida attach for this one session.",
            "Execute identifiable breaking, same-frame follow-up, break-end boundary, and finite-HP lethal-tail probes while capture is running.",
        ],
    }
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if options.output:
        output_path = options.output.resolve()
        assert_output_available(output_path, options.overwrite)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized, encoding="utf-8", newline="\n")
    print(serialized, end="")
    return 0


def run_game_capture(options: argparse.Namespace) -> int:
    manifest_path = options.manifest.resolve()
    manifest = read_json(manifest_path)
    validate_manifest(manifest)
    agent_source = AGENT_PATH.read_text(encoding="utf-8")
    session_id = options.capture_session_id or default_session_id("azpr-runtime")
    output_path = options.output.resolve()
    assert_output_available(output_path, options.overwrite)
    writer: JsonLinesWriter | None = None
    session = None
    script = None
    stop_result: dict[str, Any] | None = None

    try:
        session = frida.attach(options.pid)
        script = session.create_script(agent_source, runtime="v8")
        script.load()
        module_info = script.exports_sync.inspectmodule(
            manifest["source"]["moduleName"]
        )
        verified_module = verify_loaded_module(manifest, module_info)
        manifest_sha256 = sha256_file(manifest_path)
        writer = JsonLinesWriter(output_path, options.overwrite)
        script.on("message", create_message_handler(writer))
        writer.write(
            create_session_record(
                session_id=session_id,
                source="source-game-runtime-frida-controlled-session",
                manifest=manifest,
                manifest_sha256=manifest_sha256,
                module_info=verified_module,
                process_id=options.pid,
                capture_kind=options.capture_kind,
                binding=create_capture_binding(options),
            )
        )
        start_result = script.exports_sync.startcapture(
            {
                "manifest": manifest,
                "captureSessionId": session_id,
                "actionId": options.action_id,
                "actorId": options.actor_id,
                "targetId": options.target_id,
                "slotId": options.slot_id,
                "kiboId": options.kibo_id,
                "sourceElementConfigId": options.source_element_config_id,
                "captureKind": options.capture_kind,
            }
        )
        print(json.dumps(start_result, ensure_ascii=False), file=sys.stderr)
        wait_for_capture_duration(options.duration)
        stop_result = script.exports_sync.stopcapture()
        print(json.dumps(stop_result, ensure_ascii=False), file=sys.stderr)
    except KeyboardInterrupt:
        if script is not None:
            try:
                stop_result = script.exports_sync.stopcapture()
            except frida.InvalidOperationError:
                pass
    finally:
        if writer is not None and stop_result is not None:
            wait_for_event_delivery(
                writer, int(stop_result.get("emittedEventCount", 0))
            )
            writer.write(
                create_capture_end_record(
                    session_id=session_id,
                    writer=writer,
                    stop_result=stop_result,
                )
            )
        if script is not None:
            try:
                script.unload()
            except frida.InvalidOperationError:
                pass
        if session is not None:
            try:
                session.detach()
            except frida.InvalidOperationError:
                pass
        if writer is not None:
            writer.close()

    print(
        json.dumps(
            {
                "outputPath": str(output_path),
                "captureSessionId": session_id,
                "captureKind": options.capture_kind,
                "eventCount": writer.event_count if writer is not None else 0,
            },
            ensure_ascii=False,
        )
    )
    return 0


def run_self_test(options: argparse.Namespace) -> int:
    output_path = (
        options.output.resolve()
        if options.output
        else Path(tempfile.gettempdir())
        / f"promilia-runtime-capture-{default_session_id('self-test')}.jsonl"
    )
    session_id = options.capture_session_id or default_session_id("self-test")
    writer = JsonLinesWriter(output_path, options.overwrite)
    child = start_self_test_target()
    session = None
    script = None
    stop_result: dict[str, Any] | None = None

    try:
        pid_line = child.stdout.readline().strip()
        if not pid_line.isdigit():
            raise RuntimeError(f"Self-test target did not report a PID: {pid_line!r}")
        process_id = int(pid_line)
        session = frida.attach(process_id)
        script = session.create_script(
            AGENT_PATH.read_text(encoding="utf-8"), runtime="v8"
        )
        script.on("message", create_message_handler(writer))
        script.load()
        writer.write(
            {
                "recordType": "capture-session",
                "schemaVersion": 1,
                "captureSessionId": session_id,
                "clientRegion": "LOCAL",
                "clientBuild": "controlled-frida-self-test",
                "source": "controlled-frida-self-test",
                "captureTool": {
                    "name": CAPTURE_TOOL_NAME,
                    "version": CAPTURE_TOOL_VERSION,
                    "fridaVersion": getattr(frida, "__version__", "unknown"),
                    "hookManifestId": "self-test-kernel32-sleep",
                },
                "processId": process_id,
            }
        )
        script.exports_sync.startselftest({"captureSessionId": session_id})
        child.stdin.write("GO\n")
        child.stdin.flush()
        completion_line = child.stdout.readline().strip()
        if completion_line != "DONE":
            raise RuntimeError(
                f"Self-test target did not complete probes: {completion_line!r}"
            )
        deadline = time.monotonic() + 3
        while writer.event_count < 3 and time.monotonic() < deadline:
            writer.event_received.wait(0.1)
            writer.event_received.clear()
        stop_result = script.exports_sync.stopcapture()
        if writer.event_count < 3:
            raise RuntimeError(
                f"Frida self-test captured {writer.event_count} events; expected at least 3"
            )
        wait_for_event_delivery(writer, int(stop_result.get("emittedEventCount", 0)))
        writer.write(
            create_capture_end_record(
                session_id=session_id,
                writer=writer,
                stop_result=stop_result,
            )
        )
        child.stdin.write("STOP\n")
        child.stdin.flush()
        child.wait(timeout=10)
    finally:
        if script is not None:
            try:
                script.unload()
            except frida.InvalidOperationError:
                pass
        if session is not None:
            try:
                session.detach()
            except frida.InvalidOperationError:
                pass
        if child.poll() is None:
            child.kill()
        writer.close()

    print(
        json.dumps(
            {
                "status": "controlled-frida-self-test-passed",
                "outputPath": str(output_path),
                "captureSessionId": session_id,
                "eventCount": writer.event_count,
                "agentStop": stop_result,
            },
            ensure_ascii=False,
        )
    )
    return 0


def create_message_handler(writer: JsonLinesWriter):
    def on_message(message: dict[str, Any], data: bytes | None) -> None:
        del data
        if message.get("type") == "send":
            payload = message.get("payload", {})
            if payload.get("channel") == "capture-event":
                writer.write(payload["record"])
            else:
                status = payload.get("status", "unknown")
                if status != "capture-agent-started":
                    writer.add_diagnostic(
                        {
                            "kind": "agent-status",
                            "status": status,
                        }
                    )
                print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)
            return
        writer.add_diagnostic(
            {"kind": "frida-message", "type": message.get("type", "unknown")}
        )
        print(json.dumps(message, ensure_ascii=False), file=sys.stderr)

    return on_message


def create_session_record(
    *,
    session_id: str,
    source: str,
    manifest: dict[str, Any],
    manifest_sha256: str,
    module_info: dict[str, Any],
    process_id: int,
    capture_kind: str,
    binding: dict[str, Any],
) -> dict[str, Any]:
    module_sha256 = module_info["sha256"]
    return {
        "recordType": "capture-session",
        "schemaVersion": 1,
        "captureSessionId": session_id,
        "clientRegion": manifest["source"]["clientRegion"],
        "clientBuild": (
            f"{manifest['source']['clientSnapshot']}:{module_sha256[:12]}"
        ),
        "source": source,
        "captureKind": capture_kind,
        "binding": binding,
        "captureTool": {
            "name": CAPTURE_TOOL_NAME,
            "version": CAPTURE_TOOL_VERSION,
            "fridaVersion": getattr(frida, "__version__", "unknown"),
            "hookManifestId": manifest["manifestId"],
            "hookManifestSha256": manifest_sha256,
        },
        "processId": process_id,
        "module": module_info,
        "startedAt": datetime.now(UTC).isoformat(),
    }


def create_capture_binding(options: argparse.Namespace) -> dict[str, Any]:
    return {
        "actionId": options.action_id,
        "actorId": options.actor_id,
        "targetId": options.target_id,
        "slotId": options.slot_id,
        "kiboId": options.kibo_id,
        "sourceElementConfigId": options.source_element_config_id,
    }


def create_capture_end_record(
    *,
    session_id: str,
    writer: JsonLinesWriter,
    stop_result: dict[str, Any],
) -> dict[str, Any]:
    return {
        "recordType": "capture-session-end",
        "schemaVersion": 1,
        "captureSessionId": session_id,
        "status": "capture-complete",
        "agentEmittedEventCount": int(stop_result.get("emittedEventCount", -1)),
        "hostReceivedEventCount": writer.event_count,
        "finalCaptureSequence": int(stop_result.get("finalCaptureSequence", -1)),
        "damagePacketCount": int(stop_result.get("damagePacketCount", 0)),
        "hookInvocationCount": int(stop_result.get("hookInvocationCount", 0)),
        "openThreadStateCount": int(stop_result.get("openThreadStateCount", -1)),
        "diagnosticCount": len(writer.diagnostics),
        "diagnostics": list(writer.diagnostics),
        "completedAt": datetime.now(UTC).isoformat(),
    }


def wait_for_event_delivery(
    writer: JsonLinesWriter, expected_event_count: int, timeout: float = 2.0
) -> None:
    deadline = time.monotonic() + timeout
    while writer.event_count < expected_event_count and time.monotonic() < deadline:
        writer.event_received.wait(0.05)
        writer.event_received.clear()


def verify_loaded_module(
    manifest: dict[str, Any], module_info: dict[str, Any]
) -> dict[str, Any]:
    module_path = Path(module_info["path"]).resolve()
    expected = manifest["source"]["module"]
    actual_size = module_path.stat().st_size
    actual_sha256 = sha256_file(module_path)
    if actual_size != expected["size"] or actual_sha256 != expected["sha256"]:
        raise RuntimeError(
            "Loaded GameAssembly.dll does not match the hook manifest. "
            "Regenerate the manifest for this client build before capture."
        )
    return {
        **module_info,
        "path": str(module_path).replace("\\", "/"),
        "fileSize": actual_size,
        "sha256": actual_sha256,
    }


def validate_manifest(manifest: dict[str, Any]) -> None:
    if (
        manifest.get("game") != "azur-promilia"
        or manifest.get("kind") != "runtime-capture-hook-manifest"
        or not manifest.get("source", {}).get("module", {}).get("sha256")
    ):
        raise SystemExit("Runtime capture hook manifest is invalid or incomplete")


def assert_output_available(output_path: Path, overwrite: bool) -> None:
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Capture output already exists: {output_path}. Use --overwrite explicitly."
        )


def wait_for_capture_duration(duration: float) -> None:
    if duration == 0:
        while True:
            time.sleep(0.25)
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        time.sleep(min(0.25, max(0, deadline - time.monotonic())))


def start_self_test_target() -> subprocess.Popen[str]:
    target = (
        "import ctypes,os,sys\n"
        "print(os.getpid(), flush=True)\n"
        "sys.stdin.readline()\n"
        "sleep=ctypes.WinDLL('kernel32', use_last_error=True).Sleep\n"
        "sleep.argtypes=[ctypes.c_uint32]\n"
        "for _ in range(4): sleep(20)\n"
        "print('DONE', flush=True)\n"
        "sys.stdin.readline()\n"
    )
    return subprocess.Popen(
        [sys.executable, "-u", "-c", target],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


def default_session_id(prefix: str) -> str:
    return f"{prefix}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
