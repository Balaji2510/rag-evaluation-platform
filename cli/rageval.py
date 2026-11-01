#!/usr/bin/env python3
"""RAGEval CLI: Continuous Integration & Deployment Evaluation Runner.

Usage:
    python cli/rageval.py run --project <project_id> --dataset <dataset_id> --fail-under 85
"""

import argparse
import os
import sys
import time
from typing import Any, Dict, Optional
import httpx


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="rageval",
        description="RAG Evaluation Platform CI/CD Runner",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Trigger an evaluation run and assert quality threshold")
    run_parser.add_argument("--project", required=True, help="Project ID or name")
    run_parser.add_argument("--dataset", required=True, help="Dataset ID or name")
    run_parser.add_argument(
        "--rag-config",
        default="internal",
        help="RAG Configuration ID or 'internal' (default: internal)",
    )
    run_parser.add_argument(
        "--fail-under",
        type=float,
        default=80.0,
        help="Minimum overall quality score (0-100 or 0.0-1.0) before exiting with code 1 (default: 80.0)",
    )
    run_parser.add_argument(
        "--api-key",
        default=os.getenv("RAGEVAL_API_KEY", ""),
        help="API Key for authentication (can also be set via RAGEVAL_API_KEY env var)",
    )
    run_parser.add_argument(
        "--api-url",
        default=os.getenv("RAGEVAL_API_URL", "http://localhost:8000"),
        help="Base URL of RAG Evaluation platform (default: http://localhost:8000)",
    )
    run_parser.add_argument(
        "--prompt-version",
        default=os.getenv("PROMPT_VERSION"),
        help="Optional prompt version tag",
    )
    run_parser.add_argument(
        "--git-commit",
        default=os.getenv("GITHUB_SHA"),
        help="Optional git commit SHA",
    )
    run_parser.add_argument(
        "--git-branch",
        default=os.getenv("GITHUB_REF_NAME"),
        help="Optional git branch name",
    )
    run_parser.add_argument(
        "--pr-number",
        type=int,
        default=None,
        help="Optional GitHub PR number",
    )
    run_parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Maximum timeout in seconds to wait for evaluation to complete (default: 300)",
    )

    return parser.parse_args()


def resolve_project_and_dataset(
    client: httpx.Client, base_url: str, project_arg: str, dataset_arg: str
) -> tuple[str, str]:
    """Resolve project and dataset inputs which may be either IDs or names."""
    res = client.get(f"{base_url}/api/projects")
    if res.status_code != 200:
        print(f"Error fetching projects: {res.status_code} - {res.text}")
        sys.exit(1)

    projects = res.json()
    project_id = project_arg
    for p in projects:
        if p.get("id") == project_arg or p.get("name") == project_arg:
            project_id = p["id"]
            break

    ds_res = client.get(f"{base_url}/api/projects/{project_id}/datasets")
    if ds_res.status_code != 200:
        print(f"Error fetching datasets for project {project_id}: {ds_res.status_code} - {ds_res.text}")
        sys.exit(1)

    datasets = ds_res.json()
    dataset_id = dataset_arg
    for d in datasets:
        if d.get("id") == dataset_arg or d.get("name") == dataset_arg:
            dataset_id = d["id"]
            break

    return project_id, dataset_id


