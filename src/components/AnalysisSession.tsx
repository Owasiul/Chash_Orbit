"use client";

import React, { useState, useRef } from "react";
import { Upload, Camera, CheckCircle2, AlertTriangle, XCircle, Send, Loader2, Leaf, ShieldCheck, RotateCcw, FlaskConical, Sprout } from "lucide-react";

export interface DiagnosisData {
  cropName: string;
  isHealthy: boolean;
  diseaseIdentified: string;
  confidencePercentage: number;
  severityLevel: "LOW" | "MODERATE" | "CRITICAL" | "NONE";
  symptoms: string[];
  organicRemedy: string;
  chemicalTreatment?: string;
  preventativeTips: string[];
}

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

export default function AnalysisSession() {
  // Session states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropHint, setCropHint] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);

  // Chat states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image selection/capture
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run the AI Diagnosis
  const handleStartAnalysis = async () => {
    if (!imagePreview) return;

    setIsLoading(true);
    setStatusMessage("Uploading and preparing image...");

    try {
      setTimeout(() => setStatusMessage("Scanning foliage for pathogens..."), 1200);
      setTimeout(() => setStatusMessage("Generating treatment guidelines..."), 2400);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          cropHint,
          notes,
        }),
      });

      const res = await response.json();

      if (!response.ok) {
        throw new Error(res.error || "Failed to analyze");
      }

      setDiagnosis(res.data);
      // Initialize chat with a welcome message
      setMessages([
        {
          sender: "ai",
          text: `Diagnosis complete for your ${res.data.cropName}. Feel free to ask questions about dosage, organic alternatives, or prevention!`,
        },
      ]);
    } catch (err: any) {
      alert(err.message || "An error occurred during analysis.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // Handle follow-up conversational questions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userText = inputMessage;
    setInputMessage("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/analyze/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          diagnosisContext: diagnosis,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { sender: "ai", text: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Sorry, I could not process your query right now." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Reset Session
  const handleReset = () => {
    setImagePreview(null);
    setCropHint("");
    setNotes("");
    setDiagnosis(null);
    setMessages([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-emerald-900 flex items-center justify-center gap-2">
          <Leaf className="w-8 h-8 text-emerald-600" />
          Chash Orbit • Crop Health Session
        </h1>
        <p className="text-sm text-slate-600">
          Upload or capture a photo of your crop for an instant AI-powered health diagnosis.
        </p>
      </div>

      {/* 1. UPLOAD STAGE (When no diagnosis yet) */}
      {!diagnosis && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              imagePreview
                ? "border-emerald-500 bg-emerald-50/20"
                : "border-slate-300 hover:border-emerald-500 bg-slate-50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              capture="environment" // Opens camera automatically on mobile devices
              className="hidden"
            />

            {imagePreview ? (
              <div className="flex flex-col items-center">
                <img
                  src={imagePreview}
                  alt="Crop Preview"
                  className="max-h-64 rounded-lg object-contain shadow-sm mb-4"
                />
                <p className="text-sm text-emerald-700 font-medium">Click to change photo</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="p-4 bg-emerald-100 text-emerald-700 rounded-full">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Click to upload or take a photo</p>
                  <p className="text-xs text-slate-500">Supports JPG, PNG, WEBP</p>
                </div>
              </div>
            )}
          </div>

          {/* Context Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Crop Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Rice, Tomato, Potato"
                value={cropHint}
                onChange={(e) => setCropHint(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Observed Symptoms / Notes
              </label>
              <input
                type="text"
                placeholder="e.g., Yellow spots on bottom leaves"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Submit Action */}
          <button
            onClick={handleStartAnalysis}
            disabled={!imagePreview || isLoading}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-white flex items-center justify-center gap-2 shadow-md transition-all ${
              !imagePreview || isLoading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{statusMessage}</span>
              </>
            ) : (
              <>
                <Sprout className="w-5 h-5" />
                <span>Analyze Crop Health</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. DIAGNOSTIC RESULTS DASHBOARD */}
      {diagnosis && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Diagnostic Report</h2>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Scan
            </button>
          </div>

          {/* Overview Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-1">
              <img
                src={imagePreview!}
                alt="Analyzed Crop"
                className="w-full h-48 object-cover rounded-xl border border-slate-100"
              />
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-slate-800">{diagnosis.cropName}</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                    diagnosis.isHealthy
                      ? "bg-emerald-100 text-emerald-800"
                      : diagnosis.severityLevel === "CRITICAL"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {diagnosis.isHealthy ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : diagnosis.severityLevel === "CRITICAL" ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {diagnosis.isHealthy ? "Healthy" : `${diagnosis.severityLevel} Severity`}
                </span>
              </div>

              <p className="text-2xl font-bold text-slate-900">
                {diagnosis.isHealthy ? "No Pathogens Detected" : diagnosis.diseaseIdentified}
              </p>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Confidence Score</span>
                  <span>{diagnosis.confidencePercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${diagnosis.confidencePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Symptoms Card */}
          {diagnosis.symptoms?.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Observed Symptoms
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                {diagnosis.symptoms.map((symptom, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    {symptom}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Treatment Options (Organic vs Chemical) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-2">
              <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Organic & Safe Remedy
              </h4>
              <p className="text-sm text-emerald-800 leading-relaxed">
                {diagnosis.organicRemedy || "No action required."}
              </p>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 space-y-2">
              <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-blue-600" />
                Chemical Treatment
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                {diagnosis.chemicalTreatment || "Not recommended unless condition worsens."}
              </p>
            </div>
          </div>

          {/* 3. INTERACTIVE FOLLOW-UP CHAT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h4 className="font-semibold text-slate-700 text-sm">
                Ask Chash Orbit Agronomist
              </h4>
              <p className="text-xs text-slate-500">Ask questions regarding this specific diagnosis</p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 rounded-bl-none"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Ask about fertilizer dosages, spraying time..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isChatLoading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white p-2.5 rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}