/**
 * Clinical and Culinary Knowledge Engine for FarmFreshFarmer Produce & Products.
 * 
 * Maps organic produce, grains, pickles, spices, and groceries to verified
 * physiological/biochemical mechanisms (antioxidants, eNOS arterial vasodilation,
 * lycopene, insulin mimetics, digestive enzymes, electrolyte balance, bone density)
 * in both English and Telugu script.
 * 
 * Future-proof: Matches exact names, synonyms, stems, and category-level taxonomy
 * so any new product added in the future automatically receives complete AI benefits.
 */

export interface ProductBenefitInfo {
  reasonEn: string;
  reasonTe: string;
}

// Comprehensive Clinical and Culinary Mechanisms Dictionary
const PRODUCE_BENEFIT_MAP: Record<string, { en: string; te: string }> = {
  // ==================== FRUITS ====================
  "pomegranate": {
    en: "Potent punicalagins & polyphenols stimulate endothelial nitric oxide (eNOS) for arterial elasticity, healthy blood pressure & cardiac stamina.",
    te: "ప్యునికాలాగిన్స్ రక్తనాళాల స్థితిస్థాపకతను పెంచి, గుండె ఆరోగ్యానికి మరియు రక్త ప్రసరణకు విశేషంగా తోడ్పడతాయి.",
  },
  "danimma": {
    en: "Potent punicalagins & polyphenols stimulate endothelial nitric oxide (eNOS) for arterial elasticity, healthy blood pressure & cardiac stamina.",
    te: "ప్యునికాలాగిన్స్ రక్తనాళాల స్థితిస్థాపకతను పెంచి, గుండె ఆరోగ్యానికి మరియు రక్త ప్రసరణకు విశేషంగా తోడ్పడతాయి.",
  },
  "apple": {
    en: "Abundant soluble pectin fiber and quercetin flavonoids actively bind LDL cholesterol and support heart and vascular health.",
    te: "సహజ పెక్టిన్ ఫైబర్ మరియు క్వెర్సెటిన్ కొలెస్ట్రాల్‌ను తగ్గించి గుండె రక్తనాళాలకు రక్షణ కల్పిస్తాయి.",
  },
  "royal gala": {
    en: "Crisp natural sweetness rich in cellular antioxidants and soluble fiber for balanced gut microbiome and cardiac wellness.",
    te: "సహజ పీచు పదార్థం మరియు యాంటీఆక్సిడెంట్లు పేగు ఆరోగ్యాన్ని మరియు గుండెను సంరక్షిస్తాయి.",
  },
  "banana": {
    en: "High bioavailable potassium and prebiotic fructo-oligosaccharides restore electrolyte balance, normalize BP & sustain natural energy.",
    te: "పొటాషియం ఎలక్ట్రోలైట్ సమతుల్యతను కాపాడి రక్తపోటును అదుపులో ఉంచుతుంది, సహజ శక్తిని ఇస్తుంది.",
  },
  "ariti": {
    en: "High bioavailable potassium and prebiotic fructo-oligosaccharides restore electrolyte balance, normalize BP & sustain natural energy.",
    te: "పొటాషియం ఎలక్ట్రోలైట్ సమతుల్యతను కాపాడి రక్తపోటును అదుపులో ఉంచుతుంది, సహజ శక్తిని ఇస్తుంది.",
  },
  "orange": {
    en: "Natural bioavailable Vitamin C & hesperidin bioflavonoids strengthen vascular capillaries, boost collagen & accelerate iron absorption.",
    te: "విటమిన్ సి మరియు హెస్పెరిడిన్ రోగనిరోధక శక్తిని, చర్మ కాంతిని మరియు రక్తనాళాల బలాన్ని పెంచుతాయి.",
  },
  "citrus": {
    en: "Rich in ascorbic acid and citric bioflavonoids that alkalinize bodily tissues and defend against oxidative stress.",
    te: "విటమిన్ సి మరియు సహజ ఆమ్లాలు శరీరంలో రోగనిరోధక శక్తిని పెంచి ఇన్ఫెక్షన్ల నుండి రక్షిస్తాయి.",
  },
  "guava": {
    en: "Superfood containing 4x higher Vitamin C than citrus fruits paired with low-glycemic dietary pectin for blood glucose regulation.",
    te: "నారింజ కంటే 4 రెట్లు ఎక్కువ విటమిన్ సి మరియు పీచు పదార్థం కలిగి ఉండి షుగర్ నియంత్రణకు, రోగనిరోధకతకు మేలు చేస్తుంది.",
  },
  "jama": {
    en: "Superfood containing 4x higher Vitamin C than citrus fruits paired with low-glycemic dietary pectin for blood glucose regulation.",
    te: "నారింజ కంటే 4 రెట్లు ఎక్కువ విటమిన్ సి మరియు పీచు పదార్థం కలిగి ఉండి షుగర్ నియంత్రణకు, రోగనిరోధకతకు మేలు చేస్తుంది.",
  },
  "pineapple": {
    en: "Contains natural proteolytic bromelain enzyme that accelerates protein digestion and reduces systemic inflammation.",
    te: "బ్రోమెలైన్ ఎంజైమ్ ఆహారంలోని ప్రోటీన్లను సులభంగా జీర్ణం చేసి శరీరంలో వాపులను, మంటను తగ్గిస్తుంది.",
  },
  "anasa": {
    en: "Contains natural proteolytic bromelain enzyme that accelerates protein digestion and reduces systemic inflammation.",
    te: "బ్రోమెలైన్ ఎంజైమ్ ఆహారంలోని ప్రోటీన్లను సులభంగా జీర్ణం చేసి శరీరంలో వాపులను, మంటను తగ్గిస్తుంది.",
  },
  "papaya": {
    en: "Dense in papain enzyme and beta-carotene that soothe gastric distress, promote smooth bowel motility & nourish radiant skin.",
    te: "పపైన్ ఎంజైమ్ జీర్ణక్రియను వేగవంతం చేసి, కడుపుబ్బరం నివారించి చర్మానికి సహజ కాంతిని అందిస్తుంది.",
  },
  "boppayi": {
    en: "Dense in papain enzyme and beta-carotene that soothe gastric distress, promote smooth bowel motility & nourish radiant skin.",
    te: "పపైన్ ఎంజైమ్ జీర్ణక్రియను వేగవంతం చేసి, కడుపుబ్బరం నివారించి చర్మానికి సహజ కాంతిని అందిస్తుంది.",
  },
  "grapes": {
    en: "Packed with resveratrol and oligomeric proanthocyanidins (OPCs) that support endothelial flexibility & longevity.",
    te: "రెస్వెరాట్రాల్ మరియు ప్రోయాంతోసైనిడిన్లు రక్తనాళాల కణాలను ఆరోగ్యంగా ఉంచి గుండెకు రక్షణనిస్తాయి.",
  },
  "draksha": {
    en: "Packed with resveratrol and oligomeric proanthocyanidins (OPCs) that support endothelial flexibility & longevity.",
    te: "రెస్వెరాట్రాల్ మరియు ప్రోయాంతోసైనిడిన్లు రక్తనాళాల కణాలను ఆరోగ్యంగా ఉంచి గుండెకు రక్షణనిస్తాయి.",
  },
  "muskmelon": {
    en: "Deeply hydrating melon rich in beta-carotene (Vitamin A) and potassium to flush renal toxins and support ocular health.",
    te: "కంటి చూపును మెరుగుపరిచే విటమిన్ ఎ మరియు శరీరానికి అవసరమైన పొటాషియం అందించి కిడ్నీల ఆరోగ్యానికి తోడ్పడుతుంది.",
  },
  "kharbhuja": {
    en: "Deeply hydrating melon rich in beta-carotene (Vitamin A) and potassium to flush renal toxins and support ocular health.",
    te: "కంటి చూపును మెరుగుపరిచే విటమిన్ ఎ మరియు శరీరానికి అవసరమైన పొటాషియం అందించి కిడ్నీల ఆరోగ్యానికి తోడ్పడుతుంది.",
  },
  "dragon fruit": {
    en: "Rich in betacyanin antioxidants, iron & prebiotic fibers that nourish healthy bifidobacteria in the gut microbiome.",
    te: "బీటాసయానిన్ మరియు ప్రీబయోటిక్స్ పేగులోని మంచి బ్యాక్టీరియాను పెంచి సంపూర్ణ రోగనిరోధక శక్తినిస్తాయి.",
  },
  "custard apple": {
    en: "High in Vitamin B6, magnesium, and dietary fiber that support nervous system calmness & natural cardiac rhythm.",
    te: "విటమిన్ బి6 మరియు మెగ్నీషియం నరాల వ్యవస్థను ప్రశాంతంగా ఉంచి, గుండె స్పందనను క్రమబద్ధీకరిస్తాయి.",
  },
  "sitaphal": {
    en: "High in Vitamin B6, magnesium, and dietary fiber that support nervous system calmness & natural cardiac rhythm.",
    te: "విటమిన్ బి6 మరియు మెగ్నీషియం నరాల వ్యవస్థను ప్రశాంతంగా ఉంచి, గుండె స్పందనను క్రమబద్ధీకరిస్తాయి.",
  },
  "watermelon": {
    en: "92% hydrating lycopene & L-citrulline fruit that improves vascular blood flow and accelerates post-workout recovery.",
    te: "లైకోపీన్ మరియు ఎల్-సిట్రులిన్ రక్త ప్రసరణను మెరుగుపరిచి శరీరానికి తక్షణ చలువ, నీటి సమతుల్యతను అందిస్తాయి.",
  },
  "mango": {
    en: "Contains mangiferin, amylase digestive enzymes, and Vitamin A for robust cellular immunity and gastrointestinal health.",
    te: "మాంగిఫెరిన్ మరియు సహజ ఎంజైములు రోగనిరోధక శక్తిని మరియు జీర్ణవ్యవస్థను పటిష్టం చేస్తాయి.",
  },

  // ==================== VEGETABLES ====================
  "garlic": {
    en: "Active allicin & diallyl sulfides promote arterial flexibility, lower vascular resistance & optimize LDL cholesterol.",
    te: "అల్లిసిన్ రక్తనాళాల స్థితిస్థాపకతను పెంచి, అధిక రక్తపోటు మరియు కొలెస్ట్రాల్‌ను అదుపులో ఉంచుతుంది.",
  },
  "vellulli": {
    en: "Active allicin & diallyl sulfides promote arterial flexibility, lower vascular resistance & optimize LDL cholesterol.",
    te: "అల్లిసిన్ రక్తనాళాల స్థితిస్థాపకతను పెంచి, అధిక రక్తపోటు మరియు కొలెస్ట్రాల్‌ను అదుపులో ఉంచుతుంది.",
  },
  "ginger": {
    en: "Rich in gingerols and shogaols that accelerate gastric emptying, eliminate nausea, relieve bloating & fight inflammation.",
    te: "జింజరాల్స్ జీర్ణక్రియను వేగవంతం చేసి, గ్యాస్, అసిడిటీ మరియు శరీరంలో వాపులను నివారిస్తాయి.",
  },
  "allam": {
    en: "Rich in gingerols and shogaols that accelerate gastric emptying, eliminate nausea, relieve bloating & fight inflammation.",
    te: "జింజరాల్స్ జీర్ణక్రియను వేగవంతం చేసి, గ్యాస్, అసిడిటీ మరియు శరీరంలో వాపులను నివారిస్తాయి.",
  },
  "bitter gourd": {
    en: "Contains charantin, vicine & polypeptide-p that function as plant-derived insulin mimetics to maintain healthy HbA1c levels.",
    te: "చారంటిన్ మరియు పాలీపెప్టైడ్-పి సహజ ఇన్సులిన్ లాగా పనిచేసి రక్తంలో చక్కెర స్థాయిలను అదుపులో ఉంచుతాయి.",
  },
  "kakarakaya": {
    en: "Contains charantin, vicine & polypeptide-p that function as plant-derived insulin mimetics to maintain healthy HbA1c levels.",
    te: "చారంటిన్ మరియు పాలీపెప్టైడ్-పి సహజ ఇన్సులిన్ లాగా పనిచేసి రక్తంలో చక్కెర స్థాయిలను అదుపులో ఉంచుతాయి.",
  },
  "karela": {
    en: "Contains charantin, vicine & polypeptide-p that function as plant-derived insulin mimetics to maintain healthy HbA1c levels.",
    te: "చారంటిన్ మరియు పాలీపెప్టైడ్-పి సహజ ఇన్సులిన్ లాగా పనిచేసి రక్తంలో చక్కెర స్థాయిలను అదుపులో ఉంచుతాయి.",
  },
  "ridge gourd": {
    en: "Ultra-low in calories and dense in insoluble cellulose fiber to promote smooth bowel motility & healthy weight balance.",
    te: "తక్కువ కేలరీలు మరియు అధిక పీచు పదార్థం కలిగి ఉండి, జీర్ణక్రియకు మరియు బరువు నియంత్రణకు ఎంతో మేలు చేస్తుంది.",
  },
  "beerakaya": {
    en: "Ultra-low in calories and dense in insoluble cellulose fiber to promote smooth bowel motility & healthy weight balance.",
    te: "తక్కువ కేలరీలు మరియు అధిక పీచు పదార్థం కలిగి ఉండి, జీర్ణక్రియకు మరియు బరువు నియంత్రణకు ఎంతో మేలు చేస్తుంది.",
  },
  "bottlegaurd": {
    en: "92% moisture and soluble dietary fiber that cools the gastrointestinal tract, supports liver detoxification & regulates BP.",
    te: "శరీరానికి చలువ చేసి, కాలేయ ఆరోగ్యానికి, జీర్ణవ్యవస్థకు మరియు రక్తపోటు నియంత్రణకు తోడ్పడుతుంది.",
  },
  "bottle gourd": {
    en: "92% moisture and soluble dietary fiber that cools the gastrointestinal tract, supports liver detoxification & regulates BP.",
    te: "శరీరానికి చలువ చేసి, కాలేయ ఆరోగ్యానికి, జీర్ణవ్యవస్థకు మరియు రక్తపోటు నియంత్రణకు తోడ్పడుతుంది.",
  },
  "sorakaya": {
    en: "92% moisture and soluble dietary fiber that cools the gastrointestinal tract, supports liver detoxification & regulates BP.",
    te: "శరీరానికి చలువ చేసి, కాలేయ ఆరోగ్యానికి, జీర్ణవ్యవస్థకు మరియు రక్తపోటు నియంత్రణకు తోడ్పడుతుంది.",
  },
  "tindora": {
    en: "Low glycemic vegetable packed with anti-glycemic flavonoids that blunt post-meal blood glucose spikes.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ కలిగి ఉండి, భోజనం తర్వాత గ్లూకోజ్ పెరగకుండా నివారిస్తుంది.",
  },
  "dondakaya": {
    en: "Low glycemic vegetable packed with anti-glycemic flavonoids that blunt post-meal blood glucose spikes.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ కలిగి ఉండి, భోజనం తర్వాత గ్లూకోజ్ పెరగకుండా నివారిస్తుంది.",
  },
  "brinjal": {
    en: "Rich in nasunin anthocyanins that protect brain cell membranes from lipid peroxidation & support healthy lipid metabolism.",
    te: "మెదడు కణాలను రక్షించే మరియు కొలెస్ట్రాల్‌ను సమతుల్యం చేసే నాసునిన్ యాంటీఆక్సిడెంట్లు సమృద్ధిగా ఉంటాయి.",
  },
  "vankaya": {
    en: "Rich in nasunin anthocyanins that protect brain cell membranes from lipid peroxidation & support healthy lipid metabolism.",
    te: "మెదడు కణాలను రక్షించే మరియు కొలెస్ట్రాల్‌ను సమతుల్యం చేసే నాసునిన్ యాంటీఆక్సిడెంట్లు సమృద్ధిగా ఉంటాయి.",
  },
  "beetroot": {
    en: "Natural dietary inorganic nitrates enhance mitochondrial ATP efficiency, vasodilation & cardiovascular endurance.",
    te: "సహజ నైట్రేట్స్ రక్తనాళాలను విస్తరింపజేసి రక్త ప్రసరణను మెరుగుపరుస్తాయి, శక్తిని పెంచుతాయి.",
  },
  "tomatoes": {
    en: "High in cellular-protective lycopene and bioavailable Vitamin C for arterial integrity, glowing skin & immune vitality.",
    te: "లైకోపీన్ మరియు విటమిన్ సి గుండె మరియు చర్మ ఆరోగ్యానికి పూర్తి రక్షణగా నిలుస్తాయి.",
  },
  "tomato": {
    en: "High in cellular-protective lycopene and bioavailable Vitamin C for arterial integrity, glowing skin & immune vitality.",
    te: "లైకోపీన్ మరియు విటమిన్ సి గుండె మరియు చర్మ ఆరోగ్యానికి పూర్తి రక్షణగా నిలుస్తాయి.",
  },
  "lady finger": {
    en: "Abundant soluble mucilage fiber binds excess bile acids in the intestine, optimizing cholesterol & nourishing gut flora.",
    te: "సహజ పీచు పదార్థం కొలెస్ట్రాల్‌ను తగ్గించి, జీర్ణక్రియను మరియు పేగు ఆరోగ్యాన్ని మెరుగుపరుస్తుంది.",
  },
  "okra": {
    en: "Abundant soluble mucilage fiber binds excess bile acids in the intestine, optimizing cholesterol & nourishing gut flora.",
    te: "సహజ పీచు పదార్థం కొలెస్ట్రాల్‌ను తగ్గించి, జీర్ణక్రియను మరియు పేగు ఆరోగ్యాన్ని మెరుగుపరుస్తుంది.",
  },
  "bendakaya": {
    en: "Abundant soluble mucilage fiber binds excess bile acids in the intestine, optimizing cholesterol & nourishing gut flora.",
    te: "సహజ పీచు పదార్థం కొలెస్ట్రాల్‌ను తగ్గించి, జీర్ణక్రియను మరియు పేగు ఆరోగ్యాన్ని మెరుగుపరుస్తుంది.",
  },
  "spinach": {
    en: "Dense in dietary nitrates, non-heme iron, lutein & folate for healthy hemoglobin synthesis and retinal macular protection.",
    te: "ఐరన్, ఫోలేట్ మరియు ల్యూటీన్ రక్తకణాల ఉత్పత్తికి మరియు కంటి ఆరోగ్యానికి ఎంతో మేలు చేస్తాయి.",
  },
  "palak": {
    en: "Dense in dietary nitrates, non-heme iron, lutein & folate for healthy hemoglobin synthesis and retinal macular protection.",
    te: "ఐరన్, ఫోలేట్ మరియు ల్యూటీన్ రక్తకణాల ఉత్పత్తికి మరియు కంటి ఆరోగ్యానికి ఎంతో మేలు చేస్తాయి.",
  },
  "green chilli": {
    en: "Natural capsaicin revs up metabolic thermogenesis, supports healthy calorie burning & provides high bioflavonoids.",
    te: "సహజ క్యాప్సైసిన్ జీవక్రియను వేగవంతం చేసి శక్తిని అందిస్తుంది.",
  },
  "mirchi": {
    en: "Natural capsaicin revs up metabolic thermogenesis, supports healthy calorie burning & provides high bioflavonoids.",
    te: "సహజ క్యాప్సైసిన్ జీవక్రియను వేగవంతం చేసి శక్తిని అందిస్తుంది.",
  },
  "capsicum": {
    en: "Dense in Vitamin C, capsanthin & bioflavonoids that accelerate collagen formation and promote metabolic efficiency.",
    te: "నారింజ కంటే ఎక్కువ విటమిన్-సి కలిగి ఉండి, రోగనిరోధక శక్తిని మరియు కొల్లాజెన్ ఉత్పత్తిని పెంచుతుంది.",
  },
  "carrot": {
    en: "Rich in beta-carotene provitamin A and lutein that defend retinal photoreceptors and support mucosal barrier immunity.",
    te: "బీటా-కెరోటిన్ కంటి చూపును మెరుగుపరిచి శరీర రోగనిరోధక శక్తిని పటిష్టం చేస్తుంది.",
  },
  "potato": {
    en: "Clean source of potassium, prebiotic resistant starch, and Vitamin B6 for sustained glycogen replenishment.",
    te: "పొటాషియం మరియు విటమిన్ బి6 సమృద్ధిగా ఉండి శరీరానికి అవసరమైన స్థిరమైన శక్తిని అందిస్తాయి.",
  },
  "onion": {
    en: "Rich in quercetin bioflavonoids and inulin prebiotic fibers that defend vascular integrity and nourish gut bifidobacteria.",
    te: "క్వెర్సెటిన్ గుండె రక్తనాళాల ఆరోగ్యానికి మరియు సహజ రోగనిరోధక శక్తికి విశేషంగా తోడ్పడుతుంది.",
  },
  "weekly fresh box": {
    en: "Curated assortment of farm-harvested organic vegetables delivering a complete spectrum of micronutrients for the family.",
    te: "వారానికి సరిపడా తాజా సేంద్రీయ కూరగాయల ప్రత్యేక కాంబో బాక్స్, సంపూర్ణ పోషకాహారాన్ని అందిస్తుంది.",
  },

  // ==================== MILLETS (SIRIDHANYALU) ====================
  "foxtail millet": {
    en: "Low Glycemic Index (~50) cereal rich in beta-glucan fiber and magnesium that blunts insulin spikes and clears LDL.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ (GI ~50) కలిగిన సిరిధాన్యాలు షుగర్ నియంత్రణకు మరియు కొలెస్ట్రాల్ తగ్గింపుకు ఉత్తమం.",
  },
  "korralu": {
    en: "Low Glycemic Index (~50) cereal rich in beta-glucan fiber and magnesium that blunts insulin spikes and clears LDL.",
    te: "తక్కువ గ్లైసెమిక్ ఇండెక్స్ (GI ~50) కలిగిన సిరిధాన్యాలు షుగర్ నియంత్రణకు మరియు కొలెస్ట్రాల్ తగ్గింపుకు ఉత్తమం.",
  },
  "finger millet": {
    en: "Richest grain calcium source (344mg/100g) for solid bone density, maternal vitality & preventing osteoporosis.",
    te: "అత్యధిక కాల్షియం (344mg/100g) ఎముకల పుష్టికి, పిల్లల ఎదుగుదలకు మరియు మహిళల ఆరోగ్యానికి ఎంతో మేలు చేస్తుంది.",
  },
  "ragi": {
    en: "Richest grain calcium source (344mg/100g) for solid bone density, maternal vitality & preventing osteoporosis.",
    te: "అత్యధిక కాల్షియం (344mg/100g) ఎముకల పుష్టికి, పిల్లల ఎదుగుదలకు మరియు మహిళల ఆరోగ్యానికి ఎంతో మేలు చేస్తుంది.",
  },
  "pearl millet": {
    en: "High iron (8mg/100g) & magnesium content that fights anemia, supports hemoglobin & powers sustained physical stamina.",
    te: "ఐరన్ మరియు మెగ్నీషియం పుష్కలంగా ఉండి రక్తహీనతను నివారించి శరీరానికి విశేష బలాన్నిస్తాయి.",
  },
  "bajra": {
    en: "High iron (8mg/100g) & magnesium content that fights anemia, supports hemoglobin & powers sustained physical stamina.",
    te: "ఐరన్ మరియు మెగ్నీషియం పుష్కలంగా ఉండి రక్తహీనతను నివారించి శరీరానికి విశేష బలాన్నిస్తాయి.",
  },

  // ==================== PULSES & GRAINS ====================
  "toor dal": {
    en: "Clean plant protein and folic acid that support muscle protein synthesis, DNA repair & homocysteine management.",
    te: "స్వచ్ఛమైన ప్రోటీన్ మరియు ఫోలిక్ యాసిడ్ కండరాల పుష్టికి మరియు రక్త శుద్ధికి ఎంతో అవసరం.",
  },
  "kandi pappu": {
    en: "Clean plant protein and folic acid that support muscle protein synthesis, DNA repair & homocysteine management.",
    te: "స్వచ్ఛమైన ప్రోటీన్ మరియు ఫోలిక్ యాసిడ్ కండరాల పుష్టికి మరియు రక్త శుద్ధికి ఎంతో అవసరం.",
  },
  "moong dal": {
    en: "Lightest, easiest-to-digest pulse rich in bioactive peptides that support metabolic balance without gastric bloating.",
    te: "సులభంగా జీర్ణమయ్యే ప్రోటీన్ శరీరానికి తేలికగా శక్తిని అందించి జీర్ణక్రియను కాపాడుతుంది.",
  },
  "pesara pappu": {
    en: "Lightest, easiest-to-digest pulse rich in bioactive peptides that support metabolic balance without gastric bloating.",
    te: "సులభంగా జీర్ణమయ్యే ప్రోటీన్ శరీరానికి తేలికగా శక్తిని అందించి జీర్ణక్రియను కాపాడుతుంది.",
  },
  "chana dal": {
    en: "Slow-release complex amylose carbohydrates and high fiber for prolonged satiety and stable post-prandial glycemic response.",
    te: "నెమ్మదిగా జీర్ణమై ఎక్కువ సమయం ఆకలి వేయకుండా చూసే నాణ్యమైన ప్రోటీన్ ఆహారం.",
  },
  "senaga pappu": {
    en: "Slow-release complex amylose carbohydrates and high fiber for prolonged satiety and stable post-prandial glycemic response.",
    te: "నెమ్మదిగా జీర్ణమై ఎక్కువ సమయం ఆకలి వేయకుండా చూసే నాణ్యమైన ప్రోటీన్ ఆహారం.",
  },

  // ==================== SPICES & CONDIMENTS ====================
  "turmeric powder": {
    en: "Contains 5%+ natural curcumin that provides clinical anti-inflammatory and cellular antioxidant defense.",
    te: "శక్తివంతమైన కర్క్యుమిన్ శరీరానికి సహజ రోగనిరోధక రక్షణ కల్పించి అంతర్గత వాపులను నివారిస్తుంది.",
  },
  "pasupu": {
    en: "Contains 5%+ natural curcumin that provides clinical anti-inflammatory and cellular antioxidant defense.",
    te: "శక్తివంతమైన కర్క్యుమిన్ శరీరానికి సహజ రోగనిరోధక రక్షణ కల్పించి అంతర్గత వాపులను నివారిస్తుంది.",
  },
  "red chilli powder": {
    en: "Stone-ground Guntur chillies rich in natural capsaicin for authentic Andhra flavor & metabolic stimulation.",
    te: "సహజ ఘాటు మరియు క్యాప్సైసిన్ జీవక్రియను వేగవంతం చేసి సహజ శక్తినిస్తాయి.",
  },
  "coriander powder": {
    en: "Rich in aromatic linalool & cineole that promote smooth digestion, ease gastric spasms & provide cooling digestive aid.",
    te: "జీర్ణక్రియను మెరుగుపరిచి కడుపులో మంటను తగ్గించే సహజ ధనియాల పొడి.",
  },

  // ==================== PICKLES & FERMENTS ====================
  "mango pickle": {
    en: "Traditional homemade Andhra Avakaya cured in cold-pressed gingelly oil with zero chemical preservatives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన నిల్వ పచ్చడి.",
  },
  "avakaya": {
    en: "Traditional homemade Andhra Avakaya cured in cold-pressed gingelly oil with zero chemical preservatives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన నిల్వ పచ్చడి.",
  },
  "gongura pickle": {
    en: "Authentic Andhra Gongura rich in iron and Vitamin C that promotes digestion & supports healthy gut microflora.",
    te: "ఐరన్ మరియు విటమిన్ సి సమృద్ధిగా ఉన్న ఆంధ్ర సాంప్రదాయ గోంగూర పచ్చడి.",
  },
  "chicken pickle": {
    en: "High-protein country chicken slow-cooked with freshly roasted native spices & pure cold-pressed oil.",
    te: "స్వచ్ఛమైన నూనె, నాణ్యమైన నాటుకోడి మాంసంతో తయారుచేసిన ప్రోటీన్ సమృద్ధ పచ్చడి.",
  },
  "mutton pickle": {
    en: "Rich gourmet mutton pickle prepared with authentic homemade spice blends & tender cuts in unrefined oil.",
    te: "ఘుమఘుమలాడే మసాలాలతో స్వచ్ఛమైన నూనెలో తయారుచేసిన స్పెషల్ మటన్ పచ్చడి.",
  },
  "prawn pickle": {
    en: "Fresh coastal prawns curated with aromatic spices, providing lean protein & Omega-3 fatty acids.",
    te: "తాజా రొయ్యలతో స్వచ్ఛమైన నూనెలో తయారుచేసిన రుచికరమైన సాంప్రదాయ పచ్చడి.",
  },
  "lemon pickle": {
    en: "Aged in sunlight with pure sea salt; stimulates digestive enzymes and relieves gastric heaviness.",
    te: "ఎండలో పక్వానికి వచ్చిన నిమ్మకాయలు జీర్ణ ఎంజైములను ఉత్తేజపరిచి అజీర్తిని తొలగిస్తాయి.",
  },

  // ==================== SWEETS & SNACKS ====================
  "boondi laddu": {
    en: "Handcrafted with 100% pure desi cow ghee and natural unrefined sweetness for wholesome festive nutrition.",
    te: "100% స్వచ్ఛమైన దేశీ ఆవు నెయ్యితో చేతితో చేసిన సాంప్రదాయ తియ్యని బూందీ లడ్డూ.",
  },
  "kaju katli": {
    en: "Made from premium grade whole cashews providing healthy monounsaturated fats & natural magnesium.",
    te: "నాణ్యమైన జీడిపప్పు మరియు స్వచ్ఛమైన నెయ్యితో చేసిన పోషకభరిత కాజూ కత్లీ.",
  },
  "mysore pak": {
    en: "Melt-in-mouth traditional delicacy rich in pure desi cow ghee and aromatic roasted gram flour.",
    te: "నోట్లో వేస్తే కరిగిపోయే స్వచ్ఛమైన నెయ్యి మరియు శనగపిండితో చేసిన సాంప్రదాయ మైసూర్ పాక్.",
  },
  "special mixture": {
    en: "Crunchy tea-time savory spiced with fresh curry leaves and roasted peanuts in cold-pressed oil.",
    te: "తాజా కరివేపాకు, పల్లీలతో వేయించిన కరకరలాడే స్పెషల్ మిక్చర్.",
  },
  "murukku": {
    en: "Crispy rice & dal savory prepared with traditional hand-press techniques and pure cold-pressed oils.",
    te: "బియ్యప్పిండి మరియు పప్పులతో చేసిన కరకరలాడే సాంప్రదాయ జంతికలు.",
  },
};

