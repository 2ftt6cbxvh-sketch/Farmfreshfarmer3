/**
 * Authentic Andhra Farm Produce Telugu Naming Engine
 * Translates and maps product names into natural conversational Telugu wording in Telugu script.
 * e.g. "Farm Tomatoes" -> "నాటు టమోటాలు", "Finger Millet (Ragi)" -> "రాగులు (తైదలు)"
 */

// 1. Direct High-Precision Term Dictionary
export const DIRECT_PRODUCE_TELUGU_MAP: Record<string, string> = {
  // Fruits
  "alphonso mango": "మామిడి పండ్లు (ఆల్ఫోన్సో)",
  "sweet bananas": "చక్కరకేళి అరటి పండ్లు",
  "banana": "అరటి పండ్లు",
  "bananas": "అరటి పండ్లు",
  "fresh pomegranate": "దానిమ్మ పండ్లు",
  "pomegranate": "దానిమ్మ పండ్లు",
  "seedless grapes": "విత్తనాలు లేని ద్రాక్ష పండ్లు",
  "grapes": "ద్రాక్ష పండ్లు",
  "custard apple [sitaphal]": "సీతాఫలం పండ్లు",
  "custard apple (sitaphal)": "సీతాఫలం పండ్లు",
  "custard apple": "సీతాఫలం పండ్లు",
  "sitaphal": "సీతాఫలం పండ్లు",
  "seethaphal": "సీతాఫలం పండ్లు",
  "muskmelon": "ఖర్బూజా పండు",
  "kharbhuja": "ఖర్బూజా పండు",
  "dragon fruit [pink]": "డ్రాగన్ ఫ్రూట్",
  "dragon fruit (pink)": "డ్రాగన్ ఫ్రూట్",
  "dragon fruit": "డ్రాగన్ ఫ్రూట్",
  "premium white guava": "తాజా జామకాయలు",
  "royal gala apples": "రాయల్ గాలా యాపిల్ పండ్లు",
  "apple": "తాజా యాపిల్ పండ్లు",
  "apples": "యాపిల్ పండ్లు",
  "fresh carrots": "తాజా క్యారెట్లు",
  "papaya": "బొప్పాయి పండు",
  "guava": "తాజా జామకాయలు",
  "orange": "నారింజ పండ్లు",
  "sweet lime": "బత్తాయి పండ్లు",
  "mosambi": "బత్తాయి పండ్లు",
  "watermelon": "పుచ్చకాయ",
  "sapota": "సపోటా పండ్లు",
  "chiku": "సపోటా పండ్లు",
  "kiwi": "కివి పండ్లు",
  "pineapple": "అనాస పండు",
  "amla": "ఉసిరికాయలు",
  "indian gooseberry": "ఉసిరికాయలు",
  "lemon": "తాజా నిమ్మకాయలు",
  "lemons": "నిమ్మకాయలు",
  "coconut": "కొబ్బరికాయ",
  "tender coconut": "లేత కొబ్బరి బొండం",
  "weekly fresh box": "వారాంతపు తాజా కూరగాయల బాక్స్",

  // Vegetables
  "farm tomatoes": "నాటు టమోటాలు",
  "tomato": "నాటు టమోటాలు",
  "tomatoes": "నాటు టమోటాలు",
  "green spinach": "తాజా పాలకూర",
  "spinach": "పాలకూర",
  "lady finger (okra)": "లేత బెండకాయలు",
  "lady finger": "బెండకాయలు",
  "ladyfinger": "బెండకాయలు",
  "okra": "బెండకాయలు",
  "carrots": "క్యారెట్లు",
  "carrot": "క్యారెట్లు",
  "potato": "బంగాళాదుంపలు",
  "potatoes": "బంగాళాదుంపలు",
  "onion": "ఉల్లిపాయలు",
  "onions": "ఉల్లిపాయలు",
  "brinjal": "వంకాయలు",
  "purple brinjal": "వంకాయలు (గుత్తి వంకాయ)",
  "green brinjal": "పచ్చ వంకాయలు",
  "eggplant": "వంకాయలు",
  "green chilli": "పచ్చిమిర్చి",
  "chilli": "మిర్చి",
  "chillies": "పచ్చిమిర్చి",
  "ginger": "తాజా అల్లం",
  "garlic": "వెల్లుల్లి",
  "bitter gourd": "కాకరకాయ",
  "bittergourd": "కాకరకాయ",
  "karela": "కాకరకాయ",
  "bottle gourd": "సొరకాయ (ఆనపకాయ)",
  "bottlegaurd": "సొరకాయ (ఆనపకాయ)",
  "bottlegourd": "సొరకాయ (ఆనపకాయ)",
  "ridge gourd": "బీరకాయ",
  "ridgegourd": "బీరకాయ",
  "snake gourd": "పొట్లకాయ",
  "ivy gourd": "దొండకాయలు",
  "dondakaya": "దొండకాయలు",
  "tindora": "దొండకాయలు",
  "tindora [dondakaya]": "దొండకాయలు",
  "tindora (dondakaya)": "దొండకాయలు",
  "drumstick": "మునగకాయలు",
  "cabbage": "క్యాబేజీ",
  "cauliflower": "కాలీఫ్లవర్",
  "capsicum": "బెంగళూరు మిర్చి (క్యాప్సికమ్)",
  "cucumber": "కీర దోసకాయలు",
  "radish": "ముల్లంగి",
  "beetroot": "బీట్‌రూట్ దుంపలు",
  "coriander": "కొత్తిమీర",
  "mint": "పుదీనా",
  "curry leaves": "కరివేపాకు",
  "gongura": "గోంగూర",
  "thotakura": "తోటకూర",
  "bachali": "బచ్చలికూర",
  "methi": "మెంతికూర",
  "fenugreek leaves": "మెంతికూర",

  // Sweets
  "boondi laddu": "నెయ్యి బూందీ లడ్డూ",
  "laddu": "బూందీ లడ్డూ",
  "kaju katli": "స్పెషల్ కాజూ కత్లీ",
  "mysore pak": "నెయ్యి మైసూర్ పాక్",
  "sunnundalu": "మినప సున్నుండలు (ఆవు నెయ్యి)",
  "pootharekulu": "ఆత్రేయపురం పూతరేకులు",
  "gulab jamun": "గులాబ్ జామున్",
  "halwa": "హల్వా",
  "ariselu": "నెయ్యి అరిసెలు",
  "bobbatlu": "నెయ్యి బొబ్బట్లు",

  // Namkeen & Snacks
  "special mixture": "స్పెషల్ హాట్ మిక్చర్",
  "mixture": "హాట్ మిక్చర్",
  "murukku": "జంతికలు / మురుకులు",
  "roasted chana": "వేయించిన శనగలు (పుట్నాలు)",
  "chekodilu": "కరకరలాడే చేగోడీలు",
  "ribbon pakoda": "రిబ్బన్ పకోడా",
  "banana chips": "అరటి చిప్స్",

  // Pickles
  "mango pickle (avakaya)": "ఆంధ్ర ఆవకాయ పచ్చడి",
  "mango pickle": "ఆవకాయ పచ్చడి",
  "avakaya": "ఆవకాయ పచ్చడి",
  "lemon pickle": "నిమ్మకాయ పచ్చడి",
  "gongura pickle": "గోంగూర నిల్వ పచ్చడి",
  "tomato pickle": "టమోటా పచ్చడి",
  "ginger pickle": "అల్లం పచ్చడి",
  "chicken pickle": "నాటుకోడి పచ్చడి (చికెన్ పచ్చడి)",
  "mutton pickle": "మటన్ పచ్చడి",
  "prawn pickle": "రొయ్యల పచ్చడి",
  "fish pickle": "చేపల పచ్చడి",

  // Millets
  "foxtail millet": "కొర్రలు (సిరిధాన్యాలు)",
  "pearl millet (bajra)": "సజ్జలు",
  "pearl millet": "సజ్జలు",
  "finger millet (ragi)": "రాగులు (తైదలు)",
  "finger millet": "రాగులు",
  "ragi": "రాగులు (తైదలు)",
  "kodo millet": "అరికెలు (సిరిధాన్యాలు)",
  "little millet": "సామలు (సిరిధాన్యాలు)",
  "barnyard millet": "ఊదలు (సిరిధాన్యాలు)",
  "browntop millet": "అండుకొర్రలు (సిరిధాన్యాలు)",
  "sorghum": "జొన్నలు",
  "jowar": "జొన్నలు",

  // Pulses
  "toor dal": "స్వచ్ఛమైన కందిపప్పు",
  "moong dal": "పొట్టు పెసరపప్పు",
  "chana dal": "పచ్చి శనగపప్పు",
  "urad dal": "గుండు మినపప్పు",
  "green moong": "ఆకుపచ్చ పెసలు",
  "kabuli chana": "తెల్ల కాబూలీ శనగలు",
  "kala chana": "నల్ల శనగలు",
  "rajma": "రాజ్మా గింజలు",

  // Spices & Condiments
  "red chilli powder": "గుంటూరు ఎర్ర కారం పొడి",
  "turmeric powder": "స్వచ్ఛమైన పసుపు పొడి",
  "coriander powder": "ధనియాల పొడి",
  "cumin": "జీలకర్ర",
  "mustard": "ఆవాలు",
  "fenugreek": "మెంతులు",
  "black pepper": "మిరియాలు",
  "cardamom": "యాలకులు",
  "cloves": "లవంగాలు",
  "cinnamon": "దాల్చిన చెక్క",
  "garam masala": "గరం మసాలా",
  "sambar powder": "సాంబార్ పొడి",
  "rasam powder": "రసం పొడి",
  "jaggery": "సేంద్రీయ బెల్లం",
  "organic jaggery": "సేంద్రీయ బెల్లం",

  // Dairy & Oils
  "cow ghee": "స్వచ్ఛమైన ఆవు నెయ్యి",
  "desi ghee": "స్వచ్ఛమైన నెయ్యి",
  "ghee": "ఆవు నెయ్యి",
  "paneer": "మలై పన్నీర్",
  "milk": "తాజా పాలు",
  "curd": "గడ్డ పెరుగు",
  "butter": "వెన్న",
  "groundnut oil": "గానుగ వేరుశనగ నూనె",
  "sesame oil": "గానుగ నువ్వుల నూనె",
  "coconut oil": "స్వచ్ఛమైన కొబ్బరి నూనె",
  "honey": "స్వచ్ఛమైన తేనె",
  "organic honey": "స్వచ్ఛమైన అడవి తేనె",
  "cashew": "జీడిపప్పు",
  "almond": "బాదం పప్పు",
  "badam": "బాదం పప్పు",
  "raisins": "కిస్‌మిస్",
};

