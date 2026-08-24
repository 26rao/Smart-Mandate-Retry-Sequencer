import os
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    RAZORPAY_KEY_ID: str = "rzp_test_mockkey123456"
    RAZORPAY_KEY_SECRET: str = "mocksecret987654321"
    LLM_PROVIDER: Literal["groq", "openai", "google", "rule_based"] = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./sequencer.db"
    SYNC_DATABASE_URL: str = "sqlite:///./sequencer.db"
    MAX_ATTEMPTS: int = 4  # Standard default
    MAX_ATTEMPTS_UPI: int = 4  # NPCI UPI Autopay: 1 initial + 3 retries = 4 attempts
    MAX_ATTEMPTS_CARD: int = 3  # RBI Card E-Mandate: 1 initial + 2 retries = 3 attempts
    MAX_ATTEMPTS_NACH: int = 3  # e-NACH Presentation limit: 3 attempts
    DRY_RUN: bool = False
    APP_ENV: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
