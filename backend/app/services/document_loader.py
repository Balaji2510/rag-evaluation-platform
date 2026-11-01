import io
import json
from typing import Any, Dict, Tuple
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger("document_loader")


class DocumentLoaderService:
    """Service extracting raw text and metadata from PDF, TXT, Markdown, and JSON documents."""

    @staticmethod
    def extract_text(filename: str, content_type: str, file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
        """Extract clean text content and format-specific metadata from document binary payload."""
        lower_name = filename.lower()
        metadata: Dict[str, Any] = {
            "filename": filename,
            "contentType": content_type,
            "byteSize": len(file_bytes),
        }

        # 1. PDF Documents
        if lower_name.endswith(".pdf") or "pdf" in content_type:
            try:
                import pypdf

                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                page_texts = []
                for idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if text.strip():
                        page_texts.append(text.strip())

                total_pages = len(reader.pages)
                metadata["totalPages"] = total_pages

                if not page_texts:
                    raise AppException("PDF document contains no extractable text", status_code=400)

                extracted_text = "\n\n".join(page_texts)
                return extracted_text, metadata
            except AppException:
                raise
            except Exception as exc:
                logger.error("Failed to parse PDF document %s: %s", filename, exc)
                raise AppException(f"Failed to extract text from PDF document: {str(exc)}", status_code=400)

        # 2. JSON Documents
        if lower_name.endswith(".json") or "json" in content_type:
            try:
                raw_str = file_bytes.decode("utf-8")
                parsed = json.loads(raw_str)

                if isinstance(parsed, list):
                    blocks = []
                    for idx, item in enumerate(parsed):
                        if isinstance(item, dict):
                            line = "\n".join(f"{k}: {v}" for k, v in item.items() if v is not None)
                            blocks.append(line)
                        else:
                            blocks.append(str(item))
                    extracted_text = "\n\n---\n\n".join(blocks)
                    metadata["itemCount"] = len(parsed)
                elif isinstance(parsed, dict):
                    extracted_text = json.dumps(parsed, indent=2)
                    metadata["keyCount"] = len(parsed)
                else:
                    extracted_text = str(parsed)

                return extracted_text, metadata
            except Exception as exc:
                logger.error("Failed to parse JSON document %s: %s", filename, exc)
                raise AppException(f"Invalid JSON document payload: {str(exc)}", status_code=400)

        # 3. Markdown Documents
        if lower_name.endswith(".md") or "markdown" in content_type:
            try:
                extracted_text = file_bytes.decode("utf-8")
                metadata["format"] = "markdown"
                return extracted_text, metadata
            except UnicodeDecodeError:
                extracted_text = file_bytes.decode("latin-1", errors="replace")
                metadata["format"] = "markdown"
                return extracted_text, metadata

        # 4. Text Documents (TXT, CSV, etc.)
        if lower_name.endswith(".txt") or "text" in content_type or True:
            try:
                extracted_text = file_bytes.decode("utf-8")
                metadata["format"] = "text"
                return extracted_text, metadata
            except UnicodeDecodeError:
                extracted_text = file_bytes.decode("latin-1", errors="replace")
                metadata["format"] = "text"
                return extracted_text, metadata

