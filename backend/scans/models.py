from database import Base
from sqlalchemy import Column, String, Text, DateTime, Enum
from datetime import datetime
import uuid

class Scan(Base):
    __tablename__ = "scans"
    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id       = Column(String, nullable=False)
    target        = Column(String(255), nullable=False)
    scan_type     = Column(String(50), default="full")   # full / quick / web-only
    status        = Column(
                        Enum("queued","running","completed","failed", name="scan_status"),
                        default="queued"
                    )
    tool_results  = Column(Text)   # raw JSON from all tools
    ai_analysis   = Column(Text)   # LLM-generated analysis
    pdf_report    = Column(String) # path to PDF file
    created_at    = Column(DateTime, default=datetime.utcnow)
    completed_at  = Column(DateTime)