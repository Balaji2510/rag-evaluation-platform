import asyncio
import json
import re
from typing import Any, Dict, List, Optional
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.evaluation import EvaluationResultMetrics, MetricResult

logger = get_logger("gemini_evaluator")


class MetricScoreSchema(BaseModel):
    score: float = Field(..., ge=0.0, le=1.0, description="Quality score strictly between 0.0 and 1.0")
    reason: str = Field(..., description="Concise 1-2 sentence justification without chain of thought")


def _extract_retry_delay(exc: Exception, default_delay: float = 6.0) -> float:
    """Extract recommended retry delay from 429/quota exception or return default."""
    msg = str(exc)
    match = re.search(r"retry(?:\s+in|\s*delay[:=]?)\s*['\"]?(\d+(?:\.\d+)?)s?", msg, re.IGNORECASE)
    if match:
        try:
            return max(3.0, float(match.group(1)) + 1.5)
        except Exception:
            pass
    return default_delay


def parse_unified_metric_json(content: Any) -> Dict[str, Any]:
    """Extract and validate unified metric evaluation JSON object from model output."""
    if not content:
        raise ValueError("Empty response received from LLM")

    # Handle LangChain returning list of content dicts
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                text_parts.append(str(item["text"]))
            elif hasattr(item, "text"):
                text_parts.append(str(item.text))
        content = "".join(text_parts)
    elif not isinstance(content, str):
        content = str(content)

    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object detected in response: {content[:100]}")

    data = json.loads(match.group(0))

    # Case 1: Model returned a single score/reason object (e.g. test mocks)
    if "score" in data and "reason" in data:
        score_val = max(0.0, min(1.0, float(data["score"])))
        single_metric = {"score": round(score_val, 2), "reason": str(data["reason"]).strip()}
        return {
            "answerCorrectness": single_metric,
            "answerRelevance": single_metric,
            "faithfulness": single_metric,
            "contextRelevance": single_metric,
            "contextRecall": single_metric,
        }

    # Case 2: Model returned metric map
    result: Dict[str, Any] = {}
    known_metrics = ("answerCorrectness", "answerRelevance", "faithfulness", "contextRelevance", "contextRecall")
    for key in known_metrics:
        val = data.get(key)
        if val is None:
            # snake_case fallback: e.g. answer_correctness
            snake_key = re.sub(r'(?<!^)(?=[A-Z])', '_', key).lower()
            val = data.get(snake_key)

        if isinstance(val, dict) and "score" in val and "reason" in val:
            try:
                score_num = max(0.0, min(1.0, float(val["score"])))
                result[key] = {
                    "score": round(score_num, 2),
                    "reason": str(val["reason"]).strip(),
                }
            except Exception:
                result[key] = None
        else:
            result[key] = None

    return result


def parse_metric_json(content: Any) -> Dict[str, Any]:
    """Extract and validate JSON object with score and reason from model output."""
    if not content:
        raise ValueError("Empty response received from LLM")

    # Handle LangChain returning list of content dicts
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                text_parts.append(str(item["text"]))
            elif hasattr(item, "text"):
                text_parts.append(str(item.text))
        content = "".join(text_parts)
    elif not isinstance(content, str):
        content = str(content)

    # Match the outermost JSON object
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", content, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object detected in response: {content[:100]}")

    data = json.loads(match.group(0))
    if "score" not in data or "reason" not in data:
        raise ValueError("JSON missing required 'score' or 'reason' keys")

    score_val = float(data["score"])
    # Clamp to [0.0, 1.0]
    clamped_score = max(0.0, min(1.0, score_val))

    return {
        "score": round(clamped_score, 2),
        "reason": str(data["reason"]).strip(),
    }


