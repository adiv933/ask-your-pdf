import { Menu } from 'lucide-react'

export default function Sidebar() {
    return (
        <div className="flex flex-col h-screen w-full items-center p-2">
            <button
                className="text-white bg-zinc-700 p-3 rounded-lg hover:bg-zinc-800 left-4 top-4 absolute transition duration-200"
            >
                <Menu className="w-5 h-5" />
            </button>
        </div>
    )
}
