"""
SkyTrace Local Embedding Service
--------------------------------
Generates 384-dimensional dense semantic vectors using sentence-transformers (all-MiniLM-L6-v2).
Operates locally on CPU to eliminate third-party per-call embedding API fees and latency.
"""

from typing import List
import numpy as np

import threading

_model = None
_model_lock = threading.Lock()


def get_embedding_model():
    """Loads the SentenceTransformer model (preferring local cache to eliminate WAN Hub latency)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from sentence_transformers import SentenceTransformer
                    try:
                        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2", local_files_only=True)
                    except Exception:
                        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
                except Exception as e:
                    print(f"Warning: Could not load sentence-transformers: {e}. Fallback to synthetic embedding.")
                    _model = "fallback"
    return _model


def embed_text(text: str) -> List[float]:
    """Generates normalized 384-dimensional embedding vector for given text."""
    model = get_embedding_model()
    if model == "fallback" or model is None:
        # Fallback deterministic pseudo-vector for lightweight tests when sentence-transformers is loading
        import hashlib
        h = hashlib.sha256(text.encode("utf-8")).digest()
        raw = [(b / 255.0) - 0.5 for b in h]
        padded = (raw * 12)[:384]
        norm = np.linalg.norm(padded) or 1.0
        return [float(x / norm) for x in padded]

    embedding = model.encode(text, normalize_embeddings=True)
    return [float(x) for x in embedding]


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes cosine similarity between two 384-dimensional vectors."""
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))
