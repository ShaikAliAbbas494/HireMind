// Resume parsing and analysis utilities

// Only import pdfjs in browser environment
let pdfjsLib: any = null;
if (typeof window !== "undefined") {
  const pdfjsModule = require("pdfjs-dist");
  pdfjsLib = pdfjsModule;
  
  // Configure pdf.js worker for Next.js
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
  } catch (err) {
    // Non-critical setup failure
  }
  
  // Disable worker flag
  if ((pdfjsLib as any).PDFJS) {
    (pdfjsLib as any).PDFJS.disableWorker = true;
  }
}

export interface ExtractedResumeData {
  skills: string[];
  experience: string[];
  education: string[];
  email?: string;
  phone?: string;
  name?: string;
  summary?: string;
  rawText?: string;
}

export async function extractResumeText(file: File): Promise<string> {
  try {
    if (file.type === "text/plain") {
      return await file.text();
    }

    if (file.type === "application/pdf") {
      const text = await extractTextFromPDFSimple(file);
      if (text && text.length > 10) return text;
    }

    if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const text = await extractTextFromDOCXSimple(file);
      if (text && text.length > 10) return text;
    }

    const fallbackText = await file.text();
    if (fallbackText && fallbackText.length > 10) return fallbackText;

    throw new Error("Could not extract readable text from file");
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
}

async function extractTextFromPDFSimple(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Try PDF extraction with worker
    let pdfDoc;
    try {
      pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
      }).promise;
    } catch (workerError) {
      // If worker fails, still try text extraction without worker optimization
      console.warn("PDF worker error (will try alternative method)");
      return "";
    }

    let fullText = "";
    const maxPages = Math.min(pdfDoc.numPages, 10);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => (item.str ? item.str.trim() : ""))
        .filter(Boolean)
        .join(" ");

      if (pageText) fullText += pageText + "\n";
    }

    return fullText.trim();
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "";
  }
}

async function extractTextFromDOCXSimple(file: File): Promise<string> {
  try {
    const { extractRawText } = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error("DOCX extraction error:", error);
    return "";
  }
}

export function analyzeResume(text: string): ExtractedResumeData {
  const skillKeywords = [
    "javascript","typescript","react","next.js","node.js","python","java",
    "c++","c#","css","html","sql","mongodb","firebase","aws","gcp","azure",
    "docker","kubernetes","git","rest api","graphql","tailwind","express",
    "vue","angular","golang","rust","kotlin","swift","postgresql","mysql",
    "redis","elasticsearch","jenkins","ci/cd","testing","jest","mocha",
    "webpack","vite","linux","windows","agile","scrum",
  ];

  const foundSkills = skillKeywords.filter(skill =>
    text.toLowerCase().includes(skill.toLowerCase())
  );

  const email = text.match(
    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
  )?.[1];

  const phone = text.match(
    /(\+?1?\s?[\(]?[0-9]{3}[\)]?\s?[0-9]{3}[\-\s]?[0-9]{4})/
  )?.[0];

  const nameLine = text.split("\n")[0].trim();
  const name =
    nameLine.length > 3 && nameLine.length < 100 ? nameLine : undefined;

  return {
    skills: foundSkills,
    experience: [],
    education: [],
    email,
    phone,
    name,
    rawText: text,
  };
}

export function calculateATSScore(text: string) {
  const checks = [
    text.includes("@"),
    /\d{10}/.test(text),
    /skills|experience|education/i.test(text),
  ];

  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    score,
    isATSFriendly: score >= 70,
    suggestions: score >= 70 ? [] : ["Improve resume structure"],
  };
}
