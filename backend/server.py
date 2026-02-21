from fastapi import FastAPI, APIRouter, HTTPException, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, io, csv, json, uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import jwt, bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ.get('JWT_SECRET', 'expointel-secret-key-2026-prod!!')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Auth Helpers ──
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw: str, h: str) -> bool:
    return bcrypt.checkpw(pw.encode(), h.encode())
def make_token(uid: str, role: str) -> str:
    return jwt.encode({"user_id": uid, "role": role, "exp": datetime.now(timezone.utc).timestamp() + 86400*7}, JWT_SECRET, algorithm="HS256")

async def current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    if not cred: raise HTTPException(401, "Not authenticated")
    try:
        p = jwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"])
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
        if not u: raise HTTPException(401, "User not found")
        return u
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except Exception: raise HTTPException(401, "Invalid token")

# ── Models ──
class AuthIn(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class ShortlistIn(BaseModel):
    company_id: str
    expo_id: str
    notes: Optional[str] = ""

class NetworkIn(BaseModel):
    company_id: str
    expo_id: str
    contact_name: str
    contact_role: Optional[str] = ""
    status: Optional[str] = "request_sent"
    meeting_type: Optional[str] = "booth_visit"
    scheduled_time: Optional[str] = ""
    notes: Optional[str] = ""

class ExpoDayIn(BaseModel):
    expo_id: str
    company_id: str
    time_slot: str
    meeting_type: Optional[str] = "booth_visit"
    booth: Optional[str] = ""
    notes: Optional[str] = ""

# ── Auth ──
@api_router.post("/auth/register")
async def register(data: AuthIn):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email already registered")
    u = {"id": str(uuid.uuid4()), "email": data.email, "password_hash": hash_pw(data.password),
         "name": data.name or data.email.split("@")[0], "role": "user", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(u)
    return {"token": make_token(u["id"], u["role"]), "user": {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}}

@api_router.post("/auth/login")
async def login(data: AuthIn):
    u = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not u or not verify_pw(data.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(u["id"], u["role"]), "user": {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

# ── Expos ──
@api_router.get("/expos")
async def get_expos(region: Optional[str] = None, industry: Optional[str] = None):
    q = {}
    if region: q["region"] = {"$regex": region, "$options": "i"}
    if industry: q["industry"] = {"$regex": industry, "$options": "i"}
    expos = await db.expos.find(q, {"_id": 0}).to_list(100)
    for e in expos:
        e["company_count"] = await db.companies.count_documents({"expo_id": e["id"]})
    return expos

@api_router.get("/expos/{eid}")
async def get_expo(eid: str):
    e = await db.expos.find_one({"id": eid}, {"_id": 0})
    if not e: raise HTTPException(404, "Expo not found")
    e["company_count"] = await db.companies.count_documents({"expo_id": eid})
    return e

@api_router.get("/expos/meta/filters")
async def expo_filters():
    regions = await db.expos.distinct("region")
    industries = await db.expos.distinct("industry")
    return {"regions": sorted([r for r in regions if r]), "industries": sorted([i for i in industries if i])}

# ── Companies ──
@api_router.get("/companies")
async def get_companies(expo_id: Optional[str] = None, industry: Optional[str] = None,
                        hq: Optional[str] = None, min_revenue: Optional[float] = None,
                        max_revenue: Optional[float] = None, search: Optional[str] = None):
    q = {}
    if expo_id: q["expo_id"] = expo_id
    if industry: q["industry"] = {"$regex": industry, "$options": "i"}
    if hq: q["hq"] = {"$regex": hq, "$options": "i"}
    if min_revenue is not None or max_revenue is not None:
        q["revenue"] = {}
        if min_revenue is not None: q["revenue"]["$gte"] = min_revenue
        if max_revenue is not None: q["revenue"]["$lte"] = max_revenue
        if not q["revenue"]: del q["revenue"]
    if search: q["name"] = {"$regex": search, "$options": "i"}
    return await db.companies.find(q, {"_id": 0}).to_list(500)

@api_router.get("/companies/{cid}")
async def get_company(cid: str):
    c = await db.companies.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Company not found")
    return c

@api_router.put("/companies/{cid}/stage")
async def update_stage(cid: str, stage: str = Form(...), user=Depends(current_user)):
    valid = ["prospecting", "prospecting_complete", "engaging", "closed_won", "closed_lost"]
    if stage not in valid: raise HTTPException(400, f"Invalid stage. Must be one of: {valid}")
    await db.companies.update_one({"id": cid}, {"$set": {"shortlist_stage": stage}})
    return {"status": "updated", "stage": stage}

@api_router.get("/companies/filters/options")
async def company_filter_options(expo_id: Optional[str] = None):
    q = {"expo_id": expo_id} if expo_id else {}
    pipeline = [{"$match": q}, {"$group": {"_id": None,
        "industries": {"$addToSet": "$industry"}, "hqs": {"$addToSet": "$hq"},
        "min_revenue": {"$min": "$revenue"}, "max_revenue": {"$max": "$revenue"}}}]
    r = await db.companies.aggregate(pipeline).to_list(1)
    if not r: return {"industries": [], "hqs": [], "min_revenue": 0, "max_revenue": 1000}
    return {"industries": sorted([x for x in r[0].get("industries",[]) if x]),
            "hqs": sorted([x for x in r[0].get("hqs",[]) if x]),
            "min_revenue": r[0].get("min_revenue", 0), "max_revenue": r[0].get("max_revenue", 1000)}

# ── Shortlists ──
@api_router.get("/shortlists")
async def get_shortlists(stage: Optional[str] = None, expo_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if expo_id: q["expo_id"] = expo_id
    sls = await db.shortlists.find(q, {"_id": 0}).to_list(500)
    for sl in sls:
        c = await db.companies.find_one({"id": sl["company_id"]}, {"_id": 0})
        if c:
            sl["company"] = c
            if stage and c.get("shortlist_stage") != stage: continue
        e = await db.expos.find_one({"id": sl["expo_id"]}, {"_id": 0})
        if e: sl["expo"] = e
    if stage:
        sls = [s for s in sls if s.get("company", {}).get("shortlist_stage") == stage]
    return sls

@api_router.post("/shortlists")
async def create_shortlist(data: ShortlistIn, user=Depends(current_user)):
    existing = await db.shortlists.find_one({"user_id": user["id"], "company_id": data.company_id, "expo_id": data.expo_id})
    if existing: return {"status": "already_exists", "id": existing.get("id", "")}
    sl = {"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": data.company_id,
          "expo_id": data.expo_id, "notes": data.notes or "", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.shortlists.insert_one(sl)
    await db.companies.update_one({"id": data.company_id, "shortlist_stage": {"$in": [None, "", "none"]}},
                                   {"$set": {"shortlist_stage": "prospecting"}})
    return {k: v for k, v in sl.items() if k != "_id"}

@api_router.put("/shortlists/{sid}")
async def update_shortlist(sid: str, notes: str = Form(""), user=Depends(current_user)):
    await db.shortlists.update_one({"id": sid, "user_id": user["id"]}, {"$set": {"notes": notes}})
    return {"status": "updated"}

@api_router.delete("/shortlists/{sid}")
async def delete_shortlist(sid: str, user=Depends(current_user)):
    await db.shortlists.delete_one({"id": sid, "user_id": user["id"]})
    return {"status": "deleted"}

# ── Networks ──
@api_router.get("/networks")
async def get_networks(expo_id: Optional[str] = None, status: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if expo_id: q["expo_id"] = expo_id
    if status: q["status"] = status
    nets = await db.networks.find(q, {"_id": 0}).to_list(500)
    for n in nets:
        c = await db.companies.find_one({"id": n["company_id"]}, {"_id": 0})
        if c: n["company"] = c
        e = await db.expos.find_one({"id": n["expo_id"]}, {"_id": 0})
        if e: n["expo"] = e
    return nets

@api_router.post("/networks")
async def create_network(data: NetworkIn, user=Depends(current_user)):
    n = {"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": data.company_id,
         "expo_id": data.expo_id, "contact_name": data.contact_name, "contact_role": data.contact_role,
         "status": data.status or "request_sent", "meeting_type": data.meeting_type or "booth_visit",
         "scheduled_time": data.scheduled_time or "", "notes": data.notes or "",
         "created_at": datetime.now(timezone.utc).isoformat()}
    await db.networks.insert_one(n)
    return {k: v for k, v in n.items() if k != "_id"}

@api_router.put("/networks/{nid}")
async def update_network(nid: str, status: Optional[str] = Form(None), meeting_type: Optional[str] = Form(None),
                          scheduled_time: Optional[str] = Form(None), notes: Optional[str] = Form(None),
                          contact_name: Optional[str] = Form(None), contact_role: Optional[str] = Form(None),
                          user=Depends(current_user)):
    updates = {}
    if status is not None: updates["status"] = status
    if meeting_type is not None: updates["meeting_type"] = meeting_type
    if scheduled_time is not None: updates["scheduled_time"] = scheduled_time
    if notes is not None: updates["notes"] = notes
    if contact_name is not None: updates["contact_name"] = contact_name
    if contact_role is not None: updates["contact_role"] = contact_role
    if updates:
        await db.networks.update_one({"id": nid, "user_id": user["id"]}, {"$set": updates})
    return {"status": "updated"}

@api_router.delete("/networks/{nid}")
async def delete_network(nid: str, user=Depends(current_user)):
    await db.networks.delete_one({"id": nid, "user_id": user["id"]})
    return {"status": "deleted"}

# ── Expo Days ──
@api_router.get("/expo-days")
async def get_expo_days(expo_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if expo_id: q["expo_id"] = expo_id
    eds = await db.expo_days.find(q, {"_id": 0}).sort("time_slot", 1).to_list(500)
    for ed in eds:
        c = await db.companies.find_one({"id": ed["company_id"]}, {"_id": 0})
        if c: ed["company"] = c
        e = await db.expos.find_one({"id": ed["expo_id"]}, {"_id": 0})
        if e: ed["expo"] = e
    return eds

@api_router.post("/expo-days")
async def create_expo_day(data: ExpoDayIn, user=Depends(current_user)):
    ed = {"id": str(uuid.uuid4()), "user_id": user["id"], "expo_id": data.expo_id,
          "company_id": data.company_id, "time_slot": data.time_slot, "status": "planned",
          "meeting_type": data.meeting_type or "booth_visit", "booth": data.booth or "",
          "notes": data.notes or "", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.expo_days.insert_one(ed)
    return {k: v for k, v in ed.items() if k != "_id"}

@api_router.put("/expo-days/{eid}")
async def update_expo_day(eid: str, status: Optional[str] = Form(None), notes: Optional[str] = Form(None), user=Depends(current_user)):
    updates = {}
    if status: updates["status"] = status
    if notes is not None: updates["notes"] = notes
    if updates:
        await db.expo_days.update_one({"id": eid, "user_id": user["id"]}, {"$set": updates})
    return {"status": "updated"}

@api_router.delete("/expo-days/{eid}")
async def delete_expo_day(eid: str, user=Depends(current_user)):
    await db.expo_days.delete_one({"id": eid, "user_id": user["id"]})
    return {"status": "deleted"}

# ── Admin CSV ──
@api_router.post("/admin/upload-csv")
async def upload_csv(file_content: str = Form(...), expo_id: str = Form(...), user=Depends(current_user)):
    try:
        reader = csv.DictReader(io.StringIO(file_content))
        rows = list(reader)
        if not rows: raise HTTPException(400, "Empty CSV")
        docs = []
        for row in rows:
            contacts = []
            cj = row.get("contacts", "")
            if cj:
                try: contacts = json.loads(cj)
                except: pass
            rev_str = row.get("revenue", "0").replace("€", "").replace("$", "").replace("M", "").replace(",", "").strip()
            try: revenue = float(rev_str)
            except: revenue = 0
            docs.append({"id": str(uuid.uuid4()), "expo_id": expo_id, "name": row.get("name", "").strip(),
                         "hq": row.get("HQ", row.get("hq", "")).strip(), "revenue": revenue,
                         "booth": row.get("booth", "").strip(), "industry": row.get("industry", "").strip(),
                         "shortlist_stage": "none", "contacts": contacts,
                         "created_at": datetime.now(timezone.utc).isoformat()})
        if docs: await db.companies.insert_many(docs)
        return {"status": "uploaded", "count": len(docs), "preview": [{k:v for k,v in d.items() if k!="_id"} for d in docs[:3]]}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, str(e))

@api_router.get("/admin/users")
async def get_users(user=Depends(current_user)):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)

# ── Export CSV ──
@api_router.get("/export/{collection}")
async def export_csv(collection: str, expo_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if expo_id: q["expo_id"] = expo_id
    coll_map = {"shortlists": db.shortlists, "networks": db.networks, "expo-days": db.expo_days}
    if collection not in coll_map: raise HTTPException(400, "Invalid collection")
    items = await coll_map[collection].find(q, {"_id": 0}).to_list(500)
    rows = []
    for item in items:
        c = await db.companies.find_one({"id": item.get("company_id")}, {"_id": 0})
        e = await db.expos.find_one({"id": item.get("expo_id")}, {"_id": 0})
        row = {**{k:v for k,v in item.items() if k not in ["_id","user_id"]},
               "company_name": c.get("name","") if c else "", "expo_name": e.get("name","") if e else ""}
        rows.append(row)
    out = io.StringIO()
    if rows:
        w = csv.DictWriter(out, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    return {"csv_data": out.getvalue(), "filename": f"{collection}_export.csv"}

# ── Seed ──
@api_router.post("/seed")
async def seed_data():
    if await db.expos.count_documents({}) > 0:
        return {"status": "already_seeded"}

    expos_data = [
        {"name": "IFA Berlin 2026", "region": "Europe", "industry": "Consumer Electronics", "date": "2026-09-04"},
        {"name": "CES Las Vegas 2026", "region": "North America", "industry": "Technology", "date": "2026-01-06"},
        {"name": "MWC Barcelona 2026", "region": "Europe", "industry": "Telecoms & Mobile", "date": "2026-02-23"},
        {"name": "Hannover Messe 2026", "region": "Europe", "industry": "Industrial Automation", "date": "2026-04-20"},
        {"name": "GITEX Dubai 2026", "region": "Middle East", "industry": "Technology", "date": "2026-10-14"},
    ]
    expo_ids = {}
    for ed in expos_data:
        eid = str(uuid.uuid4())
        expo_ids[ed["name"]] = eid
        await db.expos.insert_one({**ed, "id": eid, "created_at": datetime.now(timezone.utc).isoformat()})

    companies_data = [
        # IFA Berlin
        {"expo": "IFA Berlin 2026", "name": "Siemens AG", "hq": "Munich, Germany", "revenue": 72000, "booth": "Hall 1 A-101", "industry": "Electronics", "contacts": [{"name": "Klaus Weber", "role": "VP Sales EMEA"}, {"name": "Anna Fischer", "role": "Head of Partnerships"}]},
        {"expo": "IFA Berlin 2026", "name": "Bosch GmbH", "hq": "Stuttgart, Germany", "revenue": 88000, "booth": "Hall 2 B-205", "industry": "Smart Home", "contacts": [{"name": "Thomas Mueller", "role": "Director IoT"}, {"name": "Lisa Braun", "role": "Sales Manager"}]},
        {"expo": "IFA Berlin 2026", "name": "Philips NV", "hq": "Amsterdam, Netherlands", "revenue": 18500, "booth": "Hall 3 C-110", "industry": "Health Tech", "contacts": [{"name": "Jan van Berg", "role": "CTO"}, {"name": "Sophie Laurent", "role": "BD Manager"}]},
        {"expo": "IFA Berlin 2026", "name": "Samsung Electronics", "hq": "Seoul, South Korea", "revenue": 245000, "booth": "Hall 1 A-300", "industry": "Consumer Electronics", "contacts": [{"name": "Min-jun Park", "role": "VP European Ops"}]},
        {"expo": "IFA Berlin 2026", "name": "LG Electronics", "hq": "Seoul, South Korea", "revenue": 63000, "booth": "Hall 2 D-400", "industry": "Home Appliances", "contacts": [{"name": "Hyun-woo Kim", "role": "Director Strategy"}]},
        {"expo": "IFA Berlin 2026", "name": "Miele & Cie", "hq": "Guetersloh, Germany", "revenue": 5200, "booth": "Hall 4 E-101", "industry": "Home Appliances", "contacts": [{"name": "Markus Schneider", "role": "Head of Digital"}]},
        # CES
        {"expo": "CES Las Vegas 2026", "name": "NVIDIA Corporation", "hq": "Santa Clara, USA", "revenue": 60900, "booth": "Central Hall 1001", "industry": "AI & Semiconductors", "contacts": [{"name": "Sarah Chen", "role": "VP Enterprise"}, {"name": "David Park", "role": "BD Lead"}]},
        {"expo": "CES Las Vegas 2026", "name": "Tesla Inc", "hq": "Austin, USA", "revenue": 96800, "booth": "West Hall 2200", "industry": "Automotive & Energy", "contacts": [{"name": "James Rodriguez", "role": "VP Partnerships"}]},
        {"expo": "CES Las Vegas 2026", "name": "Apple Inc", "hq": "Cupertino, USA", "revenue": 383000, "booth": "North Hall 3000", "industry": "Consumer Electronics", "contacts": [{"name": "Emily Watson", "role": "Enterprise Sales Dir"}]},
        {"expo": "CES Las Vegas 2026", "name": "Qualcomm", "hq": "San Diego, USA", "revenue": 38500, "booth": "Central Hall 1500", "industry": "Semiconductors", "contacts": [{"name": "Michael Torres", "role": "VP IoT Solutions"}]},
        {"expo": "CES Las Vegas 2026", "name": "Meta Platforms", "hq": "Menlo Park, USA", "revenue": 134900, "booth": "West Hall 2500", "industry": "XR & Metaverse", "contacts": [{"name": "Rachel Kim", "role": "Director Partnerships"}]},
        # MWC
        {"expo": "MWC Barcelona 2026", "name": "Ericsson AB", "hq": "Stockholm, Sweden", "revenue": 27200, "booth": "Fira Hall 2 2A10", "industry": "Telecoms Infrastructure", "contacts": [{"name": "Erik Lindberg", "role": "SVP Networks"}]},
        {"expo": "MWC Barcelona 2026", "name": "Nokia Corporation", "hq": "Espoo, Finland", "revenue": 25400, "booth": "Fira Hall 3 3B20", "industry": "Network Equipment", "contacts": [{"name": "Mikko Virtanen", "role": "VP Cloud"}]},
        {"expo": "MWC Barcelona 2026", "name": "Huawei Technologies", "hq": "Shenzhen, China", "revenue": 99200, "booth": "Fira Hall 1 1C30", "industry": "Telecoms & ICT", "contacts": [{"name": "Wei Zhang", "role": "Director Enterprise EU"}]},
        {"expo": "MWC Barcelona 2026", "name": "Deutsche Telekom", "hq": "Bonn, Germany", "revenue": 114200, "booth": "Fira Hall 4 4D10", "industry": "Telecoms Operator", "contacts": [{"name": "Hans Richter", "role": "Head of Innovation"}]},
        # Hannover Messe
        {"expo": "Hannover Messe 2026", "name": "ABB Ltd", "hq": "Zurich, Switzerland", "revenue": 32200, "booth": "Hall 11 A01", "industry": "Industrial Automation", "contacts": [{"name": "Stefan Keller", "role": "VP Robotics"}]},
        {"expo": "Hannover Messe 2026", "name": "KUKA AG", "hq": "Augsburg, Germany", "revenue": 3900, "booth": "Hall 11 B05", "industry": "Robotics", "contacts": [{"name": "Martin Bauer", "role": "CTO"}]},
        {"expo": "Hannover Messe 2026", "name": "SAP SE", "hq": "Walldorf, Germany", "revenue": 32500, "booth": "Hall 8 C10", "industry": "Enterprise Software", "contacts": [{"name": "Julia Wagner", "role": "VP Manufacturing"}]},
        # GITEX
        {"expo": "GITEX Dubai 2026", "name": "Emirates NBD", "hq": "Dubai, UAE", "revenue": 8400, "booth": "Hall A A-200", "industry": "FinTech & Banking", "contacts": [{"name": "Ahmed Al-Rashid", "role": "Head of Digital"}]},
        {"expo": "GITEX Dubai 2026", "name": "Etisalat (e&)", "hq": "Abu Dhabi, UAE", "revenue": 14300, "booth": "Hall B B-100", "industry": "Telecoms", "contacts": [{"name": "Omar Hassan", "role": "VP Enterprise"}]},
    ]
    for cd in companies_data:
        eid = expo_ids.get(cd["expo"])
        if not eid: continue
        await db.companies.insert_one({"id": str(uuid.uuid4()), "expo_id": eid, "name": cd["name"],
            "hq": cd["hq"], "revenue": cd["revenue"], "booth": cd["booth"], "industry": cd["industry"],
            "shortlist_stage": "none", "contacts": cd.get("contacts", []),
            "created_at": datetime.now(timezone.utc).isoformat()})

    for email, pw, name, role in [("admin@expointel.com","admin123","Admin User","admin"), ("demo@expointel.com","demo123","Sarah Mitchell","user")]:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "password_hash": hash_pw(pw),
                "name": name, "role": role, "created_at": datetime.now(timezone.utc).isoformat()})

    return {"status": "seeded", "expos": len(expos_data), "companies": len(companies_data)}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
