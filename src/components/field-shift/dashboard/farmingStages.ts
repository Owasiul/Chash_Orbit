// Farming stages generator for Crop Workspace
// Provides actionable agronomic advice for the 5 sequential farming planner stages:
// 1. Land preparation
// 2. Seed selection and planting
// 3. Fertilizer and irrigation schedule
// 4. Growth-stage monitoring
// 5. Harvesting recommendations

export interface FarmingStage {
  step: number;
  title: string;
  subtitle: string;
  duration: string;
  criticalFocus: string;
  tasks: string[];
  tips: string[];
}

export function getCropFarmingStages(
  cropName: string,
  soilType = 'clay-loam',
  irrigation = 'limited'
): FarmingStage[] {
  const c = cropName.toLowerCase();

  if (c.includes('rice') || c.includes('paddy')) {
    return [
      {
        step: 1,
        title: 'Land preparation',
        subtitle: 'Puddling, bund stabilization, and organic incorporation',
        duration: '10–14 days before transplanting',
        criticalFocus: 'Moisture retention & weed seed destruction',
        tasks: [
          'Plough 2–3 times followed by flooding and puddling to break large clods and create an impermeable sub-layer.',
          `Incorporate 8–10 tonnes/ha of well-decomposed farmyard manure (FYM) into the ${soilType} soil.`,
          'Repair, raise, and plaster peripheral field bunds to minimize seepage and hold 3–5 cm water.',
          'Level the field thoroughly with a laser land leveler or wooden plank to ensure uniform water depth.',
        ],
        tips: [
          'Well-puddled soil cuts percolation water loss by up to 40%.',
          'Add zinc sulfate (25 kg/ha) during final land prep if cultivating high-yield cultivars.',
        ],
      },
      {
        step: 2,
        title: 'Seed selection and planting',
        subtitle: 'Nursery raising, certified cultivar selection, and transplanting',
        duration: 'Days 0–25',
        criticalFocus: 'Optimum seedling age & planting density',
        tasks: [
          'Select certified high-yielding or climate-resilient varieties suited for the season.',
          'Soak seeds in salt solution to eliminate lightweight seeds, then treat with carbendazim (2g/kg).',
          'Transplant 20–25 day-old healthy seedlings at 20 cm × 15 cm spacing with 2–3 seedlings per hill.',
          'Ensure shallow transplanting (2–3 cm depth) for rapid root establishment and maximum tillering.',
        ],
        tips: [
          'Overaged seedlings (>30 days) reduce effective tillering and ultimate panicle count.',
          'For direct-seeded rice (DSR), sow at 20 cm row spacing with calibrated seed drill.',
        ],
      },
      {
        step: 3,
        title: 'Fertilizer and irrigation schedule',
        subtitle: 'Split NPK application and water level management',
        duration: 'Vegetative to heading phases',
        criticalFocus: 'Nutrient-use efficiency & critical-stage hydration',
        tasks: [
          'Basal dose: Apply 50% Nitrogen, 100% Phosphorus (TSP), and 66% Potassium (MOP) before final harrowing.',
          '1st top dressing: Apply 25% Nitrogen at early tillering (15–20 days after transplanting).',
          '2nd top dressing: Apply remaining 25% Nitrogen + 34% Potassium at panicle initiation (40–45 DAT).',
          irrigation === 'rainfed'
            ? 'Conserve rainwater by maintaining bund integrity; practice alternate wetting and drying if rains pause.'
            : 'Maintain 2–3 cm shallow standing water during tillering; increase to 5 cm during heading and flowering.',
        ],
        tips: [
          'Never apply top-dressed nitrogen on standing ponded water; apply to drained surface and flood 24h later.',
          'Withhold irrigation 10–12 days prior to expected harvest to facilitate machine access and uniform drying.',
        ],
      },
      {
        step: 4,
        title: 'Growth-stage monitoring',
        subtitle: 'Canopy inspection, pest scouting, and weed mitigation',
        duration: 'Throughout active growth',
        criticalFocus: 'Stem borer, blast resistance & weed suppression',
        tasks: [
          'First weeding at 18–20 DAT and second weeding at 35–40 DAT, or apply early post-emergence herbicide.',
          'Monitor light traps and foliage for Yellow Stem Borer, Brown Planthopper, and Bacterial Leaf Blight.',
          'Apply neem-based bio-repellents or approved fungicide immediately if blast spindle lesions appear on leaf tips.',
          'Check root zone aeration and drain ponded water for 48 hours mid-season to invigorate root respiration.',
        ],
        tips: [
          'BPH (Brown Planthopper) thrives in excessive nitrogen; avoid nitrogen over-application.',
          'Scout weekly around field edges where pest incursions typically begin.',
        ],
      },
      {
        step: 5,
        title: 'Harvesting recommendations',
        subtitle: 'Maturity assessment, grain drying, and storage protocol',
        duration: 'Maturity to post-harvest',
        criticalFocus: 'Grain moisture control & shatter minimization',
        tasks: [
          'Initiate harvest when 80–85% of grains on the panicles turn golden yellow and hard.',
          'Reap during sunny morning hours using sharp sickles or combine harvester to avoid shattering losses.',
          'Thresh immediately after harvesting to prevent discoloration and fungal heating in humid conditions.',
          'Sun-dry grains for 2–3 days until moisture content drops to 12–14% for long-term safe storage.',
        ],
        tips: [
          'Over-drying (<10% moisture) causes high milling breakage; under-drying (>14%) invites mold and storage pests.',
          'Store in hermetic bags (PICS bags) or clean bins elevated off the ground away from damp walls.',
        ],
      },
    ];
  }

  if (c.includes('wheat')) {
    return [
      {
        step: 1,
        title: 'Land preparation',
        subtitle: 'Deep plowing and pulverization for friable seedbed',
        duration: '1–2 weeks before sowing',
        criticalFocus: 'Conserving residual soil moisture & smooth seedbed',
        tasks: [
          'Plough 3–4 times followed by planking to create a fine, crumbly, and weed-free seedbed.',
          `Ensure adequate soil moisture before sowing; apply pre-sowing irrigation if ${soilType} is dry.`,
          'Incorporate 10 tonnes/ha organic manure along with basal phosphorus into the furrow slice.',
          'Level meticulously to prevent any localized water stagnation during subsequent winter irrigations.',
        ],
        tips: [
          'Wheat roots are sensitive to soil compaction; avoid heavy machinery passes on wet ground.',
          'Treat field with Trichoderma (5 kg/ha) if root rot or collar rot history exists.',
        ],
      },
      {
        step: 2,
        title: 'Seed selection and planting',
        subtitle: 'Optimal sowing window, certified seeds, and seed drill depth',
        duration: 'Days 0–10',
        criticalFocus: 'Timely sowing & uniform germination depth',
        tasks: [
          'Sow during the optimal window (mid to late November) to avoid terminal heat stress in late spring.',
          'Use certified high-yielding varieties with high 1,000-grain weight and heat tolerance.',
          'Seed rate: 100–120 kg/ha; calibrate seed-cum-fertilizer drill for 20 cm row spacing.',
          'Deposit seed at a consistent depth of 4–5 cm into moist soil layer for uniform emergence.',
        ],
        tips: [
          'Delaying sowing beyond December 1st causes an average yield loss of 30–40 kg/ha per day of delay.',
          'Treat seeds with Carboxin + Thiram (2.5 g/kg seed) to guard against loose smut.',
        ],
      },
      {
        step: 3,
        title: 'Fertilizer and irrigation schedule',
        subtitle: 'NPK management and critical growth stage irrigations',
        duration: 'CRI to grain development',
        criticalFocus: 'Crown Root Initiation (CRI) hydration',
        tasks: [
          'Apply basal fertilizer: 50% N + 100% P2O5 (60 kg/ha) + 100% K2O (40 kg/ha) during seeding.',
          '1st Critical Irrigation: At Crown Root Initiation (21–25 days after sowing) — the single most vital irrigation.',
          'Top dress first half of remaining N right after the CRI irrigation; second top dress at booting (60 DAS).',
          'Subsequent irrigations at tillering (40 DAS), late jointing (60 DAS), flowering (80 DAS), and milk stage (95 DAS).',
        ],
        tips: [
          'Never skip the CRI stage irrigation; missing it reduces tiller formation by 25–35%.',
          'Avoid heavy irrigation on windy days during grain filling to prevent severe crop lodging.',
        ],
      },
      {
        step: 4,
        title: 'Growth-stage monitoring',
        subtitle: 'Rust surveillance, weed eradication, and canopy inspection',
        duration: 'Vegetative to ripening',
        criticalFocus: 'Yellow rust prevention & broadleaf weed control',
        tasks: [
          'Apply post-emergence weedicide (Sulfosulfuron or Clodinafop) at 30–35 DAS after 1st irrigation.',
          'Inspect leaf blades weekly for yellow rust (stripe rust) pustules and brown leaf rust spots.',
          'Monitor for aphid colonies on the earheads during warm cloudy spells in late winter.',
          'Apply foliar spray of 1% potassium nitrate (KNO3) during late milk stage to combat sudden heat spells.',
        ],
        tips: [
          'Yellow rust develops rapidly under cool, humid overcast conditions; spray propiconazole upon first spot.',
          'Keep field borders free from wild canary grass and wild oats.',
        ],
      },
      {
        step: 5,
        title: 'Harvesting recommendations',
        subtitle: 'Physiological maturity indicators and grain threshing',
        duration: 'Ripening to storage',
        criticalFocus: 'Grain hardness & moisture content < 12%',
        tasks: [
          'Harvest when crop turns golden yellow, straw becomes brittle, and grains cannot be indented with a thumbnail.',
          'Conduct harvest preferably in the morning using combine harvester or reaper before full heat of the day.',
          'Dry harvested grain on clean tarpaulins for 2–3 days under direct sunlight.',
          'Store grain in dry, aerated, insect-proof metal bins or silos at <12% moisture level.',
        ],
        tips: [
          'Place dried neem leaves or celphos tablets inside storage containers to protect against granary weevils.',
          'Do not burn wheat stubble — incorporate into the soil with a rotavator to replenish organic carbon.',
        ],
      },
    ];
  }

  if (c.includes('potato')) {
    return [
      {
        step: 1,
        title: 'Land preparation',
        subtitle: 'Deep friable tillage and ridge-furrow layout',
        duration: '2–3 weeks before planting',
        criticalFocus: 'Soil looseness & aeration for tuber bulking',
        tasks: [
          'Plough deeply (20–25 cm) followed by 2–3 rotavator harrowings to achieve an ultra-fine, loose tilth.',
          `Incorporate heavy organic compost (15–20 tonnes/ha) into the ${soilType} to improve aeration.`,
          'Create broad ridges and furrows at 60 cm intervals to ensure elevated tuber formation beds.',
          'Ensure soil pH is within 5.5–6.5; avoid applying fresh lime immediately before planting to prevent scab.',
        ],
        tips: [
          'Loose, friable soil prevents malformed, deformed, or green tubers.',
          'Apply Trichoderma harzianum enriched compost to prevent Rhizoctonia stem canker.',
        ],
      },
      {
        step: 2,
        title: 'Seed selection and planting',
        subtitle: 'Sprouted seed tubers, sizing, and ridge placement',
        duration: 'Days 0–15',
        criticalFocus: 'Sprout health & certified seed vigor',
        tasks: [
          'Select certified disease-free seed tubers (35–50g size, 35–45 mm diameter) with 2–3 stout sprouts.',
          'Warm cold-stored tubers in diffused light for 7–10 days before planting until chitted sprouts appear.',
          'Dip tubers in mancozeb or carbendazim (2g/L) for 10 minutes and air dry in shade.',
          'Plant tubers on ridges at 60 cm row-to-row and 20–25 cm plant-to-plant spacing at 5–7 cm depth.',
        ],
        tips: [
          'Planting un-sprouted cold tubers directly from cold storage delays emergence by 15–20 days.',
          'Place tubers with sprouted eye buds facing upward for uniform emergence.',
        ],
      },
      {
        step: 3,
        title: 'Fertilizer and irrigation schedule',
        subtitle: 'High potash nutrition and regulated furrow moisture',
        duration: 'Emergence to bulking',
        criticalFocus: 'Earthing up & light frequent furrow watering',
        tasks: [
          'Basal fertilizer: Apply 50% N + 100% P2O5 (100 kg/ha) + 60% K2O (120 kg/ha) in the furrow below tubers.',
          'First earthing-up and top dressing (remaining N + K) at 30–35 days after planting (canopy height 15–20 cm).',
          'Second light earthing-up at 45–50 DAP to cover developing tubers and prevent greening from sunlight.',
          'Irrigate at 7–10 day intervals with light furrow flow; keep water level at half the ridge height.',
        ],
        tips: [
          'Never allow irrigation water to submerge the ridge top; tuber rot will trigger within 24 hours.',
          'Potassium is the chief driver of tuber size, starch content, and skin thickness.',
        ],
      },
      {
        step: 4,
        title: 'Growth-stage monitoring',
        subtitle: 'Late blight preventive alerts and aphid vectors',
        duration: 'Tuber initiation to maturity',
        criticalFocus: 'Late Blight (Phytophthora infestans) prevention',
        tasks: [
          'Begin preventive contact fungicide spray (Mancozeb 2.5g/L) before canopy closure or upon fog forecast.',
          'If late blight lesions (water-soaked dark spots with white fuzz) appear, switch to systemic fungicide.',
          'Install yellow sticky traps to track aphid vectors that transmit potato leaf roll virus (PLRV).',
          'Withhold irrigation 10–12 days prior to haulm cutting to allow skin firming.',
        ],
        tips: [
          'High humidity (>90%) with cool temperatures (12–18°C) is the danger zone for rapid late blight epidemics.',
          'Inspect the lower canopy foliage where humidity lingers first.',
        ],
      },
      {
        step: 5,
        title: 'Harvesting recommendations',
        subtitle: 'Dehaulming (vine cutting), curing, and cool grading',
        duration: 'Maturity to cold storage',
        criticalFocus: 'Skin setting through dehaulming & curing',
        tasks: [
          'Cut vines (dehaulm) 10–14 days before digging tubers; this hardens the tuber skin and stops virus migration.',
          'Harvest tubers carefully using potato digger or hand spades during clear dry weather.',
          'Avoid skinning or bruising tubers during picking; sort and discard cut, diseased, or green tubers immediately.',
          'Cure tubers in dark, well-ventilated sheds at 15–18°C and 85–90% RH for 10–14 days before storage.',
        ],
        tips: [
          'Curing thickens the periderm (skin) and heals micro-abrasions to block storage soft rot.',
          'Never expose harvested tubers to direct midday sun as it triggers solanine bitterness and greening.',
        ],
      },
    ];
  }

  if (c.includes('maize') || c.includes('corn')) {
    return [
      {
        step: 1,
        title: 'Land preparation',
        subtitle: 'Subsoiling, deep pulverization, and drainage furrows',
        duration: '10–15 days before planting',
        criticalFocus: 'Deep drainage & hardpan shattering',
        tasks: [
          'Deep plough (25 cm) to shatter hard compaction pans and facilitate deep maize taproot penetration.',
          `Form raised beds or ridges at 60 cm spacing, especially on ${soilType} prone to waterlogging.`,
          'Incorporate 10 tonnes/ha well-rotted compost and 25 kg/ha zinc sulfate into basal soil.',
          'Ensure laser leveling or gentle gradient to enable rapid furrow drainage during torrential rains.',
        ],
        tips: [
          'Maize seedlings cannot tolerate even 24 hours of ponded water without severe chlorosis and yield loss.',
          'Maintain loose, well-aerated soil for vigorous early root anchoring.',
        ],
      },
      {
        step: 2,
        title: 'Seed selection and planting',
        subtitle: 'Certified hybrid seeds, calibrated spacing, and planting depth',
        duration: 'Days 0–10',
        criticalFocus: 'Uniform plant population & precision depth',
        tasks: [
          'Select certified high-yielding single-cross hybrids suited to local agro-climatic zone.',
          'Seed rate: 20–22 kg/ha; treat seed with thiamethoxam + metalaxyl to guard against seedling pests.',
          'Plant seeds at 60 cm row spacing and 20 cm plant spacing on the side of the ridge.',
          'Place seed at a precise depth of 4–5 cm into moist soil layer.',
        ],
        tips: [
          'Uneven sowing depth creates uneven emergence, leading to stunted sub-dominant stalks.',
          'Aim for an optimum plant population of 65,000–75,000 plants per hectare.',
        ],
      },
      {
        step: 3,
        title: 'Fertilizer and irrigation schedule',
        subtitle: 'Heavy nitrogen regime and knee-high/silking hydration',
        duration: 'Knee-high to blister stages',
        criticalFocus: 'Tasseling & silking moisture sufficiency',
        tasks: [
          'Apply basal NPK (150:60:60 kg/ha formula): 25% N + 100% P2O5 + 50% K2O during final seedbed prep.',
          '1st top dressing: Apply 50% Nitrogen at knee-high stage (30–35 DAS) followed by earthing up.',
          '2nd top dressing: Apply remaining 25% Nitrogen + 50% K2O at tasseling/silking stage (55–60 DAS).',
          'Schedule critical irrigations at: (1) Knee-high, (2) Tasseling, (3) Silking, and (4) Grain filling.',
        ],
        tips: [
          'Moisture stress during 2 weeks before and after silking can slash grain yields by over 50%.',
          'Earthing up at knee-high stage provides brace root support to protect against crop lodging.',
        ],
      },
      {
        step: 4,
        title: 'Growth-stage monitoring',
        subtitle: 'Fall Armyworm (FAW) vigilance and weed-free period',
        duration: 'Vegetative to cob development',
        criticalFocus: 'Fall Armyworm scouting in central whorl',
        tasks: [
          'Maintain complete weed-free conditions during the critical 15–45 days after sowing.',
          'Scout central whorls weekly for Fall Armyworm (Spodoptera frugiperda) egg masses and pinhole frass.',
          'Apply bio-agent (Bacillus thuringiensis / Metarhizium) or approved insecticidal whorl granules upon early signs.',
          'Monitor for stem rot by inspecting lower stalk internodes during prolonged overcast warm spells.',
        ],
        tips: [
          'Direct spray or sand-lime mix right into the central whorl where FAW caterpillars hide.',
          'Avoid applying herbicides during hot windy afternoons to prevent leaf scorch.',
        ],
      },
      {
        step: 5,
        title: 'Harvesting recommendations',
        subtitle: 'Black layer check, cob husking, and mechanical shelling',
        duration: 'Maturity to storage',
        criticalFocus: 'Moisture reduction to 12% for aflatoxin prevention',
        tasks: [
          'Harvest when sheath leaves (husks) dry out completely and a distinct black abscission layer forms at kernel tip.',
          'Snap cobs from stalks on dry sunny days; de-husk immediately to prevent field fungal proliferation.',
          'Sun-dry un-shelled cobs for 3–5 days until grain moisture drops below 15% before shelling.',
          'After shelling, continue drying clean grain down to 12% moisture before hermetic storage.',
        ],
        tips: [
          'Storing maize above 14% moisture in warm tropical climates leads to dangerous aflatoxin contamination.',
          'Check stored grain monthly for maize weevil (Sitophilus zeamais) activity.',
        ],
      },
    ];
  }

  // Generic adaptive fallback for all other crops in FAO catalog
  return [
    {
      step: 1,
      title: 'Land preparation',
      subtitle: `Tillage, tilth refinement, and ${soilType} conditioning`,
      duration: '1–2 weeks prior to planting',
      criticalFocus: 'Seedbed aeration, organic matter, and weed elimination',
      tasks: [
        `Till and pulverize the topsoil (15–20 cm) to achieve optimal crumb structure suited for ${cropName}.`,
        `Incorporate well-decomposed organic manure (8–10 tonnes/ha) into the ${soilType} to bolster cation exchange.`,
        'Level the ground surface uniformly to ensure uniform irrigation distribution and prevent water pooling.',
        'Apply soil solarization or pre-plant bio-fungicides if soil-borne pathogens are historically present.',
      ],
      tips: [
        'A finely prepared seedbed ensures maximum seed-to-soil contact and uniform emergence.',
        'Adjust soil pH towards the crop’s optimal envelope before sowing.',
      ],
    },
    {
      step: 2,
      title: 'Seed selection and planting',
      subtitle: 'High-viability certified seed and calibrated geometry',
      duration: 'Days 0–14',
      criticalFocus: 'Seed germination percentage & optimum plant spacing',
      tasks: [
        'Procure certified high-germination (>85%) seeds or healthy disease-free vegetative cuttings/seedlings.',
        'Perform seed priming or bio-inoculant treatment (Rhizobium for pulses, Trichoderma for others).',
        'Sow or transplant at recommended row-to-row and plant-to-plant intervals matching the canopy profile.',
        'Deposit seeds at proper depth (2–3× seed diameter) into moist seedbed soil.',
      ],
      tips: [
        'Adhere strictly to the regional planting window to capture ideal temperature envelopes.',
        'Thin overcrowded seedlings early to reduce intraspecific competition for sunlight and nutrients.',
      ],
    },
    {
      step: 3,
      title: 'Fertilizer and irrigation schedule',
      subtitle: 'Balanced macronutrients, micro-dosing, and water efficiency',
      duration: 'Vegetative through reproductive stages',
      criticalFocus: 'Split nutrient feeding & critical phenological irrigation',
      tasks: [
        'Apply recommended basal NPK dose along with organic compost during final bed preparation.',
        'Split nitrogen applications to sync with peak vegetative uptake and flowering demand.',
        irrigation === 'reliable'
          ? 'Provide measured irrigations at key moisture-sensitive growth checkpoints (flowering, fruit/seed fill).'
          : 'Employ soil mulching to conserve moisture; provide supplementary irrigation during dry spells.',
        'Apply micronutrient foliar spray (Zinc, Boron, or Iron) if chlorosis symptoms appear on young foliage.',
      ],
      tips: [
        'Water during early morning or late afternoon to minimize evaporative losses.',
        'Avoid fertilizer runoff during forecasted heavy rain events.',
      ],
    },
    {
      step: 4,
      title: 'Growth-stage monitoring',
      subtitle: 'Integrated Pest Management (IPM) and physiological tracking',
      duration: 'Active vegetative to maturity',
      criticalFocus: 'Early pest/disease interception & canopy health',
      tasks: [
        'Conduct systematic field walk-throughs twice weekly to inspect upper and lower leaf surfaces.',
        'Maintain weed-free conditions during the critical early crop-weed competition period.',
        'Deploy pheromone traps, sticky cards, or bird perches as early ecological pest control lines.',
        'Use targeted bio-pesticides or approved selective sprays only when economic threshold levels are reached.',
      ],
      tips: [
        'Healthy well-nourished crops resist insect pressure far better than water-stressed crops.',
        'Keep records of scouting observations to anticipate recurring seasonal challenges.',
      ],
    },
    {
      step: 5,
      title: 'Harvesting recommendations',
      subtitle: 'Maturity signs, hygienic reaping, and safe moisture storage',
      duration: 'Maturity to warehouse',
      criticalFocus: 'Timely harvest, careful handling & safe moisture storage',
      tasks: [
        'Identify physiological maturity based on color change, firmness, moisture, and foliage dry-down.',
        'Harvest during dry, clear weather conditions to prevent post-harvest fungal spoilage.',
        'Handle harvested produce with care to avoid mechanical bruising, lacerations, or sun-scald.',
        'Dry grains/seeds to safe storage moisture (<12–14%) or clean and cool perishable produce immediately.',
      ],
      tips: [
        'Never store damp produce in non-ventilated enclosures.',
        'Grade and clean produce before marketing to command premium wholesale prices.',
      ],
    },
  ];
}
