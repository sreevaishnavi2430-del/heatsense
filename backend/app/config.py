import os
from dataclasses import dataclass, field
from typing import Optional


_env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.isfile(_env_file):
    for _line in open(_env_file, encoding="utf-8"):
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _value = _line.split("=", 1)
            os.environ.setdefault(_key.strip(), _value.strip().strip("\"'"))


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    MODE: str = os.getenv("MODE", "demo")
    DEMO_ANY_LOGIN: bool = _bool("DEMO_ANY_LOGIN", True)
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./heatsense.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "heatsense-demo-secret-key-change-in-production")
    OFFICER_PASSWORD: str = os.getenv("OFFICER_PASSWORD", "demo1234")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    FERNET_KEY: str = os.getenv("FERNET_KEY", "0w_3Nqk916qK2d8B1H0rX12_aG84kQZ7Wn-UqE6M2tM=")
    CORS_ORIGINS: list[str] = field(default_factory=lambda: [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()])
    SCHEDULER_ENABLED: bool = _bool("SCHEDULER_ENABLED", False)
    DRY_RUN: bool = _bool("DRY_RUN", True)
    DEFAULT_W_TEMP: float = float(os.getenv("DEFAULT_W_TEMP", ".35"))
    DEFAULT_W_TREE: float = float(os.getenv("DEFAULT_W_TREE", ".20"))
    DEFAULT_W_BUILT: float = float(os.getenv("DEFAULT_W_BUILT", ".15"))
    DEFAULT_W_VULN: float = float(os.getenv("DEFAULT_W_VULN", ".30"))
    GEE_SERVICE_ACCOUNT: Optional[str] = os.getenv("GEE_SERVICE_ACCOUNT")
    GEE_PRIVATE_KEY_FILE: Optional[str] = os.getenv("GEE_PRIVATE_KEY_FILE")
    GEE_PROJECT: Optional[str] = os.getenv("GEE_PROJECT")
    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_SMS_FROM: Optional[str] = os.getenv("TWILIO_SMS_FROM")
    TWILIO_WHATSAPP_FROM: Optional[str] = os.getenv("TWILIO_WHATSAPP_FROM")


settings = Settings()
