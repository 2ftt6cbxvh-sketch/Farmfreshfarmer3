/**
 * Clinical and culinary usefulness explanations for FarmFreshFarmer products.
 * Provides why each item is suggested and how it is beneficial to the customer.
 */

export interface ProductBenefitInfo {
  reasonEn: string;
  reasonTe: string;
}

const PRODUCE_BENEFIT_MAP: Record<string, { en: string; te: string }> = {
  "garlic": {
    en: "Active allicin & bio-sulfides promote arterial flexibility, healthy blood pressure & cardiovascular wellness.",
    te: "అల్లిసిన్ రక్తనాళాల స్థితిస్థాపకతను పెంచి, రక్తపోటును సమతుల్యం చేయడంలో సహాయపడుతుంది.",
  },
  "ginger": {
    en: "Rich in gingerols that stimulate gastric motility, ease bloating, soothe acidity & boost natural immunity.",
    te: "జింజరాల్స్ జీర్ణక్రియను వేగవంతం చేసి, గ్యాస్ మరియు అసిడిటీని నివారిస్తాయి.",
  },
  "bitter gourd": {
    en: "Contains natural charantin & polypeptide-p that act as plant insulin mimetics to regulate blood glucose.",
    te: "చారంటిన్ & పాలీపెప్టైడ్-పి సహజంగా రక్తంలో షుగర్ స్థాయిలను నియంత్రించడంలో తోడ్పడతాయి.",
  },
  "karela": {
    en: "Contains natural charantin & polypeptide-p that act as plant insulin mimetics to regulate blood glucose.",
    te: "చారంటిన్ & పాలీపెప్టైడ్-పి సహజంగా రక్తంలో షుగర్ స్థాయిలను నియంత్రించడంలో తోడ్పడతాయి.",
  },
  "ridge gourd": {
    en: "Extremely low in calories and high in dietary fiber and moisture to soothe digestion & promote weight management.",
    te: "తక్కువ కేలరీలు మరియు అధిక పీచు పదార్థం కలిగి ఉండి, జీర్ణక్రియకు ఎంతో మేలు చేస్తుంది.",
  },
  "tindora": {
    en: "Low glycemic vegetable packed with natural antioxidants that help stabilize postprandial glucose levels.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ కలిగి ఉండి, భోజనం తర్వాత గ్లూకోజ్ పెరగకుండా నియంత్రిస్తుంది.",
  },
  "dondakaya": {
    en: "Low glycemic vegetable packed with natural antioxidants that help stabilize postprandial glucose levels.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ కలిగి ఉండి, భోజనం తర్వాత గ్లూకోజ్ పెరగకుండా నియంత్రిస్తుంది.",
  },
  "brinjal": {
    en: "Rich in nasunin anthocyanins that protect brain cell membranes & support healthy lipid metabolism.",
    te: "మెదడు కణాలను రక్షించే మరియు కొలెస్ట్రాల్‌ను సమతుల్యం చేసే నాసునిన్ పుష్కలంగా ఉంటుంది.",
  },
  "purple brinjal": {
    en: "Anthocyanin-dense skin supports cellular longevity and lowers oxidative stress.",
    te: "యాంటీఆక్సిడెంట్లతో కూడిన సహజ వంకాయలు రక్త ప్రసరణకు మేలు చేస్తాయి.",
  },
  "green brinjal": {
    en: "Tender, naturally grown local variety packed with fiber and essential minerals for gut health.",
    te: "తాజా పచ్చ వంకాయలు జీర్ణవ్యవస్థను ఆరోగ్యంగా ఉంచడంలో తోడ్పడతాయి.",
  },
  "capsicum": {
    en: "Packed with Vitamin C (higher than oranges) and capsanthin to enhance iron absorption & metabolic rate.",
    te: "నారింజ కంటే ఎక్కువ విటమిన్-సి కలిగి ఉండి, రోగనిరోధక శక్తిని పెంచుతుంది.",
  },
  "bottlegaurd": {
    en: "92% hydrating water content & soluble fiber that detoxifies liver and cools digestive tract.",
    te: "శరీరానికి చలువ చేసి, కాలేయ ఆరోగ్యానికి మరియు బరువు తగ్గడానికి తోడ్పడుతుంది.",
  },
  "beetroot": {
    en: "Natural dietary nitrates boost blood flow, cellular energy (ATP) & support healthy blood pressure.",
    te: "సహజ నైట్రేట్స్ రక్త ప్రసరణను మెరుగుపరిచి, రక్తపోటును అదుపులో ఉంచుతాయి.",
  },
  "potato": {
    en: "Wholesome source of potassium, complex carbohydrates & Vitamin B6 for sustained natural vitality.",
    te: "పొటాషియం మరియు విటమిన్ బి6 సమృద్ధిగా ఉండి శరీరానికి శక్తిని అందిస్తాయి.",
  },
  "onion": {
    en: "Rich in quercetin bioflavonoids that strengthen immunity and support cardiovascular resilience.",
    te: "క్వెర్సెటిన్ గుండె ఆరోగ్యానికి మరియు సహజ రోగనిరోధక శక్తికి ఎంతో మేలు చేస్తుంది.",
  },
  "tomatoes": {
    en: "High in cellular-protective lycopene and Vitamin C for heart health, glowing skin & immunity.",
    te: "లైకోపీన్ మరియు విటమిన్ సి గుండె మరియు చర్మ ఆరోగ్యానికి రక్షణగా నిలుస్తాయి.",
  },
  "lady finger": {
    en: "Abundant soluble mucilage fiber binds bile acids, supporting healthy cholesterol & gut microbiota.",
    te: "సహజ పీచు పదార్థం కొలెస్ట్రాల్‌ను తగ్గించి, జీర్ణక్రియను మెరుగుపరుస్తుంది.",
  },
  "okra": {
    en: "Abundant soluble mucilage fiber binds bile acids, supporting healthy cholesterol & gut microbiota.",
    te: "సహజ పీచు పదార్థం కొలెస్ట్రాల్‌ను తగ్గించి, జీర్ణక్రియను మెరుగుపరుస్తుంది.",
  },
  "green chilli": {
    en: "Natural capsaicin revs up metabolic calorie burning and provides high bioflavonoids.",
    te: "క్యాప్సైసిన్ జీవక్రియను వేగవంతం చేసి సహజ శక్తిని అందిస్తుంది.",
  },
  "pomegranate": {
    en: "Potent punicalagins stimulate nitric oxide production for superior arterial flexibility & cardiac vitality.",
    te: "ప్యునికాలాగిన్స్ రక్తనాళాలను ఆరోగ్యంగా ఉంచి, గుండె రక్త ప్రసరణను మెరుగుపరుస్తాయి.",
  },
  "bananas": {
    en: "Rich in potassium & prebiotics for instant cellular energy and healthy electrolyte equilibrium.",
    te: "పొటాషియం మరియు సహజ శక్తిని తక్షణమే అందించి, జీర్ణక్రియను మెరుగుపరుస్తాయి.",
  },
  "custard apple": {
    en: "Packed with Vitamin B6, magnesium, and dietary fiber that support nervous system & heart wellness.",
    te: "విటమిన్ బి6 మరియు మెగ్నీషియం నరాల మరియు గుండె ఆరోగ్యానికి తోడ్పడతాయి.",
  },
  "sitaphal": {
    en: "Packed with Vitamin B6, magnesium, and dietary fiber that support nervous system & heart wellness.",
    te: "విటమిన్ బి6 మరియు మెగ్నీషియం నరాల మరియు గుండె ఆరోగ్యానికి తోడ్పడతాయి.",
  },
  "muskmelon": {
    en: "Ultra-hydrating summer fruit rich in Vitamin A (beta-carotene) & potassium for vision and renal health.",
    te: "కంటి చూపును మెరుగుపరిచే విటమిన్ ఎ మరియు శరీరానికి అవసరమైన పొటాషియం అందిస్తుంది.",
  },
  "dragon fruit": {
    en: "Dense in betalains & prebiotics that nourish gut flora and boost natural cellular regeneration.",
    te: "ప్రీబయోటిక్స్ మరియు యాంటీఆక్సిడెంట్లు పేగు ఆరోగ్యాన్ని మెరుగుపరుస్తాయి.",
  },
  "guava": {
    en: "Contains 4x more Vitamin C than oranges with high dietary pectin for optimal digestion.",
    te: "అత్యధిక విటమిన్ సి మరియు పెక్టిన్ ఫైబర్ రోగనిరోధక శక్తికి, జీర్ణక్రియకు ఎంతో మంచిది.",
  },
  "apple": {
    en: "Rich in soluble pectin fiber & polyphenols that support cardiovascular health and reduce LDL.",
    te: "సహజ పెక్టిన్ ఫైబర్ కొలెస్ట్రాల్‌ను తగ్గించి గుండెకు రక్షణ కల్పిస్తుంది.",
  },
  "orange": {
    en: "Natural bioavailable Vitamin C & hesperidin for vibrant vascular elasticity and collagen synthesis.",
    te: "విటమిన్ సి మరియు హెస్పెరిడిన్ రోగనిరోధక శక్తిని, చర్మ కాంతిని పెంచుతాయి.",
  },
  "pineapple": {
    en: "Contains natural bromelain enzyme that breaks down proteins and reduces bodily inflammation.",
    te: "బ్రోమెలైన్ ఎంజైమ్ జీర్ణక్రియకు సహాయపడి శరీరంలో మంటను తగ్గిస్తుంది.",
  },
  "grapes": {
    en: "Rich in resveratrol and proanthocyanidins that defend against oxidative stress and support circulation.",
    te: "రెస్వెరాట్రాల్ రక్త ప్రసరణను మెరుగుపరిచి గుండెను ఆరోగ్యంగా ఉంచుతుంది.",
  },
  "foxtail millet": {
    en: "Low Glycemic Index (~50) cereal rich in beta-glucan fiber for steady, spike-free blood sugar.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ (GI ~50) కలిగిన సిరిధాన్యాలు షుగర్ నియంత్రణకు ఉత్తమం.",
  },
  "finger millet": {
    en: "Richest grain calcium source (344mg/100g) for solid bone density, maternal vitality & steady stamina.",
    te: "అత్యధిక కాల్షియం (344mg/100g) ఎముకల పుష్టికి మరియు మహిళల ఆరోగ్యానికి ఎంతో మేలు చేస్తుంది.",
  },
  "ragi": {
    en: "Richest grain calcium source (344mg/100g) for solid bone density, maternal vitality & steady stamina.",
    te: "అత్యధిక కాల్షియం (344mg/100g) ఎముకల పుష్టికి మరియు మహిళల ఆరోగ్యానికి ఎంతో మేలు చేస్తుంది.",
  },
  "pearl millet": {
    en: "High iron & magnesium content that fights anemia and powers physical endurance.",
    te: "ఐరన్ మరియు మెగ్నీషియం పుష్కలంగా ఉండి రక్తహీనతను నివారించి శరీరానికి బలాన్నిస్తాయి.",
  },
  "bajra": {
    en: "High iron & magnesium content that fights anemia and powers physical endurance.",
    te: "ఐరన్ మరియు మెగ్నీషియం పుష్కలంగా ఉండి రక్తహీనతను నివారించి శరీరానికి బలాన్నిస్తాయి.",
  },
  "toor dal": {
    en: "Clean plant protein and folic acid essential for muscle synthesis and cellular tissue repair.",
    te: "స్వచ్ఛమైన ప్రోటీన్ మరియు ఫోలిక్ యాసిడ్ కండరాల పుష్టికి ఎంతో అవసరం.",
  },
  "moong dal": {
    en: "Lightest, easiest-to-digest pulse rich in bioactive peptides that support metabolic balance.",
    te: "సులభంగా జీర్ణమయ్యే ప్రోటీన్ శరీరానికి సహజ శక్తిని అందిస్తుంది.",
  },
  "chana dal": {
    en: "Slow-release complex carbohydrates and high fiber for prolonged satiety and cholesterol balance.",
    te: "నెమ్మదిగా జీర్ణమై ఎక్కువ సమయం ఆకలి వేయకుండా చూసే ప్రోటీన్ ఆహారం.",
  },
  "turmeric powder": {
    en: "Potent curcumin (5%+) delivers clinical anti-inflammatory and cellular antioxidant defense.",
    te: "శక్తివంతమైన కర్క్యుమిన్ శరీరానికి సహజ రోగనిరోధక రక్షణ కల్పిస్తుంది.",
  },
  "red chilli powder": {
    en: "Stone-ground Guntur chillies rich in capsaicin for authentic Andhra flavor & metabolic stimulation.",
    te: "సహజ ఘాటు మరియు క్యాప్సైసిన్ జీవక్రియను వేగవంతం చేస్తాయి.",
  },
  "coriander powder": {
    en: "Rich in aromatic linalool & cineole that promote smooth digestion and ease bloating.",
    te: "జీర్ణక్రియను మెరుగుపరిచి శరీరానికి చలువ చేసే సహజ ధనియాల పొడి.",
  },
  "mango pickle": {
    en: "Traditional homemade Andhra Avakaya cured in cold-pressed gingelly oil with zero chemical additives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన నిల్వ పచ్చడి.",
  },
  "avakaya": {
    en: "Traditional homemade Andhra Avakaya cured in cold-pressed gingelly oil with zero chemical additives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన నిల్వ పచ్చడి.",
  },
  "gongura pickle": {
    en: "Authentic Andhra Gongura rich in iron and Vitamin C that promotes digestion & gut flora.",
    te: "ఐరన్ మరియు విటమిన్ సి సమృద్ధిగా ఉన్న ఆంధ్ర సాంప్రదాయ గోంగూర పచ్చడి.",
  },
  "chicken pickle": {
    en: "High-protein farm chicken slow-cooked with roasted spice blends & pure cold-pressed oil.",
    te: "స్వచ్ఛమైన నూనె, నాణ్యమైన నాటుకోడి మాంసంతో తయారుచేసిన స్పెషల్ పచ్చడి.",
  },
  "mutton pickle": {
    en: "Rich gourmet mutton pickle prepared with authentic home ground spices & tender cuts.",
    te: "ఘుమఘుమలాడే మసాలాలతో తయారుచేసిన స్వచ్ఛమైన మటన్ పచ్చడి.",
  },
  "prawn pickle": {
    en: "Fresh coastal prawns curated with aromatic spices, providing lean protein & Omega-3s.",
    te: "తాజా రొయ్యలతో స్వచ్ఛమైన నూనెలో తయారుచేసిన రుచికరమైన పచ్చడి.",
  },
  "lemon pickle": {
    en: "Aged in sunlight with sea salt; stimulates digestive enzymes and relieves gastric heaviness.",
    te: "ఎండలో పక్వానికి వచ్చిన నిమ్మకాయలు జీర్ణ ఎంజైములను ఉత్తేజపరుస్తాయి.",
  },
  "boondi laddu": {
    en: "Handcrafted with 100% pure desi cow ghee and natural sweetness for genuine festive taste.",
    te: "స్వచ్ఛమైన నెయ్యితో చేతితో చేసిన సాంప్రదాయ తియ్యని బూందీ లడ్డూ.",
  },
  "kaju katli": {
    en: "Made from premium grade whole cashews and pure desi ghee with zero artificial binders.",
    te: "నాణ్యమైన జీడిపప్పు మరియు స్వచ్ఛమైన నెయ్యితో చేసిన రుచికరమైన కాజూ కత్లీ.",
  },
  "mysore pak": {
    en: "Melt-in-mouth traditional delicacy rich in pure desi ghee and aromatic gram flour.",
    te: "నోట్లో వేస్తే కరిగిపోయే స్వచ్ఛమైన నెయ్యి మైసూర్ పాక్.",
  },
  "special mixture": {
    en: "Crunchy tea-time savory spiced with curry leaves and peanuts in cold-pressed groundnut oil.",
    te: "తాజా కరివేపాకు, పల్లీలతో వేయించిన కరకరలాడే స్పెషల్ మిక్చర్.",
  },
  "murukku": {
    en: "Crispy rice & dal savory prepared with traditional hand-press techniques and pure ingredients.",
    te: "బియ్యప్పిండి మరియు పప్పులతో చేసిన కరకరలాడే సాంప్రదాయ జంతికలు.",
  },
  "weekly fresh box": {
    en: "Curated assortment of farm-harvested organic vegetables delivering complete weekly nutrition.",
    te: "వారానికి సరిపడా తాజా సేంద్రీయ కూరగాయల ప్రత్యేక కాంబో బాక్స్.",
  },
};

