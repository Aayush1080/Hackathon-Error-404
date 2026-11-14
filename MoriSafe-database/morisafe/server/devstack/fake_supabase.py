"""
LOCAL TEST STACK ONLY. A stand-in for a Supabase project's HTTP API so the
MoriSafe server can be tested end to end without network access to Supabase.

  /rest/v1/*     -> proxied to a real PostgREST (the software Supabase runs)
  /auth/v1/*     -> minimal GoTrue: password grant against auth.users (bcrypt)
  /storage/v1/*  -> minimal storage-api: upload, signed URLs, public URLs, delete

Bucket privacy, size limit, allowed MIME types and storage.objects INSERT
policies are read from the database on every request, so tests see the real
effect of the SQL migrations. Not a security boundary: never deploy this.
"""
import json
import os
import time
import uuid
from pathlib import Path

import httpx
import jwt
import psycopg
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse

JWT_SECRET = os.environ["DEVSTACK_JWT_SECRET"]
POSTGREST = os.environ.get("DEVSTACK_POSTGREST", "http://127.0.0.1:3000")
DB_DSN = os.environ.get("DEVSTACK_DB", "postgresql://postgres@127.0.0.1:5432/morisafe")
FILES = Path(os.environ.get("DEVSTACK_FILES", "/tmp/devstack-storage"))
FILES.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="fake-supabase (tests only)")
_http = httpx.Client(timeout=30)


def db():
    return psycopg.connect(DB_DSN, autocommit=True)


def role_of(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.headers.get("apikey", "")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False}).get("role", "anon")
    except jwt.PyJWTError:
        return "invalid"


def storage_error(status: int, error: str, message: str) -> JSONResponse:
    return JSONResponse({"statusCode": str(status), "error": error, "message": message}, status_code=status)


