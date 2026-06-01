from pydantic import BaseModel

class AskRequest(BaseModel):
    question: str
    session_id: int


class historyItem(BaseModel):
    user: str
    Airesponce: str