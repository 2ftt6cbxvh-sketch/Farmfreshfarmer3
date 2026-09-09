export interface VerifiedProduceItem {
  id: string;
  name: string;
  telugu: string;
  category: "vegetables" | "fruits" | "sweets" | "namkeen" | "pickles" | "pulses" | "millets" | "spices";
  path: string;
}

export const VERIFIED_PRODUCE_GALLERY: VerifiedProduceItem[] = [
  // Vegetables
  { id: "tomato", name: "Farm Fresh Tomato", telugu: "నాటు టమోటాలు", category: "vegetables", path: "/images/produce/tomato.jpg" },
  { id: "carrots", name: "Fresh Carrots", telugu: "తాజా క్యారెట్లు", category: "vegetables", path: "/images/produce/carrots.jpg" },
  { id: "green-brinjal", name: "Green Brinjal", telugu: "ఆకుపచ్చ వంకాయ", category: "vegetables", path: "/images/produce/green-brinjal.jpg" },
  { id: "purple-brinjal", name: "Purple Brinjal", telugu: "గుత్తి వంకాయ", category: "vegetables", path: "/images/produce/purple-brinjal.jpg" },
  { id: "bottlegourd", name: "Bottle Gourd (Sorakaya)", telugu: "సొరకాయ / ఆనపకాయ", category: "vegetables", path: "/images/produce/bottlegourd.jpg" },
  { id: "bitter-gourd", name: "Bitter Gourd (Kakarakaya)", telugu: "కాకరకాయ", category: "vegetables", path: "/images/produce/bitter-gourd.jpg" },
  { id: "ridge-gourd", name: "Ridge Gourd (Beerakaya)", telugu: "బీరకాయ", category: "vegetables", path: "/images/produce/ridge-gourd.jpg" },
  { id: "tindora", name: "Tindora (Dondakaya)", telugu: "దొండకాయలు", category: "vegetables", path: "/images/produce/tindora.jpg" },
  { id: "okra", name: "Okra / Lady Finger (Bendakaya)", telugu: "బెండకాయలు", category: "vegetables", path: "/images/produce/okra.jpg" },
  { id: "capsicum", name: "Green Capsicum", telugu: "క్యాప్సికమ్", category: "vegetables", path: "/images/produce/capsicum.jpg" },
  { id: "green-chilli", name: "Guntur Green Chillies", telugu: "గుంటూరు పచ్చి మిరపకాయలు", category: "vegetables", path: "/images/produce/green-chilli.jpg" },
  { id: "garlic", name: "Desi Garlic", telugu: "వెల్లుల్లి", category: "vegetables", path: "/images/produce/garlic.jpg" },
  { id: "ginger", name: "Fresh Ginger", telugu: "అల్లం", category: "vegetables", path: "/images/produce/ginger.jpg" },
  { id: "spinach", name: "Organic Palakura (Spinach)", telugu: "పాలకూర", category: "vegetables", path: "/images/produce/spinach.jpg" },
  { id: "coriander", name: "Fresh Coriander (Kothimeera)", telugu: "కొత్తిమీర", category: "vegetables", path: "/images/produce/coriander.jpg" },
  { id: "weekly-fresh-box", name: "Weekly Farm Produce Box", telugu: "వారపు తాజా కూరగాయల బాక్స్", category: "vegetables", path: "/images/produce/weekly-fresh-box.jpg" },

  // Fruits
  { id: "apples", name: "Crisp Fresh Apples", telugu: "యాపిల్స్", category: "fruits", path: "/images/produce/apples.jpg" },
  { id: "banana", name: "Farm Ripe Bananas", telugu: "తాజా అరటిపండ్లు", category: "fruits", path: "/images/produce/banana.jpg" },
  { id: "mango", name: "Banganapalli Sweet Mangoes", telugu: "బంగినపల్లి మామిడిపండ్లు", category: "fruits", path: "/images/produce/mango.jpg" },
  { id: "p-mango", name: "Organic Farm Mango", telugu: "సేంద్రీయ మామిడి", category: "fruits", path: "/images/produce/p-mango.jpg" },
  { id: "guava", name: "Sweet Guava (Jamakaya)", telugu: "జామకాయలు", category: "fruits", path: "/images/produce/guava.jpg" },
  { id: "custard-apple", name: "Sitaphal / Custard Apple", telugu: "సీతాఫలం", category: "fruits", path: "/images/produce/custard-apple.jpg" },
  { id: "pomegranate", name: "Ruby Pomegranate (Danimma)", telugu: "దానిమ్మ పండ్లు", category: "fruits", path: "/images/produce/pomegranate.jpg" },
  { id: "pineapple", name: "Sweet Pineapple (Anasa)", telugu: "అనాస పండు", category: "fruits", path: "/images/produce/pineapple.jpg" },
  { id: "muskmelon", name: "Muskmelon (Kharbuja)", telugu: "ఖర్బూజా", category: "fruits", path: "/images/produce/muskmelon.jpg" },
  { id: "papaya", name: "Farm Papaya (Boppayi)", telugu: "బొప్పాయి పండు", category: "fruits", path: "/images/produce/papaya.jpg" },
  { id: "dragon-fruit", name: "Red Dragon Fruit", telugu: "డ్రాగన్ ఫ్రూట్", category: "fruits", path: "/images/produce/dragon-fruit.jpg" },
  { id: "grapes", name: "Seedless Grapes", telugu: "ద్రాక్ష పండ్లు", category: "fruits", path: "/images/produce/grapes.jpg" },
  { id: "orange", name: "Juicy Sweet Oranges / Batthayi", telugu: "బత్తాయి / నారింజ", category: "fruits", path: "/images/produce/orange.jpg" },

  // Traditional Sweets & Snacks
  { id: "kaju-katli", name: "Pure Kaju Katli", telugu: "కాజు కట్లి", category: "sweets", path: "/images/produce/kaju-katli.jpg" },
  { id: "mysore-pak", name: "Ghee Mysore Pak", telugu: "నెయ్యి మైసూర్ పాక్", category: "sweets", path: "/images/produce/mysore-pak.jpg" },
  { id: "p-laddu", name: "Traditional Tirupati Laddu", telugu: "బెల్లం లడ్డు", category: "sweets", path: "/images/produce/p-laddu.jpg" },
  { id: "murukku", name: "Crispy Murukku / Janthikalu", telugu: "కరకరలాడే జంతికలు", category: "namkeen", path: "/images/produce/murukku.jpg" },
  { id: "p-mixture", name: "Spicy Andhra Mixture", telugu: "ఆంధ్రా మిక్చర్", category: "namkeen", path: "/images/produce/p-mixture.jpg" },
  { id: "roasted-chana", name: "Roasted Chana (Putnala)", telugu: "వేయించిన శనగలు (పుట్నాలు)", category: "namkeen", path: "/images/produce/roasted-chana.jpg" },

  // Andhra Traditional Pickles
  { id: "mango-pickle", name: "Authentic Avakaya (Mango Pickle)", telugu: "ఆవకాయ మామిడి పచ్చడి", category: "pickles", path: "/images/produce/mango-pickle.jpg" },
  { id: "lemon-pickle", name: "Traditional Lemon Pickle", telugu: "నిమ్మకాయ పచ్చడి", category: "pickles", path: "/images/produce/lemon-pickle.jpg" },
  { id: "gongura-pickle", name: "Guntur Gongura Pachadi", telugu: "గుంటూరు గోంగూర పచ్చడి", category: "pickles", path: "/images/produce/gongura-pickle.jpg" },
  { id: "chicken-pickle", name: "Farm Chicken Boneless Pickle", telugu: "నాటుకోడి చికెన్ పచ్చడి", category: "pickles", path: "/images/produce/chicken-pickle.jpg" },
  { id: "mutton-pickle", name: "Spicy Mutton Pickle", telugu: "మటన్ పచ్చడి", category: "pickles", path: "/images/produce/mutton-pickle.jpg" },
  { id: "prawn-pickle", name: "Godavari Prawns Pickle", telugu: "గోదావరి రొయ్యల పచ్చడి", category: "pickles", path: "/images/produce/prawn-pickle.jpg" },

  // Pulses & Millets
  { id: "toor-dal", name: "Unpolished Native Toor Dal", telugu: "కందిపప్పు", category: "pulses", path: "/images/produce/toor-dal.jpg" },
  { id: "moong-dal", name: "Unpolished Yellow Moong Dal", telugu: "పెసరపప్పు", category: "pulses", path: "/images/produce/moong-dal.jpg" },
  { id: "chana-dal", name: "Pure Bengal Gram (Chana Dal)", telugu: "శనగపప్పు", category: "pulses", path: "/images/produce/chana-dal.jpg" },
  { id: "foxtail-millet", name: "Organic Foxtail Millet (Korralu)", telugu: "కొర్రలు", category: "millets", path: "/images/produce/foxtail-millet.jpg" },
  { id: "pearl-millet", name: "Organic Pearl Millet (Sajjalu)", telugu: "సజ్జలు", category: "millets", path: "/images/produce/pearl-millet.jpg" },
  { id: "finger-millet", name: "Organic Finger Millet (Ragi)", telugu: "రాగులు", category: "millets", path: "/images/produce/finger-millet.jpg" },

  // Spices & Powders
  { id: "turmeric-powder", name: "Salem Pure Turmeric Powder", telugu: "స్వచ్ఛమైన పసుపు", category: "spices", path: "/images/produce/turmeric-powder.jpg" },
  { id: "red-chilli-powder", name: "Guntur Teja Red Chilli Powder", telugu: "గుంటూరు కారం పొడి", category: "spices", path: "/images/produce/red-chilli-powder.jpg" },
  { id: "coriander-powder", name: "Fresh Ground Coriander Powder", telugu: "ధనియాల పొడి", category: "spices", path: "/images/produce/coriander-powder.jpg" },
];