@app.api_route("/rest/v1/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD"])
async def rest(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length", "apikey")}
    if "authorization" not in {k.lower() for k in headers} and request.headers.get("apikey"):
        headers["Authorization"] = "Bearer " + request.headers["apikey"]
    r = _http.request(request.method, f"{POSTGREST}/{path}", params=request.query_params.multi_items(),
                      headers=headers, content=await request.body())
    keep = {k: v for k, v in r.headers.items() if k.lower() in ("content-type", "content-range", "preference-applied", "location")}
    return Response(r.content, status_code=r.status_code, headers=keep)


@app.post("/auth/v1/token")
async def token(request: Request):
    if request.query_params.get("grant_type") != "password":
        return JSONResponse({"error": "unsupported_grant_type"}, status_code=400)
    if role_of(request) == "invalid":
        return JSONResponse({"message": "Invalid API key"}, status_code=401)
    body = await request.json()
    email, password = (body.get("email") or "").strip().lower(), body.get("password") or ""
    with db() as c:
        row = c.execute("select id::text, email from auth.users where lower(email) = %s "
                        "and encrypted_password = crypt(%s, encrypted_password)", (email, password)).fetchone()
    if not row:
        return JSONResponse({"error": "invalid_grant", "error_description": "Invalid login credentials"}, status_code=400)
    now = int(time.time())
    access = jwt.encode({"sub": row[0], "email": row[1], "role": "authenticated", "aud": "authenticated",
                         "iat": now, "exp": now + 3600}, JWT_SECRET, algorithm="HS256")
    return {"access_token": access, "token_type": "bearer", "expires_in": 3600, "refresh_token": uuid.uuid4().hex,
            "user": {"id": row[0], "email": row[1], "aud": "authenticated", "role": "authenticated"}}


def bucket(bucket_id: str):
    with db() as c:
        return c.execute("select public, file_size_limit, allowed_mime_types from storage.buckets where id = %s",
                         (bucket_id,)).fetchone()


def insert_allowed(role: str, bucket_id: str) -> bool:
    """Approximates storage RLS: an INSERT policy on storage.objects for this role and bucket."""
    with db() as c:
        rows = c.execute("select roles, coalesce(with_check, '') from pg_policies where schemaname = 'storage' "
                         "and tablename = 'objects' and cmd in ('INSERT', 'ALL')").fetchall()
    return any((role in roles or "public" in roles) and f"'{bucket_id}'" in check for roles, check in rows)


def safe_path(bucket_id: str, name: str) -> Path:
    root = (FILES / bucket_id).resolve()
    p = (root / name).resolve()
    if not str(p).startswith(str(root) + os.sep):
        raise ValueError("path traversal")
    return p


def serve_file(p: Path):
    meta = json.loads(p.with_name(p.name + ".meta").read_text())
    return FileResponse(p, media_type=meta["content_type"])


@app.post("/storage/v1/object/sign/{bucket_id}")
async def sign_many(bucket_id: str, request: Request):
    if role_of(request) != "service_role":
        return storage_error(403, "Unauthorized", "new row violates row-level security policy")
    body = await request.json()
    expires = int(body.get("expiresIn", 60))
    out = []
    for name in body.get("paths", []):
        if not safe_path(bucket_id, name).exists():
            out.append({"error": "Either the object does not exist or you do not have access to it", "path": name, "signedURL": None})
            continue
        tok = jwt.encode({"url": f"{bucket_id}/{name}", "exp": int(time.time()) + expires}, JWT_SECRET, algorithm="HS256")
        out.append({"error": None, "path": name, "signedURL": f"/object/sign/{bucket_id}/{name}?token={tok}"})
    return out


@app.get("/storage/v1/object/sign/{bucket_id}/{name:path}")
async def signed_download(bucket_id: str, name: str, token: str = ""):
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return storage_error(400, "InvalidJWT", '"exp" claim timestamp check failed')
    except jwt.PyJWTError:
        return storage_error(400, "InvalidJWT", "invalid signature")
    if claims.get("url") != f"{bucket_id}/{name}":
        return storage_error(400, "InvalidSignature", "The url do not match the signature")
    p = safe_path(bucket_id, name)
    return serve_file(p) if p.exists() else storage_error(404, "not_found", "Object not found")


@app.get("/storage/v1/object/public/{bucket_id}/{name:path}")
async def public_download(bucket_id: str, name: str):
    b = bucket(bucket_id)
    if not b or not b[0]:
        return storage_error(400, "not_found", "Bucket not found")
    p = safe_path(bucket_id, name)
    return serve_file(p) if p.exists() else storage_error(404, "not_found", "Object not found")


@app.post("/storage/v1/object/{bucket_id}/{name:path}")
async def upload(bucket_id: str, name: str, request: Request):
    role = role_of(request)
    if role == "invalid":
        return storage_error(400, "InvalidJWT", "invalid signature")
    b = bucket(bucket_id)
    if not b:
        return storage_error(404, "Bucket not found", "Bucket not found")
    if role != "service_role" and not insert_allowed(role, bucket_id):
        return storage_error(403, "Unauthorized", "new row violates row-level security policy")
    form = await request.form()
    part = form.get("file")
    data = await part.read()
    ctype = part.content_type or "application/octet-stream"
    _, size_limit, allowed = b
    if size_limit and len(data) > size_limit:
        return storage_error(413, "Payload too large", "The object exceeded the maximum allowed size")
    if allowed and ctype not in allowed:
        return storage_error(415, "invalid_mime_type", f"mime type {ctype} is not supported")
    p = safe_path(bucket_id, name)
    if p.exists():
        return storage_error(409, "Duplicate", "The resource already exists")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    p.with_name(p.name + ".meta").write_text(json.dumps({"content_type": ctype}))
    with db() as c:
        c.execute("insert into storage.objects (bucket_id, name, metadata) values (%s, %s, %s)",
                  (bucket_id, name, json.dumps({"mimetype": ctype, "size": len(data)})))
    return {"Key": f"{bucket_id}/{name}", "Id": str(uuid.uuid4())}


@app.delete("/storage/v1/object/{bucket_id}")
async def remove(bucket_id: str, request: Request):
    if role_of(request) != "service_role":
        return storage_error(403, "Unauthorized", "new row violates row-level security policy")
    names = (await request.json()).get("prefixes", [])
    removed = []
    for name in names:
        p = safe_path(bucket_id, name)
        if p.exists():
            p.unlink()
            p.with_name(p.name + ".meta").unlink(missing_ok=True)
            removed.append({"name": name, "bucket_id": bucket_id})
    with db() as c:
        c.execute("delete from storage.objects where bucket_id = %s and name = any(%s)", (bucket_id, names))
    return removed
