from sqlmodel import SQLModel, create_engine, Session
import os
from dotenv import load_dotenv

load_dotenv()

# Use SQLite by default for simplicity if POSTGRES_URL is not set
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")

# Only enable SQL echo in development mode
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
engine = create_engine(DATABASE_URL, echo=DEBUG_MODE)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
