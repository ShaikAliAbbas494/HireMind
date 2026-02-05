"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { extractResumeText, analyzeResume, calculateATSScore } from "@/lib/resume.utils";

interface ResumeData {
  fileName: string;
  skills: string[];
  experience: string[];
  education: string[];
  email?: string;
  phone?: string;
  isATSFriendly: boolean;
  atsScore: number;
  suggestions: string[];
  rawText: string;
}

interface ResumeUploadProps {
  onResumeUpload: (resumeData: ResumeData) => void;
  onSkip: () => void;
}

const ResumeUpload = ({ onResumeUpload, onSkip }: ResumeUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedResume, setUploadedResume] = useState<ResumeData | null>(null);

  const parseResume = async (file: File): Promise<ResumeData> => {
    setIsProcessing(true);
    try {
      // Extract text from file
      let extractedText = "";
      
      try {
        extractedText = await extractResumeText(file);
      } catch (error) {
        console.error("Text extraction failed:", error);
        // Try one more fallback for simple text files
        if (file.type === "text/plain" || file.size < 100000) {
          try {
            extractedText = await file.text();
          } catch {
            throw new Error("Could not read file content. Please ensure the file is not corrupted.");
          }
        } else {
          throw new Error("Could not extract text from this file. Please try a different resume file (PDF, DOCX, or TXT).");
        }
      }
      
      if (!extractedText || extractedText.length < 20) {
        throw new Error("The file appears to be empty or contains no readable text. Please upload a complete resume.");
      }

      // Analyze resume
      const analysis = analyzeResume(extractedText);
      
      // Calculate ATS score
      const { score, isATSFriendly, suggestions } = calculateATSScore(extractedText);

      const resumeData: ResumeData = {
        fileName: file.name,
        skills: analysis.skills.length > 0 ? analysis.skills : ["No technical skills detected"],
        experience: analysis.experience.length > 0 ? analysis.experience : ["Experience section not found"],
        education: analysis.education.length > 0 ? analysis.education : ["Education section not found"],
        email: analysis.email,
        phone: analysis.phone,
        isATSFriendly,
        atsScore: score,
        suggestions,
        rawText: extractedText,
      };

      return resumeData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to parse resume. Please try another file.";
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOCX, or TXT file");
      return;
    }

    try {
      const resumeData = await parseResume(file);
      setUploadedResume(resumeData);
      toast.success("Resume uploaded and analyzed successfully!");
    } catch (error) {
      console.error("Error parsing resume:", error);
    }
  };

  if (uploadedResume) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 card-border rounded-lg">
        <div className="space-y-6">
          {/* ATS Score */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h3 className="font-semibold text-lg">ATS Verification</h3>
              <p className="text-sm text-gray-600">Resume Analysis Complete</p>
            </div>
            <div className="flex items-center gap-4">
              {uploadedResume.isATSFriendly ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <span className="text-sm font-medium text-green-700">ATS Friendly</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">Needs Improvement</span>
                </div>
              )}
              <span className="text-4xl font-bold text-indigo-600">{uploadedResume.atsScore}%</span>
            </div>
          </div>

          {/* Resume Details */}
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">File Information</h4>
              <p className="text-sm text-gray-600">File: {uploadedResume.fileName}</p>
              {uploadedResume.email && <p className="text-sm text-gray-600">Email: {uploadedResume.email}</p>}
              {uploadedResume.phone && <p className="text-sm text-gray-600">Phone: {uploadedResume.phone}</p>}
            </div>

            {/* Extracted Skills */}
            {uploadedResume.skills.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Detected Skills ({uploadedResume.skills.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {uploadedResume.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {uploadedResume.experience.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Experience Summary</h4>
                <ul className="space-y-1">
                  {uploadedResume.experience.slice(0, 3).map((exp, idx) => (
                    <li key={idx} className="text-sm text-gray-700 line-clamp-1">
                      • {exp.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {uploadedResume.suggestions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Improvement Suggestions</h4>
                <ul className="space-y-2">
                  {uploadedResume.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-yellow-500 mt-1">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              className="flex-1 btn-primary"
              onClick={() => {
                onResumeUpload(uploadedResume);
                toast.success("Starting interview with your resume context!");
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Start Interview with This Resume
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUploadedResume(null);
              }}
            >
              Upload Different Resume
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 card-border rounded-lg">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Upload Your Resume</h3>
        <p className="text-gray-600">
          Upload your resume to get AI-powered interview questions tailored to your skills and experience. We'll analyze your resume for ATS compatibility and extract your key competencies.
        </p>

        {/* Drag and Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="font-semibold mb-2">Drag and drop your resume</p>
          <p className="text-sm text-gray-600 mb-4">or</p>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
            id="resume-input"
          />
          <label htmlFor="resume-input" className="inline-block">
            <Button
              disabled={isProcessing}
              className="btn-primary cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("resume-input")?.click();
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Resume...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </>
              )}
            </Button>
          </label>
          <p className="text-xs text-gray-500 mt-4">
            Supported formats: PDF, DOCX, TXT (Max 10 MB)
          </p>
        </div>

        {/* Skip Option */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={onSkip}
          >
            Skip and Start Interview Anyway
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResumeUpload;
