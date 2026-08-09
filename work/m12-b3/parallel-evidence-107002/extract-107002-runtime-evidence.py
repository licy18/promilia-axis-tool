from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pefile
import UnityPy
from capstone import CS_ARCH_X86, CS_MODE_64, Cs


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
OUTPUT_PATH = HERE / "runtime-evidence-excerpt.json"
INHERITED_EVIDENCE_BASELINE = "140eefcd233cd9c1d136728f1c94b91aff632278"
EXPECTED_BASELINE = "1a56e0a295f31298da6c3ddb5d70db90183971fb"
EXPECTED_BRANCH = "fix/m12-b3-107002-charged-absorb"
ALLOWED_PREFIX = "work/m12-b3/parallel-evidence-107002/"
ALLOWED_IMPLEMENTATION_PATHS = (
    "fixtures/character-acceptance/107002-visual.json",
    "reports/m10/107002/**",
    "reports/m11/character-acceptance/107002/**",
    "schemas/azpr-machine-axis-v1.schema.json",
    "scripts/generate-character-acceptance.mjs",
    "scripts/character-acceptance/acceptance-recipes/107002.json",
    "scripts/character-combat/character-combat-contract-compiler.mjs",
    "scripts/character-combat/character-combat-golden-runtime.mjs",
    "scripts/character-combat/character-combat-production-orchestrator.mjs",
    "scripts/character-combat/character-combat-profile-pipeline.mjs",
    "scripts/character-combat/profile-recipes/107002.json",
    "scripts/optimization-scenario/optimization-scenario-policy-source.mjs",
    "scripts/sync-verified-combat-mechanics.mjs",
    "src/__tests__/character-acceptance/characterAcceptance107002.test.js",
    "src/__tests__/data/misaCharacterCombatProfile.test.js",
    "src/__tests__/simulation/actionRuleDiagnostics.test.js",
    "src/__tests__/simulation/effectRuntimeTimeline.test.js",
    "src/__tests__/simulation/verifiedBattleEffectFormulaRuntime.test.js",
    "src/__tests__/simulation/verifiedPickupEntityGeneration.test.js",
    "src/__tests__/simulation/verifiedPickupOwnerActionAbsorb.test.js",
    "src/__tests__/simulation/verifiedTargetStateRuntime.test.js",
    "src/__tests__/simulation/verifiedTuningMarkRuntime.test.js",
    "src/data/generated/character-combat-owner-contracts/107002.json",
    "src/data/generated/character-combat-profiles/107002.json",
    "src/domain/combatScenario.js",
    "src/machine-axis/machineAxisContract.js",
    "src/machine-axis/machineAxisService.js",
    "src/machine-axis/workbenchMachineAxisAdapter.js",
    "src/simulation/engine/simulateScenario.js",
    "src/simulation/mechanics/verifiedBattleEffectFormulaRuntime.js",
    "src/simulation/mechanics/verifiedBattleEffectGeneration.js",
    "src/simulation/mechanics/verifiedCombatRuntime.js",
    "src/simulation/mechanics/verifiedPickupEntityGeneration.js",
    "src/simulation/mechanics/verifiedTargetStateRuntime.js",
    "src/simulation/mechanics/verifiedTuningMarkGeneration.js",
    "src/simulation/projection/projectSimulationResult.js",
    "src/simulation/runtime/effectRuntimeTimeline.js",
)

EXTRACTOR_ROOT = Path(r"C:\Codex\AzPr Extractor")
EXTRACTOR_SCRIPTS = EXTRACTOR_ROOT / "scripts"
PACKAGE_DIR = (
    EXTRACTOR_ROOT
    / "AzurPromilia_Data"
    / "StreamingAssets"
    / ".res"
    / "default_package"
)
MANIFEST_PATH = PACKAGE_DIR / "betatc_default_package_1484109.bytes"
BATTLE_ELEMENT_INDEX = Path(
    r"C:\PC2\Codex\AzPr\work\combat-formulas\battle-element-assets.jsonl"
)
DUMP_PATH = Path(
    r"C:\PC2\Codex\AzPr\outputs\il2cpp-tc-catch-20260709\dump.cs"
)
GAME_ASSEMBLY_PATH = Path(r"C:\AP\AzurPromilia_TC\AzurPromilia_game\GameAssembly.dll")

CONTROL_LOGICAL_NAME = (
    "d_assets_resourcesassets_config_battle_skilllist_skill_control_10700261"
)
TRACK_LOGICAL_NAME = (
    "d_sh_assets_program_battle_character_config_hero_107002_subskill_"
    "ast_17515239739020000"
)

