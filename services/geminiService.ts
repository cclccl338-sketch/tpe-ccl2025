
import { GoogleGenAI, Tool } from "@google/genai";
import { WeatherCardData, LocationSearchResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const checkApiKey = (): boolean => {
  return !!apiKey;
}

// Helper to perform a search for a place using Google Maps Grounding and return rich details
export const searchPlace = async (query: string): Promise<LocationSearchResult> => {
  if (!navigator.onLine) {
      throw new Error("Offline");
  }
  if (!apiKey) throw new Error("API Key missing");

  const model = 'gemini-2.5-flash';
  const tools: Tool[] = [{ googleMaps: {} }];
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Find detailed information about "${query}" in Taiwan.
      Return a JSON object with this structure (no markdown):
      {
        "name": "Official Name",
        "address": "Address",
        "description": {
          "en": "Short description in English",
          "zh": "Short description in Traditional Chinese"
        },
        "funThings": {
          "en": ["Activity 1", "Activity 2"],
          "zh": ["Activity 1 in Chinese", "Activity 2 in Chinese"]
        }
      }`,
      config: {
        tools,
        systemInstruction: "You are a travel assistant. Always try to find the specific location in Taiwan using Google Maps grounding. Provide descriptions and fun things to do in both English and Traditional Chinese.",
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let mapUrl = '';
    
    // Extract Map URL
    if (groundingChunks && groundingChunks.length > 0) {
      const mapChunk = groundingChunks.find(c => c.maps?.uri);
      if (mapChunk && mapChunk.maps) {
        mapUrl = mapChunk.maps.uri;
      } else {
        const webChunk = groundingChunks.find(c => c.web?.uri?.includes('google.com/maps'));
        if (webChunk && webChunk.web) {
          mapUrl = webChunk.web.uri || '';
        }
      }
    }
    
    if (!mapUrl) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ' Taiwan')}`;
    }

    // Parse JSON response
    const text = response.text || '{}';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let data;
    try {
        data = JSON.parse(cleanText);
    } catch (e) {
        // Fallback if JSON parsing fails
        return {
            name: query,
            address: '',
            mapUrl,
            description: { en: 'No details found.', zh: '未找到詳細資訊' },
            funThings: { en: [], zh: [] }
        };
    }

    return {
      name: data.name || query,
      address: data.address || '',
      mapUrl,
      description: data.description || { en: 'No description.', zh: '無描述' },
      funThings: data.funThings || { en: [], zh: [] }
    };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return {
      name: query,
      address: '',
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      description: { en: 'Offline or Error.', zh: '離線或錯誤' },
      funThings: { en: [], zh: [] }
    };
  }
};

// Helper to get weather advice
export const getWeatherAdvice = async (dates: string[]): Promise<WeatherCardData[]> => {
    if (!navigator.onLine) {
        return [];
    }
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
