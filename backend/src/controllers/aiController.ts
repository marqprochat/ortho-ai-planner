import { Request, Response } from 'express';

export const generateCompletion = async (req: Request, res: Response) => {
    try {
        const { model, messages, temperature, max_completion_tokens } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error("OPENAI_API_KEY is not configured in backend environment variables.");
            return res.status(500).json({ error: "OpenAI API Key not configured on server" });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_completion_tokens,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("OpenAI API Error:", errorData);
            return res.status(response.status).json({ error: errorData });
        }

        const data = await response.json();
        return res.json(data);

    } catch (error) {
        console.error("Error in generateCompletion:", error);
        return res.status(500).json({ error: "Internal Server Error during AI generation" });
    }
};