CONTROL_ROOT_PATH_ID = -1811589296711041965
TRACK_PATH_ID = -2651181542894854447
BEHAVIOR_PATH_ID = -3169485345798086959
PASSIVE_MARKER_PATH_ID = 7643301625766811642

EXECUTE_RVA = 0x1386C60
EXPECTED_DIRECT_CALLS = {
    0x1385260: "CalculateConsumeCount",
    0x1385C40: "CastPassiveSkill",
    0x13863F0: "DoConsume",
    0x1386950: "DoInject",
}


def normalize_path(file_path: Path) -> str:
    return file_path.resolve().as_posix()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_record(file_path: Path) -> dict[str, Any]:
    return {
        "sourceIdentity": normalize_path(file_path),
        "bytes": file_path.stat().st_size,
        "sha256": sha256_bytes(file_path.read_bytes()),
    }


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=REPO_ROOT,
        text=True,
        encoding="utf-8",
        stderr=subprocess.PIPE,
    ).strip()


def git_lines(*args: str) -> list[str]:
    return [
        line.strip().replace("\\", "/")
        for line in git(*args).splitlines()
        if line.strip()
    ]


def is_allowed_carrier_path(value: str) -> bool:
    normalized = value.replace("\\", "/")
    if normalized.startswith(ALLOWED_PREFIX):
        return True
    return any(
        normalized.startswith(allowed[:-2])
        if allowed.endswith("/**")
        else normalized == allowed
        for allowed in ALLOWED_IMPLEMENTATION_PATHS
    )


def assert_frozen_source_tree() -> None:
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", EXPECTED_BASELINE, "HEAD"],
        cwd=REPO_ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if ancestor.returncode != 0:
        raise RuntimeError(
            f"carrier HEAD is not descended from frozen production baseline {EXPECTED_BASELINE}"
        )
    branch = git("branch", "--show-current")
    if branch != EXPECTED_BRANCH:
        raise RuntimeError(f"unexpected carrier branch: {branch}")
    touched = set(
        git_lines("diff", "--name-only", f"{EXPECTED_BASELINE}..HEAD")
        + git_lines("diff", "--name-only")
        + git_lines("diff", "--cached", "--name-only")
        + git_lines("ls-files", "--others", "--exclude-standard")
    )
    forbidden = sorted(path for path in touched if not is_allowed_carrier_path(path))
    if forbidden:
        raise RuntimeError(
            "repository drift outside evidence carrier and R2 implementation allowlist: "
            + ", ".join(forbidden)
        )


def deterministic_source_metadata() -> dict[str, Any]:
    return {
        "frozenProductionBaseline": {
            "commit": EXPECTED_BASELINE,
            "inheritedEvidenceBaselineCommit": INHERITED_EVIDENCE_BASELINE,
            "comparisonPolicy": (
                "reject-repository-drift-outside-evidence-carrier-and-r2-implementation-allowlist"
            ),
            "allowedEvidenceCarrierPrefix": ALLOWED_PREFIX,
            "allowedImplementationPaths": list(ALLOWED_IMPLEMENTATION_PATHS),
            "scopeGuard": "passed",
        },
        "evidenceCarrier": {
            "policy": "sidecar-commit-agnostic",
            "commitEmbedded": False,
            "branchEmbedded": False,
        },
        "artifactDeterminism": {
            "serialization": "utf8-json-pretty-2-lf",
            "volatileFields": [],
            "assertCleanSupported": True,
        },
    }


def artifact_mode() -> str:
    flags = sys.argv[1:]
    supported = {"--assert-clean", "--assert-current"}
    unexpected = [flag for flag in flags if flag not in supported]
    if unexpected:
        raise RuntimeError("unsupported argument: " + ", ".join(unexpected))
    if "--assert-clean" in flags and "--assert-current" in flags:
        raise RuntimeError("--assert-clean and --assert-current are mutually exclusive")
    if "--assert-clean" in flags:
        return "assert-clean"
    if "--assert-current" in flags:
        return "assert-current"
    return "write-if-changed"


def committed_artifact_bytes() -> bytes:
    relative_output = OUTPUT_PATH.relative_to(REPO_ROOT).as_posix()
    try:
        return subprocess.check_output(
            ["git", "show", f"HEAD:{relative_output}"], cwd=REPO_ROOT
        )
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"committed artifact missing at HEAD:{relative_output}"
        ) from error