// General Category Taxonomy Fallbacks for any new/future product
const CATEGORY_BENEFIT_MAP: Record<string, { en: string; te: string }> = {
  "vegetables": {
    en: "100% pesticide-free organic harvest dense in dietary fiber, bioactive minerals & cellular phytonutrients.",
    te: "రసాయనాలు లేని తాజా సేంద్రీయ కూరగాయలు సంపూర్ణ పోషణను, పీచు పదార్థాలను అందిస్తాయి.",
  },
  "fruits": {
    en: "Tree-ripened organic fruit providing bioavailable vitamins, active polyphenols & vital cellular hydration.",
    te: "సహజంగా పండిన పండ్లు విటమిన్లు, యాంటీఆక్సిడెంట్లు మరియు సహజ శక్తిని అందిస్తాయి.",
  },
  "pickles": {
    en: "Artisanally crafted in small batches with pure cold-pressed oils & sun-dried native spices with zero chemical preservatives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన రసాయనాలు లేని నిల్వ పచ్చళ్ళు.",
  },
  "pickles-veg": {
    en: "Artisanally crafted in small batches with pure cold-pressed oils & sun-dried native spices with zero chemical preservatives.",
    te: "స్వచ్ఛమైన గానుగ నూనెతో సంప్రదాయ పద్ధతిలో తయారుచేసిన రసాయనాలు లేని నిల్వ పచ్చళ్ళు.",
  },
  "pickles-non-veg": {
    en: "High-protein gourmet meat pickles cured in cold-pressed gingelly oil with aromatic hand-ground spice blends.",
    te: "స్వచ్ఛమైన నూనె, నాణ్యమైన మాంసంతో చేసిన ప్రోటీన్ సమృద్ధ సంప్రదాయ పచ్చళ్ళు.",
  },
  "millets": {
    en: "Ancient unpolished Siridhanyalu grains with low Glycemic Index and dense micronutrients for sustained energy & wellness.",
    te: "ఆరోగ్యానికి మేలు చేసే అసలైన సిరిధాన్యాలు, తక్కువ GI మరియు సమృద్ధిగా పీచు పదార్థాలు.",
  },
  "pulses": {
    en: "Unpolished, protein-rich legumes that supply essential amino acids, non-heme iron & muscle-building nutrition.",
    te: "పొట్టు తీయని స్వచ్ఛమైన పప్పు దినుసులు కండరాల పుష్టికి మరియు ఆరోగ్యానికి ఉత్తమం.",
  },
  "spices": {
    en: "Sun-dried and stone-ground pure native spices rich in active essential oils that stimulate metabolism & immunity.",
    te: "స్వచ్ఛమైన సుగంధ ద్రవ్యాలు రోగనిరోధక శక్తిని మరియు జీర్ణక్రియను పెంచుతాయి.",
  },
  "homemade-sweets": {
    en: "Traditional homemade sweets handcrafted with 100% pure desi cow ghee & natural unrefined sweeteners.",
    te: "100% స్వచ్ఛమైన దేశీ ఆవు నెయ్యితో చేసిన సాంప్రదాయ తియ్యని మిఠాయిలు.",
  },
  "sweets": {
    en: "Traditional homemade sweets handcrafted with 100% pure desi cow ghee & natural unrefined sweeteners.",
    te: "100% స్వచ్ఛమైన దేశీ ఆవు నెయ్యితో చేసిన సాంప్రదాయ తియ్యని మిఠాయిలు.",
  },
  "namkeen": {
    en: "Authentic savories crafted with pure cold-pressed groundnut oil, unrefined flours, and roasted native spices.",
    te: "గానుగ నూనెలో వేయించిన రుచికరమైన సాంప్రదాయ కరకరలాడే తినుబండారాలు.",
  },
  "snacks": {
    en: "Authentic savories crafted with pure cold-pressed groundnut oil, unrefined flours, and roasted native spices.",
    te: "గానుగ నూనెలో వేయించిన రుచికరమైన సాంప్రదాయ కరకరలాడే తినుబండారాలు.",
  },
  "oils": {
    en: "100% pure wood-pressed (ghani) unrefined oil rich in natural MUFA/PUFA & heart-healthy phytosterols.",
    te: "స్వచ్ఛమైన చెక్క గానుగ నూనె, గుండె ఆరోగ్యానికి మరియు సంపూర్ణ శరీర పుష్టికి ఉత్తమం.",
  },
};

