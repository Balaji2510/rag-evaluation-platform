from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.health import router as health_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag_configurations import router as rag_configurations_router
from app.api.v1.evaluations import router as evaluations_router
from app.api.v1.comparisons import router as comparisons_router
from app.api.v1.internal_rag import router as internal_rag_router
from app.api.v1.production import router as production_router

api_router = APIRouter()

# Health endpoints (/api/health)
api_router.include_router(health_router, prefix="/health")

# Authentication endpoints (/api/auth)
api_router.include_router(auth_router, prefix="/auth")

# Projects endpoints (/api/projects)
api_router.include_router(projects_router, prefix="/projects")

# Internal RAG & Documents endpoints (/api/projects/{projectId}/...)
api_router.include_router(internal_rag_router, prefix="/projects")

# Datasets endpoints (/api/datasets)
api_router.include_router(datasets_router, prefix="/datasets")

# RAG Configurations endpoints (/api/rag-configurations)
api_router.include_router(rag_configurations_router, prefix="/rag-configurations")

# Evaluations Engine endpoints (/api/evaluations)
api_router.include_router(evaluations_router, prefix="/evaluations")

# Comparisons endpoints (/api/comparisons)
api_router.include_router(comparisons_router, prefix="/comparisons")

# Production improvements & enterprise features
api_router.include_router(production_router)


# Mock/Demo External RAG Endpoint (/api/rag/query) for out-of-the-box evaluations
@api_router.post("/rag/query", tags=["demo-rag"])
@api_router.get("/rag/query", tags=["demo-rag"])
async def demo_rag_endpoint(payload: dict = None, question: str = None):
    q = (payload or {}).get("question") or question or "What is the policy?"
    
    # Generate realistic grounded answers for support and general queries
    q_lower = str(q).lower()
    if "return" in q_lower or "refund" in q_lower:
        answer = "Items can be returned within 30 days of purchase in original condition with receipt for a full refund."
        contexts = [
            "Our standard return policy permits returns of undamaged items within 30 days of receipt with proof of purchase.",
            "Refunds are credited to the original payment method within 3 to 5 business days."
        ]
    elif "atlas" in q_lower or "vector" in q_lower or "search" in q_lower:
        answer = "MongoDB Atlas Vector Search allows developers to build semantic search and RAG applications using vector embeddings stored directly alongside document data in MongoDB."
        contexts = [
            "MongoDB Atlas Vector Search enables fast k-NN vector search natively inside the database without managing separate vector databases.",
            "Vector search queries can be filtered by metadata using MQL and combined with BM25 full-text search."
        ]
    elif "api" in q_lower or "key" in q_lower or "timeout" in q_lower:
        answer = "API keys are valid until revoked, and standard API request timeouts are configured to 30 seconds."
        contexts = [
            "API keys remain active indefinitely until rotated or revoked from the developer settings dashboard.",
            "All outbound HTTP requests have a default timeout of 30 seconds."
        ]
    else:
        answer = f"According to platform specifications, {q.rstrip('?')} is fully supported following standard security and evaluation guidelines."
        contexts = [
            f"The standard reference documentation addresses {q}: all verified platform workflows follow automated testing and evaluation standards.",
            "Documentation is updated with each release to reflect current SLA guarantees and operational guidelines."
        ]

    return {
        "answer": answer,
        "contexts": contexts,
        "status": "success",
        "question": q,
    }

