from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://dashboard:dashboard123@postgres:5432/dashboard"
    JWT_SECRET: str = "supersecretkey"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60
    JWT_REFRESH_EXPIRY_DAYS: int = 7

    DEFAULT_ADMIN_EMAIL: str = "admin@esprit.tn"
    DEFAULT_ADMIN_PASSWORD: str = "Admin123!"
    DEFAULT_ADMIN_NAME: str = "Default Admin"

    # Gmail SMTP — set SMTP_USER + SMTP_PASSWORD (App Password) in .env
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@resinet.tn"
    SMTP_TLS: bool = True
    APP_LOGIN_URL: str = "http://localhost:3000/login"

    class Config:
        env_file = ".env"


settings = Settings()
