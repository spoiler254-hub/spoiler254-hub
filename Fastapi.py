# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase
cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.get("/api/moments")
async def get_moments():
    try:
        docs = db.collection('moments').stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete-moment")
async def delete_moment(moment_id: str):
    try:
        db.collection('moments').document(moment_id).delete()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
