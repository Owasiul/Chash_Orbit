'use client';

import * as React from 'react';

export type Locale = 'en' | 'bn';

const BENGALI_MESSAGES: Record<string, string> = {
  'Home': 'হোম',
  'Field': 'ক্ষেত্র',
  'Signals': 'সংকেত',
  'Crops': 'ফসল',
  'Planner': 'পরিকল্পনাকারী',
  'Compare': 'তুলনা',
  'Learn': 'জানুন',
  'Advisor': 'পরামর্শক',
  'Back to globe': 'গ্লোবে ফিরে যান',
  'Chash Orbit · NASA Earth-observation decision system · POWER · SMAP · GPM · MODIS': 'চাষ অরবিট · NASA পৃথিবী পর্যবেক্ষণ সিদ্ধান্ত ব্যবস্থা · POWER · SMAP · GPM · MODIS',
  'INITIALIZING EARTH OBSERVATION SYSTEM': 'পৃথিবী পর্যবেক্ষণ ব্যবস্থা চালু হচ্ছে',
  'EARTH OBSERVATION INTERFACE · v1.0': 'পৃথিবী পর্যবেক্ষণ ইন্টারফেস · v1.0',
  'Where is your field?': 'আপনার ক্ষেত কোথায়?',
  'Tell us where your farm is. We analyze NASA Earth-observation data — temperature, rainfall, soil moisture, vegetation — and turn it into a transparent 4-year crop rotation plan.': 'আপনার খামার কোথায় তা জানান। আমরা NASA-র পৃথিবী পর্যবেক্ষণ তথ্য—তাপমাত্রা, বৃষ্টিপাত, মাটির আর্দ্রতা ও উদ্ভিদ—বিশ্লেষণ করে স্বচ্ছ ৪ বছরের ফসল পর্যায়ক্রম পরিকল্পনা তৈরি করি।',
  'Quick pick': 'দ্রুত নির্বাচন',
  'See a demo: rice farmer in Rajshahi, Bangladesh': 'ডেমো দেখুন: বাংলাদেশের রাজশাহীর একজন ধানচাষি',
  'Selected Field': 'নির্বাচিত ক্ষেত',
  'Awaiting farmer profile': 'কৃষকের তথ্যের অপেক্ষায়',
  'Analyze this area': 'এই এলাকার বিশ্লেষণ করুন',
  'Tell us what you grow · 90-second onboarding': 'আপনি কী চাষ করেন জানান · ৯০ সেকেন্ডের পরিচিতি',
  'Search your farm, city, district or region...': 'আপনার খামার, শহর, জেলা বা অঞ্চল খুঁজুন...',
  'Search location': 'অবস্থান খুঁজুন',
  'Clear search': 'অনুসন্ধান মুছুন',
  "Couldn't load locations. Check your connection and try again.": 'অবস্থান লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'No locations found. Try a different spelling or a nearby city.': 'কোনো অবস্থান পাওয়া যায়নি। বানান পরিবর্তন করে বা কাছের কোনো শহর দিয়ে চেষ্টা করুন।',
  'What do you grow?': 'আপনি কী চাষ করেন?',
  'Farm information': 'খামারের তথ্য',
  'What matters most?': 'আপনার কাছে সবচেয়ে গুরুত্বপূর্ণ কী?',
  'What do you want to grow?': 'আপনি কী চাষ করতে চান?',
  "Pick your primary crops, secondary crops, and any crops you're considering. We'll match each one to your field's signals.": 'আপনার প্রধান ও গৌণ ফসল এবং বিবেচনাধীন ফসলগুলো বেছে নিন। প্রতিটি ফসলকে আপনার ক্ষেতের তথ্যের সঙ্গে মিলিয়ে দেখা হবে।',
  'Add another crop...': 'আরেকটি ফসল যোগ করুন...',
  'Add': 'যোগ করুন',
  'Your selected crops': 'আপনার নির্বাচিত ফসল',
  'Remove': 'সরান',
  'Farm information details': 'আপনার জমি সম্পর্কে কয়েকটি তথ্য দিন। মাটির ধরন না জানলে আঞ্চলিক তথ্য থেকে তা অনুমান করা হবে।',
  "A few details about your land. If you're unsure about soil, we'll infer it from regional signals.": 'আপনার জমি সম্পর্কে কয়েকটি তথ্য দিন। মাটির ধরন না জানলে আঞ্চলিক তথ্য থেকে তা অনুমান করা হবে।',
  'Farm size': 'খামারের আয়তন',
  'Current crop': 'বর্তমান ফসল',
  'Irrigation': 'সেচ',
  'Rainfed': 'বৃষ্টিনির্ভর',
  'No irrigation infrastructure.': 'সেচের কোনো ব্যবস্থা নেই।',
  'Limited irrigation': 'সীমিত সেচ',
  'Some supplemental watering in dry spells.': 'শুষ্ক সময়ে কিছু অতিরিক্ত পানি দেওয়া হয়।',
  'Reliable irrigation': 'নির্ভরযোগ্য সেচ',
  'Steady water access through the season.': 'পুরো মৌসুমে নিয়মিত পানির ব্যবস্থা আছে।',
  'Soil type': 'মাটির ধরন',
  "I don't know": 'আমি জানি না',
  "We'll infer it from regional signals.": 'আঞ্চলিক তথ্য থেকে অনুমান করা হবে।',
  'Sandy': 'বেলে',
  'Drains fast, low water retention.': 'দ্রুত পানি নিষ্কাশন হয়, পানি ধরে রাখার ক্ষমতা কম।',
  'Loamy': 'দোআঁশ',
  'Balanced texture, generally fertile.': 'সুষম গঠন, সাধারণত উর্বর।',
  'Clay': 'এঁটেল',
  'Heavy, high water retention, slow drain.': 'ভারী মাটি, পানি ধরে রাখে বেশি, নিষ্কাশন ধীর।',
  "Not required — we'll infer it if you don't know.": 'এটি বাধ্যতামূলক নয়—না জানলে আমরা অনুমান করব।',
  'What matters most to you?': 'আপনার কাছে সবচেয়ে গুরুত্বপূর্ণ কী?',
  'Assign a weight to each priority. The total should equal 100%. We weight crop recommendations accordingly.': 'প্রতিটি অগ্রাধিকারের জন্য গুরুত্ব নির্ধারণ করুন। মোট যোগফল ১০০% হতে হবে। সেই অনুযায়ী ফসলের সুপারিশে ওজন দেওয়া হবে।',
  'Total': 'মোট',
  'Total must equal 100% (currently {total}%)': 'মোট ১০০% হতে হবে (এখন {total}%)',
  'Normalize to 100%': '১০০%-এ সামঞ্জস্য করুন',
  'Soil health': 'মাটির স্বাস্থ্য',
  'Water conservation': 'পানি সংরক্ষণ',
  'Climate resilience': 'জলবায়ু সহনশীলতা',
  'Income stability': 'আয়ের স্থিতিশীলতা',
  'weight': 'গুরুত্ব',
  'Select a location first.': 'আগে একটি অবস্থান বেছে নিন।',
  'Back': 'পেছনে',
  'Globe': 'গ্লোব',
  'Continue': 'এগিয়ে যান',
  'Analyze my field': 'আমার ক্ষেত বিশ্লেষণ করুন',
  'Locating field': 'ক্ষেতের অবস্থান নির্ধারণ',
  'Reading NASA climate signals': 'NASA জলবায়ু সংকেত পড়া হচ্ছে',
  'Checking rainfall patterns': 'বৃষ্টিপাতের ধরন পরীক্ষা করা হচ্ছে',
  'Checking soil moisture': 'মাটির আর্দ্রতা পরীক্ষা করা হচ্ছে',
  'Assessing vegetation': 'উদ্ভিদ পর্যবেক্ষণ করা হচ্ছে',
  'Comparing crop requirements': 'ফসলের চাহিদা তুলনা করা হচ্ছে',
  'Calculating field risks': 'ক্ষেতের ঝুঁকি হিসাব করা হচ্ছে',
  'Chash Orbit · Acquisition in progress': 'চাষ অরবিট · তথ্য সংগ্রহ চলছে',
  'Analyzing your field...': 'আপনার ক্ষেত বিশ্লেষণ করা হচ্ছে...',
  'Comparing your crops against NASA observations — composing rotation plan...': 'NASA পর্যবেক্ষণের সঙ্গে আপনার ফসল তুলনা করা হচ্ছে — পর্যায়ক্রম পরিকল্পনা তৈরি হচ্ছে...',
  'LIVE NASA DATA': 'লাইভ NASA তথ্য',
  'CACHED DATA': 'ক্যাশ করা তথ্য',
  'DERIVED ESTIMATE': 'গণনাভিত্তিক অনুমান',
  'DEMO DATA': 'ডেমো তথ্য',
  'YOUR FIELD': 'আপনার ক্ষেত',
  'Climate zone': 'জলবায়ু অঞ্চল',
  'Rainfall zone': 'বৃষ্টিপাত অঞ্চল',
  'Soil zone': 'মাটির অঞ্চল',
  'Crop region': 'ফসল অঞ্চল',
  'FIELD CONDITION': 'ক্ষেতের অবস্থা',
  'Temperature': 'তাপমাত্রা',
  'Water': 'পানি',
  'Rainfall': 'বৃষ্টিপাত',
  'Soil moisture': 'মাটির আর্দ্রতা',
  'Vegetation': 'উদ্ভিদ',
  'Considering:': 'বিবেচনাধীন:',
  'soil': 'মাটি',
  'irrigation': 'সেচ',
  'Now:': 'এখন:',
  'No analysis available.': 'কোনো বিশ্লেষণ উপলভ্য নেই।',
  'Your crops': 'আপনার ফসল',
  "Compatibility scores for the crops you're considering, weighted by your priorities.": 'আপনার বিবেচনাধীন ফসলগুলোর সামঞ্জস্যের স্কোর, আপনার অগ্রাধিকার অনুযায়ী নির্ধারিত।',
  'Top fit': 'সেরা উপযোগিতা',
  'Season': 'মৌসুম',
  'Climate': 'জলবায়ু',
  'Rotation': 'পর্যায়ক্রম',
  'Plant': 'বপন',
  'Harvest': 'ফসল তোলা',
  'Plantable now': 'এখন বপন করা যায়',
  'Next plant in {months} mo': 'পরবর্তী বপন {months} মাস পর',
  'Why this score': 'এই স্কোরের কারণ',
  'No specific signal flags this crop — scores are moderate across all dimensions.': 'কোনো নির্দিষ্ট সংকেত এই ফসলকে আলাদা করে চিহ্নিত করেনি—সব ক্ষেত্রেই স্কোর মাঝারি।',
  'What could grow well here?': 'এখানে কোন ফসল ভালো হতে পারে?',
  "Top six candidates outside of your current crop, ranked by Chash Orbit's overall fit score.": 'বর্তমান ফসল ছাড়া সেরা ছয়টি বিকল্প, চাষ অরবিটের সামগ্রিক উপযোগিতা স্কোর অনুযায়ী সাজানো।',
  'Change your crops': 'আপনার ফসল পরিবর্তন করুন',
  'Curious how a different crop mix changes the recommendations? Adjust your selection below — Chash Orbit will re-run the analysis with the same NASA data and your priorities.': 'ফসলের মিশ্রণ বদলালে সুপারিশ কীভাবে বদলায় জানতে চান? নিচে নির্বাচন বদলান—একই NASA তথ্য ও অগ্রাধিকার দিয়ে আবার বিশ্লেষণ করা হবে।',
  'Currently considering:': 'এখন বিবেচনাধীন:',
  'Edit crop selection': 'ফসলের নির্বাচন সম্পাদনা',
  "Edit crops you're considering": 'বিবেচনাধীন ফসল সম্পাদনা',
  'Toggle crops to add or remove them. Chash Orbit re-runs the analysis automatically (debounced) — keep at least one crop selected.': 'ফসল যোগ বা সরাতে নির্বাচন করুন। চাষ অরবিট স্বয়ংক্রিয়ভাবে আবার বিশ্লেষণ করবে—অন্তত একটি ফসল নির্বাচন রাখুন।',
  'Selected ({count})': 'নির্বাচিত ({count})',
  'No crops selected — pick at least one below.': 'কোনো ফসল নির্বাচিত নেই—নিচে অন্তত একটি বেছে নিন।',
  'Recommended but not selected': 'সুপারিশকৃত, তবে নির্বাচিত নয়',
  'Done': 'সম্পন্ন',
  'You must select at least one crop to consider.': 'বিবেচনার জন্য অন্তত একটি ফসল নির্বাচন করুন।',
  'Analysis updated with new crop selection.': 'নতুন ফসল নির্বাচনের ভিত্তিতে বিশ্লেষণ হালনাগাদ হয়েছে।',
  'Analysis failed': 'বিশ্লেষণ ব্যর্থ হয়েছে',
  'Re-analysis failed: ': 'পুনর্বিশ্লেষণ ব্যর্থ হয়েছে: ',
  'YOUR FIELD SHIFT PLAN': 'আপনার ক্ষেত পরিবর্তন পরিকল্পনা',
  'Overall score': 'সামগ্রিক স্কোর',
  '4-YEAR ROTATION': '৪ বছরের ফসল পর্যায়ক্রম',
  'Year {year}': '{year} বছর',
  'with {crop}': '{crop}-সহ',
  'Compare rotations': 'ফসল পর্যায়ক্রম তুলনা',
  'See how the Chash Orbit recommended rotation outperforms the current rotation.': 'চাষ অরবিটের সুপারিশকৃত পর্যায়ক্রম বর্তমান পরিকল্পনার চেয়ে কীভাবে ভালো তা দেখুন।',
  'Current rotation': 'বর্তমান পর্যায়ক্রম',
  'Chash Orbit plan': 'চাষ অরবিট পরিকল্পনা',
  'SUB-SCORE COMPARISON': 'উপস্কোর তুলনা',
  'Overall': 'সামগ্রিক',
  'point': 'পয়েন্ট',
  'improvement': 'উন্নতি',
  'regression': 'অবনতি',
  'no overall change': 'সামগ্রিক পরিবর্তন নেই',
  'weighted by your priorities.': 'আপনার অগ্রাধিকার অনুযায়ী গুরুত্ব নির্ধারিত।',
  'About this analysis': 'এই বিশ্লেষণ সম্পর্কে',
  'DATA SOURCES': 'তথ্যের উৎস',
  'Dataset': 'ডেটাসেট',
  'HOW WE SCORE': 'স্কোর নির্ধারণ পদ্ধতি',
  'WHY THESE DATA SOURCES': 'এই তথ্যের উৎস কেন',
  'Measures': 'যা পরিমাপ করে',
  'Why Chash Orbit uses it': 'চাষ অরবিট এটি কেন ব্যবহার করে',
  'NASA Open Data': 'NASA উন্মুক্ত তথ্য',
  'AI Field Report': 'AI ক্ষেত প্রতিবেদন',
  'Retry': 'আবার চেষ্টা করুন',
  'Error': 'ত্রুটি',
  'Executive Summary': 'সারসংক্ষেপ',
  'Environmental Risks': 'পরিবেশগত ঝুঁকি',
  'Action:': 'করণীয়:',
  'Crop Comparison & Rankings': 'ফসল তুলনা ও ক্রমতালিকা',
  'Strengths:': 'সুবিধা:',
  'Concerns:': 'উদ্বেগ:',
  'Rotation Insights': 'ফসল পর্যায়ক্রমের বিশ্লেষণ',
  'Practical Next Steps': 'পরবর্তী করণীয়',
  'Data Confidence & Limitations': 'তথ্যের নির্ভরযোগ্যতা ও সীমাবদ্ধতা',
  'Ask Your Field': 'আপনার ক্ষেতকে প্রশ্ন করুন',
  "Ask anything about this field's analysis, crop rankings, or risks.": 'এই ক্ষেতের বিশ্লেষণ, ফসলের ক্রমতালিকা বা ঝুঁকি সম্পর্কে যেকোনো প্রশ্ন করুন।',
  'Action': 'করণীয়',
  'Thinking...': 'ভাবছি...',
  'An error occurred. Please try again.': 'একটি ত্রুটি হয়েছে। আবার চেষ্টা করুন।',
  'e.g. Why is water availability a concern?': 'যেমন: পানির প্রাপ্যতা কেন উদ্বেগের বিষয়?',
  '10y trend': '১০ বছরের প্রবণতা',
  'Recent trend': 'সাম্প্রতিক প্রবণতা',
  'Field capacity': 'মাঠ ধারণক্ষমতা',
  'MODIS observed': 'MODIS পর্যবেক্ষিত',
  'POWER-driven model': 'POWER-নির্ভর মডেল',
  'Soil condition': 'মাটির অবস্থা',
  'NASA observation:': 'NASA পর্যবেক্ষণ:',
  'Derived/model estimate:': 'গণনাভিত্তিক/মডেল অনুমান:',
  'Source:': 'উৎস:',
  'rising': 'বাড়ছে',
  'falling': 'কমছে',
  'stable': 'স্থিতিশীল',
  'Cool & stable': 'শীতল ও স্থিতিশীল',
  'Mild heat': 'মৃদু তাপ',
  'Moderate stress': 'মাঝারি চাপ',
  'High heat risk': 'উচ্চ তাপঝুঁকি',
  'Severe heat': 'তীব্র তাপ',
  'Well-watered': 'পর্যাপ্ত পানি',
  'Slight deficit': 'সামান্য ঘাটতি',
  'Seasonal deficit': 'মৌসুমি ঘাটতি',
  'Water stress': 'পানির চাপ',
  'Drought risk': 'খরার ঝুঁকি',
  'Well below normal': 'স্বাভাবিকের অনেক নিচে',
  'Below normal': 'স্বাভাবিকের নিচে',
  'Near normal': 'স্বাভাবিকের কাছাকাছি',
  'Above normal': 'স্বাভাবিকের উপরে',
  'Well above normal': 'স্বাভাবিকের অনেক উপরে',
  'Meets demand': 'চাহিদা পূরণ করে',
  'Slight gap': 'সামান্য ঘাটতি',
  'Below demand': 'চাহিদার নিচে',
  'Below crop demand': 'ফসলের চাহিদার নিচে',
  'Sparse vegetation': 'বিরল উদ্ভিদ',
  'Low health': 'স্বাস্থ্য কম',
  'Moderate health': 'মাঝারি স্বাস্থ্য',
  'Good health': 'ভালো স্বাস্থ্য',
  'Vigorous canopy': 'ঘন ও সতেজ উদ্ভিদ আচ্ছাদন',
  'Equatorial': 'নিরক্ষীয়',
  'Tropical': 'ক্রান্তীয়',
  'Subtropical': 'উপক্রান্তীয়',
  'Temperate': 'নাতিশীতোষ্ণ',
  'Boreal': 'উত্তরীয় শীতল',
  'Polar': 'মেরু',
  'Arid': 'শুষ্ক',
  'Semi-arid': 'অর্ধ-শুষ্ক',
  'Sub-humid': 'আংশিক আর্দ্র',
  'Humid': 'আর্দ্র',
  'Wet': 'অতিবৃষ্টিপ্রবণ',
  'Rice–wheat belt': 'ধান-গম অঞ্চল',
  'Wheat–fallow': 'গম-পতিত জমি অঞ্চল',
  'Maize–soybean': 'ভুট্টা-সয়াবিন অঞ্চল',
  'Maize belt': 'ভুট্টা অঞ্চল',
  'Dryland millet': 'শুষ্ক জমির বাজরা',
  'Cotton belt': 'তুলা অঞ্চল',
  'Pulse–cereal': 'ডাল-শস্য অঞ্চল',
  'Mixed smallholder': 'বৈচিত্র্যময় ক্ষুদ্র খামার',
  'Cereal–legume': 'শস্য-ডাল অঞ্চল',
  'high': 'উচ্চ',
  'medium': 'মাঝারি',
  'low': 'নিম্ন',
  'deficit': 'ঘাটতি',
  'adequate': 'পর্যাপ্ত',
  'surplus': 'উদ্বৃত্ত',
  'depleting': 'ক্ষয় হচ্ছে',
  'building': 'উন্নত হচ্ছে',
  'Switch language to Bengali': 'বাংলা ভাষায় পরিবর্তন করুন',
  'Switch language to English': 'ইংরেজি ভাষায় পরিবর্তন করুন',
  'Live NASA POWER · SMAP / GPM / MODIS derived': 'লাইভ NASA POWER · SMAP / GPM / MODIS থেকে অনুমিত',
  'Field details': 'ক্ষেতের বিবরণ',
  'Wheat': 'গম',
  'Rice': 'ধান',
  'Maize': 'ভুট্টা',
  'Corn': 'ভুট্টা',
  'Potato': 'আলু',
  'Chickpea': 'ছোলা',
  'Lentil': 'মসুর ডাল',
  'Mung bean': 'মুগ ডাল',
  'Soybean': 'সয়াবিন',
  'Vegetables': 'শাকসবজি',
  'Other': 'অন্যান্য',
  'None / fallow': 'কিছু নয় / পতিত',
  'acres': 'একর',
  'hectares': 'হেক্টর',
  'primary': 'প্রধান',
  'secondary': 'গৌণ',
  'considering': 'বিবেচনাধীন',
  'Source status': 'উৎসের অবস্থা',
  'Attribution': 'স্বীকৃতি',
  'Current max': 'বর্তমান সর্বোচ্চ',
  'Growing-season avg': 'বর্ধন মৌসুমের গড়',
  'Heat-stress days (90d)': 'তাপচাপের দিন (৯০ দিন)',
  'Growing-season (90d)': 'বর্ধন মৌসুম (৯০ দিন)',
  'Anomaly vs climatology': 'জলবায়ুগত গড়ের তুলনায় বিচ্যুতি',
  'Variability (σ)': 'পরিবর্তনশীলতা (σ)',
  'Dry spells (90d)': 'শুষ্ক সময় (৯০ দিন)',
  'Current (% capacity)': 'বর্তমান (% ধারণক্ষমতা)',
  'Seasonal deficit (90d)': 'মৌসুমি ঘাটতি (৯০ দিন)',
  'Health': 'স্বাস্থ্য',
  'Model': 'মডেল',
  'Model / observed': 'মডেল / পর্যবেক্ষিত',
  'Year': 'বছর',
  'Rationale': 'যুক্তি',
  'Climate fit': 'জলবায়ু উপযোগিতা',
  'Water fit': 'পানি উপযোগিতা',
  'Soil fit': 'মাটি উপযোগিতা',
  'Rotation fit': 'পর্যায়ক্রম উপযোগিতা',
  'Overall fit': 'সামগ্রিক উপযোগিতা',
  'Temperature window match + heat/drought tolerance vs field heat & drought risk.': 'তাপমাত্রার উপযোগী সময়সীমা এবং ক্ষেতের তাপ ও খরা ঝুঁকির তুলনায় সহনশীলতা।',
  'Field rainfall vs crop water need, irrigation uplift, and flood tolerance vs flood risk.': 'ক্ষেতের বৃষ্টিপাত ও ফসলের পানির চাহিদা, সেচের সুবিধা এবং বন্যা ঝুঁকির তুলনায় সহনশীলতা।',
  'Root depth, soil texture retention match, and nitrogen-fixing benefit on this soil.': 'শিকড়ের গভীরতা, মাটির পানি ধারণক্ষমতা এবং এই মাটিতে নাইট্রোজেন স্থিতিকরণের সুবিধা।',
  'Alternating family and nitrogen balance vs the previous crop — penalises same-family repeats.': 'আগের ফসলের সঙ্গে পরিবার ও নাইট্রোজেনের ভারসাম্য রেখে পর্যায়ক্রম; একই পরিবারের ফসল পরপর হলে স্কোর কমে।',
  'Weighted sum of climate, water, soil, and rotation scores by your priorities (soil/water/climate/income).': 'আপনার অগ্রাধিকার (মাটি/পানি/জলবায়ু/আয়) অনুযায়ী জলবায়ু, পানি, মাটি ও পর্যায়ক্রমের স্কোরের ওজনযুক্ত যোগফল।',
  'Daily + monthly temperature, rainfall, humidity, and wind for any point on Earth.': 'পৃথিবীর যেকোনো স্থানের দৈনিক ও মাসিক তাপমাত্রা, বৃষ্টিপাত, আর্দ্রতা ও বাতাসের তথ্য।',
  'Live, key-authenticated REST API. Chash Orbit uses POWER for temperature and rainfall directly — the backbone of every climate signal here.': 'লাইভ, কী-নির্ভর REST API। চাষ অরবিট সরাসরি তাপমাত্রা ও বৃষ্টিপাতের জন্য POWER ব্যবহার করে—এখানকার প্রতিটি জলবায়ু সংকেতের ভিত্তি।',
  'No special authentication required — NASA API key only.': 'বিশেষ প্রমাণীকরণ প্রয়োজন নেই—শুধু NASA API key।',
  'Surface soil moisture (top ~5 cm) from the Soil Moisture Active Passive mission.': 'Soil Moisture Active Passive মিশন থেকে ভূপৃষ্ঠের মাটির আর্দ্রতা (উপরের প্রায় ৫ সেমি)।',
  'Would provide true live soil moisture. Chash Orbit derives an estimate from POWER precipitation + a water-balance model instead, and labels it "derived" — never "live SMAP".': 'প্রকৃত লাইভ মাটির আর্দ্রতা দিতে পারে। এর পরিবর্তে চাষ অরবিট POWER বৃষ্টিপাত ও পানি-ভারসাম্য মডেল থেকে অনুমান করে এবং "গণনাভিত্তিক" হিসেবে চিহ্নিত করে—কখনোই "লাইভ SMAP" বলে না।',
  'Requires Earthdata auth via NSIDC / AppEEARS. Demo uses POWER-derived substitute.': 'NSIDC / AppEEARS-এর মাধ্যমে Earthdata প্রমাণীকরণ প্রয়োজন। ডেমোতে POWER-ভিত্তিক বিকল্প ব্যবহার করা হয়।',
  'Global Precipitation Measurement (Integrated Multi-satellitE Retrievals) — high-resolution rainfall.': 'Global Precipitation Measurement (Integrated Multi-satellitE Retrievals)—উচ্চ রেজোলিউশনের বৃষ্টিপাতের তথ্য।',
  "Chash Orbit uses POWER's PRECTOTCORR (GPM-corrected precipitation) and computes IMERG-style stats (anomaly, variability, dry spells) on top of it.": 'চাষ অরবিট POWER-এর PRECTOTCORR (GPM-সংশোধিত বৃষ্টিপাত) ব্যবহার করে এবং এর ভিত্তিতে IMERG-ধাঁচের পরিসংখ্যান (বিচ্যুতি, পরিবর্তনশীলতা, শুষ্ক সময়) হিসাব করে।',
  'Late-run GPM data is delivered via NASA GES DISC (Earthdata). POWER PRECTOTCORR already folds GPM in.': 'বিলম্বিত GPM তথ্য NASA GES DISC (Earthdata)-এর মাধ্যমে পাওয়া যায়। POWER PRECTOTCORR-এ GPM তথ্য আগে থেকেই অন্তর্ভুক্ত।',
  'NDVI vegetation index (MOD13 / VNP13 products) — global vegetation health, every 16 days.': 'NDVI উদ্ভিদ সূচক (MOD13 / VNP13 পণ্য)—প্রতি ১৬ দিনে বৈশ্বিক উদ্ভিদের স্বাস্থ্য।',
  'Would provide true live NDVI. Chash Orbit derives a seasonal NDVI model from POWER precipitation + temperature climatology instead, and labels it "derived".': 'প্রকৃত লাইভ NDVI দিতে পারে। এর পরিবর্তে চাষ অরবিট POWER বৃষ্টিপাত ও তাপমাত্রার জলবায়ুগত গড় থেকে মৌসুমি NDVI মডেল তৈরি করে এবং "গণনাভিত্তিক" হিসেবে চিহ্নিত করে।',
  'Requires Earthdata auth via AppEEARS / LP DAAC. Demo uses POWER-derived substitute.': 'AppEEARS / LP DAAC-এর মাধ্যমে Earthdata প্রমাণীকরণ প্রয়োজন। ডেমোতে POWER-ভিত্তিক বিকল্প ব্যবহার করা হয়।',
  'Chash Orbit turns NASA Earth-observation data into a transparent field-level recommendation. NASA POWER provides live temperature and rainfall data. Soil moisture, NDVI, and additional soil metrics are derived estimates — we never falsely label sample data as live NASA data.': 'চাষ অরবিট NASA-র পৃথিবী পর্যবেক্ষণ তথ্য থেকে স্বচ্ছ ক্ষেত-ভিত্তিক সুপারিশ তৈরি করে। NASA POWER লাইভ তাপমাত্রা ও বৃষ্টিপাতের তথ্য দেয়। মাটির আর্দ্রতা, NDVI এবং অতিরিক্ত মাটির পরিমাপ অনুমানভিত্তিক—নমুনা তথ্যকে কখনো ভুলভাবে লাইভ NASA তথ্য বলা হয় না।',
  'Temperature & rainfall: NASA POWER (Langley Research Center). Soil moisture, NDVI, and additional soil metrics are derived estimates (see attributions above).': 'তাপমাত্রা ও বৃষ্টিপাত: NASA POWER (Langley Research Center)। মাটির আর্দ্রতা, NDVI এবং অতিরিক্ত মাটির পরিমাপ অনুমানভিত্তিক (উপরের স্বীকৃতি দেখুন)।',
  'Chash Orbit · NASA Space Apps Challenge · Earth-to-farm decision system': 'চাষ অরবিট · NASA Space Apps Challenge · পৃথিবী থেকে খামার সিদ্ধান্ত ব্যবস্থা',
  'Temperature (°C)': 'তাপমাত্রা (°C)',
  'Rainfall (mm)': 'বৃষ্টিপাত (মিমি)',
  'Rain': 'বৃষ্টি',
  'Soil': 'মাটি',
  'Income': 'আয়',
  'Current': 'বর্তমান',
  'Fallow rotation': 'পতিত জমির পর্যায়ক্রম',
  'monoculture': 'একক ফসল চাষ',
  'year': 'বছর',
};

