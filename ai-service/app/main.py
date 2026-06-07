from fastapi import FastAPI

app = FastAPI(title="AI Bug Detection Service", version="0.1.0")


@app.get("/health")
def health_check():
    return {
        "success": True,
        "service": "ai-bug-detection-ai-service",
        "status": "ok",
    }
