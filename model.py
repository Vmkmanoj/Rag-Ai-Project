from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text
)

from sqlalchemy.orm import (
    declarative_base,
    relationship
)

from datetime import datetime

Base = declarative_base()

# ======================================================
# Session Table
# ======================================================

class SessionTable(Base):

    __tablename__ = "sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(String)

    user_id = Column(Integer, ForeignKey("usersForChatApp.id"))

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    user = relationship(
        "UserForChatApp",
        back_populates="sessions"
    )

    # Relationship
    messages = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete"
    )


# ======================================================
# Message Table
# ======================================================

class Message(Base):

    __tablename__ = "messages"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        Integer,
        ForeignKey("sessions.id")
    )

    sender = Column(String)

    question = Column(Text)

    content = Column(Text)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationship
    session = relationship(
        "SessionTable",
        back_populates="messages"
    )

class UserForChatApp(Base):

    __tablename__ = "usersForChatApp"

    id = Column(
        Integer,primary_key=True,
        index=True)
    
    username = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)

    sessions = relationship(
        "SessionTable",
        back_populates="user"
    )