
import { GoogleGenAI, Tool } from "@google/genai";
import { WeatherCardData } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const checkApiKey = (): boolean => {
  return !!apiKey;
}

// Helper to perform a search for a place using Google Maps Grounding
export const searchPlace = async (query: string): Promise<{ name: string; address: string; mapUrl: string; description: string }> => {
  if (!apiKey) throw new Error("API Key missing");

  const model = 'gemini-2.5-flash';
  const tools: Tool[] = [{ googleMaps: {} }];
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Find information about "${query}" in Taiwan. Return a short description, the official name, and the address.`,
      config: {
        tools,
        systemInstruction: "You are a travel assistant. Always try to find the specific location in Taiwan using Google Maps grounding.",
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let mapUrl = '';
    let name = query;
    let address = '';

    if (groundingChunks && groundingChunks.length > 0) {
      // Prioritize maps specific chunks
      const mapChunk = groundingChunks.find(c => c.maps?.uri);
      
      if (mapChunk && mapChunk.maps) {
        mapUrl = mapChunk.maps.uri;
        name = mapChunk.maps.title || name;
      } else {
        // Fallback to web chunks if maps specific chunk isn't found but search worked
        const webChunk = groundingChunks.find(c => c.web?.uri?.includes('google.com/maps'));
        if (webChunk && webChunk.web) {
          mapUrl = webChunk.web.uri || '';
          name = webChunk.web.title || name;
        }
      }
    }
    
    // Fallback if no specific map chunk, construct a search query
    if (!mapUrl) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ' Taiwan')}`;
    }

    return {
      name,
      address, // Address extraction is best effort from model text, but mapUrl is the source of truth
      mapUrl,
      description: response.text || "No description available."
    };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return {
      name: query,
      address: '',
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      description: "Could not fetch details."
    };
  }
};

// Helper to get weather advice
export const getWeatherAdvice = async (dates: string[]): Promise<WeatherCardData[]> => {
    if (!apiKey) return [];

    const model = 'gemini-2.5-flash';
    // Using Search tool to get real data from CWA (Central Weather Administration)
    const tools: Tool[] = [{ googleSearch: {} }];

    try {
        const response = await ai.models.generateContent({
            model,
            contents: `Search for the weather forecast (or historical average if too far out) for Taipei, Taiwan for these specific dates: ${dates.join(', ')}. 
            Specifically look for data from Taiwan Central Weather Administration (CWA).
            
            Return a JSON string array where each object has these exact keys:
            - date: string (e.g. "Dec 15")
            - dayName: string (e.g. "Monday")
            - condition: string (short summary like "Cloudy", "Rainy")
            - temp: string (e.g. "18-22°C")
            - rainChance: string (e.g. "30%")
            - advice: string (short clothing advice, e.g. "Bring umbrella")
            
            Do not include markdown formatting like \`\`\`json. Just the raw JSON array string.`,
            config: {
                tools,
            }
        });
        
        const text = response.text || '[]';
        // Cleanup potential markdown if the model ignores the instruction
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Weather fetch failed", e);
        return [];
    }
}