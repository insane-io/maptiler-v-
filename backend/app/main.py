from fastapi import FastAPI

app = FastAPI(title="maptiler-v- API")


@app.get("/")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