/**
 * Resolve why a product is suggested and how it is useful to the customer.
 * Uses smart multi-token fuzzy matching to automatically match future products.
 */
export function resolveProductBenefit(productName: string, categorySlug?: string): { reasonEn: string; reasonTe: string } {
  const pLower = (productName || "").toLowerCase().trim();
  if (!pLower) {
    return {
      reasonEn: "100% naturally grown organic farm produce delivering pure, wholesome nutrition.",
      reasonTe: "రసాయనాలు లేని స్వచ్ఛమైన సేంద్రీయ ఉత్పత్తి, సంపూర్ణ ఆరోగ్యానికి తోడ్పడుతుంది.",
    };
  }

  // 1. Direct key match
  if (PRODUCE_BENEFIT_MAP[pLower]) {
    return { reasonEn: PRODUCE_BENEFIT_MAP[pLower].en, reasonTe: PRODUCE_BENEFIT_MAP[pLower].te };
  }

  // 2. Substring & keyword match in produce map
  for (const [key, benefit] of Object.entries(PRODUCE_BENEFIT_MAP)) {
    if (pLower.includes(key) || key.includes(pLower)) {
      return { reasonEn: benefit.en, reasonTe: benefit.te };
    }
  }

  // 3. Token-level stem matching (handles plurals, adjectives like "Organic Fresh Totapuri Mangoes")
  const tokens = pLower.split(/[\s,()\[\]\/-]+/).filter(t => t.length >= 3);
  for (const token of tokens) {
    const stem = token.replace(/(?:ing|ies|es|s|ed|ly)$/, '');
    for (const [key, benefit] of Object.entries(PRODUCE_BENEFIT_MAP)) {
      if (key.includes(stem) || stem.includes(key)) {
        return { reasonEn: benefit.en, reasonTe: benefit.te };
      }
    }
  }

  // 4. Category-level taxonomy match
  const catKey = (categorySlug || "").toLowerCase().trim();
  if (catKey && CATEGORY_BENEFIT_MAP[catKey]) {
    return { reasonEn: CATEGORY_BENEFIT_MAP[catKey].en, reasonTe: CATEGORY_BENEFIT_MAP[catKey].te };
  }

  for (const [cat, catBenefit] of Object.entries(CATEGORY_BENEFIT_MAP)) {
    if (catKey.includes(cat) || pLower.includes(cat)) {
      return { reasonEn: catBenefit.en, reasonTe: catBenefit.te };
    }
  }

  // 5. Ultimate organic fallback
  return {
    reasonEn: "100% naturally grown organic farm produce offering pristine daily nutrition and rich natural vitality.",
    reasonTe: "రసాయనాలు లేని స్వచ్ఛమైన సేంద్రీయ ఉత్పత్తి, సంపూర్ణ ఆరోగ్యానికి తోడ్పడుతుంది.",
  };
}
