import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Queue } from "bullmq";
import { QdrantVectorStore } from '@langchain/qdrant';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Ollama } from 'ollama';

dotenv.config();

// Use docker-compose service names
const REDIS_HOST = process.env.REDIS_HOST || 'valkey';
const QDRANT_HOST = process.env.VECTOR_DB_HOST || 'qdrant';
const LLM_HOST = process.env.LLM_HOST || 'ollama';

const ollama = new Ollama({ host: `http://${LLM_HOST}:11434` });

const embeddings = new OllamaEmbeddings({
    model: 'nomic-embed-text',
    baseUrl: `http://${LLM_HOST}:11434`
});

const uploadDir = path.join(process.cwd(), 'uploads', 'pdf');

const queue = new Queue("pdf-queue", {
    connection: {
        host: REDIS_HOST,
        port: 6379,
    }
});

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ' - ' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'AskYourPDF Server', status: 'running' });
});

app.post('/upload/pdf', upload.single('pdf'), async function (req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No PDF file uploaded' });
            return;
        }

        await queue.add("pdf-job", {
            filename: req.file.originalname,
            destination: req.file.destination,
            path: req.file.path
        });

        res.json({
            message: "PDF uploaded successfully",
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
});

app.get('/chat', async (req, res) => {
    try {
        const userQuery = req.query.query as string;

        if (!userQuery) {
            res.status(400).json({ error: 'Query parameter is required' });
        }

        const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: `http://${QDRANT_HOST}:6333`,
            collectionName: "pdf-collection",
        });

        const retriever = vectorStore.asRetriever({ k: 2 });
        const retrievedDocs = await retriever.invoke(userQuery);

        const context = retrievedDocs.map(doc => doc.pageContent).join('\n\n');

        const SYSTEM_PROMPT = `You are a helpful assistant. Use the provided context to answer user questions when it is available. If the answer is clearly found in the context, say "Based on the provided documents, ..." before answering. If the context does not contain the answer, you may respond using your own general knowledge, but indicate it by saying "Based on my general knowledge, ...". Do not make up facts when context is needed for accuracy. Be concise, accurate, and helpful. Context: ${context}`;

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userQuery }
        ];

        const response = await ollama.chat({
            model: "tinyllama:1.1b-chat",
            messages: messages
        });

        res.json({
            response: response.message.content,
            sources: retrievedDocs.length
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat query' });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const models = await ollama.list();
        res.json({
            status: 'healthy',
            ollama: 'connected',
            models: models.models?.length || 0
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.use((error: any, req: any, res: any, next: any) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }

    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
