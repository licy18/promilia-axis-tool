#!/usr/bin/env python3
"""Resolve Azur Promilia skill external element objects from compact bundles."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


SCRIPT_TYPE_CANDIDATES: dict[str, dict[str, Any]] = {
    "3156599909451817364": {
        "className": "TDamageElementParams",
        "typeDefIndex": 9720,
        "label": "damage",
        "sourceLineRange": "dump.cs:395210-395289",
        "role": "hp-damage-and-break-sp",
        "signatureFields": [
            "damageType",
            "damageElementalType",
            "weakBreakDamageRate",
            "recoverSP",
            "petRecoverSP",
            "recoverInterval",
        ],
    },
    "7293914887559091286": {
        "className": "TFreezeFrameElementParams",
        "typeDefIndex": 9728,
        "label": "freeze-frame",
        "sourceLineRange": "dump.cs:395456-395501",
        "role": "hit-stop",
        "signatureFields": [
            "timeScaleCurve",
            "freezeFrameCount",
            "freezeSource",
            "freezeTarget",
        ],
    },
    "8877289764366981625": {
        "className": "TFxElementParams",
        "typeDefIndex": 9729,
        "label": "fx",
        "sourceLineRange": "dump.cs:395503-395627",
        "role": "fx-camera-shake",
        "signatureFields": [
            "fxElementType",
            "shakeType",
            "floatParam1",
            "intParam1",
        ],
    },
    "4171700675270990854": {
        "className": "TBuffElementParams",
        "typeDefIndex": 9700,
        "label": "buff",
        "sourceLineRange": "dump.cs:394732-394799",
        "role": "buff",
        "signatureFields": [
            "inherit",
            "time",
            "frequencyType",
            "injectElementDataList",
        ],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resolve skill m_FileID=2 element object summaries."
    )
    parser.add_argument("--extractor", type=Path, required=True)
    parser.add_argument("--skill-ids", required=True)
    parser.add_argument("--package", default="default_package")
    return parser.parse_args()


def configure_imports(extractor_root: Path) -> None:
    scripts = extractor_root / "scripts"
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))


def load_manifest(extractor_root: Path, package: str):
    from azpr_compact_manifest import parse_manifest

    package_dir = (
        extractor_root
        / "AzurPromilia_Data"
        / "StreamingAssets"
        / ".res"
        / package
    )
    return parse_manifest(package_dir)


def configure_unitypy(extractor_root: Path) -> None:
    configure_imports(extractor_root)
    from export_unity_resources import configure_unitypy as configure

    configure()


def object_type_name(obj: Any) -> str:
    return getattr(getattr(obj, "type", None), "name", str(getattr(obj, "type", "")))


def read_asset_bundle_typetree(env: Any) -> dict[str, Any] | None:
    for obj in env.objects:
        if object_type_name(obj) == "AssetBundle":
            return obj.read_typetree()
    return None


def bundle_summary(manifest: Any, index: int) -> dict[str, Any]:
    info = manifest.bundle_info(index)
    return {
        "bundleIndex": info.get("bundleIndex"),
        "logicalName": info.get("logicalName"),
        "fileName": info.get("fileName"),
        "packName": info.get("packName"),
        "packResId": info.get("packResId"),
        "fileOffset": info.get("fileOffset"),
        "fileSize": info.get("fileSize"),
    }


def compact_value(value: Any) -> Any:
    if isinstance(value, dict):
        if set(value.keys()) == {"_serializedValue"}:
            return value.get("_serializedValue")
        if {"m_FileID", "m_PathID"} <= set(value.keys()):
            return {
                "fileId": value.get("m_FileID"),
                "pathId": str(value.get("m_PathID")),
            }
        return {key: compact_value(val) for key, val in value.items()}
    if isinstance(value, list):
        return [compact_value(item) for item in value]
    return value


def script_path_id(data: dict[str, Any]) -> str | None:
    script = data.get("m_Script") or {}
    value = script.get("m_PathID")
    return None if value is None else str(value)


def script_type_candidate(data: dict[str, Any]) -> dict[str, Any] | None:
    script_id = script_path_id(data)
    candidate = SCRIPT_TYPE_CANDIDATES.get(script_id or "")
    if not candidate:
        return None
    matched = [
        field for field in candidate["signatureFields"] if field in data
    ]
    if len(matched) < max(2, len(candidate["signatureFields"]) // 2):
        return None
    return {
        "status": "field-signature-matched",
        "confidence": "medium",
        "scriptPathId": script_id,
        "namespace": "Lens.Gameplay.Modules.BigWorld.Config",
        "className": candidate["className"],
        "typeDefIndex": candidate["typeDefIndex"],
        "label": candidate["label"],
        "role": candidate["role"],
        "source": "C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs",
        "sourceLineRange": candidate["sourceLineRange"],
        "matchedFields": matched,
    }


def media_pack_names(data: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for item in data.get("baseEffectParams") or []:
        name = item.get("mediaPackName")
        if name and name not in result:
            result.append(name)
    return result


def formula_params(data: dict[str, Any]) -> dict[str, Any] | None:
    raw = data.get("formulaParams")
    if not isinstance(raw, dict):
        return None
    return {
        "function_1": raw.get("function_1"),
        "function_2": raw.get("function_2"),
        "formulaParamValues": raw.get("formulaParamValues") or [],
    }


def damage_fields(data: dict[str, Any]) -> dict[str, Any] | None:
    keys = [
        "damageSourceType",
        "damageType",
        "damageElementalType",
        "weakBreakDamageRate",
        "damageMinimunValueType",
        "minimunHpValue",
        "burstId",
        "armerPenetration",
        "magicPenetration",
        "elementCalFactor",
        "physicalRatio",
        "magicRatio",
        "hitType",
        "knockBackId",
        "knockBackForce",
        "amp",
        "interruptPriority",
        "useOneBreak",
        "recoverSP",
        "petRecoverSP",
        "recoverInterval",
    ]
    present = {key: compact_value(data.get(key)) for key in keys if key in data}
    return present or None


def timing_fields(data: dict[str, Any]) -> dict[str, Any] | None:
    keys = [
        "freezeFrameCount",
        "freezeSource",
        "freezeTarget",
        "freezeEffect",
        "freezeBullet",
        "freezeHitEffect",
        "fxElementType",
        "shakeType",
        "floatParam1",
        "floatParam2",
        "floatParam3",
        "floatParam4",
        "intParam1",
        "intParam2",
        "time",
        "frequencyType",
        "frequency",
    ]
    present = {key: compact_value(data.get(key)) for key in keys if key in data}
    return present or None


def collect_file2_preload_path_ids(env: Any) -> list[str]:
    bundle = read_asset_bundle_typetree(env)
    if not bundle:
        return []
    result: list[str] = []
    for item in bundle.get("m_PreloadTable") or []:
        if item.get("m_FileID") != 2:
            continue
        path_id = str(item.get("m_PathID"))
        if path_id not in result:
            result.append(path_id)
    return result


def resolve_skill(manifest: Any, skill_id: int) -> dict[str, Any]:
    import UnityPy

    skill_logical = (
        f"d_assets_resourcesassets_config_battle_skilllist_skill_control_{skill_id}"
    )
    skill_index = manifest.find_bundle(skill_logical)
    if skill_index is None:
        return {
            "skillId": skill_id,
            "status": "skill-control-bundle-missing",
            "skillControlLogicalName": skill_logical,
        }

    element_assets_logical = "d_assets_resourcesassets_config_battle_element_assets"
    element_assets_index = manifest.find_bundle(element_assets_logical)
    if element_assets_index is None:
        return {
            "skillId": skill_id,
            "status": "element-assets-bundle-missing",
            "skillControlLogicalName": skill_logical,
            "skillControlBundle": bundle_summary(manifest, skill_index),
        }

    skill_env = UnityPy.load(manifest.bundle_bytes(skill_index))
    path_ids = collect_file2_preload_path_ids(skill_env)
    element_env = UnityPy.load(manifest.bundle_bytes(element_assets_index))
    object_by_path_id = {str(int(obj.path_id)): obj for obj in element_env.objects}
    container_by_path_id = {
        str(int(getattr(ptr, "path_id", 0))): path.replace("\\", "/")
        for path, ptr in getattr(element_env, "container", {}).items()
        if getattr(ptr, "path_id", None) is not None
    }

    objects: list[dict[str, Any]] = []
    unresolved: list[str] = []
    for path_id in path_ids:
        obj = object_by_path_id.get(path_id)
        if not obj:
            unresolved.append(path_id)
            continue
        try:
            data = obj.read_typetree()
        except Exception as exc:  # noqa: BLE001
            objects.append(
                {
                    "pathId": path_id,
                    "status": "read-typetree-failed",
                    "error": f"{type(exc).__name__}: {exc}",
                    "objectType": object_type_name(obj),
                }
            )
            continue
        candidate = script_type_candidate(data)
        objects.append(
            {
                "pathId": path_id,
                "status": "resolved-in-element-assets-bundle",
                "objectType": object_type_name(obj),
                "containerPath": container_by_path_id.get(path_id),
                "scriptPathId": script_path_id(data),
                "scriptTypeCandidate": candidate,
                "mName": data.get("m_Name"),
                "elementConfigId": data.get("elementConfigId"),
                "elementName": data.get("elementName"),
                "describe": data.get("describe"),
                "types": data.get("types") or [],
                "combineType": data.get("combineType"),
                "baseIntParams": data.get("baseIntParams") or [],
                "functionParams": data.get("functionParams") or [],
                "formulaParams": formula_params(data),
                "mediaPackNames": media_pack_names(data),
                "damageFields": damage_fields(data),
                "timingFields": timing_fields(data),
            }
        )

    classes = Counter(
        ((item.get("scriptTypeCandidate") or {}).get("className") or "unknown")
        for item in objects
        if item.get("status") == "resolved-in-element-assets-bundle"
    )
    return {
        "skillId": skill_id,
        "status": "element-objects-resolved" if not unresolved else "element-objects-partial",
        "skillControlLogicalName": skill_logical,
        "skillControlBundle": bundle_summary(manifest, skill_index),
        "elementAssetsBundle": bundle_summary(manifest, element_assets_index),
        "fileId": 2,
        "requestedPathIds": path_ids,
        "resolvedPathIds": [item["pathId"] for item in objects if item.get("status") == "resolved-in-element-assets-bundle"],
        "unresolvedPathIds": unresolved,
        "scriptClassCounts": dict(classes),
        "objects": objects,
    }


def main() -> int:
    args = parse_args()
    extractor = args.extractor.resolve()
    configure_unitypy(extractor)
    manifest = load_manifest(extractor, args.package)
    skill_ids = [
        int(part)
        for part in args.skill_ids.split(",")
        if part.strip()
    ]
    skills = [resolve_skill(manifest, skill_id) for skill_id in skill_ids]
    resolved_refs = sum(len(item.get("resolvedPathIds") or []) for item in skills)
    unresolved_refs = sum(len(item.get("unresolvedPathIds") or []) for item in skills)
    output = {
        "schemaVersion": 1,
        "sourceKind": "azpr-skill-external-element-object-evidence",
        "status": "element-objects-resolved" if resolved_refs and not unresolved_refs else "element-objects-partial",
        "source": {
            "extractorRoot": str(extractor).replace("\\", "/"),
            "package": args.package,
            "compactManifest": str(
                extractor
                / "AzurPromilia_Data"
                / "StreamingAssets"
                / ".res"
                / args.package
            ).replace("\\", "/"),
        },
        "summary": {
            "skillCount": len(skills),
            "resolvedSkills": sum(1 for item in skills if item.get("resolvedPathIds")),
            "requestedPathIds": sum(len(item.get("requestedPathIds") or []) for item in skills),
            "resolvedPathIds": resolved_refs,
            "unresolvedPathIds": unresolved_refs,
        },
        "skills": skills,
    }
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
