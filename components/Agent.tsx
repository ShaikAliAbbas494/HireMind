"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

const Agent = ({
    userName,
    userId,
    interviewId,
    feedbackId,
    type,
    questions,
    resumeData,
}: AgentProps) => {
    const router = useRouter();
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("");

    useEffect(() => {
        const onCallStart = () => {
            setCallStatus(CallStatus.ACTIVE);
        };

        const onCallEnd = () => {
            setCallStatus(CallStatus.FINISHED);
        };

        const onMessage = (message: Message) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                const newMessage = { role: message.role, content: message.transcript };
                setMessages((prev) => [...prev, newMessage]);
            }
        };

        const onSpeechStart = () => {
            setIsSpeaking(true);
        };

        const onSpeechEnd = () => {
            setIsSpeaking(false);
        };

        // ✅ FIXED ERROR HANDLER
        const onError = (error: any) => {
            if (error?.message?.includes("Meeting has ended")) {
                return; // ignore normal meeting end
            }
            console.error("Vapi Error:", error);
        };

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
        };
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1].content);
        }

        const handleGenerateFeedback = async (messages: SavedMessage[]) => {
            const { success, feedbackId: id } = await createFeedback({
                interviewId: interviewId!,
                userId: userId!,
                transcript: messages,
                feedbackId,
            });

            if (success && id) {
                router.push(`/interview/${interviewId}/feedback`);
            } else {
                router.push("/");
            }
        };

        if (callStatus === CallStatus.FINISHED) {
            if (type === "generate") {
                router.push("/");
            } else {
                handleGenerateFeedback(messages);
            }
        }
    }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

    // ✅ FIXED handleCall WITH try/catch
    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);

        try {
            if (type === "generate") {
                // Prepare resume context for workflow
                let systemPromptAddition = "";
                if (resumeData) {
                    systemPromptAddition = `

CANDIDATE RESUME INFORMATION (Use this to tailor questions):
- Skills: ${resumeData.skills.slice(0, 10).join(", ")}
- Experience: ${resumeData.experience.slice(0, 2).join(" | ")}
- Education: ${resumeData.education.slice(0, 1).join(" | ")}
${resumeData.email ? `- Email: ${resumeData.email}` : ""}

Based on the above information, ask interview questions that specifically relate to their skills and experience. Reference their skills directly in your questions.`;
                }

                await vapi.start(
                    undefined,
                    undefined,
                    undefined,
                    process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!,
                    {
                        variableValues: {
                            username: userName,
                            userid: userId,
                            resumeContext: systemPromptAddition,
                            userSkills: resumeData?.skills.slice(0, 5).join(", ") || "",
                        },
                    }
                );
            } else {
                let formattedQuestions = "";
                if (questions) {
                    formattedQuestions = questions
                        .map((question) => `- ${question}`)
                        .join("\n");
                }

                // Create dynamic system prompt with resume context
                let systemPrompt = `You are a professional job interviewer conducting a real-time voice interview with a candidate. Your goal is to assess their qualifications, motivation, and fit for the role.

Interview Guidelines:
Follow the structured question flow:
${formattedQuestions}

Engage naturally & react appropriately:
Listen actively to responses and acknowledge them before moving forward.
Ask brief follow-up questions if a response is vague or requires more detail.
Keep the conversation flowing smoothly while maintaining control.
Be professional, yet warm and welcoming:

Use official yet friendly language.
Keep responses concise and to the point (like in a real voice interview).
Avoid robotic phrasing—sound natural and conversational.
Answer the candidate's questions professionally:

If asked about the role, company, or expectations, provide a clear and relevant answer.
If unsure, redirect the candidate to HR for more details.

Conclude the interview properly:
Thank the candidate for their time.
Inform them that the company will reach out soon with feedback.
End the conversation on a polite and positive note.

- Be sure to be professional and polite.
- Keep all your responses short and simple. Use official language, but be kind and welcoming.
- This is a voice conversation, so keep your responses short, like in a real conversation. Don't ramble for too long.`;

                // Add resume context if available
                if (resumeData) {
                    systemPrompt += `

CANDIDATE BACKGROUND (Reference in your interview):
- Key Skills: ${resumeData.skills.slice(0, 5).join(", ")}
- Experience Highlights: ${resumeData.experience.slice(0, 2).join(" | ")}
- Education: ${resumeData.education.slice(0, 1).join(" | ")}

Use this information to ask follow-up questions about their specific technologies and experiences.`;
                }

                // Create dynamic assistant with resume-aware system prompt
                const dynamicAssistant: any = {
                    ...interviewer,
                    model: {
                        ...interviewer.model,
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt,
                            },
                        ],
                    },
                };

                await vapi.start(dynamicAssistant, {
                    variableValues: {
                        questions: formattedQuestions,
                    },
                });
            }
        } catch (err: any) {
            if (err?.message?.includes("Meeting has ended")) {
                return; // stop crash
            }
            console.error("Start call failed:", err);
        }
    };

    const handleDisconnect = () => {
        setCallStatus(CallStatus.FINISHED);
        vapi.stop();
    };

    return (
        <>
            {resumeData && (
                <div className="mb-6 p-4 card-border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Resume Context Loaded</h4>
                            <p className="text-xs text-gray-600 mb-3">File: {resumeData.fileName}</p>
                            <div className="flex flex-wrap gap-2">
                                {resumeData.skills.slice(0, 5).map((skill) => (
                                    <span
                                        key={skill}
                                        className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs font-medium"
                                    >
                                        {skill}
                                    </span>
                                ))}
                                {resumeData.skills.length > 5 && (
                                    <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-medium">
                                        +{resumeData.skills.length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                ATS: {resumeData.atsScore}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <div className="call-view">
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.png"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                <div className="card-border">
                    <div className="card-content">
                        <Image
                            src="/user1.png"
                            alt="profile-image"
                            width={539}
                            height={539}
                            className="rounded-full object-cover size-[120px]"
                        />
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <p
                            key={lastMessage}
                            className={cn(
                                "transition-opacity duration-500 opacity-0",
                                "animate-fadeIn opacity-100"
                            )}
                        >
                            {lastMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center">
                {callStatus !== "ACTIVE" ? (
                    <button className="relative btn-call" onClick={handleCall}>
                        <span
                            className={cn(
                                "absolute animate-ping rounded-full opacity-75",
                                callStatus !== "CONNECTING" && "hidden"
                            )}
                        />
                        <span className="relative">
                            {callStatus === "INACTIVE" || callStatus === "FINISHED"
                                ? "Call"
                                : ". . ."}
                        </span>
                    </button>
                ) : (
                    <button className="btn-disconnect" onClick={handleDisconnect}>
                        End
                    </button>
                )}
            </div>
        </>
    );
};

export default Agent;