// 2. Individual Word & Modifier Telugu Mappings for Composite Names
const WORD_TELUGU_DICT: Record<string, string> = {
  // Modifiers
  fresh: "తాజా",
  organic: "సేంద్రీయ",
  pure: "స్వచ్ఛమైన",
  sweet: "తీపి",
  spicy: "కారపు",
  hot: "హాట్",
  special: "స్పెషల్",
  homemade: "ఇంట్లో చేసిన",
  green: "పచ్చి",
  red: "ఎరుపు",
  yellow: "పసుపు",
  seedless: "విత్తనాలు లేని",
  roasted: "వేయించిన",
  fried: "ఫ్రైడ్",
  dry: "ఎండిన",
  raw: "పచ్చి",
  coldpressed: "గానుగ",
  woodpressed: "గానుగ",

  // Produce
  mango: "మామిడి",
  alphonso: "ఆల్ఫోన్సో",
  banana: "అరటి",
  pomegranate: "దానిమ్మ",
  grape: "ద్రాక్ష",
  grapes: "ద్రాక్ష",
  apple: "యాపిల్",
  tomato: "టమోటా",
  tomatoes: "టమోటాలు",
  spinach: "పాలకూర",
  okra: "బెండకాయ",
  ladyfinger: "బెండకాయ",
  carrot: "క్యారెట్",
  carrots: "క్యారెట్లు",
  potato: "బంగాళాదుంప",
  potatoes: "బంగాళాదుంపలు",
  onion: "ఉల్లిపాయ",
  onions: "ఉల్లిపాయలు",
  brinjal: "వంకాయ",
  chilli: "మిర్చి",
  ginger: "అల్లం",
  garlic: "వెల్లుల్లి",
  karela: "కాకరకాయ",
  gourd: "కాయ",
  papaya: "బొప్పాయి",
  guava: "జామకాయ",
  orange: "నారింజ",
  watermelon: "పుచ్చకాయ",
  lemon: "నిమ్మకాయ",
  pickle: "పచ్చడి",
  pickles: "పచ్చళ్ళు",
  avakaya: "ఆవకాయ",
  gongura: "గోంగూర",
  chicken: "చికెన్",
  mutton: "మటన్",
  prawn: "రొయ్యల",
  fish: "చేపల",
  laddu: "లడ్డూ",
  katli: "కత్లీ",
  pak: "పాక్",
  mixture: "మిక్చర్",
  murukku: "మురుకులు",
  chana: "శనగలు",
  millet: "మిల్లెట్",
  millets: "సిరిధాన్యాలు",
  foxtail: "కొర్రలు",
  pearl: "సజ్జలు",
  finger: "రాగులు",
  ragi: "రాగులు",
  kodo: "అరికెలు",
  little: "సామలు",
  barnyard: "ఊదలు",
  bajra: "సజ్జలు",
  dal: "పప్పు",
  toor: "కంది",
  moong: "పెసర",
  urad: "మినప",
  powder: "పొడి",
  turmeric: "పసుపు",
  coriander: "ధనియాల",
  cumin: "జీలకర్ర",
  mustard: "ఆవాలు",
  fenugreek: "మెంతులు",
  ghee: "నెయ్యి",
  milk: "పాలు",
  curd: "పెరుగు",
  butter: "వెన్న",
  oil: "నూనె",
  honey: "తేనె",
  cashew: "జీడిపప్పు",
  almond: "బాదం",
  rice: "బియ్యం",
};