const STORAGE_KEY = 'chash-orbit-locale';
const listeners = new Set<() => void>();
let currentLocale: Locale = 'en';
let initialized = false;

function initializeLocale(): Locale {
  if (initialized || typeof window === 'undefined') return currentLocale;
  initialized = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    currentLocale = saved === 'en' || saved === 'bn'
      ? saved
      : window.navigator.language.toLowerCase().startsWith('bn')
        ? 'bn'
        : 'en';
  } catch (error) {
    console.error('Could not read the saved language preference:', error);
  }
  return currentLocale;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    currentLocale = event.newValue === 'bn' ? 'bn' : 'en';
    listeners.forEach(notify => notify());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  return initializeLocale();
}

function getServerSnapshot(): Locale {
  return 'en';
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  initialized = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch (error) {
    console.error('Could not save the language preference:', error);
  }
  listeners.forEach(listener => listener());
}

export function useTranslation() {
  const locale = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const t = React.useCallback((message: string) => translateMessage(locale, message), [locale]);

  return { locale, t };
}

export function translateMessage(locale: Locale, message: string) {
  return locale === 'bn' ? BENGALI_MESSAGES[message] ?? message : message;
}

export function LanguageSwitcher() {
  const { locale, t } = useTranslation();
  const nextLocale: Locale = locale === 'en' ? 'bn' : 'en';
  const label = t(locale === 'en' ? 'Switch language to Bengali' : 'Switch language to English');

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      aria-label={label}
      title={label}
      className="fixed right-4 top-14 z-[100] rounded-full border border-amber-400/30 bg-black/70 px-3 py-2 font-mono text-xs text-amber-100 shadow-lg backdrop-blur transition-colors hover:bg-amber-400/15 sm:top-4"
    >
      {locale === 'en' ? 'বাংলা' : 'English'}
    </button>
  );
}
