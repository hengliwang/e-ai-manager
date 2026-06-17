import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'smart_grid.db')}"
PHOTO_DIR = os.path.join(os.path.dirname(BASE_DIR), 'photos')
os.makedirs(PHOTO_DIR, exist_ok=True)

SECRET_KEY = "smart-grid-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
