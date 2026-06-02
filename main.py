from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware


import os
import shutil
from dotenv import load_dotenv
from fastapi.params import Form
import requests

from database import get_db

import google.generativeai as genai
import chromadb
from model import Base, Message, UserForChatApp
from database import engine
import ollama
from langchain_ollama import OllamaEmbeddings

from passwordHashing import hash_password, verify_password

Base.metadata.create_all(bind=engine)

from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = "RagSecretKeyForJWTGeneration"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60



def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )



from sqlalchemy.orm import (
    Session
)

from datetime import datetime

from langchain_community.document_loaders import PyPDFLoader

from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings,
    ChatGoogleGenerativeAI
)

from langchain_chroma import Chroma

from pydantic import BaseModel

from model import SessionTable
from schema import AskRequest, UserIdLogin , UserSignup , loginRequest, transcriptRequest

# ======================================================
# FastAPI App
# ======================================================

app = FastAPI()

# ======================================================
# CORS
# ======================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# ENV
# ======================================================

load_dotenv()

CollectionName = "ollama_collection"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")

CHROMA_TENANT = os.getenv("CHROMA_TENANT")

CHROMA_DATABASE = os.getenv("CHROMA_DATABASE")

DATABASE_URL = os.getenv("DATABASE_URL")

API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found")

# ======================================================
# Gemini Config
# ======================================================

os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)

# ======================================================
# PostgreSQL
# ======================================================



# ======================================================
# Session Table
# ======================================================



# ======================================================
# Create Tables
# ======================================================



# ======================================================
# Pydantic Schema
# ======================================================


# ======================================================
# Gemini Embeddings
# ======================================================

embeddings = OllamaEmbeddings(
    model="nomic-embed-text"
)

# ======================================================
# Chroma Cloud Client
# ======================================================

client = chromadb.CloudClient(
    api_key=CHROMA_API_KEY,
    tenant=CHROMA_TENANT,
    database=CHROMA_DATABASE
)

# ======================================================
# Upload Folder
# ======================================================

UPLOAD_FOLDER = "uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ======================================================
# Root API
# ======================================================

@app.get("/")
def root():
    return {
        "message": "RAG API Running Successfully"
    }

# ======================================================
# Upload PDF API
# ======================================================

@app.post("/createnewsession")
def create_new_session(userId : UserIdLogin ,db: Session = Depends(get_db)):

    try:

        new_session = SessionTable(
            title="New Session",
            user_id = userId.userId
        )

        db.add(new_session)

        db.commit()

        db.refresh(new_session)

        return {
            "message": "New session created successfully",
            "session_id": new_session.id
        }

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    userId: str = Form(...)
):

    try:
    
        # -----------------------------------
        # Save Uploaded File
        # -----------------------------------

        file_path = os.path.join(
            UPLOAD_FOLDER,
            file.filename
        )

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

        # -----------------------------------
        # Create Session
        # -----------------------------------

        new_session = SessionTable(
            title=file.filename,
            user_id = userId
        )   

        db.add(new_session)

        db.commit()

        db.refresh(new_session)

        # -----------------------------------
        # Load PDF
        # -----------------------------------

        loader = PyPDFLoader(file_path)



        document = loader.load()

        documents = [
        doc for doc in document
        if doc.page_content.strip()
        ]

        # -----------------------------------
        # Split Text
        # -----------------------------------

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=500
        )

        docs = splitter.split_documents(
            documents
        )

        # -----------------------------------
        # Create Chroma Collection
        # -----------------------------------



        vectorstore = Chroma(
            client=client,
            collection_name=CollectionName,
            embedding_function=embeddings
        )

        # -----------------------------------
        # Store Documents
        # -----------------------------------

        batch_size = 500

        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]

            vectorstore.add_documents(batch)

            print(f"Inserted {i + len(batch)}")

        

        return {
            "message": "PDF uploaded successfully",
            "collection_name": CollectionName,
            "total_chunks": len(docs),
            "session_id": new_session.id            
        }

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# ======================================================
# Ask Question API
# ======================================================

