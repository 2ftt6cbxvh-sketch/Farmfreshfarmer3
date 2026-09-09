/**
 * Telugu Vernacular Voice Search & Dialect Cart Router
 */
import type { Express, Request, Response } from "express";
import { parseTeluguVoiceTranscript } from "../services/telugu-voice-parser";

export function registerVoiceSearchRoutes(app: Express) {
  app.post("/api/voice-order/parse", async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body || {};
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ message: "Transcript text is required" });
      }

      const result = await parseTeluguVoiceTranscript(transcript);
      return res.json(result);
    } catch (err: any) {
      console.error("[voice-order] Error parsing transcript:", err.message);
      return res.status(500).json({ message: "Failed to parse voice transcript" });
    }
  });
}
