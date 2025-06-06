import { FileStack } from "lucide-react"

export default function Sources() {
    const sourceCount = 1;

    return (
        <div className="flex flex-col h-screen w-full items-center p-2">
            <button
                className="text-white bg-zinc-700 p-3 rounded-lg hover:bg-zinc-800 right-4 top-4 absolute transition duration-200"
            >
                <FileStack className="w-5 h-5" />
                {sourceCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-300 text-xs text-black rounded-full px-1.5 h-5 flex items-center justify-center min-w-[1.25rem]">
                        {sourceCount}
                    </span>
                )}
            </button>
        </div>
    )
}
