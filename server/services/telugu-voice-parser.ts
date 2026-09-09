/**
 * Native Telugu Voice-Order & Produce Dialect Parser
 * Translates vernacular Telugu shopping phrases into catalog items and units.
 */
import { db } from "../db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ParsedVoiceItem {
  productId: number;
  name: string;
  nameTe?: string | null;
  requestedQty: number;
  matchedUnit: string;
  unitPrice: number;
  totalPrice: number;
}

const TELUGU_PRODUCE_DICTIONARY: Record<string, number> = {
  // Vegetables
  "టమోటా": 5, "టమోటాలు": 5, "నాటు టమోటా": 5, "నాటు టమోటాలు": 5, "టమాటా": 5, "tomato": 5, "tomatoes": 5,
  "పాలకూర": 6, "కూరగాయ": 6, "spinach": 6,
  "బెండకాయ": 7, "బెండకాయలు": 7, "భెండీ": 7, "okra": 7, "bhendi": 7,
  "క్యారెట్": 8, "క్యారెట్లు": 8, "carrot": 8, "carrots": 8,
  "సొరకాయ": 11, "ఆనపకాయ": 11, "bottle gourd": 11, "lauki": 11,
  "కాకరకాయ": 12, "కాకరకాయలు": 12, "bitter gourd": 12,
  "బీరకాయ": 13, "బీరకాయలు": 13, "ridge gourd": 13,
  "దొండకాయ": 14, "దొండకాయలు": 14, "tindora": 14, "kundru": 14,
  "వంకాయ": 15, "వంకాయలు": 15, "గుత్తి వంకాయ": 15, "నల్ల వంకాయ": 15, "eggplant": 15, "brinjal": 15,
  "పచ్చిమిర్చి": 17, "పచ్చి మిరపకాయలు": 17, "మిరపకాయలు": 17, "green chilli": 17, "chillies": 17,
  "వెల్లుల్లి": 30, "తెల్లగడ్డ": 30, "garlic": 30,
  "అల్లం": 19, "ginger": 19,
  "కొత్తిమీర": 29, "కరివేపాకు": 29, "coriander": 29,

  // Fruits
  "మామిడి": 1, "మామిడి పండ్లు": 1, "బంగినపల్లి": 1, "ఆల్ఫోన్సో": 1, "mango": 1, "mangoes": 1,
  "అరటి": 2, "అరటి పండ్లు": 2, "అరటిపండు": 2, "banana": 2, "bananas": 2,
  "దానిమ్మ": 3, "దానిమ్మ పండ్లు": 3, "pomegranate": 3,
  "ద్రాక్ష": 4, "నల్ల ద్రాక్ష": 4, "grapes": 4,

  // Sweets & Namkeen
  "లడ్డూ": 9, "బూందీ లడ్డూ": 9, "laddu": 9, "laddoo": 9,
  "కాజూ కత్లీ": 10, "జీడిపప్పు స్వీట్": 10, "kaju katli": 10,
  "మైసూర్ పాక్": 11, "mysore pak": 11,
  "మిశ్రమం": 12, "మిక్స్చర్": 12, "హాట్ మిక్స్చర్": 12, "mixture": 12,
  "మురుకులు": 13, "జంతికలు": 13, "murukku": 13,
  "వేయించిన శనగలు": 14, "పుట్నాలు": 14, "గుగ్గిళ్ళు": 14, "roasted chana": 14,

  // Pickles
  "ఆవకాయ": 15, "మామిడికాయ పచ్చడి": 15, "avakaya": 15, "mango pickle": 15,
  "నిమ్మకాయ పచ్చడి": 16, "lemon pickle": 16,
  "గోంగూర పచ్చడి": 17, "గోంగూర": 17, "gongura pickle": 17,
  "చికెన్ పచ్చడి": 18, "కోడి పచ్చడి": 18, "chicken pickle": 18,
  "మటన్ పచ్చడి": 19, "మాంసం పచ్చడి": 19, "mutton pickle": 19,
  "రొయ్యల పచ్చడి": 20, "prawn pickle": 20,

  // Millets & Pulses
  "కొర్రలు": 21, "కొర్ర": 21, "foxtail millet": 21,
  "సజ్జలు": 22, "pearl millet": 22, "bajra": 22,
  "రాగులు": 23, "రాగి పిండి": 23, "finger millet": 23, "ragi": 23,
  "కందిపప్పు": 24, "తోర్ దాల్": 24, "toor dal": 24,
  "పెసరపప్పు": 25, "మూంగ్ దాల్": 25, "moong dal": 25,
  "శనగపప్పు": 26, "చనా దాల్": 26, "chana dal": 26,
  "కారం పొడి": 27, "ఎర్ర కారం": 27, "గుంటూరు కారం": 27, "red chilli powder": 27,
  "పసుపు": 28, "పసుపు కొమ్ములు": 28, "turmeric": 28,
};