@app.post("/ask")
def ask_question(request: AskRequest,db: Session = Depends(get_db)):

    try:

        # -----------------------------------
        # Collection Name
        # -----------------------------------

        

        print("sesstionId:", request.session_id)


        # -----------------------------------
        # Connect Collection    
        # -----------------------------------

        vectorstore = Chroma(
            client=client,
            collection_name=CollectionName,
            embedding_function=embeddings
        )



        retrieved_docs = (
            vectorstore.similarity_search(
                request.question,
                k=3
            )
        )

      
        context = "\n\n".join(
            [
                doc.page_content
                for doc in retrieved_docs
            ]
        )

        # -----------------------------------
        # Gemini LLM
        # -----------------------------------

        # llm = ChatGoogleGenerativeAI(
        #     model="gemini-2.5-flash",
        #     temperature=0.5
        # )

  


        session = db.query(SessionTable).filter(SessionTable.id == request.session_id).first()

    
        # -----------------------------------
        # Prompt
        # -----------------------------------

        prompt = f"""
        You are an AI assistant for question answering.

        Answer the user's question ONLY using the provided context.
        Do not make up information.
        If the answer is not available in the context, say:
        "I could not find the answer in the uploaded documents."

        Document Title:
        {session.title}

        Retrieved Context:
        {context}

        User Question:
        {request.question}

        Instructions:
        - Give a clear and accurate answer.
        - Keep the answer concise but complete.
        - If multiple documents contain relevant information, combine them properly.
        - Do not mention unrelated details.
        """

        # -----------------------------------
        # Generate Response
        # -----------------------------------

        llm = ollama.generate(model="mistral", prompt=prompt)


        

        message =  Message(
            session_id=request.session_id,
            sender="user",
            question=request.question,
            content=llm.response.strip(),
        )
        db.add(message)
        db.commit()
        if session.title == "New Session":
            session.title = request.question[:100] 
            db.commit()

        return {
            "question": request.question,
            "response": llm.response.strip()
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    

@app.get("/getAllSessions/{user_id}")
def get_all_sessions(user_id: int, db: Session = Depends(get_db)):
    try:
        sessions = db.query(SessionTable).filter(SessionTable.user_id == user_id).all()
        
        return sessions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@app.get("/getSessionHistory/{user_id}/{session_id}")
def get_session_history(
    user_id: int,
    session_id: int,
    db: Session = Depends(get_db)
):

    session = (
        db.query(SessionTable)
        .filter(
            SessionTable.id == session_id,
            SessionTable.user_id == user_id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .all()
    )

    return [
        {
            "user": msg.question,
            "Assistant": msg.content,
            "datetime": msg.created_at
        }
        for msg in messages
    ]
    
@app.post("/signup")
def signup(user: UserSignup ,db: Session  = Depends(get_db)):
    
    userMailid = db.query(UserForChatApp).filter(UserForChatApp.email == user.email).first()

    print("Password:", user.password)
    print("Length:", len(user.password))

    if userMailid:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    hashed_password = hash_password(user.password)
    new_user = UserForChatApp(username = user.username,password = hashed_password, email = user.email)
    db.add(new_user)
    db.commit()

    return {
        "message": "User registered successfully",
        "userId": new_user.id
    }

@app.post("/login")
def login(request : loginRequest,db : Session = Depends(get_db)):
    user = db.query(UserForChatApp).filter(UserForChatApp.email  == request.email).first()


    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )
    
    if not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )
    
    token = create_access_token(
        {
            "user_id": user.id,
            "email": user.email
        }
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }




@app.get("/token")
def get_token():
    response = requests.get(
        "https://streaming.assemblyai.com/v3/token",
        headers={
            "Authorization": API_KEY
        },
        params={
            "expires_in_seconds": 300
        }
    )

    print(response.status_code)
    print(response.text)

    return response.json()


@app.post("/transcribe")
def livetranscribe(transcript : transcriptRequest):
    print("Transcript:", transcript.transcript)

    return {
        "message": "Transcript received successfully"
    }