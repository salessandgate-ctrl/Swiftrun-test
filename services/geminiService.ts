import { GoogleGenAI } from "@google/genai";
import { DeliveryBooking } from "../types";

export interface OptimizationResult {
  text: string;
  links: { title: string; uri: string }[];
}

const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
};

export const getSmartOptimization = async (bookings: DeliveryBooking[]): Promise<OptimizationResult> => {
  if (bookings.length === 0) {
    return { text: "Add some deliveries to get a smart summary.", links: [] };
  }

  // Fix: Create a new GoogleGenAI instance right before making an API call to ensure it uses the latest process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const location = await getCurrentLocation();

  const prompt = `
    Analyze the following delivery list and provide a logical delivery sequence recommendation. 
    Use Google Maps to verify address locations and optimize the route based on real-world geography.
    Explain why this sequence makes sense.
    
    Current Deliveries:
    ${bookings.map((b, i) => `${i + 1}. ${b.customerName} at ${b.deliveryAddress} (${b.cartons} cartons)`).join('\n')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert logistics coordinator. Use Google Maps to verify address validity and proximity to provide an optimized delivery route. If an address seems invalid or hard to find, mention it.",
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: location ? {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        } : undefined
      },
    });

    // Fix: Access extracted text directly via the .text property (not a method).
    const text = response.text || "Could not generate optimization notes.";
    const links: { title: string; uri: string }[] = [];

    // Extract links from grounding chunks
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          links.push({ title: chunk.maps.title || "View Location", uri: chunk.maps.uri });
        } else if (chunk.web) {
          links.push({ title: chunk.web.title || "Web Source", uri: chunk.web.uri });
        }
      });
    }

    return { text, links };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { 
      text: "Error getting AI optimization. Please check your connection and API key.", 
      links: [] 
    };
  }
};