class GeminiEvaluatorService:
    """Service utilizing Google Gemini and LangChain to evaluate RAG quality metrics."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        llm: Optional[Any] = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
        self._llm = llm

    def _get_llm(self) -> Optional[ChatGoogleGenerativeAI]:
        """Lazy initialization of LangChain ChatGoogleGenerativeAI."""
        if self._llm:
            return self._llm

        if not self.api_key:
            logger.warning("GEMINI_API_KEY is not configured; evaluation will record API key error.")
            return None

        try:
            self._llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=self.api_key,
                temperature=0.0,
                max_retries=2,
                timeout=30.0,
            )
            return self._llm
        except Exception as exc:
            logger.error("Failed to initialize ChatGoogleGenerativeAI: %s", exc)
            return None

    async def _invoke_metric_prompt(
        self, system_instruction: str, user_prompt: str
    ) -> MetricResult:
        """Call Gemini model with system & user instructions and parse structured JSON."""
        llm = self._get_llm()
        if not llm:
            return MetricResult(
                score=None,
                reason=None,
                error="Google Gemini API key is not configured (GEMINI_API_KEY)",
            )

        messages = [
            SystemMessage(
                content=(
                    f"{system_instruction}\n\n"
                    "STRICT FORMATTING REQUIREMENTS:\n"
                    "1. Respond ONLY with a valid JSON object.\n"
                    "2. The JSON object must have exactly two keys: 'score' (number between 0.0 and 1.0) and 'reason' (string).\n"
                    "3. 'reason' MUST be a concise 1-2 sentence justification.\n"
                    "4. Do NOT output any preamble, markdown code blocks, thoughts, or chain-of-thought analysis."
                )
            ),
            HumanMessage(content=user_prompt),
        ]

        # Retry with exponential backoff on transient errors and smart 429 backoff
        retries = 3
        last_error = None

        for attempt in range(retries + 1):
            try:
                response = await llm.ainvoke(messages)
                raw_text = response.content if hasattr(response, "content") else str(response)
                parsed = parse_metric_json(raw_text)
                return MetricResult(
                    score=parsed["score"],
                    reason=parsed["reason"],
                    error=None,
                )
            except Exception as exc:
                last_error = exc
                err_str = str(exc).lower()
                is_rate_limit = "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str
                logger.warning(
                    "Gemini evaluation attempt %d/%d failed: %s",
                    attempt + 1,
                    retries + 1,
                    exc,
                )
                if attempt < retries:
                    wait_time = _extract_retry_delay(exc, 12.0) if is_rate_limit else (1.0 * (attempt + 1))
                    await asyncio.sleep(wait_time)

        return MetricResult(
            score=None,
            reason=None,
            error=f"Gemini evaluation failed: {str(last_error)}",
        )

    async def evaluate_answer_correctness(
        self,
        question: str,
        expected_answer: Optional[str],
        generated_answer: Optional[str],
    ) -> MetricResult:
        """Measure factual and semantic agreement between generated answer and ground truth."""
        if not expected_answer or not expected_answer.strip():
            return MetricResult(
                score=None,
                reason="No ground truth expected answer provided in dataset for comparison.",
                error=None,
            )

        if not generated_answer or not generated_answer.strip():
            return MetricResult(
                score=0.0,
                reason="The generated answer is empty or missing.",
                error=None,
            )

        system = (
            "You are an expert AI evaluator measuring Answer Correctness in a RAG system.\n"
            "Compare the Generated Answer to the Ground Truth Expected Answer for the given Question.\n"
            "- Score 1.0: Factually identical or semantically equivalent to expected answer.\n"
            "- Score 0.5: Partially correct, missing minor details, or contains slight inaccuracies.\n"
            "- Score 0.0: Completely incorrect, contradicts ground truth, or fails to answer."
        )

        prompt = (
            f"Question:\n{question}\n\n"
            f"Ground Truth Expected Answer:\n{expected_answer}\n\n"
            f"Generated Answer:\n{generated_answer}"
        )

        return await self._invoke_metric_prompt(system, prompt)

    async def evaluate_answer_relevance(
        self, question: str, generated_answer: Optional[str]
    ) -> MetricResult:
        """Measure whether the generated answer directly addresses the user question."""
        if not generated_answer or not generated_answer.strip():
            return MetricResult(
                score=0.0,
                reason="The generated answer is empty or missing.",
                error=None,
            )

        system = (
            "You are an expert AI evaluator measuring Answer Relevance in a RAG system.\n"
            "Determine how directly, completely, and concisely the Generated Answer answers the Question.\n"
            "- Score 1.0: Directly, accurately, and concisely answers the question without irrelevant fluff.\n"
            "- Score 0.5: Partially relevant or contains tangential/evasive remarks.\n"
            "- Score 0.0: Irrelevant, off-topic, or completely ignores the question."
        )

        prompt = f"Question:\n{question}\n\nGenerated Answer:\n{generated_answer}"

        return await self._invoke_metric_prompt(system, prompt)

    async def evaluate_faithfulness(
        self,
        question: str,
        generated_answer: Optional[str],
        retrieved_contexts: List[str],
    ) -> MetricResult:
        """Measure whether claims in generated answer are grounded in retrieved contexts."""
        if not generated_answer or not generated_answer.strip():
            return MetricResult(
                score=0.0,
                reason="The generated answer is empty or missing.",
                error=None,
            )

        if not retrieved_contexts or all(not c.strip() for c in retrieved_contexts):
            return MetricResult(
                score=0.0,
                reason="No retrieved context passages were provided to verify claims in the answer.",
                error=None,
            )

        context_text = "\n---\n".join([f"Passage {i+1}: {c}" for i, c in enumerate(retrieved_contexts)])

        system = (
            "You are an expert AI evaluator measuring Faithfulness (Hallucination Detection) in a RAG system.\n"
            "Assess whether EVERY claim and statement made in the Generated Answer can be directly inferred from the Retrieved Contexts.\n"
            "- Score 1.0: All claims in the answer are strictly supported and grounded in the context.\n"
            "- Score 0.5: Some claims are grounded, but others are unverified or extrapolated.\n"
            "- Score 0.0: The answer hallucinated claims that are unsupported or contradicted by the context."
        )

        prompt = (
            f"Question:\n{question}\n\n"
            f"Retrieved Contexts:\n{context_text}\n\n"
            f"Generated Answer:\n{generated_answer}"
        )

        return await self._invoke_metric_prompt(system, prompt)

    async def evaluate_context_relevance(
        self, question: str, retrieved_contexts: List[str]
    ) -> MetricResult:
        """Measure how relevant and noise-free the retrieved contexts are for answering the question."""
        if not retrieved_contexts or all(not c.strip() for c in retrieved_contexts):
            return MetricResult(
                score=0.0,
                reason="No context passages were retrieved by the RAG system.",
                error=None,
            )

        context_text = "\n---\n".join([f"Passage {i+1}: {c}" for i, c in enumerate(retrieved_contexts)])

        system = (
            "You are an expert AI evaluator measuring Context Relevance in a RAG system.\n"
            "Assess whether the Retrieved Contexts contain information needed to answer the Question with minimal irrelevant noise.\n"
            "- Score 1.0: Highly relevant context passages containing direct evidence for the question.\n"
            "- Score 0.5: Moderately relevant, containing some useful facts mixed with noisy/unrelated text.\n"
            "- Score 0.0: Completely irrelevant or useless context passages."
        )

        prompt = f"Question:\n{question}\n\nRetrieved Contexts:\n{context_text}"

        return await self._invoke_metric_prompt(system, prompt)

    async def evaluate_context_recall(
        self,
        question: str,
        expected_contexts: List[str],
        retrieved_contexts: List[str],
    ) -> Optional[MetricResult]:
        """Measure what proportion of ground truth context was successfully retrieved (optional)."""
        # "Optional if expected contexts exist"
        if not expected_contexts or all(not c.strip() for c in expected_contexts):
            return None

        if not retrieved_contexts or all(not c.strip() for c in retrieved_contexts):
            return MetricResult(
                score=0.0,
                reason="No contexts were retrieved to match expected ground truth contexts.",
                error=None,
            )

        exp_text = "\n---\n".join([f"Expected Passage {i+1}: {c}" for i, c in enumerate(expected_contexts)])
        ret_text = "\n---\n".join([f"Retrieved Passage {i+1}: {c}" for i, c in enumerate(retrieved_contexts)])

        system = (
            "You are an expert AI evaluator measuring Context Recall in a RAG system.\n"
            "Determine whether all information present in the Ground Truth Expected Contexts was successfully captured by the Retrieved Contexts.\n"
            "- Score 1.0: All required facts and ground truth contexts were retrieved.\n"
            "- Score 0.5: Part of the ground truth contexts was retrieved, but important passages were missed.\n"
            "- Score 0.0: None of the ground truth contexts were retrieved."
        )

        prompt = (
            f"Question:\n{question}\n\n"
            f"Ground Truth Expected Contexts:\n{exp_text}\n\n"
            f"Retrieved Contexts:\n{ret_text}"
        )

        return await self._invoke_metric_prompt(system, prompt)

    async def _invoke_unified_evaluation(
        self,
        question: str,
        expected_answer: Optional[str],
        expected_contexts: List[str],
        generated_answer: Optional[str],
        retrieved_contexts: List[str],
    ) -> EvaluationResultMetrics:
        """Evaluate all metrics in a single unified Gemini LLM call to conserve rate limits."""
        has_expected_ans = bool(expected_answer and expected_answer.strip())
        has_gen_ans = bool(generated_answer and generated_answer.strip())
        has_ret_ctx = bool(retrieved_contexts and any(c.strip() for c in retrieved_contexts))
        has_exp_ctx = bool(expected_contexts and any(c.strip() for c in expected_contexts))

        # Short-circuit if generated answer is empty: answer metrics are 0.0 without needing an LLM call
        if not has_gen_ans:
            return EvaluationResultMetrics(
                answerCorrectness=MetricResult(
                    score=0.0,
                    reason="The generated answer is empty or missing.",
                ) if has_expected_ans else MetricResult(
                    score=None,
                    reason="No ground truth expected answer provided in dataset for comparison.",
                ),
                answerRelevance=MetricResult(score=0.0, reason="The generated answer is empty or missing."),
                faithfulness=MetricResult(score=0.0, reason="The generated answer is empty or missing."),
                contextRelevance=MetricResult(
                    score=1.0 if has_ret_ctx else 0.0,
                    reason="Retrieved contexts present." if has_ret_ctx else "No context passages were retrieved by the RAG system.",
                ),
                contextRecall=MetricResult(
                    score=0.0,
                    reason="No contexts were retrieved to match expected ground truth contexts.",
                ) if (has_exp_ctx and not has_ret_ctx) else None,
            )

        llm = self._get_llm()
        if not llm:
            err = "Google Gemini API key is not configured (GEMINI_API_KEY)"
            return EvaluationResultMetrics(
                answerCorrectness=MetricResult(score=None, reason=None, error=err),
                answerRelevance=MetricResult(score=None, reason=None, error=err),
                faithfulness=MetricResult(score=None, reason=None, error=err),
                contextRelevance=MetricResult(score=None, reason=None, error=err),
                contextRecall=MetricResult(score=None, reason=None, error=err) if has_exp_ctx else None,
            )

        system_instruction = (
            "You are an expert AI evaluator measuring RAG (Retrieval-Augmented Generation) system quality.\n"
            "Evaluate the provided RAG question, contexts, and answers across all required dimensions:\n\n"
            "1. answerCorrectness: Factual and semantic agreement between Generated Answer and Expected Answer (1.0 = identical/equivalent, 0.5 = partially correct, 0.0 = incorrect).\n"
            "2. answerRelevance: How directly, concisely, and completely Generated Answer answers Question (1.0 = direct/concise, 0.5 = partially relevant, 0.0 = off-topic).\n"
            "3. faithfulness: Whether every claim in Generated Answer is strictly grounded in Retrieved Contexts (1.0 = fully grounded/no hallucination, 0.5 = partially grounded, 0.0 = hallucinated).\n"
            "4. contextRelevance: Whether Retrieved Contexts contain information needed for Question with minimal noise (1.0 = highly relevant, 0.5 = moderate noise, 0.0 = irrelevant).\n"
            "5. contextRecall: Whether Ground Truth Expected Contexts were captured by Retrieved Contexts (1.0 = complete, 0.5 = partial, 0.0 = none).\n\n"
            "STRICT FORMATTING REQUIREMENTS:\n"
            "1. Output ONLY a valid JSON object without markdown or formatting tags.\n"
            "2. Schema:\n"
            "{\n"
            '  "answerCorrectness": {"score": float (0.0-1.0), "reason": "concise 1-2 sentence justification"},\n'
            '  "answerRelevance": {"score": float (0.0-1.0), "reason": "concise 1-2 sentence justification"},\n'
            '  "faithfulness": {"score": float (0.0-1.0), "reason": "concise 1-2 sentence justification"},\n'
            '  "contextRelevance": {"score": float (0.0-1.0), "reason": "concise 1-2 sentence justification"},\n'
            '  "contextRecall": {"score": float (0.0-1.0), "reason": "concise 1-2 sentence justification"}\n'
            "}"
        )

        ctx_ret_str = "\n---\n".join([f"Passage {i+1}: {c}" for i, c in enumerate(retrieved_contexts)]) if has_ret_ctx else "None"
        ctx_exp_str = "\n---\n".join([f"Expected Passage {i+1}: {c}" for i, c in enumerate(expected_contexts)]) if has_exp_ctx else "None"

        user_prompt = (
            f"Question:\n{question}\n\n"
            f"Ground Truth Expected Answer:\n{expected_answer or 'None'}\n\n"
            f"Ground Truth Expected Contexts:\n{ctx_exp_str}\n\n"
            f"Retrieved Contexts:\n{ctx_ret_str}\n\n"
            f"Generated Answer:\n{generated_answer}"
        )

        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=user_prompt),
        ]

        retries = 3
        last_error = None

        for attempt in range(retries + 1):
            try:
                response = await llm.ainvoke(messages)
                raw_text = response.content if hasattr(response, "content") else str(response)
                parsed = parse_unified_metric_json(raw_text)

                def build_metric(key: str, default_none_reason: Optional[str] = None) -> Optional[MetricResult]:
                    m = parsed.get(key)
                    if m and m.get("score") is not None:
                        return MetricResult(score=m["score"], reason=m["reason"], error=None)
                    if default_none_reason:
                        return MetricResult(score=None, reason=default_none_reason, error=None)
                    return MetricResult(score=None, reason=None, error="Metric evaluation omitted from LLM response")

                ans_corr = (
                    build_metric("answerCorrectness")
                    if has_expected_ans
                    else MetricResult(
                        score=None,
                        reason="No ground truth expected answer provided in dataset for comparison.",
                        error=None,
                    )
                )

                ctx_rec = (
                    build_metric("contextRecall")
                    if has_exp_ctx
                    else None
                )

                return EvaluationResultMetrics(
                    answerCorrectness=ans_corr,
                    answerRelevance=build_metric("answerRelevance"),
                    faithfulness=build_metric("faithfulness"),
                    contextRelevance=build_metric("contextRelevance"),
                    contextRecall=ctx_rec,
                )
            except Exception as exc:
                last_error = exc
                err_str = str(exc).lower()
                is_rate_limit = "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str
                logger.warning(
                    "Gemini unified evaluation attempt %d/%d failed: %s",
                    attempt + 1,
                    retries + 1,
                    exc,
                )
                if attempt < retries:
                    wait_time = _extract_retry_delay(exc, 12.0) if is_rate_limit else (1.0 * (attempt + 1))
                    await asyncio.sleep(wait_time)

        err_msg = f"Gemini evaluation failed: {str(last_error)}"
        return EvaluationResultMetrics(
            answerCorrectness=MetricResult(score=None, reason=None, error=err_msg),
            answerRelevance=MetricResult(score=None, reason=None, error=err_msg),
            faithfulness=MetricResult(score=None, reason=None, error=err_msg),
            contextRelevance=MetricResult(score=None, reason=None, error=err_msg),
            contextRecall=MetricResult(score=None, reason=None, error=err_msg) if has_exp_ctx else None,
        )

    async def evaluate_all(
        self,
        question: str,
        expected_answer: Optional[str],
        expected_contexts: List[str],
        generated_answer: Optional[str],
        retrieved_contexts: List[str],
    ) -> EvaluationResultMetrics:
        """Run all RAG metrics in a single unified LLM request to avoid rate limits."""
        return await self._invoke_unified_evaluation(
            question=question,
            expected_answer=expected_answer,
            expected_contexts=expected_contexts,
            generated_answer=generated_answer,
            retrieved_contexts=retrieved_contexts,
        )

