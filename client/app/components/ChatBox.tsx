'use client'
import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send } from 'lucide-react';

export default function ChatBox() {
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hi! Upload a PDF and ask me anything about it.' },
    ]);
    const [input, setInput] = useState('');
    const [pdfName, setPdfName] = useState<string>("");
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', text: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');

        // Placeholder bot response
        const botMessage = { role: 'bot', text: `Let me check the PDF and get back to you.` };
        setTimeout(() => setMessages((prev) => [...prev, botMessage]), 1000);
    };

    const handleUpload = async (e: any) => {
        const files = e.target.files;
        if (files.length > 0 && files[0]) {
            setPdfName(files[0].name);
            console.log('pdfName', pdfName)
            const formData = new FormData();
            formData.append('pdf', files[0]);
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`,
                {
                    method: 'POST',
                    body: formData
                }
            )
            const result = await res.json();
            console.log(result);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full md:min-w-4xl items-center p-2">
            
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 shadow-md rounded-xl w-full">
                <h1 className="text-lg font-bold text-white">Chat with PDF</h1>
                <label className="cursor-pointer text-white bg-zinc-700 p-3 rounded-lg hover:bg-zinc-600 transition duration-200">
                    <Paperclip className="w-4 h-4" />
                    <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 w-full mx-auto bg-white/20  rounded-xl border border-white/20 m-2 minimal-scrollbar">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`w-fit max-w-[80%] px-4 py-2 rounded-lg text-sm break-words ${msg.role === 'user' ? 'ml-auto bg-orange-300' : 'mr-auto bg-gray-200'
                            }`}
                    >
                        {msg.text}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-zinc-900 rounded-xl w-full">
                <div className="flex items-center gap-2 w-full mx-auto text-white">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 focus:outline-none text-sm"
                        placeholder="Ask something..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        className="p-2 rounded-full bg-orange-300 text-black hover:bg-orange-400 transition duration-200"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>

        </div>
    );
}