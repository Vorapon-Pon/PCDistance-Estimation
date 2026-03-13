"use client";

import { useState, useEffect } from "react";

export default function PointCloudConverterTest() {
  // 1. ตั้งค่า Default สำหรับการเทสต์ (เปลี่ยนให้ตรงกับข้อมูลใน DB คุณได้เลย)
  const [projectId, setProjectId] = useState("your-project-id");
  const [bucketName, setBucketName] = useState("project_files");
  const [filePath, setFilePath] = useState("path/to/your/file.las");

  // State สำหรับเก็บ UI
  const [status, setStatus] = useState("idle"); // idle, processing, completed, failed
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  // 2. ฟังก์ชันกดยิง API แปลงไฟล์
  const handleStartConversion = async () => {
    setStatus("processing");
    setMessage("กำลังส่งคำสั่ง...");
    setProgress(0);

    try {
      const response = await fetch("http://localhost:8000/api/convert-pointcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          bucket_name: bucketName,
          file_path: filePath,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setIsPolling(true); // เริ่มดึง Status
      } else {
        setStatus("failed");
        setMessage(`Error: ${data.detail || "Something went wrong"}`);
      }
    } catch (error: any) {
      setStatus("failed");
      setMessage(`Network Error: ${error.message}`);
    }
  };

  // 3. ฟังก์ชันดึง Status เป็นระยะ (Polling)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPolling) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/status/${projectId}`);
          if (response.ok) {
            const data = await response.json();
            setStatus(data.status);
            setMessage(data.message);
            setProgress(data.progress || 0);

            // หยุดดึงข้อมูลถ้าเสร็จหรือพัง
            if (data.status === "completed" || data.status === "failed") {
              setIsPolling(false);
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 3000); // ดึงข้อมูลทุกๆ 3 วินาที
    }

    return () => clearInterval(interval);
  }, [isPolling, projectId]);

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md space-y-4 mt-10 text-gray-800">
      <h2 className="text-2xl font-bold border-b pb-2">🛠️ ทดสอบแปลงไฟล์ Potree</h2>

      {/* Input Fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Project ID</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full mt-1 p-2 border rounded bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Bucket Name</label>
          <input
            type="text"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            className="w-full mt-1 p-2 border rounded bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">File Path (.las)</label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            className="w-full mt-1 p-2 border rounded bg-gray-50"
            placeholder="เช่น uploads/test.las"
          />
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleStartConversion}
        disabled={status === "processing"}
        className={`w-full py-2 px-4 rounded font-semibold text-white transition-colors ${
          status === "processing" ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {status === "processing" ? "⏳ กำลังทำงานเบื้องหลัง..." : "🚀 เริ่มแปลงไฟล์ (Convert)"}
      </button>

      {/* Status Display */}
      {(status !== "idle" || message) && (
        <div className="mt-4 p-4 rounded bg-gray-100 border">
          <p><strong>Status:</strong> {status.toUpperCase()}</p>
          <p><strong>Message:</strong> {message}</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-300 rounded-full h-2.5 mt-3">
            <div
              className={`h-2.5 rounded-full ${status === 'failed' ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${progress}%`, transition: 'width 0.5s' }}
            ></div>
          </div>
          <p className="text-right text-xs mt-1">{progress}%</p>
        </div>
      )}
    </div>
  );
}