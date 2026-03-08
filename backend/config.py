from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str

    POTREE_CONVERTER_PATH: str
    TEMP_DIR: str

    FRONTEND_URL: str

    class Config:
        env_file = ".env"


settings = Settings()