from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import asyncpg
from typing import List, Dict, Any
import chromadb
from datetime import datetime
import json

app = FastAPI(title="MCP ChatGPT Server", version="1.0.0")
security = HTTPBearer()

# PostgreSQL connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mcp_chatgpt")
WORKSPACE_DIR = "workspace"
AUTH_TOKEN = os.getenv("MCP_AUTH_TOKEN", "your-secret-token")

# ChromaDB client
chroma_client = chromadb.PersistentClient(path="./chroma")
collection = chroma_client.get_or_create_collection(name="mcp_documents")

class FileWrite(BaseModel):
    filename: str
    content: str

class SQLQuery(BaseModel):
    query: str
    params: List[Any] = []

class EmbedDocument(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any] = {}

class SearchQuery(BaseModel):
    query: str
    n_results: int = 10

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != AUTH_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid authentication token")
    return credentials.credentials

@app.on_event("startup")
async def startup():
    # Create workspace directory
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
    
    # Test PostgreSQL connection
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute('''
        CREATE TABLE IF NOT EXISTS mcp_logs (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            action TEXT,
            details JSONB
        )
    ''')
    await conn.close()

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), token: str = Depends(verify_token)):
    """Upload a file to the workspace"""
    file_path = os.path.join(WORKSPACE_DIR, file.filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Log to PostgreSQL
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute(
        "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
        "file_upload", json.dumps({"filename": file.filename, "size": len(content)})
    )
    await conn.close()
    
    return {"status": "uploaded", "filename": file.filename, "path": file_path}

@app.post("/write")
async def write_file(file_data: FileWrite, token: str = Depends(verify_token)):
    """Write content to a file"""
    file_path = os.path.join(WORKSPACE_DIR, file_data.filename)
    
    # Create subdirectories if needed
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "w") as f:
        f.write(file_data.content)
    
    # Log to PostgreSQL
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute(
        "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
        "file_write", json.dumps({"filename": file_data.filename, "size": len(file_data.content)})
    )
    await conn.close()
    
    return {"status": "written", "filename": file_data.filename, "path": file_path}

@app.get("/read/{filename:path}")
async def read_file(filename: str, token: str = Depends(verify_token)):
    """Read a file from the workspace"""
    file_path = os.path.join(WORKSPACE_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(file_path, "r") as f:
        content = f.read()
    
    return {"filename": filename, "content": content}

@app.get("/files")
async def list_files(path: str = "", token: str = Depends(verify_token)):
    """List files in the workspace"""
    target_path = os.path.join(WORKSPACE_DIR, path)
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    files = []
    for root, dirs, filenames in os.walk(target_path):
        for filename in filenames:
            file_path = os.path.relpath(os.path.join(root, filename), WORKSPACE_DIR)
            files.append(file_path)
    
    return {"files": files}

@app.post("/sql")
async def execute_sql(query_data: SQLQuery, token: str = Depends(verify_token)):
    """Execute PostgreSQL query with full read/write access"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Handle different query types
        if query_data.query.strip().upper().startswith("SELECT"):
            rows = await conn.fetch(query_data.query, *query_data.params)
            result = [dict(row) for row in rows]
        else:
            result = await conn.execute(query_data.query, *query_data.params)
        
        # Log query
        await conn.execute(
            "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
            "sql_query", json.dumps({"query": query_data.query[:200]})
        )
        
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await conn.close()

@app.post("/embed")
async def embed_document(doc: EmbedDocument, token: str = Depends(verify_token)):
    """Add document to ChromaDB for vector search"""
    collection.add(
        documents=[doc.content],
        metadatas=[doc.metadata],
        ids=[doc.id]
    )
    
    # Log to PostgreSQL
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute(
        "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
        "embed_document", json.dumps({"id": doc.id, "metadata": doc.metadata})
    )
    await conn.close()
    
    return {"status": "embedded", "id": doc.id}

@app.post("/search")
async def search_documents(search: SearchQuery, token: str = Depends(verify_token)):
    """Search documents using ChromaDB"""
    results = collection.query(
        query_texts=[search.query],
        n_results=search.n_results
    )
    
    return {
        "query": search.query,
        "results": [
            {
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i]
            }
            for i in range(len(results["ids"][0]))
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        await conn.fetchval("SELECT 1")
        await conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}