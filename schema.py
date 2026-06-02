from pydantic import BaseModel , EmailStr, Field

class AskRequest(BaseModel):
    question: str
    session_id: int


class historyItem(BaseModel):
    user: str
    Airesponce: str

class UserSignup(BaseModel):
    username:str
    password: str = Field(
        min_length=8,
        max_length=72
    )
    email:EmailStr

class loginRequest(BaseModel):
    email:EmailStr
    password:str

class UserIdLogin(BaseModel):
    userId: int

class transcriptRequest(BaseModel):
    transcript: str