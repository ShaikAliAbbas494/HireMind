"use client";

import Agent from "@/components/Agent";
import ResumeUpload from "@/components/ResumeUpload";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { useState, useEffect } from "react";

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
}

const Page = () => {
  const [user, setUser] = useState<any>(null);
  const [uploadedResume, setUploadedResume] = useState<ResumeData | null>(null);
  const [showAgent, setShowAgent] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const userData = await getCurrentUser();
      setUser(userData);
    };
    getUser();
  }, []);

  if (!user) {
    return <div className="text-center p-8">Loading...</div>;
  }

  if (showAgent) {
    return (
      <>
        <h3>Interview Generation</h3>
        <Agent
          userName={user?.name || "Unknown"}
          userId={user?.id || "default_user_id"}
          type="generate"
          role={uploadedResume ? `Based on: ${uploadedResume.skills.slice(0, 3).join(", ")}` : "NotSpecified"}
          level="NotSpecified"
          amount="0"
          techstack={uploadedResume?.skills.join(", ") || "NotSpecified"}
          resumeData={uploadedResume || undefined}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-2">Interview Preparation</h2>
        <p className="text-gray-600 mb-8">
          Prepare for your interview by uploading your resume. Our AI will tailor questions based on your skills.
        </p>

        <ResumeUpload
          onResumeUpload={(resumeData) => {
            setUploadedResume(resumeData);
            setShowAgent(true);
          }}
          onSkip={() => {
            setShowAgent(true);
          }}
        />
      </div>
    </div>
  );
};

export default Page;