import json
import os
import numpy as np
import faiss
from typing import List, Dict, Optional

INDEX_DIR = os.path.join(os.path.dirname(__file__), "..", "faiss_indices")
os.makedirs(INDEX_DIR, exist_ok=True)


def get_index_path(document_id: str) -> str:
    return os.path.join(INDEX_DIR, f"{document_id}.index")


def get_meta_path(document_id: str) -> str:
    return os.path.join(INDEX_DIR, f"{document_id}.json")


def create_index(document_id: str, chunks: List[Dict]) -> None:
    embeddings = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    faiss.write_index(index, get_index_path(document_id))

    meta = {
        "document_id": document_id,
        "dimension": dimension,
        "chunks": [
            {
                "index": c["index"],
                "text": c["text"],
                "page": c.get("page"),
            }
            for c in chunks
        ],
    }
    with open(get_meta_path(document_id), "w") as f:
        json.dump(meta, f)


def load_index(document_id: str):
    index = faiss.read_index(get_index_path(document_id))
    with open(get_meta_path(document_id), "r") as f:
        meta = json.load(f)
    return index, meta


def load_meta(document_id: str) -> dict:
    with open(get_meta_path(document_id), "r") as f:
        return json.load(f)


def list_indices() -> List[str]:
    ids = set()
    for fname in os.listdir(INDEX_DIR):
        if fname.endswith(".index"):
            ids.add(fname[:-6])
    return sorted(ids)


def search(document_id: str, query_embedding: List[float], top_k: int = 5):
    index, meta = load_index(document_id)
    query_vec = np.array([query_embedding], dtype=np.float32)
    distances, indices = index.search(query_vec, top_k)

    results = []
    for i, idx in enumerate(indices[0]):
        if idx >= 0 and idx < len(meta["chunks"]):
            results.append({
                "chunk": meta["chunks"][idx],
                "distance": float(distances[0][i]),
            })
    return results
