import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Queue } from "bullmq";
import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatGroq } from "@langchain/groq";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { QdrantTranslator } from "@langchain/community/structured_query/qdrant";

const uploadDir = path.join(__dirname, 'uploads', 'pdf');

const queue = new Queue("pdf-queue",
    // {
    //     connection: {
    //         host: 'localhost',
    //         port: 6379
    //     }
    // }
);

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

const upload = multer({ storage: storage })
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('help');
});

app.post('/upload/pdf', upload.single('pdf'), async function (req, res) {
    await queue.add("pdf-job", JSON.stringify({
        filename: req.file?.originalname,
        destination: req.file?.destination,
        path: req.file?.path
    }));

    res.json({ message: "PDF uploaded" })
});

app.get('/chat', async (req, res) => {
    const userQuery = req.query.query;
    const embeddings = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY //TODO find other embedding models
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: "pdf-collection",
    });

    const retriever = vectorStore.asRetriever({ k: 2 });
    // @ts-ignore
    const result = await retriever.invoke(userQuery);

    const SYSTEM_PROMPT = `
    You are a helpful assistant that answers questions based on the provided context. Read the context carefully and use it to answer user queries. If you cannot find an answer, say "I don't have information about that in this document." Do not generate false information or use external sources.
    Context: ${JSON.stringify(result)}
    `;
    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0
    });
    const prompt = [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userQuery }
    ];
    // @ts-ignore
    const answer = await llm.invoke(prompt);

    res.json({ answer, sources: result });
});


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