/**
 * Clean and normalize product name for lookup
 */
function normalizeProduceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves the authentic Telugu produce sub-name in Telugu script for any product.
 * Returns authentic Andhra market phrasing (e.g. "నాటు టమోటాలు", "పాలకూర", "ఆవకాయ పచ్చడి").
 */
export function resolveTeluguProductName(productName: string, categorySlug?: string): string {
  if (!productName || typeof productName !== "string") return "";

  const clean = normalizeProduceName(productName);

  // 1. Direct exact match in dictionary
  if (DIRECT_PRODUCE_TELUGU_MAP[clean]) {
    return DIRECT_PRODUCE_TELUGU_MAP[clean];
  }

  // 2. Try matching without parentheses (e.g. "Lady Finger (Okra)" -> "Lady Finger")
  const strippedParentheses = clean.replace(/\([^)]*\)/g, "").trim().replace(/\s+/g, " ");
  if (DIRECT_PRODUCE_TELUGU_MAP[strippedParentheses]) {
    return DIRECT_PRODUCE_TELUGU_MAP[strippedParentheses];
  }

  // 3. Try partial substring matching for well-known produce key phrases
  for (const [key, teluguVal] of Object.entries(DIRECT_PRODUCE_TELUGU_MAP)) {
    if (clean === key || clean.startsWith(key + " ") || clean.endsWith(" " + key) || clean.includes(" " + key + " ")) {
      return teluguVal;
    }
  }

  // 4. Token-level composition for compound names
  const tokens = clean.split(/\s+/).filter((t) => t.length > 0);
  const teluguTokens: string[] = [];

  for (const token of tokens) {
    const rawToken = token.replace(/[^a-z0-9]/g, "");
    if (WORD_TELUGU_DICT[rawToken]) {
      teluguTokens.push(WORD_TELUGU_DICT[rawToken]);
    }
  }

  if (teluguTokens.length > 0) {
    // Remove duplicate sequential tokens
    const uniqueTokens = teluguTokens.filter((item, pos, arr) => pos === 0 || item !== arr[pos - 1]);
    return uniqueTokens.join(" ");
  }

  // 5. Category-based fallback with phonetic transliteration
  const cat = (categorySlug || "").toLowerCase();
  if (cat.includes("vegetable")) return `${productName} (కూరగాయలు)`;
  if (cat.includes("fruit")) return `${productName} (పండ్లు)`;
  if (cat.includes("sweet")) return `${productName} (మిఠాయి)`;
  if (cat.includes("pickle")) return `${productName} (పచ్చడి)`;
  if (cat.includes("millet")) return `${productName} (సిరిధాన్యాలు)`;
  if (cat.includes("pulse")) return `${productName} (పప్పు)`;
  if (cat.includes("spice")) return `${productName} (సుగంధ ద్రవ్యం)`;

  return productName;
}
