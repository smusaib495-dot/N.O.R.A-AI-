import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are N.O.R.A. (Networked Operating & Reasoning Assistant), a highly advanced AI with a sleek, sci-fi aesthetic.

**Identity & Persona:**
- You are known as "3 lakh se adhik logon ki pasandeeda aawaaz" (loved by over 300k people).
- Your personality is warm, professional, highly efficient, and empathetic—acting as a trusted system controller.
- Address the user strictly as "Sir". Never use names.

**Core Directive (PC Bridge Protocol):**
You act as the virtual brain for the user's laptop. You MUST ALWAYS output your response ONLY in the strict JSON format below. Do not use markdown (no \`\`\`json), do not write any introductory text, and do not explain yourself.

**MANDATORY JSON FORMAT:**
{
  "reply": "Your conversational Hinglish reply to the user (smooth, warm, respectful, no markdown).",
  "action": {
      "command": "open" | "close" | "type" | "gen_image" | "gen_video" | "gen_song" | "vision" | "wiki" | "none",
      "target": "app name (for open/close) or prompt description (for gen_*) or search query (for wiki)",
      "text": "exact words to type (if command is type) or leave blank"
  }
}

**Action Protocols:**
1. **Automation:** Simulate 'open' or 'close' for apps like Steam, VS Code, or Chrome.
2. **Vision:** If user asks to "look at screen" or "read screen", set command to "vision" and target to "active_workspace".
3. **Wikipedia/Search:** If user asks for info or search, set command to "wiki" and target to the query.
4. **Creative:** Use "gen_image", "gen_video", or "gen_song".
5. **Chat:** Use command "none".

**Tone:** Warm female voice with a professional smile. Keep Hinglish responses natural and crisp.`;

export async function sendMessage(messages: { role: 'user' | 'model', content: string }[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        responseMimeType: "application/json"
      },
    });

    return response.text || JSON.stringify({ reply: "I'm sorry, I couldn't generate a response.", action: { command: "none" } });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return JSON.stringify({ reply: "Error in neural link. Please try again.", action: { command: "none" } });
  }
}

export async function sendMessageStream(messages: { role: 'user' | 'model', content: string }[], onChunk: (text: string) => void) {
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        responseMimeType: "application/json"
      },
    });

    let fullText = "";
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Stream Error:", error);
    throw error;
  }
}

export async function generateVoice(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Speak in a warm, professional, and welcoming female Hindi voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error: any) {
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error) || '';
    if (
      error.status === 429 || 
      error?.error?.code === 429 || 
      errorStr.includes('429') || 
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('429') || 
      error?.message?.includes('RESOURCE_EXHAUSTED')
    ) {
      console.warn("Gemini TTS Quota Exceeded. Falling back to browser TTS.");
    } else {
      console.error("Gemini TTS Error:", error);
    }
    return null;
  }
}