def finalize_artifact(serialized: bytes, mode: str) -> dict[str, Any]:
    working = OUTPUT_PATH.read_bytes() if OUTPUT_PATH.exists() else None
    if mode == "assert-clean":
        committed = committed_artifact_bytes()
        if working is None or working != committed:
            raise RuntimeError(
                f"working artifact differs from committed artifact: {normalize_path(OUTPUT_PATH)}"
            )
        if serialized != committed:
            raise RuntimeError(
                f"recomputed artifact differs from committed artifact: {normalize_path(OUTPUT_PATH)}"
            )
        return {"wrote": False, "sha256": sha256_bytes(serialized)}
    if mode == "assert-current":
        if working is None or serialized != working:
            raise RuntimeError(
                f"recomputed artifact differs from working artifact: {normalize_path(OUTPUT_PATH)}"
            )
        return {"wrote": False, "sha256": sha256_bytes(serialized)}
    wrote = working is None or serialized != working
    if wrote:
        OUTPUT_PATH.write_bytes(serialized)
    return {"wrote": wrote, "sha256": sha256_bytes(serialized)}


def load_manifest_tools():
    sys.path.insert(0, str(EXTRACTOR_SCRIPTS))
    from azpr_compact_manifest import parse_manifest  # type: ignore
    from export_unity_resources import configure_unitypy  # type: ignore

    configure_unitypy()
    return parse_manifest


def bundle_excerpt(manifest: Any, logical_name: str, path_ids: set[int]) -> dict[str, Any]:
    bundle_index = manifest.find_bundle(logical_name)
    if bundle_index is None:
        raise RuntimeError(f"bundle not found: {logical_name}")
    bundle_bytes = manifest.bundle_bytes(bundle_index)
    environment = UnityPy.load(bundle_bytes)
    objects: list[dict[str, Any]] = []
    for obj in environment.objects:
        path_id = int(obj.path_id)
        if path_id not in path_ids:
            continue
        if obj.type.name != "MonoBehaviour":
            raise RuntimeError(f"unexpected object type for {path_id}: {obj.type.name}")
        objects.append(
            {
                "pathId": path_id,
                "type": obj.type.name,
                "typetree": obj.read_typetree(),
            }
        )
    unresolved = sorted(path_ids - {entry["pathId"] for entry in objects})
    if unresolved:
        raise RuntimeError(f"unresolved path ids in {logical_name}: {unresolved}")
    info = manifest.bundle_info(bundle_index)
    return {
        "bundleIndex": bundle_index,
        "logicalName": logical_name,
        "fileName": info["fileName"],
        "fileSize": info["fileSize"],
        "fileOffset": info["fileOffset"],
        "packName": info["packName"],
        "packPath": Path(info["packPath"]).resolve().as_posix(),
        "sliceSha256": sha256_bytes(bundle_bytes),
        "objects": objects,
    }


def battle_element_excerpt(path_id: int) -> dict[str, Any]:
    needle = f'"path_id": {path_id}'
    with BATTLE_ELEMENT_INDEX.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if needle not in line:
                continue
            row = json.loads(line)
            if int(row.get("path_id", 0)) == path_id:
                return {
                    "lineNumber": line_number,
                    "pathId": path_id,
                    "row": row,
                }
    raise RuntimeError(f"battle element path not found: {path_id}")


def enum_excerpt(lines: list[str], declaration: str) -> dict[str, Any]:
    start_index = next(
        (index for index, line in enumerate(lines) if line.startswith(declaration)), None
    )
    if start_index is None:
        raise RuntimeError(f"enum declaration not found: {declaration}")
    end_index = start_index
    while end_index < len(lines) and lines[end_index].strip() != "}":
        end_index += 1
    if end_index >= len(lines):
        raise RuntimeError(f"enum declaration not closed: {declaration}")
    return {
        "declaration": declaration,
        "lineStart": start_index + 1,
        "lineEnd": end_index + 1,
        "text": lines[start_index : end_index + 1],
    }