function parseQuantityAndUnit(text: string): { qty: number; unit: string } {
  let qty = 1;
  let unit = "1 Kg";

  // Telugu quantity words
  if (/అర\s*కిలో|అరకేజీ|500\s*(గ్రా|gm|g)/i.test(text)) {
    qty = 1;
    unit = "500 Grams";
  } else if (/పావు\s*కిలో|పావుకేజీ|250\s*(గ్రా|gm|g)/i.test(text)) {
    qty = 1;
    unit = "250 Grams";
  } else if (/ముప్పావు\s*కిలో|750\s*(గ్రా|gm|g)/i.test(text)) {
    qty = 1;
    unit = "750 Grams";
  } else if (/ఒక\s*కట్ట|రెండు\s*కట్టలు|కట్ట/i.test(text)) {
    const match = text.match(/(ఒక|రెండు|మూడు|[0-9]+)\s*కట్ట/i);
    if (match) {
      if (match[1] === "రెండు" || match[1] === "2") qty = 2;
      else if (match[1] === "మూడు" || match[1] === "3") qty = 3;
      else qty = 1;
    }
    unit = "1 Bunch";
  } else if (/([0-9]+|ఒక|రెండు|మూడు|నాలుగు|ఐదు)\s*(కిలో|కేజీ|kg|kilo)/i.test(text)) {
    const match = text.match(/([0-9]+|ఒక|రెండు|మూడు|నాలుగు|ఐదు)\s*(కిలో|కేజీ|kg|kilo)/i);
    if (match) {
      const qStr = match[1];
      if (qStr === "ఒక" || qStr === "1") qty = 1;
      else if (qStr === "రెండు" || qStr === "2") qty = 2;
      else if (qStr === "మూడు" || qStr === "3") qty = 3;
      else if (qStr === "నాలుగు" || qStr === "4") qty = 4;
      else if (qStr === "ఐదు" || qStr === "5") qty = 5;
      else qty = parseInt(qStr, 10) || 1;
    }
    unit = `${qty} Kg`;
  }

  return { qty, unit };
}

export async function parseTeluguVoiceTranscript(transcript: string): Promise<{
  recognizedItems: ParsedVoiceItem[];
  rawTranscript: string;
  matchedCount: number;
  teluguConfirmation: string;
}> {
  const normalized = transcript.toLowerCase();
  const matchedIds = new Set<number>();
  const parsedItems: ParsedVoiceItem[] = [];

  // Split clauses by comma, 'మరియు', 'ఇంకా', 'and'
  const phrases = normalized.split(/[,]|మరియు|ఇంకా|\band\b/i);

  // Load active products from DB
  const allProds = await db.select().from(products);
  const prodMap = new Map<number, typeof products.$inferSelect>();
  for (const p of allProds) {
    prodMap.set(p.id, p);
  }

  for (const phrase of phrases) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;

    for (const [kw, prodId] of Object.entries(TELUGU_PRODUCE_DICTIONARY)) {
      if (trimmed.includes(kw.toLowerCase()) && !matchedIds.has(prodId)) {
        const prod = prodMap.get(prodId);
        if (prod) {
          matchedIds.add(prodId);
          const { qty, unit } = parseQuantityAndUnit(trimmed);
          const unitPrice = Number(prod.price) || 40;
          parsedItems.push({
            productId: prod.id,
            name: prod.name,
            nameTe: prod.nameTe,
            requestedQty: qty,
            matchedUnit: unit,
            unitPrice,
            totalPrice: unitPrice * qty,
          });
          break; // Found match for this phrase
        }
      }
    }
  }

  const teluguConfirmation =
    parsedItems.length > 0
      ? `🌾 ${parsedItems.length} తాజా వస్తువులు గుర్తించబడ్డాయి (Detected ${parsedItems.length} fresh farm items)!`
      : "మీరు చెప్పిన వస్తువుల వివరాలు స్పష్టంగా లేవు. దయచేసి మళ్ళీ చెప్పండి.";

  return {
    recognizedItems: parsedItems,
    rawTranscript: transcript,
    matchedCount: parsedItems.length,
    teluguConfirmation,
  };
}
