'use client';
import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Bot, User, CheckCircle, XCircle, Loader2, Square, Loader2Icon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    sources: string[] | null;
}

export default function ChatBox() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: 'Hi! Upload a PDF and ask me anything about it.', sources: null }
    ]);
    const [input, setInput] = useState('');
    const [pdfName, setPdfName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [streamingResponse, setStreamingResponse] = useState('');
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingResponse]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', text: input, sources: null };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);
        setStreamingResponse('');

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let fullResponse = '';
        let sources: string[] = [];

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?query=${encodeURIComponent(currentInput)}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader available');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;

                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.type === 'metadata') {
                                sources = data.sources || [];
                            } else if (data.type === 'content') {
                                fullResponse += data.content;
                                setStreamingResponse(fullResponse);
                            } else if (data.type === 'done') {
                                setMessages(prev => [
                                    ...prev,
                                    {
                                        role: 'assistant',
                                        text: data.fullResponse || fullResponse,
                                        sources: data.sources || sources || null
                                    }
                                ]);
                                setIsLoading(false);
                                setStreamingResponse('');
                                return;
                            } else if (data.type === 'error') {
                                throw new Error(data.error || 'Stream error');
                            }
                        } catch (err) {
                            console.warn('Parse error:', jsonStr, err);
                        }
                    }
                }
            }

        } catch (error: any) {
            console.error('Chat error:', error);

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: `Error: ${error.message}. Please try again.`,
                    sources: null
                }
            ]);
        } finally {
            setIsLoading(false);
            setStreamingResponse('');
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Please upload a PDF file only.', sources: null }
            ]);
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'File size must be less than 10MB.', sources: null }
            ]);
            return;
        }

        setIsUploading(true);
        setUploadStatus('uploading');
        setPdfName(file.name);

        try {
            const formData = new FormData();
            formData.append('pdf', file);

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const result = await res.json();

            if (result.error) throw new Error(result.error);

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: `Uploading "${result.filename}". Please wait while the document is being processed...`,
                    sources: null
                }
            ]);

            await new Promise(resolve => setTimeout(resolve, 10000));

            setUploadStatus('success');
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: `Successfully uploaded and processed "${result.filename}". You can now ask questions about it.`,
                    sources: null
                }
            ]);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Failed to upload PDF. Please try again.', sources: null }
            ]);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const getUploadIcon = () => {
        switch (uploadStatus) {
            case 'uploading':
                return <Loader2 className="w-4 h-4 animate-spin" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Paperclip className="w-4 h-4" />;
        }
    };

    const getUploadButtonClass = () => {
        switch (uploadStatus) {
            case 'uploading':
                return 'text-yellow-400 bg-zinc-700 cursor-not-allowed';
            case 'success':
                return 'text-green-400 bg-zinc-700 hover:bg-zinc-600';
            case 'error':
                return 'text-red-400 bg-zinc-700 hover:bg-zinc-600';
            default:
                return 'text-white bg-zinc-700 hover:bg-zinc-600';
        }
    };

    return (
        <div className="flex flex-col h-screen w-full md:min-w-4xl items-center p-2 bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 shadow-md rounded-xl w-full">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-white">Chat with PDF</h1>
                    {pdfName && <p className="text-sm text-zinc-400 truncate max-w-xs">{pdfName}</p>}
                </div>
                <label className={`cursor-pointer p-3 rounded-lg transition duration-200 ${getUploadButtonClass()}`}>
                    {getUploadIcon()}
                    <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={isUploading}
                    />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full mx-auto bg-white/10 rounded-xl border border-white/10 m-2 minimal-scrollbar">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`fade-in flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className="border-3 rounded-full p-1 mt-1 border-white">
                            {msg.role === 'assistant' ? (
                                <Bot className="w-5 h-5 text-zinc-300" />
                            ) : (
                                <User className="w-5 h-5 text-orange-400" />
                            )}
                        </div>

                        <div className="relative max-w-[80%]">
                            <div className={`relative p-3 rounded-xl shadow-md ${msg.role === 'user' ? 'bg-orange-300 text-black' : 'bg-zinc-400 text-black'}`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                                {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs items-center">
                                        <span className="font-semibold text-zinc-800">Sources:</span>
                                        {msg.sources.map((src, i) => {
                                            const isLink = src.startsWith('http://') || src.startsWith('https://');
                                            return (
                                                <a
                                                    key={i}
                                                    href={isLink ? src : undefined}
                                                    target={isLink ? "_blank" : undefined}
                                                    rel={isLink ? "noopener noreferrer" : undefined}
                                                    className="px-2 py-1 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors text-xs font-medium border border-blue-300"
                                                >
                                                    {isLink ? new URL(src).hostname : src}
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}

                            </div>
                            <div
                                className={`absolute top-3 w-0 h-0 border-t-8 border-b-8 ${msg.role === 'user'
                                    ? 'right-[-8px] border-l-8 border-l-orange-300 border-t-transparent border-b-transparent'
                                    : 'left-[-8px] border-r-8 border-r-zinc-400 border-t-transparent border-b-transparent'
                                    }`}
                            />
                        </div>
                    </div>
                ))}

                {isLoading && streamingResponse === '' && (
                    <div className="fade-in flex gap-3 items-start justify-start">
                        <div className="mt-1 border-3 rounded-full p-1 border-white">
                            <Bot className="w-5 h-5 text-zinc-300" />
                        </div>
                        <div className="max-w-[80%] p-3 rounded-xl shadow-md bg-zinc-400 text-black relative">

                            Thinking...

                            <div className="absolute top-3 left-[-8px] w-0 h-0 border-t-8 border-b-8 border-r-8 border-r-zinc-400 border-t-transparent border-b-transparent" />
                        </div>
                    </div>
                )}

                {streamingResponse && (
                    <div className="fade-in flex gap-3 items-start justify-start">
                        <div className="mt-1 border-3 rounded-full p-1 border-white">
                            <Bot className="w-5 h-5 text-zinc-300" />
                        </div>
                        <div className="max-w-[80%] p-3 rounded-xl shadow-md bg-zinc-400 text-black relative">
                            <ReactMarkdown>{streamingResponse}</ReactMarkdown>
                            <div className="absolute top-3 left-[-8px] w-0 h-0 border-t-8 border-b-8 border-r-8 border-r-zinc-400 border-t-transparent border-b-transparent" />
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            <div className="p-3 bg-zinc-900 rounded-xl w-full">
                <div className="flex items-center gap-2 w-full text-white">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 text-sm rounded-lg bg-zinc-900 placeholder-zinc-400 focus:outline-none disabled:opacity-50"
                        placeholder="Ask something..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                        disabled={isLoading}
                    />
                    {isLoading ? (
                        <button
                            onClick={handleStop}
                            className="p-2 rounded-full bg-red-400 text-white hover:bg-red-500 transition duration-200"
                            title="Stop generation"
                        >
                            <Square className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="p-2 rounded-full bg-orange-300 text-black hover:bg-orange-400 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
