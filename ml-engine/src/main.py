import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from parsers import parse_pdf, parse_docx, parse_pptx, parse_text
from embedder import chunk_text, embed_texts, compute_token_count
from vector_store import create_index, search as vector_search, list_indices, load_meta

app = FastAPI(title="NexusIQ ML Engine", version="0.1.0")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class ProcessRequest(BaseModel):
    documentId: str
    callbackUrl: str


class SearchRequest(BaseModel):
    documentId: str
    query: str
    topK: int = 5


class SearchAllRequest(BaseModel):
    documentIds: List[str]
    query: str
    topK: int = 5


class AskRequest(BaseModel):
    query: str
    documentIds: Optional[List[str]] = None


ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".pptx": "pptx",
    ".md": "md",
    ".txt": "txt",
}


def parse_file(filepath: str, ext: str) -> dict:
    parsers = {
        "pdf": parse_pdf,
        "docx": parse_docx,
        "pptx": parse_pptx,
        "md": parse_text,
        "txt": parse_text,
    }
    parser = parsers.get(ext)
    if not parser:
        raise ValueError(f"Unsupported file type: {ext}")
    return parser(filepath)


@app.on_event("startup")
async def startup():
    print("ML Engine starting up...")
    from embedder import get_model
    get_model()
    print("SentenceTransformer model loaded")


@app.get("/health")
def health():
    return {"status": "ok", "service": "nexusiq-ml-engine"}


@app.post("/process")
async def process_document(req: ProcessRequest):
    try:
        gateway_url = os.getenv("GATEWAY_URL", "http://localhost:4000")
        file_url = f"{gateway_url}/internal/documents/{req.documentId}/file"

        async with httpx.AsyncClient() as client:
            file_resp = await client.get(file_url, follow_redirects=True)
            if file_resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch file: {file_resp.status_code}")

            content_type = (file_resp.headers.get("content-type", "") or "").split(";")[0].strip()
            ext = None
            mapping = {
                "application/pdf": "pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
                "text/markdown": "md",
                "text/plain": "txt",
            }

            content_disposition = file_resp.headers.get("content-disposition", "")
            if "filename=" in content_disposition:
                filename = content_disposition.split("filename=")[-1].strip('"')
                _, ext = os.path.splitext(filename)
                ext = ext.lstrip(".").lower()
            else:
                ext = mapping.get(content_type)

            if not ext:
                raise HTTPException(status_code=400, detail="Could not determine file type")

            tmp_path = f"/tmp/{req.documentId}.{ext}"
            with open(tmp_path, "wb") as f:
                f.write(file_resp.content)

        result = parse_file(tmp_path, ext)
        text = result["text"]
        page_count = result.get("page_count")

        chunks = chunk_text(text)
        if not chunks:
            raise HTTPException(status_code=400, detail="No text content found in document")

        embeddings = embed_texts(chunks)
        token_count = compute_token_count(text)

        chunk_data = [
            {"index": i, "text": chunks[i], "embedding": embeddings[i]}
            for i in range(len(chunks))
        ]
        create_index(req.documentId, chunk_data)

        os.remove(tmp_path)

        payload = {
            "documentId": req.documentId,
            "status": "READY",
            "pageCount": page_count,
            "tokenCount": token_count,
        }
        async with httpx.AsyncClient() as client:
            await client.post(req.callbackUrl, json=payload, timeout=30)

        return {"status": "completed", "chunks": len(chunks)}

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        try:
            async with httpx.AsyncClient() as client:
                await client.post(req.callbackUrl, json={"documentId": req.documentId, "status": "FAILED", "error": error_msg}, timeout=30)
        except:
            pass
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/search")
async def search_document(req: SearchRequest):
    try:
        from embedder import embed_text
        query_embedding = embed_text(req.query)
        results = vector_search(req.documentId, query_embedding, top_k=req.topK)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search-all")
async def search_all(req: SearchAllRequest):
    try:
        from embedder import embed_text
        query_embedding = embed_text(req.query)

        all_results = []
        for doc_id in req.documentIds:
            try:
                results = vector_search(doc_id, query_embedding, top_k=req.topK)
                for r in results:
                    r["documentId"] = doc_id
                all_results.extend(results)
            except Exception:
                pass

        all_results.sort(key=lambda x: x["distance"])
        all_results = all_results[: req.topK]

        return {"results": all_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask")
async def ask_question(req: AskRequest):
    try:
        from embedder import embed_text

        doc_ids = req.documentIds
        if not doc_ids:
            doc_ids = list_indices()
        if not doc_ids:
            return {"answer": "No documents available to search.", "citations": []}

        groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not groq_api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

        from groq import Groq
        client = Groq(api_key=groq_api_key)

        rewrite = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": f"Fix typos and rewrite for search: {req.query}"},
            ],
            temperature=0.0,
            max_tokens=50,
        )
        search_query = rewrite.choices[0].message.content.strip()
        if not search_query:
            search_query = req.query

        query_embedding = embed_text(search_query)

        all_results = []
        for doc_id in doc_ids:
            try:
                results = vector_search(doc_id, query_embedding, top_k=3)
                for r in results:
                    r["documentId"] = doc_id
                all_results.extend(results)
            except Exception:
                pass

        all_results.sort(key=lambda x: x["distance"])

        best_doc_id = all_results[0]["documentId"] if all_results else None

        if best_doc_id:
            full_meta = load_meta(best_doc_id)
            full_chunks = [{"chunk": c, "documentId": best_doc_id} for c in full_meta["chunks"]]
        else:
            full_chunks = []

        top_chunks = full_chunks

        context_parts = []
        citations = []

        for r in top_chunks:
            text = r["chunk"]["text"]
            context_parts.append(f"[Source: {r['documentId']}]\n{text}")
            citations.append({
                "documentId": r["documentId"],
                "text": text[:200],
            })

        context = "\n\n---\n\n".join(context_parts)

        sys_msg = {
            "role": "system",
            "content": "Answer concisely using the excerpts. Ignore typos in the question.",
        }
        user_msg = {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {req.query}",
        }

        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[sys_msg, user_msg],
            temperature=0.0,
            max_tokens=1024,
        )
        answer = completion.choices[0].message.content

        return {"answer": answer, "citations": citations}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