const CATEGORY_BENEFIT_MAP: Record<string, { en: string; te: string }> = {
  "vegetables": {
    en: "100% pesticide-free harvest rich in active dietary fiber, minerals & essential phytonutrients.",
    te: "రసాయనాలు లేని తాజా సేంద్రీయ కూరగాయలు పూర్తి పోషణను అందిస్తాయి.",
  },
  "fruits": {
    en: "Tree-ripened organic fruits providing natural antioxidants, bio-available vitamins & hydration.",
    te: "సహజంగా పండిన పండ్లు విటమిన్లు మరియు యాంటీఆక్సిడెంట్లను అందిస్తాయి.",
  },
  "pickles": {
    en: "Prepared in small artisanal batches with cold-pressed oils & sun-dried spices; zero chemical preservatives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన అసలైన ఆంధ్ర పచ్చళ్ళు.",
  },
  "millets": {
    en: "Ancient unpolished Siridhanyalu grains with low GI and dense dietary minerals for sustained wellness.",
    te: "ఆరోగ్యానికి మేలు చేసే అసలైన సిరిధాన్యాలు మరియు పీచు పదార్థాలు.",
  },
  "pulses": {
    en: "Unpolished, protein-dense legumes supporting muscle repair, cardiac balance & lasting satiety.",
    te: "పొట్టు తీయని స్వచ్ఛమైన పప్పు దినుసులు కండరాల పుష్టికి ఉత్తమం.",
  },
  "spices": {
    en: "Sun-dried and stone-ground pure Indian spices with active essential oils for robust immunity.",
    te: "స్వచ్ఛమైన సుగంధ ద్రవ్యాలు రోగనిరోధక శక్తిని మరియు జీర్ణక్రియను పెంచుతాయి.",
  },
  "sweets": {
    en: "Traditional homemade sweets handcrafted with 100% pure desi cow ghee & natural unrefined sweeteners.",
    te: "100% స్వచ్ఛమైన దేశీ ఆవు నెయ్యితో చేసిన సాంప్రదాయ మిఠాయిలు.",
  },
  "snacks": {
    en: "Authentic namkeens and savories crafted with pure cold-pressed oils and aromatic native spices.",
    te: "స్వచ్ఛమైన నూనెలో వేయించిన రుచికరమైన సాంప్రదాయ తినుబండారాలు.",
  },
};

/**
 * Resolve why a product is suggested and how it is useful to the customer.
 */
export function resolveProductBenefit(productName: string, categorySlug?: string): { reasonEn: string; reasonTe: string } {
  const pLower = (productName || "").toLowerCase().trim();
  
  // 1. Direct produce match
  for (const [key, benefit] of Object.entries(PRODUCE_BENEFIT_MAP)) {
    if (pLower.includes(key) || key.includes(pLower)) {
      return { reasonEn: benefit.en, reasonTe: benefit.te };
    }
  }

  // 2. Category match
  const catKey = (categorySlug || "").toLowerCase();
  for (const [cat, catBenefit] of Object.entries(CATEGORY_BENEFIT_MAP)) {
    if (catKey.includes(cat) || pLower.includes(cat)) {
      return { reasonEn: catBenefit.en, reasonTe: catBenefit.te };
    }
  }

  // 3. Fallback
  return {
    reasonEn: "100% naturally grown farm produce offering pristine daily nutrition and rich natural vitality.",
    reasonTe: "రసాయనాలు లేని స్వచ్ఛమైన సేంద్రీయ ఉత్పత్తి, సంపూర్ణ ఆరోగ్యానికి తోడ్పడుతుంది.",
  };
}
