import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { OllamaEmbeddings } from '@langchain/ollama';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Use service names from docker-compose
const QDRANT_HOST = process.env.VECTOR_DB_HOST || 'qdrant';
const REDIS_HOST = process.env.REDIS_HOST || 'valkey';
const LLM_HOST = process.env.LLM_HOST || 'ollama';

const qdrantClient = new QdrantClient({
    url: `http://${QDRANT_HOST}:6333`,
});

const embeddings = new OllamaEmbeddings({
    model: 'nomic-embed-text',
    baseUrl: `http://${LLM_HOST}:11434`
});

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', ' ', ''],
});

async function waitForQdrant(retries = 15, delayMs = 5000) {
    const url = `http://${QDRANT_HOST}:6333/collections`;

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                console.log('✅ Qdrant is ready');
                return;
            }
        } catch (err) {
            console.log(`Waiting for Qdrant... (${i + 1}/${retries})`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Qdrant did not become ready in time');
}

async function ensureCollection() {
    try {
        const collections = await qdrantClient.getCollections();
        const collectionExists = collections.collections.some(
            collection => collection.name === 'pdf-collection'
        );

        if (!collectionExists) {
            console.log('Creating pdf-collection...');
            await qdrantClient.createCollection('pdf-collection', {
                vectors: {
                    size: 768,
                    distance: 'Cosine',
                },
            });
            console.log('Collection created successfully');
        }
    } catch (error) {
        console.error('Error ensuring collection exists:', error);
        throw error;
    }
}

async function initializeWorker() {
    await waitForQdrant();
    await ensureCollection();

    return new Worker('pdf-queue', async job => {
        try {
            console.log(`Processing job ${job.id}...`);

            const data = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;

            if (!fs.existsSync(data.path)) {
                throw new Error(`PDF file not found: ${data.path}`);
            }

            console.log(`Loading PDF: ${data.filename}`);
            const loader = new PDFLoader(data.path);
            const docs = await loader.load();

            if (docs.length === 0) {
                throw new Error('No content extracted from PDF');
            }

            console.log(`Loaded ${docs.length} pages from PDF`);
            const splitDocs = await textSplitter.splitDocuments(docs);
            console.log(`Split into ${splitDocs.length} chunks`);

            const docsWithMetadata = splitDocs.map((doc, index) => ({
                ...doc,
                metadata: {
                    ...doc.metadata,
                    filename: data.filename,
                    chunkIndex: index,
                    totalChunks: splitDocs.length,
                    uploadedAt: new Date().toISOString(),
                }
            }));

            const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
                url: `http://${QDRANT_HOST}:6333`,
                collectionName: "pdf-collection",
            });

            console.log('Adding documents to vector store...');
            await vectorStore.addDocuments(docsWithMetadata);
            console.log(`Successfully processed ${data.filename}: ${docsWithMetadata.length} chunks added to vector store`);

            fs.unlinkSync(data.path);
            console.log(`Cleaned up temporary file: ${data.path}`);
            await job.updateProgress(100);

            return {
                success: true,
                filename: data.filename,
                chunksProcessed: docsWithMetadata.length,
                message: 'PDF processed successfully'
            };

        } catch (error) {
            console.error(`Error processing job ${job.id}:`, error);
            await job.updateProgress(0);
            throw error;
        }
    }, {
        concurrency: 1,
        connection: {
            host: REDIS_HOST,
            port: 6379,
        },
    });
}

initializeWorker().then(worker => {
    worker.on('completed', (job, result) => {
        console.log(`Job ${job.id} completed successfully:`, result);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error('Worker error:', err);
    });

    worker.on('ready', () => {
        console.log('Worker is ready and waiting for jobs...');
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await worker.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await worker.close();
        process.exit(0);
    });

    console.log('PDF processing worker started');
}).catch(error => {
    console.error('Failed to initialize worker:', error);
    process.exit(1);
});
