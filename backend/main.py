from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import CORS_ORIGINS, PHOTO_DIR
from routers import auth, equipment, inspection_task, defect_order, dashboard, user
from seed_data import init_db

app = FastAPI(title="电网智能巡检管理平台", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件（照片）
app.mount("/photos", StaticFiles(directory=PHOTO_DIR), name="photos")

# 路由
app.include_router(auth.router)
app.include_router(equipment.router)
app.include_router(inspection_task.router)
app.include_router(defect_order.router)
app.include_router(dashboard.router)
app.include_router(user.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"message": "电网智能巡检管理平台 API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