/**
 * Smart automatic matcher that takes any product name (English or Telugu)
 * and returns the best matching verified local image path.
 */
export function matchVerifiedProduceImage(productName: string, categorySlug = "general"): string {
  const norm = productName.toLowerCase().trim();

  // Direct matches
  if (norm.includes("garlic") || norm.includes("vellulli")) return "/images/produce/garlic.jpg";
  if (norm.includes("ginger") || norm.includes("allam")) return "/images/produce/ginger.jpg";
  if (norm.includes("bitter") || norm.includes("kakara") || norm.includes("karela")) return "/images/produce/bitter-gourd.jpg";
  if (norm.includes("ridge") || norm.includes("beera")) return "/images/produce/ridge-gourd.jpg";
  if (norm.includes("tindora") || norm.includes("donda")) return "/images/produce/tindora.jpg";
  if (norm.includes("green") && (norm.includes("brinjal") || norm.includes("vankaya"))) return "/images/produce/green-brinjal.jpg";
  if (norm.includes("brinjal") || norm.includes("eggplant") || norm.includes("vankaya")) return "/images/produce/purple-brinjal.jpg";
  if (norm.includes("capsicum") || norm.includes("bell pepper") || norm.includes("shimla")) return "/images/produce/capsicum.jpg";
  if (norm.includes("bottle") || norm.includes("sora") || norm.includes("anapa")) return "/images/produce/bottlegourd.jpg";
  if (norm.includes("beetroot") || norm.includes("potato") || norm.includes("bangala") || norm.includes("carrot") || norm.includes("kyarettu")) return "/images/produce/carrots.jpg";
  if (norm.includes("onion") || norm.includes("ulli")) return "/images/produce/garlic.jpg";
  if (norm.includes("tomato") || norm.includes("tamota")) return "/images/produce/tomato.jpg";
  if (norm.includes("spinach") || norm.includes("palak") || norm.includes("thotakura") || norm.includes("gongura")) return "/images/produce/spinach.jpg";
  if (norm.includes("okra") || norm.includes("lady") || norm.includes("benda")) return "/images/produce/okra.jpg";
  if (norm.includes("cauliflower") || norm.includes("cabbage")) return "/images/produce/capsicum.jpg";
  if (norm.includes("green chilli") || norm.includes("mirchi") || norm.includes("pachi mirapa")) return "/images/produce/green-chilli.jpg";
  if (norm.includes("coriander") || norm.includes("kothimeera")) return "/images/produce/coriander.jpg";
  if (norm.includes("cucumber") || norm.includes("dosakaya")) return "/images/produce/tindora.jpg";
  if (norm.includes("drumstick") || norm.includes("mulakkada")) return "/images/produce/ridge-gourd.jpg";
  if (norm.includes("box") || norm.includes("fresh box") || norm.includes("basket") || norm.includes("combo")) return "/images/produce/weekly-fresh-box.jpg";

  // Fruits
  if (norm.includes("guava") || norm.includes("jamakaya")) return "/images/produce/guava.jpg";
  if (norm.includes("sitaphal") || norm.includes("custard") || norm.includes("seetha")) return "/images/produce/custard-apple.jpg";
  if (norm.includes("pomegranate") || norm.includes("danimma")) return "/images/produce/pomegranate.jpg";
  if (norm.includes("pineapple") || norm.includes("anasa")) return "/images/produce/pineapple.jpg";
  if (norm.includes("muskmelon") || norm.includes("kharbuja")) return "/images/produce/muskmelon.jpg";
  if (norm.includes("papaya") || norm.includes("boppayi")) return "/images/produce/papaya.jpg";
  if (norm.includes("dragon")) return "/images/produce/dragon-fruit.jpg";
  if (norm.includes("mango") || norm.includes("mamidi")) return "/images/produce/mango.jpg";
  if (norm.includes("banana") || norm.includes("arati")) return "/images/produce/banana.jpg";
  if (norm.includes("grapes") || norm.includes("draksha")) return "/images/produce/grapes.jpg";
  if (norm.includes("orange") || norm.includes("narinja") || norm.includes("batthayi")) return "/images/produce/orange.jpg";
  if (norm.includes("apple") || norm.includes("aapi")) return "/images/produce/apples.jpg";

  // Sweets & Snacks
  if (norm.includes("laddu")) return "/images/produce/p-laddu.jpg";
  if (norm.includes("katli") || norm.includes("kaju")) return "/images/produce/kaju-katli.jpg";
  if (norm.includes("pak") || norm.includes("mysore")) return "/images/produce/mysore-pak.jpg";
  if (norm.includes("mixture")) return "/images/produce/p-mixture.jpg";
  if (norm.includes("murukku") || norm.includes("janthikalu") || norm.includes("chakli")) return "/images/produce/murukku.jpg";
  if (norm.includes("chana") || norm.includes("putnala")) return "/images/produce/roasted-chana.jpg";

  // Pickles
  if (norm.includes("lemon pickle") || norm.includes("nimma")) return "/images/produce/lemon-pickle.jpg";
  if (norm.includes("gongura pickle") || norm.includes("gongura pachadi")) return "/images/produce/gongura-pickle.jpg";
  if (norm.includes("chicken pickle")) return "/images/produce/chicken-pickle.jpg";
  if (norm.includes("mutton pickle")) return "/images/produce/mutton-pickle.jpg";
  if (norm.includes("prawn pickle") || norm.includes("royyala")) return "/images/produce/prawn-pickle.jpg";
  if (norm.includes("pickle") || norm.includes("pacchadi") || norm.includes("avakaya")) return "/images/produce/mango-pickle.jpg";

  // Pulses & Millets
  if (norm.includes("toor dal") || norm.includes("kandi")) return "/images/produce/toor-dal.jpg";
  if (norm.includes("moong dal") || norm.includes("pesara") || norm.includes("minapa")) return "/images/produce/moong-dal.jpg";
  if (norm.includes("chana dal") || norm.includes("senaga")) return "/images/produce/chana-dal.jpg";
  if (norm.includes("korralu") || norm.includes("foxtail")) return "/images/produce/foxtail-millet.jpg";
  if (norm.includes("sajjalu") || norm.includes("pearl millet") || norm.includes("bajra")) return "/images/produce/pearl-millet.jpg";
  if (norm.includes("ragi") || norm.includes("ragulu") || norm.includes("finger millet")) return "/images/produce/finger-millet.jpg";

  // Spices
  if (norm.includes("turmeric") || norm.includes("pasupu")) return "/images/produce/turmeric-powder.jpg";
  if (norm.includes("chilli") || norm.includes("karam")) return "/images/produce/red-chilli-powder.jpg";
  if (norm.includes("coriander") || norm.includes("dhaniyala")) return "/images/produce/coriander-powder.jpg";

  // Category based fallbacks
  if (categorySlug.includes("fruit")) return "/images/produce/apples.jpg";
  if (categorySlug.includes("sweet")) return "/images/produce/mysore-pak.jpg";
  if (categorySlug.includes("namkeen")) return "/images/produce/murukku.jpg";
  if (categorySlug.includes("pickle")) return "/images/produce/mango-pickle.jpg";
  if (categorySlug.includes("spice")) return "/images/produce/turmeric-powder.jpg";
  if (categorySlug.includes("pulse")) return "/images/produce/toor-dal.jpg";
  if (categorySlug.includes("millet")) return "/images/produce/foxtail-millet.jpg";

  return "/images/produce/weekly-fresh-box.jpg";
}
