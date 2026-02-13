from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import csv
import json
import base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'expo-intel-secret-2026')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class ExpoCreate(BaseModel):
    name: str
    date: str
    location: str

class ShortlistCreate(BaseModel):
    expo_id: str
    name: str

class AddToShortlist(BaseModel):
    exhibitor_id: str

class MeetingCreate(BaseModel):
    exhibitor_id: str
    time: str
    agenda: Optional[str] = ""

class MeetingUpdate(BaseModel):
    time: Optional[str] = None
    agenda: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ExpoDayCreate(BaseModel):
    expo_id: str

class ReorderRequest(BaseModel):
    exhibitor_ids: List[str]

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    return jwt.encode({"user_id": user_id, "role": role, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7}, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

# ============ EXPOS ============

@api_router.get("/expos")
async def get_expos():
    expos = await db.expos.find({}, {"_id": 0}).to_list(100)
    return expos

@api_router.post("/expos")
async def create_expo(data: ExpoCreate, user=Depends(get_current_user)):
    expo = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "date": data.date,
        "location": data.location,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.expos.insert_one(expo)
    return {k: v for k, v in expo.items() if k != "_id"}

# ============ EXHIBITORS ============

@api_router.get("/exhibitors")
async def get_exhibitors(
    expo_id: Optional[str] = None,
    hq: Optional[str] = None,
    industry: Optional[str] = None,
    min_revenue: Optional[float] = None,
    min_team_size: Optional[int] = None,
    solutions: Optional[str] = None,
    search: Optional[str] = None
):
    query = {}
    if expo_id:
        query["expo_id"] = expo_id
    if hq:
        query["hq"] = {"$regex": hq, "$options": "i"}
    if industry:
        query["industry"] = {"$regex": industry, "$options": "i"}
    if min_revenue:
        query["revenue"] = {"$gte": min_revenue}
    if min_team_size:
        query["team_size"] = {"$gte": min_team_size}
    if solutions:
        sol_list = [s.strip() for s in solutions.split(",")]
        query["solutions"] = {"$in": sol_list}
    if search:
        query["company"] = {"$regex": search, "$options": "i"}

    exhibitors = await db.exhibitors.find(query, {"_id": 0}).to_list(500)
    return exhibitors

@api_router.get("/exhibitors/{exhibitor_id}")
async def get_exhibitor(exhibitor_id: str):
    ex = await db.exhibitors.find_one({"id": exhibitor_id}, {"_id": 0})
    if not ex:
        raise HTTPException(status_code=404, detail="Exhibitor not found")
    return ex

@api_router.get("/exhibitors/filters/options")
async def get_filter_options(expo_id: Optional[str] = None):
    query = {}
    if expo_id:
        query["expo_id"] = expo_id
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "hqs": {"$addToSet": "$hq"},
            "industries": {"$addToSet": "$industry"},
            "solutions": {"$push": "$solutions"}
        }}
    ]
    result = await db.exhibitors.aggregate(pipeline).to_list(1)
    if not result:
        return {"hqs": [], "industries": [], "solutions": []}
    r = result[0]
    all_solutions = set()
    for sol_list in r.get("solutions", []):
        if isinstance(sol_list, list):
            all_solutions.update(sol_list)
    return {
        "hqs": sorted([x for x in r.get("hqs", []) if x]),
        "industries": sorted([x for x in r.get("industries", []) if x]),
        "solutions": sorted(list(all_solutions))
    }

# ============ SHORTLISTS ============

@api_router.get("/shortlists")
async def get_shortlists(user=Depends(get_current_user)):
    shortlists = await db.shortlists.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for sl in shortlists:
        if sl.get("exhibitor_ids"):
            exhibitors = await db.exhibitors.find({"id": {"$in": sl["exhibitor_ids"]}}, {"_id": 0}).to_list(100)
            sl["exhibitors"] = exhibitors
        else:
            sl["exhibitors"] = []
    return shortlists

@api_router.post("/shortlists")
async def create_shortlist(data: ShortlistCreate, user=Depends(get_current_user)):
    shortlist = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "expo_id": data.expo_id,
        "name": data.name,
        "exhibitor_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.shortlists.insert_one(shortlist)
    return {k: v for k, v in shortlist.items() if k != "_id"}

