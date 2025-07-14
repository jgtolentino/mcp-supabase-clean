from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncpg
from typing import List, Dict, Any, Optional
import chromadb
from datetime import datetime
import json
import asyncio

app = FastAPI(title="MCP ChatGPT Server", version="2.0.0")
security = HTTPBearer()

# Add CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://claude.ai", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mcp_chatgpt")
WORKSPACE_DIR = "workspace"
AUTH_TOKEN = os.getenv("MCP_AUTH_TOKEN", "your-secret-token")

# ChromaDB client
chroma_client = chromadb.PersistentClient(path="./chroma")
collection = chroma_client.get_or_create_collection(name="mcp_documents")

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.authenticated: Dict[WebSocket, bool] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.authenticated[websocket] = False

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        if websocket in self.authenticated:
            del self.authenticated[websocket]

    def is_authenticated(self, websocket: WebSocket) -> bool:
        return self.authenticated.get(websocket, False)

    def authenticate(self, websocket: WebSocket):
        self.authenticated[websocket] = True

manager = ConnectionManager()

# Existing models
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

# Existing endpoints remain the same...
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != AUTH_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid authentication token")
    return credentials.credentials

@app.on_event("startup")
async def startup():
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
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

# WebSocket endpoint for browser extension
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle authentication
            if data.get("type") == "auth":
                if data.get("token") == AUTH_TOKEN:
                    manager.authenticate(websocket)
                    await websocket.send_json({"type": "auth", "status": "success"})
                else:
                    await websocket.send_json({"type": "auth", "status": "failed"})
                    await websocket.close()
                    break
                continue
            
            # Check authentication for other requests
            if not manager.is_authenticated(websocket):
                await websocket.send_json({
                    "requestId": data.get("requestId"),
                    "error": "Not authenticated"
                })
                continue
            
            # Process MCP commands
            request_id = data.get("requestId")
            action = data.get("action")
            params = data.get("params", {})
            
            try:
                result = await process_mcp_action(action, params)
                await websocket.send_json({
                    "requestId": request_id,
                    "result": result
                })
            except Exception as e:
                await websocket.send_json({
                    "requestId": request_id,
                    "error": str(e)
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Process MCP actions
async def process_mcp_action(action: str, params: Dict[str, Any]) -> Dict[str, Any]:
    if action == "read":
        filepath = os.path.join(WORKSPACE_DIR, params["filepath"])
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {params['filepath']}")
        with open(filepath, "r") as f:
            content = f.read()
        return {"content": content, "filepath": params["filepath"]}
    
    elif action == "write":
        filepath = os.path.join(WORKSPACE_DIR, params["filepath"])
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w") as f:
            f.write(params["content"])
        
        # Log to database
        conn = await asyncpg.connect(DATABASE_URL)
        await conn.execute(
            "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
            "file_write", json.dumps({"filename": params["filepath"], "size": len(params["content"])})
        )
        await conn.close()
        
        return {"status": "written", "filename": params["filepath"]}
    
    elif action == "list":
        path = os.path.join(WORKSPACE_DIR, params.get("path", ""))
        if not os.path.exists(path):
            return {"files": []}
        
        files = []
        for root, dirs, filenames in os.walk(path):
            for filename in filenames:
                file_path = os.path.relpath(os.path.join(root, filename), WORKSPACE_DIR)
                files.append(file_path)
        
        return {"files": sorted(files)}
    
    elif action == "sql":
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            query = params["query"]
            if query.strip().upper().startswith("SELECT"):
                rows = await conn.fetch(query)
                result = [dict(row) for row in rows]
            else:
                result = await conn.execute(query)
            
            # Log query
            await conn.execute(
                "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
                "sql_query", json.dumps({"query": query[:200]})
            )
            
            return {"result": result}
        finally:
            await conn.close()
    
    elif action == "embed":
        collection.add(
            documents=[params["content"]],
            metadatas=[params.get("metadata", {})],
            ids=[params["id"]]
        )
        return {"status": "embedded", "id": params["id"]}
    
    elif action == "search":
        results = collection.query(
            query_texts=[params["query"]],
            n_results=params.get("n_results", 10)
        )
        
        return {
            "query": params["query"],
            "results": [
                {
                    "id": results["ids"][0][i],
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0
                }
                for i in range(len(results["ids"][0]))
            ] if results["ids"] and len(results["ids"][0]) > 0 else []
        }
    
    else:
        raise ValueError(f"Unknown action: {action}")

# Keep all existing REST endpoints for ChatGPT compatibility
@app.post("/upload")
async def upload_file(file: UploadFile = File(...), token: str = Depends(verify_token)):
    file_path = os.path.join(WORKSPACE_DIR, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute(
        "INSERT INTO mcp_logs (action, details) VALUES ($1, $2)",
        "file_upload", json.dumps({"filename": file.filename, "size": len(content)})
    )
    await conn.close()
    
    return {"status": "uploaded", "filename": file.filename, "path": file_path}

@app.post("/write")
async def write_file(file_data: FileWrite, token: str = Depends(verify_token)):
    result = await process_mcp_action("write", {
        "filepath": file_data.filename,
        "content": file_data.content
    })
    return result

@app.get("/read/{filename:path}")
async def read_file(filename: str, token: str = Depends(verify_token)):
    result = await process_mcp_action("read", {"filepath": filename})
    return {"filename": filename, "content": result["content"]}

@app.get("/files")
async def list_files(path: str = "", token: str = Depends(verify_token)):
    result = await process_mcp_action("list", {"path": path})
    return result

@app.post("/sql")
async def execute_sql(query_data: SQLQuery, token: str = Depends(verify_token)):
    result = await process_mcp_action("sql", {
        "query": query_data.query,
        "params": query_data.params
    })
    return {"status": "success", **result}

@app.post("/embed")
async def embed_document(doc: EmbedDocument, token: str = Depends(verify_token)):
    result = await process_mcp_action("embed", {
        "id": doc.id,
        "content": doc.content,
        "metadata": doc.metadata
    })
    return result

@app.post("/search")
async def search_documents(search: SearchQuery, token: str = Depends(verify_token)):
    result = await process_mcp_action("search", {
        "query": search.query,
        "n_results": search.n_results
    })
    return result

@app.get("/health")
async def health_check():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        await conn.fetchval("SELECT 1")
        await conn.close()
        return {
            "status": "healthy",
            "database": "connected",
            "websocket_clients": len(manager.active_connections)
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}