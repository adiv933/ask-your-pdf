'use client'
import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Bot, User, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    sources: number | null;
}

export default function ChatBox() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: 'Hi! Upload a PDF and ask me anything about it.', sources: null },
    ]);
    const [input, setInput] = useState('');
    const [pdfName, setPdfName] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', text: input, sources: null };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?query=${encodeURIComponent(input)}`);

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: data.response || 'No response received.',
                    sources: data.sources || null
                }
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'Sorry, I encountered an error while processing your question. Please try again.',
                    sources: null
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];

        // Validate file type
        if (file.type !== 'application/pdf') {
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'Please upload a PDF file only.',
                    sources: null
                }
            ]);
            return;
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'File size must be less than 10MB.',
                    sources: null
                }
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

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const result = await res.json();

            if (result.error) {
                throw new Error(result.error);
            }

            setUploadStatus('success');
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: `Successfully uploaded "${result.filename}"! The PDF is being processed. You can start asking questions about it.`,
                    sources: null
                }
            ]);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'Failed to upload PDF. Please try again.',
                    sources: null
                }
            ]);
        } finally {
            setIsUploading(false);
            // Clear the file input
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

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 shadow-md rounded-xl w-full">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-white">Chat with PDF</h1>
                    {pdfName && (
                        <p className="text-sm text-zinc-400 truncate max-w-xs">
                            {pdfName}
                        </p>
                    )}
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full mx-auto bg-white/10 rounded-xl border border-white/10 m-2 minimal-scrollbar">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {/* Avatar */}
                        <div className="border-3 rounded-full p-1 mt-1 border-white">
                            {msg.role === 'assistant' ? (
                                <Bot className="w-5 h-5 text-zinc-300" />
                            ) : (
                                <User className="w-5 h-5 text-orange-400" />
                            )}
                        </div>

                        {/* Message bubble with tail */}
                        <div className="relative max-w-[80%]">
                            <div
                                className={`relative p-3 rounded-xl shadow-md ${msg.role === 'user'
                                    ? 'bg-orange-300 text-black'
                                    : 'bg-zinc-100 text-black'
                                    }`}
                            >
                                {/* Message text */}
                                <ReactMarkdown>{msg.text}</ReactMarkdown>

                                {/* Sources info */}
                                {msg.sources && typeof msg.sources === 'number' && msg.sources > 0 && (
                                    <div className="mt-2 text-xs text-blue-700">
                                        <strong>Sources:</strong> Found {msg.sources} relevant document{msg.sources > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>

                            {/* Tail */}
                            <div
                                className={`absolute top-3 w-0 h-0 border-t-8 border-b-8 ${msg.role === 'user'
                                    ? 'right-[-8px] border-l-8 border-l-orange-300 border-t-transparent border-b-transparent'
                                    : 'left-[-8px] border-r-8 border-r-zinc-100 border-t-transparent border-b-transparent'
                                    }`}
                            />
                        </div>
                    </div>

                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex gap-3 items-start justify-start">
                        <div className="mt-1">
                            <Bot className="w-5 h-5 text-zinc-300" />
                        </div>
                        <div className="max-w-[80%] p-3 rounded-xl shadow-md bg-zinc-100 text-black">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <div className="p-4 bg-zinc-900 rounded-xl w-full">
                <div className="flex items-center gap-2 w-full mx-auto text-white">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 text-sm rounded-lg bg-zinc-800 placeholder-zinc-400 focus:outline-none disabled:opacity-50"
                        placeholder="Ask something..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-2 rounded-full bg-orange-300 text-black hover:bg-orange-400 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}