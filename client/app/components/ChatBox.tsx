// 'use client'
// import { useState, useRef, useEffect } from 'react';
// import { Paperclip, Send } from 'lucide-react';

// export default function ChatBox() {
//     const [messages, setMessages] = useState([
//         { role: 'assistant', text: 'Hi! Upload a PDF and ask me anything about it.', sources: null },
//     ]);
//     const [input, setInput] = useState('');
//     const [pdfName, setPdfName] = useState<string>("");
//     const chatEndRef = useRef(null);

//     useEffect(() => {
//         chatEndRef.current
//     }, [messages]);

//     const handleSend = async () => {
//         if (!input.trim()) return;

//         const userMessage = { role: 'user', text: input };
//         setMessages((prev) => [...prev, { ...userMessage, sources: null }]);
//         setInput('');

//         const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?query=${userMessage}`)
//         const data = await res.json();

//         setMessages(prev => [...prev, { role: 'assistant', text: data.answer , sources: data.sources}]) //check from response whats to be set in text field

//     };

//     const handleUpload = async (e: any) => {
//         const files = e.target.files;
//         if (files.length > 0 && files[0]) {
//             setPdfName(files[0].name);
//             console.log('pdfName', pdfName)
//             const formData = new FormData();
//             formData.append('pdf', files[0]);
//             const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`,
//                 {
//                     method: 'POST',
//                     body: formData
//                 }
//             )
//             const result = await res.json();
//             console.log(result);
//         }
//     };

//     return (
//         <div className="flex flex-col h-screen w-full md:min-w-4xl items-center p-2">

//             <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 shadow-md rounded-xl w-full">
//                 <h1 className="text-lg font-bold text-white">Chat with PDF</h1>
//                 <label className="cursor-pointer text-white bg-zinc-700 p-3 rounded-lg hover:bg-zinc-600 transition duration-200">
//                     <Paperclip className="w-4 h-4" />
//                     <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
//                 </label>
//             </div>

//             <div className="flex-1 overflow-y-auto p-4 space-y-3 w-full mx-auto bg-white/20  rounded-xl border border-white/20 m-2 minimal-scrollbar">
//                 {messages.map((msg, idx) => (
//                     <div
//                         key={idx}
//                         className={`w-fit max-w-[80%] px-4 py-2 rounded-lg text-sm break-words ${msg.role === 'user' ? 'ml-auto bg-orange-300' : 'mr-auto bg-gray-200'
//                             }`}
//                     >
//                         {msg.text}
//                     </div>
//                 ))}
//                 <div ref={chatEndRef} />
//             </div>

//             <div className="p-4 bg-zinc-900 rounded-xl w-full">
//                 <div className="flex items-center gap-2 w-full mx-auto text-white">
//                     <input
//                         type="text"
//                         className="flex-1 px-4 py-2 focus:outline-none text-sm"
//                         placeholder="Ask something..."
//                         value={input}
//                         onChange={(e) => setInput(e.target.value)}
//                         onKeyDown={(e) => e.key === 'Enter' && handleSend()}
//                     />
//                     <button
//                         onClick={handleSend}
//                         className="p-2 rounded-full bg-orange-300 text-black hover:bg-orange-400 transition duration-200"
//                     >
//                         <Send className="w-5 h-5" />
//                     </button>
//                 </div>
//             </div>

//         </div>
//     );
// }

'use client'
import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ChatBox() {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Hi! Upload a PDF and ask me anything about it.', sources: null },
    ]);
    const [input, setInput] = useState('');
    const [pdfName, setPdfName] = useState<string>("");
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', text: input, sources: null };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?query=${encodeURIComponent(input)}`);
        const data = await res.json();

        setMessages(prev => [
            ...prev,
            { role: 'assistant', text: data.answer || 'No response.', sources: data.sources || null }
        ]);
    };

    const handleUpload = async (e: any) => {
        const files = e.target.files;
        if (files.length > 0 && files[0]) {
            setPdfName(files[0].name);
            const formData = new FormData();
            formData.append('pdf', files[0]);
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`, {
                method: 'POST',
                body: formData
            });
            // const result = await res.json();
            // console.log(result);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full md:min-w-4xl items-center p-2 bg-zinc-950">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 shadow-md rounded-xl w-full">
                <h1 className="text-lg font-bold text-white">Chat with PDF</h1>
                <label className="cursor-pointer text-white bg-zinc-700 p-3 rounded-lg hover:bg-zinc-600 transition duration-200">
                    <Paperclip className="w-4 h-4" />
                    <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                </label>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full mx-auto bg-white/10 rounded-xl border border-white/10 m-2 minimal-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {/* Avatar */}
                        <div className="mt-1">
                            {msg.role === 'assistant' ? (
                                <Bot className="w-5 h-5 text-zinc-300" />
                            ) : (
                                <User className="w-5 h-5 text-orange-400" />
                            )}
                        </div>

                        {/* Message bubble */}
                        <div className={`max-w-[80%] p-3 rounded-xl shadow-md ${msg.role === 'user' ? 'bg-orange-300 text-black' : 'bg-zinc-100 text-black'}`}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>

                            //TODO add sources later on basis of response data
                            {/* {msg.sources && Array.isArray(msg.sources) && (
                                <div className="mt-2 text-xs text-blue-700">
                                    <strong>Sources:</strong> {msg.sources.map((src: string, i: number) => (
                                        <span key={i} className="block">• {src}</span>
                                    ))}
                                </div>
                            )} */}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <div className="p-4 bg-zinc-900 rounded-xl w-full">
                <div className="flex items-center gap-2 w-full mx-auto text-white">
                    <input
                        type="text"
                        className="flex-1 px-4 py-2 text-sm rounded-lg bg-zinc-800 placeholder-zinc-400 focus:outline-none"
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
