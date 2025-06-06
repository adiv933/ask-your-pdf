import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { QdrantClient } from "@qdrant/js-client-rest";

const worker = new Worker('pdf-queue', async job => {
    const data = JSON.parse(job.data)
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();

    const embeddings = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY   //TODO find other embedding models
    });
    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: "pdf-collection",
    });

    await vectorStore.addDocuments(docs)
    console.log('All docs added to vector store')

}, {
    concurrency: 100, connection: {
        host: 'localhost',
        port: 6379
    }
});