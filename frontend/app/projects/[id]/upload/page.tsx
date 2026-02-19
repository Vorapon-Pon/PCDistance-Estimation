export default function UploadPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 text-white">
        <h1 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="text-gray-400">Upload data</span>
        </h1>
        
        <div className="bg-[#282828] rounded-xl p-8 border border-neutral-700 h-[400px] flex flex-col items-center justify-center text-center">
            <p className="text-gray-400 mb-4">Drag and drop file(s) to upload, or:</p>
            <button className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg transition">
                Select File(s)
            </button>
        </div>
    </div>
  );
}