'use client'

import ChatBox from "./components/ChatBox";
import Sidebar from "./components/Sidebar";
import Sources from "./components/Sources";

export default function ChatWithPDF() {
  return (<div className="flex items-center">
    <Sidebar />
    <ChatBox />
    <Sources />
  </div>
  );
}