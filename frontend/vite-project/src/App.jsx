import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Upload, FileText, MessageSquare, Search, User,
  ChevronRight, Copy, Check, Layers, Sparkles, ArrowUp, X,
  Menu, BookOpen, Hash, BarChart2, RefreshCw, Brain,
  Paperclip, Settings, Trash2, Edit3, MoreHorizontal,
  ChevronDown, Star, Clock, ExternalLink, AlignLeft,
  ChevronLeft, RotateCcw, ThumbsUp, ThumbsDown, Share2
} from "lucide-react";
import VoiceAgent from "./VoiceAgent";

/* ── helpers ──────────────────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const MOCK_SOURCES = [
  { id: 1, text: "The retrieval-augmented generation framework combines parametric and non-parametric memory for open-domain question answering tasks.", page: 3, score: 0.97, section: "Introduction" },
  { id: 2, text: "Dense passage retrieval enables efficient semantic search over large document corpora using bi-encoder transformer architectures.", page: 7, score: 0.91, section: "Methodology" },
  { id: 3, text: "Empirical results demonstrate that RAG outperforms purely generative models on knowledge-intensive NLP benchmarks.", page: 12, score: 0.84, section: "Results" },
];

const MOCK_RESPONSES = [
  `## RAG Framework Overview\n\nRetrieval-Augmented Generation (RAG) is a hybrid approach combining **parametric memory** (neural network weights) with **non-parametric memory** (an external document store).\n\n### Key Components\n\n1. **Dense Retriever** — encodes queries and documents into a shared embedding space\n2. **Generator** — a seq2seq model conditioned on retrieved context\n3. **Knowledge Base** — an indexed corpus of passages\n\n\`\`\`python\nfrom langchain.vectorstores import Chroma\nfrom langchain.embeddings import OpenAIEmbeddings\n\nvectorstore = Chroma.from_documents(\n    documents=docs,\n    embedding=OpenAIEmbeddings()\n)\nretriever = vectorstore.as_retriever(search_k=4)\n\`\`\`\n\nThis allows the model to access **up-to-date information** without retraining, making it far more flexible than traditional LLMs.`,
  `Based on the document, the methodology involves three stages:\n\n- **Indexing** — Documents are chunked and embedded into a vector database\n- **Retrieval** — Top-k semantically similar passages are fetched at query time\n- **Generation** — The LLM synthesises an answer grounded in retrieved context\n\nThe paper reports a **14.3% improvement** in exact match scores over baseline approaches on the Natural Questions benchmark.`,
  `The confidence scores in the Sources panel reflect **cosine similarity** between your query embedding and retrieved passage embeddings. Scores above 0.85 indicate high semantic relevance.\n\nThe system retrieves the top 3 passages by default, configurable via the \`search_k\` parameter in your retriever setup.`,
];

const CHAT_HISTORY = [
  { id: 1, title: "Transformer Architecture Deep Dive", time: "2h ago" },
  { id: 2, title: "BERT vs GPT Comparison Study", time: "Yesterday" },
  { id: 3, title: "Vector Database Setup Guide", time: "2 days ago" },
  { id: 4, title: "Prompt Engineering Best Practices", time: "3 days ago" },
  { id: 5, title: "Fine-tuning LLaMA on Custom Data", time: "4 days ago" },
];





const SUGGESTIONS = [
  "Summarise the key findings of this document",
  "What methodology was used in this research?",
  "List the main conclusions and recommendations",
  "Explain the technical architecture described",
];

/* ── Markdown renderer ────────────────────────────────────────────────────── */
function MDContent({ text }) {
  const [copied, setCopied] = useState(null);

  const copyCode = async (code, id) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    await sleep(2000);
    setCopied(null);
  };

  const parts = [];
  const codeRe = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0, m, bid = 0;
  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1] || "text", content: m[2].trim(), id: bid++ });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });

  const inline = (s) =>
    s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.82em;">$1</code>');

  const parseText = (raw) =>
    raw.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: "1.05rem", fontWeight: 600, color: "#e5e7eb", margin: "16px 0 6px" }}>{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: "0.95rem", fontWeight: 600, color: "#d1d5db", margin: "12px 0 4px" }}>{line.slice(4)}</h3>;
      if (/^\d+\.\s/.test(line)) return <div key={i} style={{ display: "flex", gap: 8, margin: "3px 0", color: "#d1d5db" }}><span style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.82em", minWidth: "1.2rem", marginTop: 2 }}>{line.match(/^\d+/)[0]}.</span><span dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\d+\.\s/, "")) }} /></div>;
      if (line.startsWith("- ")) return <div key={i} style={{ display: "flex", gap: 8, margin: "3px 0", color: "#d1d5db" }}><span style={{ color: "#6b7280", marginTop: 6, fontSize: "0.5rem" }}>●</span><span dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} /></div>;
      if (line.trim()) return <p key={i} style={{ color: "#d1d5db", margin: "4px 0", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: inline(line) }} />;
      return <div key={i} style={{ height: 4 }} />;
    });

  return (
    <div style={{ fontSize: "0.875rem" }}>
      {parts.map((p, i) =>
        p.type === "code" ? (
          <div key={i} style={{ margin: "12px 0", borderRadius: 8, overflow: "hidden", border: "1px solid #2d2d2d", background: "#1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#222", borderBottom: "1px solid #2d2d2d" }}>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace" }}>{p.lang}</span>
              <button onClick={() => copyCode(p.content, p.id)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: copied === p.id ? "#4ade80" : "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4, transition: "color 0.2s" }}>
                {copied === p.id ? <><Check size={11} /><span>Copied</span></> : <><Copy size={11} /><span>Copy code</span></>}
              </button>
            </div>
            <pre style={{ margin: 0, padding: "14px", overflow: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", lineHeight: 1.65, color: "#e2e8f0" }}>{p.content}</pre>
          </div>
        ) : (
          <div key={i}>{parseText(p.content)}</div>
        )
      )}
    </div>
  );
}

/* ── Typing dots ──────────────────────────────────────────────────────────── */
function Dots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#6b7280", display: "block" }}
          animate={{ y: [-3, 3, -3], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

/* ── Upload Modal ─────────────────────────────────────────────────────────── */
function UploadModal({ onClose, onDone }) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const ref = useRef();

  const uploadFile = (f) => new Promise((resolve, reject) => {
    const formData = new FormData();
    
    formData.append("file", f);
    formData.append("userId", localStorage.getItem("userId"));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
            const data = JSON.parse(
                    xhr.responseText
                );
                localStorage.setItem("sessionId", data.session_id);
                resolve(data);
        } catch (err) {
          resolve({ message: xhr.responseText });
        }
      } else {
        reject(xhr.responseText || xhr.statusText || "Upload failed");
      }
    };
    xhr.onerror = () => reject("Upload failed due to a network error.");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setPct(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.send(formData);
  });

  const run = async (f) => {
    if (!f || f.type !== "application/pdf") return;
    setError(null);
    setFile(f);
    setPct(0);
    setPhase("up");

    try {
      await uploadFile(f);
      setPhase("proc");
      await sleep(600);
      setPhase("done");
      await sleep(700);
      onDone(f.name);
    } catch (err) {
      setError(typeof err === "string" ? err : JSON.stringify(err));
      setPhase("error");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
      <motion.div initial={{ scale: 0.93, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.93, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ width: "100%", maxWidth: 440, margin: "0 16px", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.7)" }}>

        <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f3f4f6", fontFamily: "'Geist',sans-serif" }}>Upload PDF</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#6b7280" }}>Supports PDF up to 50 MB</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4, borderRadius: 6, marginTop: -2 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); run(e.dataTransfer.files[0]); }}
                  onClick={() => ref.current?.click()}
                  style={{ border: `2px dashed ${drag ? "#4b5563" : "#2a2a2a"}`, borderRadius: 12, padding: "36px 20px", textAlign: "center", cursor: "pointer", background: drag ? "rgba(255,255,255,0.03)" : "transparent", transition: "all 0.2s" }}>
                  <input ref={ref} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => run(e.target.files[0])} />
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "#252525", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <Upload size={22} color="#9ca3af" />
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "#e5e7eb", fontWeight: 500 }}>{drag ? "Drop here" : "Drag & drop or click to browse"}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#4b5563" }}>PDF files only</p>
                </div>
              </motion.div>
            )}

            {(phase === "up" || phase === "proc") && (
              <motion.div key="up" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: "flex", gap: 12, padding: 14, borderRadius: 10, background: "#252525", border: "1px solid #2d2d2d", marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={16} color="#f87171" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "0.82rem", color: "#e5e7eb", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#6b7280" }}>{(file?.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>{phase === "up" ? "Uploading…" : "Indexing chunks…"}</span>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace" }}>{phase === "up" ? `${pct}%` : "—"}</span>
                </div>
                <div style={{ height: 3, background: "#2a2a2a", borderRadius: 99, overflow: "hidden" }}>
                  <motion.div style={{ height: "100%", background: "#e5e7eb", borderRadius: 99 }}
                    animate={{ width: phase === "proc" ? "100%" : `${pct}%` }} transition={{ duration: 0.25 }} />
                </div>
                {phase === "proc" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                    {["Parsing", "Chunking", "Embedding", "Indexing"].map((s, i) => (
                      <motion.span key={s} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.15 }}
                        style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 99, background: "#252525", border: "1px solid #333", color: "#9ca3af" }}>{s}</motion.span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "20px 0" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Check size={26} color="#4ade80" />
                </motion.div>
                <p style={{ margin: "0 0 4px", fontSize: "0.95rem", fontWeight: 600, color: "#f3f4f6" }}>Ready!</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>Opening chat…</p>
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(248,113,113,0.12)", border: "2px solid rgba(248,113,113,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <X size={26} color="#f87171" />
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 600, color: "#f3f4f6" }}>Upload failed</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#fca5a5" }}>{error}</p>
                <button onClick={() => { setPhase("idle"); setError(null); }}
                  style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#e5e7eb", cursor: "pointer" }}>
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionModal({ onClose, onNewChat, onUpload }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
      <motion.div initial={{ scale: 0.97, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{ width: "100%", maxWidth: 420, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 64px rgba(0,0,0,0.55)" }}>
        <div style={{ padding: "22px 22px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f3f4f6" }}>New chat</h2>
              <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#6b7280" }}>Choose whether to start a blank chat or upload a document.</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4, borderRadius: 6 }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <button onClick={() => { onNewChat(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#141414", color: "#e5e7eb", cursor: "pointer", fontSize: "0.95rem", fontWeight: 600 }}>
              <Plus size={16} /> Start blank chat
            </button>
            <button onClick={onUpload}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#111", color: "#9ca3af", cursor: "pointer", fontSize: "0.95rem", fontWeight: 600 }}>
              <Upload size={16} /> Upload document
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Sources sidebar ──────────────────────────────────────────────────────────────── */
function Sources({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ width: 272, flexShrink: 0, borderLeft: "1px solid #1f1f1f", background: "#141414", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1f1f1f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={14} color="#9ca3af" />
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e5e7eb" }}>Sources</span>
              <span style={{ fontSize: "0.68rem", padding: "1px 7px", borderRadius: 99, background: "#252525", color: "#6b7280", border: "1px solid #2a2a2a" }}>{MOCK_SOURCES.length}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 2 }}><X size={15} /></button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }} className="custom-scroll">
            {MOCK_SOURCES.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ borderRadius: 10, padding: 14, border: "1px solid #1f1f1f", background: "#1a1a1a", marginBottom: 8, cursor: "pointer", transition: "border-color 0.2s" }}
                whileHover={{ borderColor: "#3a3a3a" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.68rem", color: "#6b7280", background: "#252525", border: "1px solid #2a2a2a", padding: "2px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{s.section}</span>
                  <span style={{ fontSize: "0.68rem", color: "#6b7280" }}>p.{s.page}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "0.72rem", color: "#9ca3af", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.text}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.68rem", color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{(s.score * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: "0.65rem", color: "#374151" }}>match</span>
                  </div>
                  <div style={{ width: 52, height: 3, background: "#252525", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${s.score * 100}%`, height: "100%", background: "#4ade80", borderRadius: 99 }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ padding: "10px 12px", borderTop: "1px solid #1f1f1f" }}>
            <button style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #252525", background: "none", color: "#6b7280", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1f1f1f"; e.currentTarget.style.color = "#9ca3af"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280"; }}>
              <RefreshCw size={12} />Refresh sources
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Message ──────────────────────────────────────────────────────────────── */
function Msg({ msg, isNew }) {
  const isUser = msg.role === "user";
  return (
    <motion.div initial={isNew ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
      style={{ padding: "22px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 20px", display: "flex", gap: 14, flexDirection: isUser ? "row-reverse" : "row" }}>
        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
          background: isUser ? "#374151" : "#212121", border: "1px solid #2a2a2a"
        }}>
          {isUser ? <User size={14} color="#9ca3af" /> : <Sparkles size={14} color="#9ca3af" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.75rem", color: "#4b5563", marginBottom: 6, textAlign: isUser ? "right" : "left" }}>
            <span style={{ fontWeight: 600, color: "#6b7280" }}>{isUser ? "You" : "Assistant"}</span>
            <span style={{ marginLeft: 8 }}>{msg.timestamp?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {isUser ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ background: "#212121", border: "1px solid #2a2a2a", borderRadius: "12px 12px 2px 12px", padding: "10px 16px", maxWidth: "80%", fontSize: "0.875rem", color: "#e5e7eb", lineHeight: 1.65 }}>
                {msg.content}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.875rem" }}>
              <MDContent text={msg.content} />
              {!msg.streaming && msg.content && (
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  {[{ icon: ThumbsUp, label: "Good" }, { icon: ThumbsDown, label: "Bad" }, { icon: Copy, label: "Copy" }, { icon: RotateCcw, label: "Retry" }].map(({ icon: Icon, label }) => (
                    <button key={label} title={label}
                      style={{ background: "none", border: "1px solid #1f1f1f", borderRadius: 6, padding: "4px 8px", color: "#4b5563", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", transition: "all 0.18s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#2d2d2d"; e.currentTarget.style.color = "#9ca3af"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1f1f1f"; e.currentTarget.style.color = "#4b5563"; }}>
                      <Icon size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Empty chat ───────────────────────────────────────────────────────────── */
function EmptyChat({ pdf, onSuggest }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#1a1a1a", border: "1px solid #252525", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Sparkles size={22} color="#9ca3af" />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb", fontFamily: "'Geist',sans-serif" }}>What do you want to know?</h3>
      <p style={{ margin: "0 0 28px", fontSize: "0.82rem", color: "#4b5563", maxWidth: 340 }}>
        Ask anything about <span style={{ color: "#9ca3af" }}>{pdf}</span>
      </p>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGGESTIONS.map((s, i) => (
          <motion.button key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
            onClick={() => onSuggest(s)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, border: "1px solid #1f1f1f", background: "#141414", color: "#9ca3af", fontSize: "0.82rem", cursor: "pointer", textAlign: "left", transition: "all 0.18s" }}
            whileHover={{ borderColor: "#2d2d2d", color: "#e5e7eb" }}>
            <ChevronRight size={14} color="#4b5563" />
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ── Welcome screen ───────────────────────────────────────────────────────── */
function Welcome({ onNew, onNavigate }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "#1a1a1a", border: "1px solid #252525", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Brain size={28} color="#9ca3af" />
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "1.9rem", fontWeight: 700, color: "#f3f4f6", fontFamily: "'Geist',sans-serif", letterSpacing: "-0.03em" }}>
          Chat with your PDF
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: "0.9rem", color: "#6b7280", maxWidth: 360, lineHeight: 1.7 }}>
          Upload any document and ask questions. Get instant, accurate answers powered by AI retrieval.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <motion.button onClick={onNew} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, background: "#e5e7eb", border: "none", color: "#111", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            <Upload size={16} />
            Upload PDF to get started
          </motion.button>
          <motion.button onClick={() => onNavigate("/login")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, background: "#111", border: "1px solid #232323", color: "#e5e7eb", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            Log in
          </motion.button>
          <motion.button onClick={() => onNavigate("/signup")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, background: "#161616", border: "1px solid #232323", color: "#9ca3af", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            Sign up
          </motion.button>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 0, flexWrap: "wrap" }}>
          {[["Semantic search", Brain], ["Cited answers", BookOpen], ["Instant results", Sparkles]].map(([label, Icon]) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "1px solid #1f1f1f", background: "#141414", fontSize: "0.75rem", color: "#6b7280" }}>
              <Icon size={12} color="#4b5563" />{label}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function AuthPage({ mode, onNavigate }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your account" : "Welcome back";
  const description = isSignup
    ? "Sign up to start using RAGchat with your own documents."
    : "Log in to continue where you left off.";
  const buttonLabel = isSignup ? "Sign up" : "Log in";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (isSignup && password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", message: data.detail || data.message || "Unable to complete request." });
        return;
      }

      if (data.userId || data.id || data.user?.id || data.user_id) {
        const savedId = data.userId || data.id || data.user?.id || data.user_id;
        localStorage.setItem("userId", savedId);
        localStorage.setItem("email", email);
        localStorage.setItem("username", data.user.username);
        sessionStorage.setItem("token",data.access_token)
      }

      setStatus({ type: "success", message: `${isSignup ? "Signup" : "Login"} successful! Redirecting...` });
      window.setTimeout(() => onNavigate("/"), 1200);
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Network error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: 24, border: "1px solid #1a1a1a", background: "#111", padding: "32px 28px", color: "#e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700, color: "#f3f4f6" }}>{title}</h1>
            <p style={{ margin: "8px 0 0", color: "#9ca3af", fontSize: "0.92rem", lineHeight: 1.6 }}>{description}</p>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={22} color="#9ca3af" />
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {isSignup && (
            <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "#d1d5db" }}>
              Name
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your full name"
                style={{ width: "100%", borderRadius: 14, border: "1px solid #232323", background: "#121212", color: "#e5e7eb", padding: "12px 14px", fontSize: "0.95rem" }} />
            </label>
          )}

          <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "#d1d5db" }}>
            Email address
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              style={{ width: "100%", borderRadius: 14, border: "1px solid #232323", background: "#121212", color: "#e5e7eb", padding: "12px 14px", fontSize: "0.95rem" }} />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "#d1d5db" }}>
            Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
              style={{ width: "100%", borderRadius: 14, border: "1px solid #232323", background: "#121212", color: "#e5e7eb", padding: "12px 14px", fontSize: "0.95rem" }} />
          </label>

          {isSignup && (
            <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "#d1d5db" }}>
              Confirm password
              <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password"
                style={{ width: "100%", borderRadius: 14, border: "1px solid #232323", background: "#121212", color: "#e5e7eb", padding: "12px 14px", fontSize: "0.95rem" }} />
            </label>
          )}

          {status && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: status.type === "error" ? "#31171f" : "#142f1e", color: status.type === "error" ? "#fca5a5" : "#86efac", fontSize: "0.88rem" }}>
              {status.message}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "none", background: "#e5e7eb", color: "#111", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Processing..." : buttonLabel}
          </button>
        </form>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.92rem", color: "#9ca3af" }}>
          <button type="button" onClick={() => onNavigate("/")}
            style={{ flex: 1, padding: "12px 14px", borderRadius: 14, border: "1px solid #232323", background: "#111", color: "#9ca3af", cursor: "pointer" }}>
            Back to home
          </button>
          <button type="button" onClick={() => onNavigate(isSignup ? "/login" : "/signup")}
            style={{ flex: 1, padding: "12px 14px", borderRadius: 14, border: "1px solid #232323", background: "#161616", color: "#e5e7eb", cursor: "pointer" }}>
            {isSignup ? "Already have account" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── App ──────────────────────────────────────────────────────────────────── */
function App() {
  const [screen, setScreen] = useState("welcome");
  const [modal, setModal] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sections, setSections] = useState([]);
  const [sources, setSources] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [newIds, setNewIds] = useState(new Set());
  const bottomRef = useRef();
  const inputRef = useRef();
  const ridx = useRef(0);
  const [history, setHistory] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [route, setRoute] = useState(window.location.pathname || "/");

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  };

  const handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("logout clear error", e);
    }
    setPdf(null);
    setMsgs([]);
    setHistory([]);
    navigate("/login");
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const onDone = (name) => {
    setPdf(name);
    setModal(null);
    setMsgs([{ id: 1, role: "assistant", content: `Hello! I've indexed **${name}** and I'm ready to answer your questions. What would you like to know?`, timestamp: new Date() }]);
    setScreen("chat");
    setSources(true);
  };

  const newSection = async () => {
    
    const response = await fetch(`${API_BASE}/createnewsession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: localStorage.getItem("userId") })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const newSection = { id: data.session_id };
    console.log("New section created:", newSection);
    localStorage.setItem("sessionId", data.session_id);
    // setSections(p => [...p, newSection]);

  }

  const startNewChat = () => {
    setPdf(null);
    setModal(null);
    setMsgs([{ id: 1, role: "assistant", content: "Hello! A new chat has been created. You can ask me anything or upload a document to continue.", timestamp: new Date() }]);
    setScreen("chat");
    setSources(false);
    setNewIds(new Set());
    newSection();
    setSections([
      { id: "section-1", title: "Overview" },
      { id: "section-2", title: "Notes" },
    ]);
  };




useEffect(() => {

    const fetchData = async () => {
        try {

            const response = await fetch(
                `${API_BASE}/getAllSessions/${localStorage.getItem("userId")}`
            );

            const data = await response.json();

            console.log(data);

            setHistory(data || []);

        } catch (error) {

            console.log(error);

        }
    };

    fetchData();

}, []);

  const stream = async (text) => {
    const id = Date.now() + 1;
    setMsgs(p => [...p, { id, role: "assistant", content: "", timestamp: new Date(), streaming: true }]);
    setNewIds(p => new Set([...p, id]));
    const words = text.split(" ");
    for (let i = 0; i <= words.length; i++) {
      await sleep(28);
      setMsgs(p => p.map(m => m.id === id ? { ...m, content: words.slice(0, i).join(" "), streaming: i < words.length } : m));
    }
  };

  const getSessionHistory = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/getSessionHistory/${localStorage.getItem("userId")}/${sessionId}`);
      const data = await response.json();
      const historyItems = Array.isArray(data) ? data : [];
      setTranscripts(historyItems);

      const formattedMessages = historyItems.flatMap((item, index) => [
        {
          id: `${sessionId}-u-${index}`,
          role: "user",
          content: item.user || "",
          timestamp: item.datetime ? new Date(item.datetime) : new Date(),
        },
        {
          id: `${sessionId}-a-${index}`,
          role: "assistant",
          content: item.Assistant || "",
          timestamp: item.datetime ? new Date(item.datetime) : new Date(),
        },
      ]);

      if (formattedMessages.length > 0) {
        setMsgs(formattedMessages);
      } else {
        setMsgs([
          {
            id: `${sessionId}-empty`,
            role: "assistant",
            content: "No chat history available for this session.",
            timestamp: new Date(),
          },
        ]);
      }

    } catch (error) {
      console.log(error);
    }
  };

  const askBackend = async (question) => {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question ,session_id: localStorage.getItem("sessionId")}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
    return res.json();
  };

  const send = async (text) => {
    const t = (text || input).trim();
    if (!t || typing) return;
    setInput("");
    const uid = Date.now();
    setMsgs(p => [...p, { id: uid, role: "user", content: t, timestamp: new Date() }]);
    setNewIds(p => new Set([...p, uid]));
    setTyping(true);

    try {
      const data = await askBackend(t);
      const answer = data.response ?? data.content ?? "No answer returned.";
      await stream(answer);
    } catch (err) {
      const message = err?.message || "Unable to reach the chat API.";
      setMsgs(p => [...p, { id: Date.now() + 2, role: "assistant", content: `Error: ${message}`, timestamp: new Date() }]);
    } finally {
      setTyping(false);
    }
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  if (route === "/login" || route === "/signup") {
    return <AuthPage mode={route.slice(1)} onNavigate={navigate} />;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:#0a0a0a; }
        textarea { font-family:'Geist',sans-serif !important; }
        .custom-scroll::-webkit-scrollbar { width:4px; }
        .custom-scroll::-webkit-scrollbar-track { background:transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background:#252525; border-radius:4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background:#333; }
      `}</style>

      <div style={{ height: "100vh", width: "100vw", display: "flex", overflow: "hidden", background: "#0a0a0a", fontFamily: "'Geist',sans-serif", color: "#e5e7eb" }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {sidebar && (
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ width: 248, flexShrink: 0, background: "#111", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>

              {/* top */}
              <div style={{ padding: "12px 10px 8px", borderBottom: "1px solid #1a1a1a" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Brain size={14} color="#111" />
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e5e7eb" }}>RAGchat</span>
                  </div>
                  <button onClick={() => setSidebar(false)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, borderRadius: 5, transition: "color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#9ca3af"} onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                    <ChevronLeft size={15} />
                  </button>
                </div>

                <button onClick={() => setModal("choose")}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "1px solid #1f1f1f", background: "#1a1a1a", color: "#9ca3af", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1f1f1f"; e.currentTarget.style.color = "#e5e7eb"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#9ca3af"; }}>
                  <Plus size={14} />New chat
                </button>
              </div>

              {/* history */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }} className="custom-scroll">
                {screen === "chat" && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: "0.65rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 6px 5px" }}>Current</p>
                    <div style={{ padding: "9px 10px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #212121", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={13} color="#6b7280" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: "0.78rem", color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{pdf?.replace(".pdf", "") ?? "Document"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {screen === "chat" && sections.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: "0.65rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 6px 5px" }}>Sections</p>
                    <div style={{ display: "grid", gap: 8, padding: "0 6px" }}>
                      {sections.map(section => (
                        <div key={section.id} style={{ padding: "10px 12px", borderRadius: 8, background: "#151515", border: "1px solid #1f1f1f", color: "#9ca3af", fontSize: "0.78rem" }}>
                          {section.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p style={{ fontSize: "0.65rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 6px 5px" }}>Recent</p>
                {history?.map((c) => (
                  <motion.button
                    key={c.id}
                    type="button"
                    whileHover={{ x: 2 }}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #1f1f1f",
                      background: "#111",
                      color: "#9ca3af",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.18s, color 0.18s, transform 0.18s",
                      overflow: "hidden",
                    }}
                    onClick={() => {
                      console.log("Session ID:", c.id);
                      localStorage.setItem("sessionId", c.id);
                      setPdf(c.title || c.name || "Session");
                      getSessionHistory(c.id);
                      setScreen("chat");
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#161616";
                      e.currentTarget.style.color = "#9ca3af";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#111";
                      e.currentTarget.style.color = "#9ca3af";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                      <MessageSquare size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: "#e5e7eb" }}>
                        {c.title}
                      </span>
                    </div>
                    <small style={{ fontSize: "0.65rem", color: "#6b7280" }}>
                      {new Date(c.created_at).toLocaleString()}
                    </small>
                  </motion.button>
                ))}
              </div>

              {/* footer */}
              <div style={{ padding: "10px 10px", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", transition: "background 0.18s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#161616"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1f1f1f", border: "1px solid #252525", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={13} color="#9ca3af" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.78rem", color: "#d1d5db", fontWeight: 500, margin: 0 }}>{localStorage.getItem("username") || "User"}</p>
                    <p style={{ fontSize: "0.67rem", color: "#4b5563", margin: 0 }}>Free plan</p>
                    <p style={{ fontSize: "0.67rem", color: "#4b5563", margin: 0 }} onClick={()=>setScreen("voiceAgent")} >
                      Voice Agent
                    </p>
                  </div>
                  <Settings size={13} color="#374151" />
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={handleLogout} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #232323", background: "#111", color: "#e5e7eb", cursor: "pointer" }}>
                    Logout
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid #1a1a1a", background: "#0f0f0f", flexShrink: 0 }}>
            {!sidebar && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => setSidebar(true)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, marginRight: 2, borderRadius: 5 }}
                onMouseEnter={e => e.currentTarget.style.color = "#9ca3af"} onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                <Menu size={17} />
              </motion.button>
            )}

            {screen === "chat" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={13} color="#f87171" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 500, color: "#e5e7eb", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{pdf}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {/* <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                        style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }} /> */}
                    </div>
                  </div>
                </div>
                {/* <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setSources(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${sources ? "#2a2a2a" : "#1a1a1a"}`, background: sources ? "#1f1f1f" : "none", color: sources ? "#9ca3af" : "#4b5563", fontSize: "0.72rem", cursor: "pointer", transition: "all 0.18s" }}>
                    <Layers size={12} />Sources
                  </button>
                  <button style={{ background: "none", border: "1px solid #1a1a1a", borderRadius: 6, padding: "5px 8px", color: "#4b5563", cursor: "pointer", transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#252525"; e.currentTarget.style.color = "#9ca3af"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1a1a"; e.currentTarget.style.color = "#4b5563"; }}>
                    <Search size={14} />
                  </button>
                </div> */}
              </>
            ) : (
              <>
                <span style={{ fontSize: "0.8rem", color: "#4b5563" }}>RAGchat</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button style={{ background: "none", border: "1px solid #1a1a1a", borderRadius: 6, padding: "5px 8px", color: "#4b5563", cursor: "pointer" }}>
                    <Search size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* body */}
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <AnimatePresence mode="wait">
              {screen === "welcome" ? (
                <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ flex: 1, display: "flex" }}>
                  <Welcome onNew={() => setModal("choose")} onNavigate={navigate} />
                </motion.div>
              ) : (
                <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ flex: 1, display: "flex", minWidth: 0 }}>

                  {/* chat column */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0f0f0f" }}>
                    <div style={{ flex: 1, overflowY: "auto" }} className="custom-scroll">
                      {msgs.length === 1 && msgs[0].id === 1
                        ? <EmptyChat pdf={pdf} onSuggest={send} />
                        : <>{msgs.map(m => <Msg key={m.id} msg={m} isNew={newIds.has(m.id)} />)}
                          {typing && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: "22px 0", borderBottom: "1px solid #1a1a1a" }}>
                              <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 20px", display: "flex", gap: 14 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 6, background: "#212121", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                  <Sparkles size={14} color="#9ca3af" />
                                </div>
                                <div style={{ paddingTop: 4 }}><Dots /></div>
                              </div>
                            </motion.div>
                          )}
                          <div ref={bottomRef} style={{ height: 20 }} /></>
                      }
                      {msgs.length === 1 && <div ref={bottomRef} />}
                    </div>

                    {/* input bar */}
                    <div style={{ flexShrink: 0, padding: "14px 20px 18px", background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
                      <div style={{ maxWidth: 700, margin: "0 auto" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#1a1a1a", border: "1px solid #252525", borderRadius: 12, padding: "10px 10px 10px 14px", transition: "border-color 0.2s" }}
                          onFocusCapture={e => e.currentTarget.style.borderColor = "#333"} onBlurCapture={e => e.currentTarget.style.borderColor = "#252525"}>
                          <button style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", padding: "4px", borderRadius: 6, flexShrink: 0, transition: "color 0.18s" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#6b7280"} onMouseLeave={e => e.currentTarget.style.color = "#374151"}>
                            <Paperclip size={15} />
                          </button>
                          <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                            placeholder="Message…"
                            style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", fontSize: "0.875rem", color: "#e5e7eb", lineHeight: 1.6, padding: "2px 0", maxHeight: 140, overflowY: "auto" }}
                            onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }} />
                          <motion.button onClick={() => send()} disabled={!input.trim() || typing} whileTap={{ scale: 0.93 }}
                            style={{
                              width: 34, height: 34, borderRadius: 8, border: "none", cursor: input.trim() && !typing ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.18s",
                              background: input.trim() && !typing ? "#e5e7eb" : "#1f1f1f"
                            }}>
                            <ArrowUp size={16} color={input.trim() && !typing ? "#111" : "#374151"} />
                          </motion.button>
                        </div>
                        <p style={{ textAlign: "center", fontSize: "0.67rem", color: "#2d2d2d", marginTop: 8 }}>RAGchat can make mistakes. Verify important information.</p>
                      </div>
                    </div>
                  </div>

                  {/* sources panel */}
                  {/* <Sources open={sources} onClose={() => setSources(false)} /> */}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div>
              {screen === "voiceAgent" && (
                <VoiceAgent onBack={() => setScreen("welcome")} />
              )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modal === "choose" && (
          <ActionModal
            onClose={() => setModal(null)}
            onNewChat={startNewChat}
            onUpload={() => setModal("upload")}
          />
        )}
        {modal === "upload" && <UploadModal onClose={() => setModal(null)} onDone={onDone} />}
      </AnimatePresence>
    </>
  );
}

export default App;