def consume_execute_excerpt() -> dict[str, Any]:
    pe = pefile.PE(str(GAME_ASSEMBLY_PATH), fast_load=True)
    file_offset = pe.get_offset_from_rva(EXECUTE_RVA)
    with GAME_ASSEMBLY_PATH.open("rb") as handle:
        handle.seek(file_offset)
        code = handle.read(0x800)
    disassembler = Cs(CS_ARCH_X86, CS_MODE_64)
    instructions = []
    direct_calls = []
    function_end_rva = None
    for instruction in disassembler.disasm(code, EXECUTE_RVA):
        row = {
            "rva": f"0x{instruction.address:X}",
            "mnemonic": instruction.mnemonic,
            "operands": instruction.op_str,
            "bytes": instruction.bytes.hex(),
        }
        instructions.append(row)
        if instruction.mnemonic == "call" and instruction.op_str.startswith("0x"):
            target = int(instruction.op_str, 16)
            if target in EXPECTED_DIRECT_CALLS:
                direct_calls.append(
                    {
                        **row,
                        "targetRva": f"0x{target:X}",
                        "targetMethod": EXPECTED_DIRECT_CALLS[target],
                    }
                )
        if instruction.mnemonic == "ret":
            function_end_rva = instruction.address + instruction.size
            break
    if function_end_rva is None:
        raise RuntimeError("ConsumePackElement.Execute return not found")
    expected_order = list(EXPECTED_DIRECT_CALLS.values())
    actual_order = [call["targetMethod"] for call in direct_calls]
    if actual_order != expected_order:
        raise RuntimeError(
            f"ConsumePackElement.Execute call order drift: {actual_order} != {expected_order}"
        )
    function_size = function_end_rva - EXECUTE_RVA
    return {
        "method": "Lens.Gameplay.Modules.BigWorld.ConsumePackElement.Execute",
        "rvaStart": f"0x{EXECUTE_RVA:X}",
        "rvaEndExclusive": f"0x{function_end_rva:X}",
        "fileOffset": file_offset,
        "byteLength": function_size,
        "bytesSha256": sha256_bytes(code[:function_size]),
        "verifiedDirectCallOrder": direct_calls,
        "orderConclusion": expected_order,
        "instructions": instructions,
    }


def main() -> int:
    mode = artifact_mode()
    assert_frozen_source_tree()
    parse_manifest = load_manifest_tools()
    manifest = parse_manifest(PACKAGE_DIR, MANIFEST_PATH)
    control_bundle = bundle_excerpt(
        manifest, CONTROL_LOGICAL_NAME, {CONTROL_ROOT_PATH_ID}
    )
    track_bundle = bundle_excerpt(
        manifest, TRACK_LOGICAL_NAME, {TRACK_PATH_ID, BEHAVIOR_PATH_ID}
    )
    dump_lines = DUMP_PATH.read_text(encoding="utf-8").splitlines()
    output = {
        "schemaVersion": 2,
        "kind": "m12-b3-107002-runtime-and-external-track-evidence-excerpt",
        **deterministic_source_metadata(),
        "scope": {
            "characterId": 107002,
            "characterName": "米砂",
            "productScenario": "m12c-zero-distance-passive-boss-v1",
            "sourceOnly": True,
        },
        "sources": {
            "manifest": source_record(MANIFEST_PATH),
            "battleElementIndex": source_record(BATTLE_ELEMENT_INDEX),
            "dump": source_record(DUMP_PATH),
            "gameAssembly": source_record(GAME_ASSEMBLY_PATH),
        },
        "passiveTrack": {
            "controlBundle": control_bundle,
            "externalTrackBundle": track_bundle,
            "markerElement": battle_element_excerpt(PASSIVE_MARKER_PATH_ID),
            "resolvedReferenceChain": [
                {
                    "fromPathId": CONTROL_ROOT_PATH_ID,
                    "field": "skillControlData.skillPlayers[0].skillTrackDatas[0]",
                    "toPathId": TRACK_PATH_ID,
                },
                {
                    "fromPathId": TRACK_PATH_ID,
                    "field": "behaviorlineControl[0].behaviorList[0]",
                    "toPathId": BEHAVIOR_PATH_ID,
                },
                {
                    "fromPathId": BEHAVIOR_PATH_ID,
                    "field": "elementDataList[0]",
                    "toPathId": PASSIVE_MARKER_PATH_ID,
                },
            ],
        },
        "runtimeEnums": [
            enum_excerpt(dump_lines, "public enum ECombineType"),
            enum_excerpt(dump_lines, "public enum EDirectInjectTargetType"),
            enum_excerpt(dump_lines, "public enum ETargetType"),
            enum_excerpt(dump_lines, "public enum ConsumePackElement.EConsumeMode"),
            enum_excerpt(dump_lines, "public enum ConsumePackElement.ETargetType"),
            enum_excerpt(dump_lines, "public enum ESummonCountType"),
            enum_excerpt(dump_lines, "public enum TSpElementParams.ESPShareType"),
        ],
        "consumePackExecute": consume_execute_excerpt(),
    }
    serialized = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode(
        "utf-8"
    )
    artifact_result = finalize_artifact(serialized, mode)
    print(
        json.dumps(
            {
                "outputPath": normalize_path(OUTPUT_PATH),
                "mode": mode,
                "wrote": artifact_result["wrote"],
                "sha256": artifact_result["sha256"],
                "controlBundleIndex": control_bundle["bundleIndex"],
                "trackBundleIndex": track_bundle["bundleIndex"],
                "enumCount": len(output["runtimeEnums"]),
                "executeCallOrder": output["consumePackExecute"]["orderConclusion"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
