
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI(title="Mauritius Safety Alert Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

reports = []
next_id = 1


@app.get("/")
def home():
    return {
        "message": "Mauritius Safety Alert Server is running!",
        "status": "online"
    }


@app.post("/reports")
def submit_report(report: dict):
    global next_id

    new_report = {
        "id": next_id,
        "details": report,
        "status": "pending",
        "date": datetime.now().isoformat()
    }

    reports.append(new_report)
    next_id += 1

    return {
        "message": "Report submitted successfully",
        "report": new_report
    }


@app.get("/reports")
def get_reports():
    return reports


@app.post("/reports/{report_id}/accept")
def accept_report(report_id: int):
    for report in reports:
        if report["id"] == report_id:
            report["status"] = "accepted"
            return {"message": "Report accepted"}

    return {"message": "Report not found"}


@app.post("/reports/{report_id}/reject")
def reject_report(report_id: int):
    for report in reports:
        if report["id"] == report_id:
            report["status"] = "rejected"
            return {"message": "Report rejected"}

    return {"message": "Report not found"}