@api_router.post("/shortlists/{shortlist_id}/add")
async def add_to_shortlist(shortlist_id: str, data: AddToShortlist, user=Depends(get_current_user)):
    result = await db.shortlists.update_one(
        {"id": shortlist_id, "user_id": user["id"]},
        {"$addToSet": {"exhibitor_ids": data.exhibitor_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Shortlist not found")
    return {"status": "added"}

@api_router.post("/shortlists/{shortlist_id}/remove")
async def remove_from_shortlist(shortlist_id: str, data: AddToShortlist, user=Depends(get_current_user)):
    await db.shortlists.update_one(
        {"id": shortlist_id, "user_id": user["id"]},
        {"$pull": {"exhibitor_ids": data.exhibitor_id}}
    )
    return {"status": "removed"}

@api_router.post("/shortlists/{shortlist_id}/reorder")
async def reorder_shortlist(shortlist_id: str, data: ReorderRequest, user=Depends(get_current_user)):
    await db.shortlists.update_one(
        {"id": shortlist_id, "user_id": user["id"]},
        {"$set": {"exhibitor_ids": data.exhibitor_ids}}
    )
    return {"status": "reordered"}

@api_router.delete("/shortlists/{shortlist_id}")
async def delete_shortlist(shortlist_id: str, user=Depends(get_current_user)):
    await db.shortlists.delete_one({"id": shortlist_id, "user_id": user["id"]})
    return {"status": "deleted"}

@api_router.get("/shortlists/{shortlist_id}/export")
async def export_shortlist(shortlist_id: str, user=Depends(get_current_user)):
    sl = await db.shortlists.find_one({"id": shortlist_id, "user_id": user["id"]}, {"_id": 0})
    if not sl:
        raise HTTPException(status_code=404, detail="Shortlist not found")
    exhibitors = await db.exhibitors.find({"id": {"$in": sl.get("exhibitor_ids", [])}}, {"_id": 0}).to_list(100)
    rows = []
    for ex in exhibitors:
        rows.append({
            "Company": ex.get("company", ""),
            "HQ": ex.get("hq", ""),
            "Industry": ex.get("industry", ""),
            "Revenue": ex.get("revenue", ""),
            "Team Size": ex.get("team_size", ""),
            "Booth": ex.get("booth", ""),
            "Website": ex.get("website", ""),
            "LinkedIn": ex.get("linkedin", "")
        })
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return {"csv_data": output.getvalue(), "filename": f"shortlist_{sl.get('name', 'export')}.csv"}

# ============ EXPO DAYS ============

@api_router.get("/expodays")
async def get_expodays(expo_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if expo_id:
        query["expo_id"] = expo_id
    expodays = await db.expodays.find(query, {"_id": 0}).to_list(100)
    for ed in expodays:
        for meeting in ed.get("meetings", []):
            ex = await db.exhibitors.find_one({"id": meeting.get("exhibitor_id")}, {"_id": 0})
            if ex:
                meeting["exhibitor"] = ex
    return expodays

@api_router.post("/expodays")
async def create_expoday(data: ExpoDayCreate, user=Depends(get_current_user)):
    existing = await db.expodays.find_one({"user_id": user["id"], "expo_id": data.expo_id}, {"_id": 0})
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}
    expoday = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "expo_id": data.expo_id,
        "meetings": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.expodays.insert_one(expoday)
    return {k: v for k, v in expoday.items() if k != "_id"}

@api_router.post("/expodays/{expoday_id}/meetings")
async def add_meeting(expoday_id: str, data: MeetingCreate, user=Depends(get_current_user)):
    meeting = {
        "id": str(uuid.uuid4()),
        "exhibitor_id": data.exhibitor_id,
        "time": data.time,
        "agenda": data.agenda or "",
        "status": "scheduled",
        "notes": "",
        "visiting_card_base64": None,
        "voice_note_base64": None,
        "voice_transcript": None,
        "action_items": None,
        "checked_in": False
    }
    result = await db.expodays.update_one(
        {"id": expoday_id, "user_id": user["id"]},
        {"$push": {"meetings": meeting}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expo day not found")
    return meeting

@api_router.put("/expodays/{expoday_id}/meetings/{meeting_id}")
async def update_meeting(expoday_id: str, meeting_id: str, data: MeetingUpdate, user=Depends(get_current_user)):
    update_fields = {}
    if data.time is not None:
        update_fields["meetings.$.time"] = data.time
    if data.agenda is not None:
        update_fields["meetings.$.agenda"] = data.agenda
    if data.status is not None:
        update_fields["meetings.$.status"] = data.status
    if data.notes is not None:
        update_fields["meetings.$.notes"] = data.notes
    if update_fields:
        await db.expodays.update_one(
            {"id": expoday_id, "user_id": user["id"], "meetings.id": meeting_id},
            {"$set": update_fields}
        )
    return {"status": "updated"}

@api_router.post("/expodays/{expoday_id}/meetings/{meeting_id}/checkin")
async def checkin_meeting(expoday_id: str, meeting_id: str, user=Depends(get_current_user)):
    await db.expodays.update_one(
        {"id": expoday_id, "user_id": user["id"], "meetings.id": meeting_id},
        {"$set": {"meetings.$.checked_in": True, "meetings.$.status": "checked_in"}}
    )
    return {"status": "checked_in"}

@api_router.post("/expodays/{expoday_id}/meetings/{meeting_id}/upload-card")
async def upload_visiting_card(expoday_id: str, meeting_id: str, base64_data: str = Form(...), user=Depends(get_current_user)):
    await db.expodays.update_one(
        {"id": expoday_id, "user_id": user["id"], "meetings.id": meeting_id},
        {"$set": {"meetings.$.visiting_card_base64": base64_data}}
    )
    return {"status": "card_uploaded"}

@api_router.post("/expodays/{expoday_id}/meetings/{meeting_id}/upload-voice")
async def upload_voice_note(expoday_id: str, meeting_id: str, base64_data: str = Form(...), user=Depends(get_current_user)):
    await db.expodays.update_one(
        {"id": expoday_id, "user_id": user["id"], "meetings.id": meeting_id},
        {"$set": {"meetings.$.voice_note_base64": base64_data}}
    )
    # Attempt transcription
    transcript = None
    action_items = None
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        if EMERGENT_LLM_KEY:
            audio_bytes = base64.b64decode(base64_data)
            temp_path = f"/tmp/voice_{meeting_id}.wav"
            with open(temp_path, "wb") as f:
                f.write(audio_bytes)
            stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(file=audio_file, model="whisper-1", response_format="json")
            transcript = response.text
            if transcript:
                chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"actions-{meeting_id}", system_message="Extract action items from meeting notes. Return a concise bullet list.")
                chat.with_model("openai", "gpt-4o")
                msg = UserMessage(text=f"Extract action items from this meeting transcript:\n\n{transcript}")
                action_items = await chat.send_message(msg)
            await db.expodays.update_one(
                {"id": expoday_id, "user_id": user["id"], "meetings.id": meeting_id},
                {"$set": {"meetings.$.voice_transcript": transcript, "meetings.$.action_items": action_items}}
            )
            os.remove(temp_path)
    except Exception as e:
        logger.warning(f"Transcription failed: {e}")
    return {"status": "voice_uploaded", "transcript": transcript, "action_items": action_items}

@api_router.delete("/expodays/{expoday_id}/meetings/{meeting_id}")
async def delete_meeting(expoday_id: str, meeting_id: str, user=Depends(get_current_user)):
    await db.expodays.update_one(
        {"id": expoday_id, "user_id": user["id"]},
        {"$pull": {"meetings": {"id": meeting_id}}}
    )
    return {"status": "deleted"}

@api_router.get("/expodays/{expoday_id}/export")
async def export_expoday(expoday_id: str, user=Depends(get_current_user)):
    ed = await db.expodays.find_one({"id": expoday_id, "user_id": user["id"]}, {"_id": 0})
    if not ed:
        raise HTTPException(status_code=404, detail="Expo day not found")
    rows = []
    for m in ed.get("meetings", []):
        ex = await db.exhibitors.find_one({"id": m.get("exhibitor_id")}, {"_id": 0})
        rows.append({
            "Time": m.get("time", ""),
            "Company": ex.get("company", "") if ex else "",
            "Booth": ex.get("booth", "") if ex else "",
            "Agenda": m.get("agenda", ""),
            "Status": m.get("status", ""),
            "Notes": m.get("notes", ""),
            "Transcript": m.get("voice_transcript", "") or "",
            "Action Items": m.get("action_items", "") or "",
            "Checked In": "Yes" if m.get("checked_in") else "No"
        })
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return {"csv_data": output.getvalue(), "filename": f"expoday_{expoday_id}.csv"}

# ============ ADMIN - CSV UPLOAD ============

@api_router.post("/admin/upload-csv")
async def upload_csv(file_content: str = Form(...), file_type: str = Form(...), user=Depends(get_current_user)):
    try:
        reader = csv.DictReader(io.StringIO(file_content))
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV")

        if file_type == "expos":
            docs = []
            for row in rows:
                docs.append({
                    "id": str(uuid.uuid4()),
                    "name": row.get("name", "").strip(),
                    "date": row.get("date", "").strip(),
                    "location": row.get("location", "").strip(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            if docs:
                await db.expos.insert_many(docs)
            return {"status": "uploaded", "count": len(docs), "preview": docs[:5]}

        elif file_type == "exhibitors":
            docs = []
            for row in rows:
                people = []
                people_raw = row.get("people_json", row.get("people", ""))
                if people_raw:
                    try:
                        people = json.loads(people_raw)
                    except Exception:
                        people = []
                solutions_raw = row.get("solutions", "")
                solutions = [s.strip() for s in solutions_raw.split(",") if s.strip()] if solutions_raw else []
                rev_str = row.get("revenue", "0").replace("$", "").replace("M", "000000").replace("B", "000000000").replace(",", "").strip()
                try:
                    revenue = float(rev_str)
                except Exception:
                    revenue = 0
                ts_str = row.get("team_size", "0").replace(",", "").strip()
                try:
                    team_size = int(ts_str)
                except Exception:
                    team_size = 0
                docs.append({
                    "id": str(uuid.uuid4()),
                    "expo_id": row.get("expo_id", "").strip(),
                    "company": row.get("company", "").strip(),
                    "hq": row.get("hq", row.get("HQ", "")).strip(),
                    "industry": row.get("industry", "").strip(),
                    "revenue": revenue,
                    "team_size": team_size,
                    "booth": row.get("booth", "").strip(),
                    "linkedin": row.get("linkedin", "").strip(),
                    "website": row.get("website", "").strip(),
                    "solutions": solutions,
                    "people": people,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            if docs:
                await db.exhibitors.insert_many(docs)
            return {"status": "uploaded", "count": len(docs), "preview": [{k: v for k, v in d.items() if k != "_id"} for d in docs[:5]]}
        else:
            raise HTTPException(status_code=400, detail="Invalid file_type. Use 'expos' or 'exhibitors'")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/users")
async def get_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role: str = Form(...), user=Depends(get_current_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    return {"status": "updated"}

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_data():
    expo_count = await db.expos.count_documents({})
    if expo_count > 0:
        return {"status": "already_seeded"}

    expo_id = str(uuid.uuid4())
    expo = {
        "id": expo_id,
        "name": "TechConnect 2026",
        "date": "2026-03-15",
        "location": "San Francisco, CA",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.expos.insert_one(expo)

    expo2_id = str(uuid.uuid4())
    expo2 = {
        "id": expo2_id,
        "name": "Industry Summit Europe",
        "date": "2026-05-20",
        "location": "Berlin, Germany",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.expos.insert_one(expo2)

    exhibitors = [
        {"company": "NeuralForge AI", "hq": "San Francisco, CA", "industry": "AI/ML", "revenue": 120000000, "team_size": 450, "booth": "A-101", "linkedin": "https://linkedin.com/company/neuralforge", "website": "https://neuralforge.ai", "solutions": ["NLP", "Computer Vision", "MLOps"], "people": [{"name": "Sarah Chen", "title": "CEO", "linkedin": "https://linkedin.com/in/sarachen"}, {"name": "Klaus Schmidt", "title": "VP Engineering", "linkedin": "https://linkedin.com/in/klausschmidt"}]},
        {"company": "CloudScale Systems", "hq": "Seattle, WA", "industry": "Cloud Infrastructure", "revenue": 85000000, "team_size": 320, "booth": "B-205", "linkedin": "https://linkedin.com/company/cloudscale", "website": "https://cloudscale.io", "solutions": ["Kubernetes", "Serverless", "Edge Computing"], "people": [{"name": "James Parker", "title": "CTO", "linkedin": "https://linkedin.com/in/jamesparker"}, {"name": "Maria Santos", "title": "VP Sales", "linkedin": "https://linkedin.com/in/mariasantos"}]},
        {"company": "DataVault Security", "hq": "Austin, TX", "industry": "Cybersecurity", "revenue": 200000000, "team_size": 800, "booth": "C-310", "linkedin": "https://linkedin.com/company/datavault", "website": "https://datavault.sec", "solutions": ["Zero Trust", "SIEM", "Threat Intelligence"], "people": [{"name": "Alex Rivera", "title": "CISO", "linkedin": "https://linkedin.com/in/alexrivera"}, {"name": "Priya Patel", "title": "Head of Product", "linkedin": "https://linkedin.com/in/priyapatel"}]},
        {"company": "GreenTech Solutions", "hq": "Berlin, Germany", "industry": "CleanTech", "revenue": 45000000, "team_size": 150, "booth": "D-115", "linkedin": "https://linkedin.com/company/greentech", "website": "https://greentech.eu", "solutions": ["Solar Analytics", "Carbon Tracking", "Energy Storage"], "people": [{"name": "Hans Müller", "title": "CEO", "linkedin": "https://linkedin.com/in/hansmuller"}]},
        {"company": "QuantumBit Labs", "hq": "Boston, MA", "industry": "Quantum Computing", "revenue": 60000000, "team_size": 200, "booth": "A-220", "linkedin": "https://linkedin.com/company/quantumbit", "website": "https://quantumbit.io", "solutions": ["Quantum Simulation", "Optimization", "Cryptography"], "people": [{"name": "Dr. Wei Zhang", "title": "Chief Scientist", "linkedin": "https://linkedin.com/in/weizhang"}, {"name": "Emily Brooks", "title": "VP Business Dev", "linkedin": "https://linkedin.com/in/emilybrooks"}]},
        {"company": "RoboFlow Industries", "hq": "Tokyo, Japan", "industry": "Robotics", "revenue": 300000000, "team_size": 1200, "booth": "B-400", "linkedin": "https://linkedin.com/company/roboflow", "website": "https://roboflow.jp", "solutions": ["Industrial Automation", "Cobots", "Computer Vision"], "people": [{"name": "Kenji Tanaka", "title": "CEO", "linkedin": "https://linkedin.com/in/kenjitanaka"}, {"name": "Lisa Wang", "title": "VP Engineering", "linkedin": "https://linkedin.com/in/lisawang"}]},
        {"company": "FinEdge Analytics", "hq": "London, UK", "industry": "FinTech", "revenue": 95000000, "team_size": 380, "booth": "C-150", "linkedin": "https://linkedin.com/company/finedge", "website": "https://finedge.co", "solutions": ["Risk Analytics", "Fraud Detection", "RegTech"], "people": [{"name": "Oliver Hayes", "title": "CTO", "linkedin": "https://linkedin.com/in/oliverhayes"}]},
        {"company": "MedAI Diagnostics", "hq": "Zurich, Switzerland", "industry": "HealthTech", "revenue": 150000000, "team_size": 520, "booth": "D-300", "linkedin": "https://linkedin.com/company/medai", "website": "https://medai.health", "solutions": ["Medical Imaging", "Drug Discovery", "EHR Analytics"], "people": [{"name": "Dr. Anna Kowalski", "title": "Chief Medical Officer", "linkedin": "https://linkedin.com/in/annakowalski"}, {"name": "Marco Bianchi", "title": "VP Sales EMEA", "linkedin": "https://linkedin.com/in/marcobianchi"}]},
    ]

    for i, ex in enumerate(exhibitors):
        ex["id"] = str(uuid.uuid4())
        ex["expo_id"] = expo_id if i < 6 else expo2_id
        ex["created_at"] = datetime.now(timezone.utc).isoformat()
    # Add some to both expos
    exhibitors[6]["expo_id"] = expo_id
    exhibitors[7]["expo_id"] = expo_id

    await db.exhibitors.insert_many(exhibitors)

    # Create admin user
    admin_exists = await db.users.find_one({"email": "admin@expointel.com"})
    if not admin_exists:
        admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@expointel.com",
            "password_hash": hash_password("admin123"),
            "name": "Admin User",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)

    demo_exists = await db.users.find_one({"email": "demo@expointel.com"})
    if not demo_exists:
        demo = {
            "id": str(uuid.uuid4()),
            "email": "demo@expointel.com",
            "password_hash": hash_password("demo123"),
            "name": "Demo User",
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(demo)

    return {"status": "seeded", "expos": 2, "exhibitors": len(exhibitors), "users": 2}

# ============ HEALTH ============
@api_router.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