def main() -> None:
    args = parse_args()
    if args.command != "run":
        print(f"Unknown command: {args.command}")
        sys.exit(1)

    # Normalize fail_under threshold to 0.0 - 1.0 range
    fail_under = args.fail_under / 100.0 if args.fail_under > 1.0 else args.fail_under

    base_url = args.api_url.rstrip("/")
    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["x-api-key"] = args.api_key

    client = httpx.Client(headers=headers, timeout=30.0)

    print("=" * 60)
    print("🚀 RAGEval CI/CD Evaluation Runner")
    print("=" * 60)
    print(f"Target API:     {base_url}")
    print(f"Threshold:      {fail_under * 100:.1f}%")
    if args.git_commit:
        print(f"Git Commit:     {args.git_commit}")

    # 1. Resolve IDs if names were provided
    project_id, dataset_id = resolve_project_and_dataset(client, base_url, args.project, args.dataset)
    print(f"Project ID:     {project_id}")
    print(f"Dataset ID:     {dataset_id}")
    print(f"RAG Endpoint:   {args.rag_config}")

    # 2. Trigger Evaluation
    payload: Dict[str, Any] = {
        "projectId": project_id,
        "datasetId": dataset_id,
        "ragConfigurationId": args.rag_config,
    }
    if args.prompt_version:
        payload["promptVersion"] = args.prompt_version
    if args.git_commit:
        payload["gitCommit"] = args.git_commit
    if args.git_branch:
        payload["gitBranch"] = args.git_branch
    if args.pr_number:
        payload["prNumber"] = args.pr_number

    eval_res = client.post(f"{base_url}/api/evaluations", json=payload)
    if eval_res.status_code not in (200, 201):
        print(f"❌ Failed to trigger evaluation: {eval_res.status_code}\n{eval_res.text}")
        sys.exit(1)

    run_data = eval_res.json()
    run_id = run_data["id"]
    print(f"\n⚡ Evaluation Run Triggered: {run_id}")
    print("Waiting for evaluation execution to complete...")

    # 3. Poll for completion
    start_time = time.time()
    last_completed = -1
    while time.time() - start_time < args.timeout:
        poll_res = client.get(f"{base_url}/api/evaluations/{run_id}")
        if poll_res.status_code == 200:
            status_data = poll_res.json()
            status = status_data.get("status")
            completed = status_data.get("completedQuestions", 0)
            total = status_data.get("totalQuestions", 0)

            if completed != last_completed and total > 0:
                print(f"Progress: [{completed}/{total}] questions processed...")
                last_completed = completed

            if status in ("completed", "failed", "cancelled"):
                run_data = status_data
                break

        time.sleep(2)
    else:
        print(f"❌ Timed out waiting for evaluation {run_id} after {args.timeout}s")
        sys.exit(1)

    if run_data.get("status") != "completed":
        print(f"❌ Evaluation run ended with status: {run_data.get('status')}")
        sys.exit(1)

    # 4. Check Quality Gate
    gate_req = {"overallScore": fail_under}
    gate_res = client.post(f"{base_url}/api/evaluations/{run_id}/quality-gate", json=gate_req)
    gate_data = gate_res.json() if gate_res.status_code == 200 else {}

    overall_score = run_data.get("overallScore") or 0.0
    faithfulness = run_data.get("averageFaithfulness")
    correctness = run_data.get("averageAnswerCorrectness")
    relevance = run_data.get("averageAnswerRelevance")
    latency = run_data.get("averageLatency")
    passed = gate_data.get("passed", overall_score >= fail_under)

    print("\n" + "=" * 60)
    print("📊 EVALUATION RESULTS SUMMARY")
    print("=" * 60)
    print(f"Overall Score:       {overall_score * 100:.1f}% (Required: {fail_under * 100:.1f}%)")
    if faithfulness is not None:
        print(f"Faithfulness:        {faithfulness * 100:.1f}%")
    if correctness is not None:
        print(f"Answer Correctness:  {correctness * 100:.1f}%")
    if relevance is not None:
        print(f"Answer Relevance:    {relevance * 100:.1f}%")
    if latency is not None:
        print(f"Average Latency:     {latency:.1f} ms")

    token_usage = run_data.get("tokenUsage")
    if token_usage:
        print(f"Token Usage:         {token_usage.get('totalTokens', 0):,} tokens")
    cost = run_data.get("estimatedCostUsd")
    if cost is not None:
        print(f"Estimated Cost:      ${cost:.4f}")

    if run_data.get("regressionDetected"):
        print(f"⚠️  Regression:       {run_data.get('regressionDetails')}")

    print("-" * 60)
    if passed:
        print("✅ QUALITY GATE PASSED")
        print("=" * 60)
        sys.exit(0)
    else:
        print("❌ QUALITY GATE FAILED")
        for failure in gate_data.get("failures", []):
            print(f"   • {failure}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()

