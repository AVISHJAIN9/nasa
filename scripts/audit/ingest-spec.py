#!/usr/bin/env python3
"""
Ingest AstroCare v2 and v3 spec workbooks into docs/spec/features.json and docs/spec/features.csv.
Validates exact row counts and extracts all per-layer tasks.
"""
import sys
import os
import json
import csv
import openpyxl

V2_FILE = "docs/spec/AstroCare_v2_Master_Features.xlsx"
V3_FILE = "docs/spec/AstroCare_v3_Additions.xlsx"
OUT_JSON = "docs/spec/features.json"
OUT_CSV = "docs/spec/features.csv"

# Expected IDs per spec
EXPECTED_V2_IDS = [f"F{i:03d}" for i in range(1, 151)] + [
    f"X{i:02d}" for i in range(1, 12)
] + ["P01", "P02", "Q01", "V01", "S01", "D01", "R01", "V02"]
# 150 + 11 + 8 = 169

EXPECTED_V3_IDS = [
    "A05", "C01", "C05", "A01", "A02", "M01", "D01", "D02",
    "C02", "C03", "C04", "A03", "M03", "M05", "A04", "M04",
    "M02", "D03"
] # 18

def ingest():
    if not os.path.exists(V2_FILE):
        print(f"ERROR: Missing {V2_FILE}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(V3_FILE):
        print(f"ERROR: Missing {V3_FILE}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {V2_FILE}...")
    wb_v2 = openpyxl.load_workbook(V2_FILE, data_only=True)
    
    # Load Selling Points proof metrics
    v2_proof_metrics = {}
    if "Selling Points" in wb_v2.sheetnames:
        sp_sheet = wb_v2["Selling Points"]
        for r in range(4, sp_sheet.max_row + 1):
            raw_id = sp_sheet.cell(r, 1).value
            if raw_id and isinstance(raw_id, str):
                raw_id_clean = raw_id.strip()
                metric = sp_sheet.cell(r, 9).value
                if metric:
                    v2_proof_metrics[raw_id_clean] = str(metric).strip()

    # Load v2 All Features
    sheet_v2 = wb_v2["All Features"]
    v2_features = []
    v2_found_ids = []

    for r in range(2, sheet_v2.max_row + 1):
        raw_id_val = sheet_v2.cell(r, 1).value
        if not raw_id_val:
            continue
        raw_id = str(raw_id_val).strip()
        v2_found_ids.append(raw_id)
        
        name = str(sheet_v2.cell(r, 2).value or "").strip()
        stage_num = sheet_v2.cell(r, 3).value
        stage = str(sheet_v2.cell(r, 4).value or "").strip()
        who = str(sheet_v2.cell(r, 5).value or "").strip()
        use_case = str(sheet_v2.cell(r, 6).value or "").strip()
        how_we_build_it = str(sheet_v2.cell(r, 7).value or "").strip()
        done_when = str(sheet_v2.cell(r, 8).value or "").strip()
        owner = str(sheet_v2.cell(r, 9).value or "").strip()
        hours = sheet_v2.cell(r, 10).value
        tier = str(sheet_v2.cell(r, 11).value or "").strip()
        wave = str(sheet_v2.cell(r, 12).value or "").strip()
        source = str(sheet_v2.cell(r, 13).value or "").strip()
        notes = str(sheet_v2.cell(r, 14).value or "").strip()

        # Handle ID collision
        feature_id = f"v2:{raw_id}" if raw_id == "D01" else raw_id
        
        proof_metric = v2_proof_metrics.get(raw_id, "")
        honest_limit = notes if notes else ""
        if not honest_limit:
            if raw_id in ["X04"]:
                honest_limit = "Conformal abstention states uncertainty, not a diagnosis."
            elif raw_id in ["X05"]:
                honest_limit = "Pulse and breathing rate only. Accuracy depends on light, motion, skin tone."
            elif raw_id in ["X06"]:
                honest_limit = "Edge LLM with RAG; refuses unsupported medical questions."
            elif raw_id in ["R01"]:
                honest_limit = "Honest limitations and ethics page."

        v2_features.append({
            "id": feature_id,
            "raw_id": raw_id,
            "spec": "v2",
            "name": name,
            "stage_num": stage_num,
            "stage": stage,
            "who": who,
            "tier": tier,
            "wave": wave,
            "owner": owner,
            "hours": hours,
            "use_case": use_case,
            "how_we_build_it": how_we_build_it,
            "done_when": done_when,
            "proof_metric": proof_metric,
            "honest_limit": honest_limit,
            "source": source,
            "layer_tasks": {}
        })

    print(f"Loaded {len(v2_features)} v2 features.")
    
    # Check v2 count and missing IDs
    missing_v2 = [fid for fid in EXPECTED_V2_IDS if fid not in v2_found_ids]
    extra_v2 = [fid for fid in v2_found_ids if fid not in EXPECTED_V2_IDS]
    if missing_v2 or extra_v2 or len(v2_features) != 169:
        print(f"ERROR: v2 features count mismatch! Expected 169, got {len(v2_features)}.", file=sys.stderr)
        if missing_v2:
            print(f"Missing v2 IDs: {missing_v2}", file=sys.stderr)
        if extra_v2:
            print(f"Extra v2 IDs: {extra_v2}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {V3_FILE}...")
    wb_v3 = openpyxl.load_workbook(V3_FILE, data_only=True)

    # Ingest per-layer sheets: Frontend, Backend, Database, ML
    layer_tasks = {"FE": {}, "BE": {}, "DB": {}, "ML": {}}
    
    def parse_layer(sheetname, layer_key):
        if sheetname not in wb_v3.sheetnames:
            print(f"Warning: {sheetname} not in v3 workbook", file=sys.stderr)
            return
        s = wb_v3[sheetname]
        for r in range(2, s.max_row + 1):
            task_id = s.cell(r, 1).value
            feat_id = s.cell(r, 2).value
            if not task_id or not feat_id:
                continue
            task_id = str(task_id).strip()
            feat_id = str(feat_id).strip()
            feat_name = str(s.cell(r, 3).value or "").strip()
            task_desc = str(s.cell(r, 4).value or "").strip()
            hours = s.cell(r, 5).value
            owner = str(s.cell(r, 6).value or "").strip()
            wave = str(s.cell(r, 7).value or "").strip()
            done_when = str(s.cell(r, 8).value or "").strip()
            status = str(s.cell(r, 9).value or "").strip()
            notes = str(s.cell(r, 10).value or "").strip()
            
            task_obj = {
                "task_id": task_id,
                "feature_id": feat_id,
                "feature_name": feat_name,
                "task": task_desc,
                "hours": hours,
                "owner": owner,
                "wave": wave,
                "done_when": done_when,
                "status": status,
                "notes": notes
            }
            if feat_id not in layer_tasks[layer_key]:
                layer_tasks[layer_key][feat_id] = []
            layer_tasks[layer_key][feat_id].append(task_obj)

    parse_layer("Frontend", "FE")
    parse_layer("Backend", "BE")
    parse_layer("Database", "DB")
    parse_layer("ML", "ML")

    print(f"Ingested v3 layers: FE({sum(len(v) for v in layer_tasks['FE'].values())}), BE({sum(len(v) for v in layer_tasks['BE'].values())}), DB({sum(len(v) for v in layer_tasks['DB'].values())}), ML({sum(len(v) for v in layer_tasks['ML'].values())})")

    # Ingest v3 Features sheet
    sheet_v3 = wb_v3["Features"]
    v3_features = []
    v3_found_ids = []

    # Map who for v3 features based on domain
    v3_who_map = {
        "A05": "ALL",
        "C01": "A, FS, MC",
        "C05": "ALL",
        "A01": "A, FS",
        "A02": "A, FS",
        "M01": "A, FS, MC",
        "D01": "ALL",
        "D02": "ALL",
        "C02": "A, FS",
        "C03": "A, FS",
        "C04": "A",
        "A03": "A, FS",
        "M03": "FS, MC, AD",
        "M05": "FS, MC",
        "A04": "FS, MC",
        "M04": "FS",
        "M02": "AD, MC",
        "D03": "MC, ALL"
    }

    for r in range(2, sheet_v3.max_row + 1):
        raw_id_val = sheet_v3.cell(r, 1).value
        if not raw_id_val:
            continue
        raw_id = str(raw_id_val).strip()
        v3_found_ids.append(raw_id)

        name = str(sheet_v3.cell(r, 2).value or "").strip()
        group = str(sheet_v3.cell(r, 3).value or "").strip()
        wave = str(sheet_v3.cell(r, 4).value or "").strip()
        extends = str(sheet_v3.cell(r, 5).value or "").strip()
        pitch_line = str(sheet_v3.cell(r, 6).value or "").strip()
        honest_limit = str(sheet_v3.cell(r, 7).value or "").strip()
        proof_metric = str(sheet_v3.cell(r, 8).value or "").strip()
        fe_h = sheet_v3.cell(r, 9).value
        be_h = sheet_v3.cell(r, 10).value
        db_h = sheet_v3.cell(r, 11).value
        ml_h = sheet_v3.cell(r, 12).value
        total_h = sheet_v3.cell(r, 13).value

        # Tier derived from wave
        tier = "Tier 1" if "Wave 1" in wave else ("Tier 2" if "Wave 2" in wave else "Tier 3")
        who = v3_who_map.get(raw_id, "ALL")

        # Handle ID collision
        feature_id = f"v3:{raw_id}" if raw_id == "D01" else raw_id

        # Linked tasks
        cur_fe = layer_tasks["FE"].get(raw_id, [])
        cur_be = layer_tasks["BE"].get(raw_id, [])
        cur_db = layer_tasks["DB"].get(raw_id, [])
        cur_ml = layer_tasks["ML"].get(raw_id, [])

        # Build how_we_build_it from tasks
        how_parts = []
        if cur_fe:
            how_parts.append(f"FE: {'; '.join([t['task'] for t in cur_fe])}")
        if cur_be:
            how_parts.append(f"BE: {'; '.join([t['task'] for t in cur_be])}")
        if cur_db:
            how_parts.append(f"DB: {'; '.join([t['task'] for t in cur_db])}")
        if cur_ml:
            how_parts.append(f"ML: {'; '.join([t['task'] for t in cur_ml])}")
        how_we_build_it = " | ".join(how_parts) if how_parts else f"Extends {extends}"

        # Build done_when from tasks
        done_parts = []
        for l_name, tasks in [("FE", cur_fe), ("BE", cur_be), ("DB", cur_db), ("ML", cur_ml)]:
            dw_items = [t['done_when'] for t in tasks if t.get('done_when')]
            if dw_items:
                done_parts.append(f"{l_name}: {'; '.join(dw_items)}")
        done_when = " | ".join(done_parts) if done_parts else pitch_line

        v3_features.append({
            "id": feature_id,
            "raw_id": raw_id,
            "spec": "v3",
            "name": name,
            "stage_num": None,
            "stage": group,
            "who": who,
            "tier": tier,
            "wave": wave,
            "owner": "Team",
            "hours": total_h,
            "use_case": pitch_line,
            "how_we_build_it": how_we_build_it,
            "done_when": done_when,
            "proof_metric": proof_metric,
            "honest_limit": honest_limit,
            "source": f"v3 Additions ({extends})",
            "layer_tasks": {
                "FE": cur_fe,
                "BE": cur_be,
                "DB": cur_db,
                "ML": cur_ml
            }
        })

    print(f"Loaded {len(v3_features)} v3 features.")

    # Check v3 count and missing IDs
    missing_v3 = [fid for fid in EXPECTED_V3_IDS if fid not in v3_found_ids]
    extra_v3 = [fid for fid in v3_found_ids if fid not in EXPECTED_V3_IDS]
    if missing_v3 or extra_v3 or len(v3_features) != 18:
        print(f"ERROR: v3 features count mismatch! Expected 18, got {len(v3_features)}.", file=sys.stderr)
        if missing_v3:
            print(f"Missing v3 IDs: {missing_v3}", file=sys.stderr)
        if extra_v3:
            print(f"Extra v3 IDs: {extra_v3}", file=sys.stderr)
        sys.exit(1)

    all_features = v2_features + v3_features
    print(f"Total features combined: {len(all_features)} (expected 187).")

    if len(all_features) != 187:
        print(f"ERROR: Combined count is {len(all_features)}, expected 187!", file=sys.stderr)
        sys.exit(1)

    # Write JSON
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_features, f, indent=2)
    print(f"Wrote {OUT_JSON} ({len(all_features)} records).")

    # Write CSV
    csv_columns = [
        "id", "raw_id", "spec", "name", "stage", "who", "tier", "wave",
        "use_case", "how_we_build_it", "done_when", "proof_metric", "honest_limit"
    ]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_columns, extrasaction="ignore")
        writer.writeheader()
        for feat in all_features:
            writer.writerow(feat)
    print(f"Wrote {OUT_CSV} ({len(all_features)} records).")

if __name__ == "__main__":
    ingest()
