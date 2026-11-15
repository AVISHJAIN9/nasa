#!/usr/bin/env python3
"""
Generate routes-python.json from FastAPI OpenAPI schema.
Extracts method, path, schema fields, and sample real response.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath("."))
from backend.app.main import app

OUT_FILE = "scripts/audit/routes-python.json"

def generate():
    openapi = app.openapi()
    paths = openapi.get("paths", {})
    components = openapi.get("components", {}).get("schemas", {})

    routes = []
    for path, methods_dict in sorted(paths.items()):
        for method, details in sorted(methods_dict.items()):
            if method.lower() not in ["get", "post", "put", "patch", "delete", "options", "head"]:
                continue
            
            # Extract parameters
            params = []
            for p in details.get("parameters", []):
                params.append({
                    "name": p.get("name"),
                    "in": p.get("in"),
                    "required": p.get("required", False),
                    "schema": p.get("schema", {}).get("type")
                })

            # Extract request body schema fields
            request_body = details.get("requestBody", {})
            req_schema_fields = []
            if request_body:
                content = request_body.get("content", {}).get("application/json", {})
                schema_ref = content.get("schema", {}).get("$ref", "")
                if schema_ref:
                    schema_name = schema_ref.split("/")[-1]
                    schema_obj = components.get(schema_name, {})
                    props = schema_obj.get("properties", {})
                    req_schema_fields = list(props.keys())

            # Extract response schema fields
            responses = details.get("responses", {})
            resp_200 = responses.get("200", {}).get("content", {}).get("application/json", {})
            resp_schema_fields = []
            if resp_200:
                resp_ref = resp_200.get("schema", {}).get("$ref", "")
                if resp_ref:
                    schema_name = resp_ref.split("/")[-1]
                    schema_obj = components.get(schema_name, {})
                    resp_schema_fields = list(schema_obj.get("properties", {}).keys())

            routes.append({
                "method": method.upper(),
                "path": path,
                "summary": details.get("summary", ""),
                "tags": details.get("tags", []),
                "parameters": params,
                "request_schema_fields": req_schema_fields,
                "response_schema_fields": resp_schema_fields,
                "responses": list(responses.keys())
            })

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2)
    print(f"Generated {OUT_FILE} with {len(routes)} Python routes.")

if __name__ == "__main__":
    generate()
