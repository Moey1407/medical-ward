/* Ward Round — core data: rng, names, lab reference ranges, investigations, formulary, consequence rules, comorbidity overlays */
'use strict';

/* ---------- seeded randomness ---------- */
function mkRng(seed){
  let a = seed >>> 0;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const r = {
    raw: rnd,
    f: (lo, hi, dp = 1) => +(lo + rnd() * (hi - lo)).toFixed(dp),
    int: (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(rnd() * arr.length)],
    chance: p => rnd() < p,
    shuffle: arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; },
    /* weighted pick: {a:3,b:1} */
    w: obj => { const ks = Object.keys(obj); let tot = 0; ks.forEach(k => tot += obj[k]); let x = rnd() * tot; for (const k of ks) { x -= obj[k]; if (x <= 0) return k; } return ks[0]; },
  };
  r.sex = (pF = 0.5) => rnd() < pF ? 'F' : 'M';
  r.skin = () => r.w({1: 1, 2: 2, 3: 3, 4: 4, 5: 3});           // 1 light … 5 deep
  r.build = (bias) => r.w(bias || {thin: 1, normal: 4, overweight: 3, obese: 2});
  r.name = (sex, age, eth) => nameFor(r, sex, age, eth);
  r.eth = () => r.w({african: 80, coloured: 8, white: 7, indian: 3, muslim: 2});
  r.side = () => r.pick(['left', 'right']);
  r.hosp = (kind) => r.pick(kind === 'clinic' ? CLINICS : kind === 'peds' ? PEDS_SITES : HOSPITALS);
  return r;
}

const HOSPITALS = ['Emergency unit, Chris Hani Baragwanath Academic Hospital', 'Emergency unit, Charlotte Maxeke Johannesburg Academic Hospital', 'Emergency unit, Helen Joseph Hospital', 'Casualty, Rahima Moosa Mother and Child Hospital', 'Emergency unit, Tambo Memorial Hospital (Boksburg)', 'Casualty, Edenvale Hospital', 'Emergency unit, Leratong Hospital', 'Casualty, Thelle Mogoerane Regional Hospital (Vosloorus)', 'Medical admissions ward, Chris Hani Baragwanath', 'Emergency unit, Far East Rand Hospital (Springs)'];
const CLINICS = ['Daveyton Main Clinic', 'Alexandra Health Centre', 'Hillbrow CHC', 'Zola CHC (Soweto)', 'Wattville Clinic (Benoni)', 'Diepsloot CHC', 'Tembisa Main Clinic', 'GP rooms, Lakefield', 'Mamelodi Day Hospital', 'Lenasia South CHC'];
const PEDS_SITES = ['Paediatric casualty, Chris Hani Baragwanath', 'Paediatric emergency, Charlotte Maxeke', 'Paediatric casualty, Rahima Moosa', 'Paediatric OPD, Tambo Memorial', 'Paediatric ward, Helen Joseph'];

const NAMES = {
  african: {M: ['Sipho', 'Thabo', 'Mandla', 'Bongani', 'Lwazi', 'Kagiso', 'Tshepo', 'Themba', 'Kabelo', 'Vusi', 'Neo', 'Sibusiso', 'Musa', 'Lucky', 'Mpho', 'Xolani', 'Tendai', 'Simba', 'Ayanda', 'Siyabonga', 'Godfrey', 'Tumelo', 'Lethabo'], F: ['Nomsa', 'Thandeka', 'Zanele', 'Lerato', 'Palesa', 'Nokuthula', 'Busisiwe', 'Refilwe', 'Dineo', 'Precious', 'Gugu', 'Nandi', 'Khanyisile', 'Tsakani', 'Rudo', 'Chipo', 'Naledi', 'Bongiwe', 'Hlengiwe', 'Sindiswa', 'Amahle', 'Lindiwe'], S: ['Dlamini', 'Nkosi', 'Mokoena', 'Ndlovu', 'Khumalo', 'Mthembu', 'Molefe', 'Mahlangu', 'Sithole', 'Zulu', 'Baloyi', 'Maluleke', 'Mabuza', 'Shabalala', 'Mkhize', 'Ngcobo', 'Masilela', 'Radebe', 'Chauke', 'Netshitenzhe', 'Moyo', 'Banda', 'Tshabalala', 'Modise']},
  coloured: {M: ['Clive', 'Desmond', 'Ryan', 'Brandon', 'Marlon', 'Ashwin', 'Shaun', 'Eugene'], F: ['Charmaine', 'Sharon', 'Yolanda', 'Chantal', 'Natasha', 'Bernadette', 'Kayla', 'Monique'], S: ['Abrahams', 'Jacobs', 'Williams', 'Hendricks', 'Adams', 'Petersen', 'Daniels', 'Fortuin']},
  white: {M: ['Johan', 'Pieter', 'Riaan', 'Hendrik', 'David', 'Andre', 'Willem', 'Gareth'], F: ['Marlize', 'Annelie', 'Elsabe', 'Sarah', 'Ruth', 'Karen', 'Liezl', 'Michelle'], S: ['van der Merwe', 'Botha', 'Pretorius', 'Smith', 'Fourie', 'du Plessis', 'Venter', 'Nel']},
  indian: {M: ['Rajesh', 'Pravin', 'Kevin', 'Suren', 'Vikesh', 'Dinesh'], F: ['Priya', 'Anjali', 'Kamini', 'Shamla', 'Nirvana', 'Reshma'], S: ['Naidoo', 'Pillay', 'Moodley', 'Govender', 'Reddy', 'Singh']},
  muslim: {M: ['Mohammed', 'Yusuf', 'Ismail', 'Faizel', 'Ahmed', 'Zaheer'], F: ['Ayesha', 'Fatima', 'Zainab', 'Shireen', 'Nadia', 'Mariam'], S: ['Cassim', 'Patel', 'Ebrahim', 'Essop', 'Moosa', 'Bhamjee']},
};
const SKIN_FOR = {african: [3, 4, 4, 5, 5], coloured: [2, 3, 3, 4], white: [1, 1, 2], indian: [2, 3, 3], muslim: [2, 2, 3]};
function nameFor(r, sex, age, eth) {
  const g = NAMES[eth] || NAMES.african;
  const first = r.pick(g[sex] || g.M), last = r.pick(g.S);
  if (age < 16) return `${first} ${last}`;
  return `${sex === 'F' ? (age > 25 && r.chance(0.5) ? 'Mrs' : 'Ms') : 'Mr'} ${first} ${last}`;
}

/* ---------- body measurements ---------- */
const BMI_FOR = {cachectic: [14.5, 17], thin: [17, 18.9], normal: [19.5, 24.5], overweight: [25.5, 29.5], obese: [31, 42]};
function anthropometry(r, p) {
  if (p.age < 16) {
    // rough WHO median-ish weight for age, scaled by build
    const base = p.age < 1 ? 3.5 + p.age * 6 : p.age <= 5 ? 9 + 2.2 * p.age : 8 + 3 * p.age;
    const k = {cachectic: 0.68, thin: 0.85, normal: 1, overweight: 1.15, obese: 1.35}[p.build] || 1;
    const ht = p.age < 1 ? 50 + p.age * 25 : p.age <= 5 ? 75 + 7 * p.age : 80 + 6 * p.age;
    return {wt: +(base * k * r.f(0.95, 1.05, 2)).toFixed(1), ht: Math.round(ht * r.f(0.97, 1.03, 2)), bmi: null};
  }
  const ht = Math.round((p.sex === 'F' ? r.f(152, 172) : r.f(162, 186)));
  const bmi = r.f(...(BMI_FOR[p.build] || BMI_FOR.normal), 1);
  const wt = +(bmi * (ht / 100) ** 2).toFixed(0);
  return {ht, wt, bmi};
}

/* ---------- lab reference ranges (adult, SI, NHLS-style) ---------- */
// key: [label, unit, lo, hi, dp, {F:[lo,hi]}]
const LAB = {
  Hb: ['HAEMOGLOBIN', 'g/dL', 13.8, 18.8, 1, {F: [12.1, 16.3], C: [11.0, 14.5]}],
  MCV: ['MCV', 'fL', 79, 100, 1],
  MCH: ['MCH', 'pg', 27, 35, 1],
  RDW: ['RDW', '%', 11.0, 16.0, 1],
  WCC: ['LEUCOCYTE COUNT', '×10⁹/L', 4.0, 12.0, 2, {C: [5.0, 15.0]}],
  Neut: ['Neutrophils', '×10⁹/L', 2.0, 7.5, 2],
  Lymph: ['Lymphocytes', '×10⁹/L', 1.0, 4.0, 2],
  Eos: ['Eosinophils', '×10⁹/L', 0.0, 0.5, 2],
  Plt: ['PLATELET COUNT', '×10⁹/L', 150, 450, 0],
  Retic: ['Reticulocytes', '%', 0.5, 2.5, 1],
  Na: ['S-SODIUM', 'mmol/L', 136, 145, 0],
  K: ['S-POTASSIUM', 'mmol/L', 3.5, 5.1, 1],
  Cl: ['S-CHLORIDE', 'mmol/L', 98, 107, 0],
  HCO3: ['S-TOT. CO2 (bicarbonate)', 'mmol/L', 21, 29, 0],
  Urea: ['S-UREA', 'mmol/L', 2.1, 7.1, 1],
  Cr: ['S-CREATININE', 'µmol/L', 80, 115, 0, {F: [49, 90], C: [25, 60]}],
  eGFR: ['eGFR (CKD-EPI)', 'mL/min/1.73m²', 90, 200, 0],
  AG: ['S-ANION GAP', 'mmol/L', 8, 16, 1],
  TBil: ['Total bilirubin', 'µmol/L', 5, 21, 0],
  CBil: ['Conjugated bilirubin', 'µmol/L', 0, 3, 0],
  ALT: ['S-ALANINE TRANSAMINASE', 'IU/L', 7, 50, 0, {F: [7, 35]}],
  AST: ['S-ASPARTATE TRANSAMINASE', 'IU/L', 13, 50, 0, {F: [13, 35]}],
  ALP: ['ALP', 'U/L', 53, 128, 0, {C: [100, 390]}],
  GGT: ['S-γ-GLUTAMYL TRANSFERASE', 'U/L', 0, 64, 0, {F: [0, 36]}],
  Alb: ['Albumin', 'g/L', 35, 52, 0],
  TP: ['Total protein', 'g/L', 60, 78, 0],
  Ca: ['Calcium (total)', 'mmol/L', 2.15, 2.50, 2],
  cCa: ['Calcium (corrected)', 'mmol/L', 2.15, 2.50, 2],
  PO4: ['Phosphate', 'mmol/L', 0.78, 1.42, 2],
  Mg: ['Magnesium', 'mmol/L', 0.66, 1.07, 2],
  Urate: ['S-URIC ACID', 'mmol/L', 0.21, 0.42, 2, {F: [0.15, 0.35]}],
  Gluc: ['Glucose (random)', 'mmol/L', 3.9, 7.8, 1],
  HbA1c: ['HBA1C (NGSP/DCCT)', '%', 4.0, 5.6, 1],
  Lact: ['Lactate', 'mmol/L', 0.5, 2.2, 1],
  CRP: ['S-CRP', 'mg/L', 0, 10, 1],
  ESR: ['ESR (DIESSE METHOD)', 'mm/hr', 1, 20, 0, {F: [1, 25]}],
  PCT: ['Procalcitonin', 'ng/mL', 0, 0.5, 2],
  TnT: ['hs-Troponin T', 'ng/L', 0, 14, 0],
  CK: ['Creatine kinase', 'U/L', 39, 308, 0, {F: [26, 192]}],
  NTproBNP: ['NT-proBNP', 'pg/mL', 0, 125, 0],
  DD: ['D-dimer', 'mg/L FEU', 0, 0.5, 2],
  Lipase: ['Lipase', 'U/L', 13, 60, 0],
  Amyl: ['Amylase', 'U/L', 28, 100, 0],
  INR: ['INR', '', 0.9, 1.2, 2],
  PT: ['Prothrombin time', 's', 10.0, 13.0, 1],
  aPTT: ['aPTT', 's', 25, 36, 0],
  Fib: ['Fibrinogen', 'g/L', 2.0, 4.0, 1],
  Ferr: ['S-FERRITIN', 'ng/mL', 20, 300, 0, {F: [13, 150]}],
  Fe: ['S-IRON', 'µmol/L', 11.6, 31.3, 1],
  Tsat: ['S-% SATURATION', '%', 20, 55, 1],
  Trf: ['S-TRANSFERRIN', 'µmol/L', 20.2, 44.8, 1],
  B12: ['Vitamin B12', 'pmol/L', 145, 569, 0],
  Fol: ['Folate (serum)', 'nmol/L', 7, 46, 0],
  LDH: ['LDH', 'U/L', 120, 250, 0],
  Hapt: ['Haptoglobin', 'g/L', 0.3, 2.0, 2],
  TSH: ['S-TSH', 'µIU/mL', 0.35, 4.94, 2],
  fT4: ['Free T4', 'pmol/L', 12, 22, 0],
  Chol: ['S-CHOLESTEROL', 'mmol/L', 0, 5.0, 1],
  LDL: ['S-LDL MEASURED', 'mmol/L', 0, 3.0, 1],
  HDL: ['S-HDL CHOLESTEROL', 'mmol/L', 1.0, 3.0, 1],
  TG: ['S-TRIGLYCERIDE', 'mmol/L', 0, 1.7, 1],
  PSA: ['PSA (total)', 'ng/mL', 0, 4.0, 1],
  CEA: ['CEA', 'µg/L', 0, 5.0, 1],
  CA125: ['CA-125', 'U/mL', 0, 35, 0],
  CA153: ['CA 15-3', 'U/mL', 0, 30, 0],
  ASOT: ['ASOT', 'IU/mL', 0, 200, 0],
  AntiDNase: ['Anti-DNase B', 'U/mL', 0, 200, 0],
  C3: ['Complement C3', 'g/L', 0.9, 1.8, 2],
  C4: ['Complement C4', 'g/L', 0.10, 0.40, 2],
  CD4: ['CD4 count', 'cells/µL', 500, 1500, 0],
  VL: ['HIV viral load', 'copies/mL', 0, 50, 0],
  F8: ['Factor VIII activity', '%', 50, 150, 0],
  F9: ['Factor IX activity', '%', 50, 150, 0],
  vWFAg: ['vWF antigen', '%', 50, 160, 0],
  vWFAct: ['vWF activity (GP1bR)', '%', 50, 160, 0],
  pH: ['pH', '', 7.35, 7.45, 2],
  pCO2: ['pCO₂', 'kPa', 4.7, 6.0, 1],
  pO2: ['pO₂', 'kPa', 10.0, 13.3, 1],
  BE: ['Base excess', 'mmol/L', -2, 2, 1],
  SaO2: ['SaO₂', '%', 95, 100, 0],
  UPCR: ['Urine protein:creatinine ratio', 'mg/mmol', 0, 15, 0],
  UACR: ['Urine albumin:creatinine ratio', 'mg/mmol', 0, 3, 1],
  bhcg: ['Serum β-hCG', 'IU/L', 0, 5, 0],
  Vit25: ['25-OH vitamin D', 'nmol/L', 75, 250, 0],
  PTH: ['PTH', 'pmol/L', 1.6, 6.9, 1],
  Cort: ['Cortisol (09:00)', 'nmol/L', 133, 537, 0],
};

const PANELS = {
  FBC: {name: 'Full blood count + differential', keys: ['Hb', 'MCV', 'MCH', 'RDW', 'WCC', 'Neut', 'Lymph', 'Eos', 'Plt'], tat: 60},
  UE: {name: 'U&E (urea, electrolytes, creatinine)', keys: ['Na', 'K', 'Cl', 'HCO3', 'Urea', 'Cr', 'eGFR', 'AG'], tat: 60},
  LFT: {name: 'Liver function tests', keys: ['TBil', 'CBil', 'ALT', 'AST', 'ALP', 'GGT', 'Alb', 'TP'], tat: 60},
  CMP: {name: 'Calcium, magnesium, phosphate', keys: ['Ca', 'cCa', 'Mg', 'PO4'], tat: 60},
  CRP: {name: 'CRP', keys: ['CRP'], tat: 60},
  ESR: {name: 'ESR', keys: ['ESR'], tat: 60},
  PCT: {name: 'Procalcitonin', keys: ['PCT'], tat: 90},
  TROP: {name: 'hs-Troponin T (serial)', keys: ['TnT', 'CK'], tat: 60},
  BNP: {name: 'NT-proBNP', keys: ['NTproBNP'], tat: 90},
  DDIM: {name: 'D-dimer', keys: ['DD'], tat: 60},
  LIP: {name: 'Lipase + amylase', keys: ['Lipase', 'Amyl'], tat: 60},
  COAG: {name: 'Coagulation (INR, PT, aPTT, fibrinogen)', keys: ['INR', 'PT', 'aPTT', 'Fib'], tat: 60},
  URATE: {name: 'Serum uric acid', keys: ['Urate'], tat: 60},
  GLUC: {name: 'Glucose + HbA1c', keys: ['Gluc', 'HbA1c'], tat: 60},
  LIPID: {name: 'Fasting lipogram', keys: ['Chol', 'LDL', 'HDL', 'TG'], tat: 120},
  TFT: {name: 'Thyroid function (TSH, fT4)', keys: ['TSH', 'fT4'], tat: 120},
  IRON: {name: 'Iron studies', keys: ['Fe', 'Trf', 'Tsat', 'Ferr'], tat: 120},
  HAEMAT: {name: 'B12 + folate', keys: ['B12', 'Fol'], tat: 240},
  HAEMOL: {name: 'Haemolysis screen (LDH, haptoglobin, reticulocytes)', keys: ['LDH', 'Hapt', 'Retic'], tat: 90},
  ABG: {name: 'Arterial blood gas', keys: ['pH', 'pCO2', 'pO2', 'HCO3', 'BE', 'Lact', 'SaO2'], tat: 10},
  LACT: {name: 'Lactate (venous)', keys: ['Lact'], tat: 10},
  CD4: {name: 'CD4 count', keys: ['CD4'], tat: 240},
  VL: {name: 'HIV viral load', keys: ['VL'], tat: 2880},
  STREP: {name: 'ASOT + anti-DNase B', keys: ['ASOT', 'AntiDNase'], tat: 240},
  COMP: {name: 'Complement C3, C4', keys: ['C3', 'C4'], tat: 240},
  PSA: {name: 'PSA', keys: ['PSA'], tat: 240},
  TUMR: {name: 'Tumour markers (CEA, CA-125, CA 15-3)', keys: ['CEA', 'CA125', 'CA153'], tat: 240},
  FACT: {name: 'Factor VIII, factor IX, vWF studies', keys: ['F8', 'F9', 'vWFAg', 'vWFAct'], tat: 1440},
  UPCR: {name: 'Urine protein:creatinine + albumin:creatinine', keys: ['UPCR', 'UACR'], tat: 120},
  BHCG: {name: 'Serum β-hCG', keys: ['bhcg'], tat: 60},
  BONE: {name: 'Vitamin D + PTH', keys: ['Vit25', 'PTH'], tat: 1440},
  CORT: {name: 'Cortisol', keys: ['Cort'], tat: 240},
};

/* ---------- investigation catalogue ---------- */
// id: [name, group, tat-min, kind, default result]
const INV = {
  ECG: ['12-lead ECG', 'Bedside', 5, 'ecg'],
  GLUCO: ['Finger-prick glucose', 'Bedside', 1, 'text', 'Glucose within normal range.'],
  DIP: ['Urine dipstick', 'Bedside', 3, 'text', 'Protein neg · Blood neg · Leukocytes neg · Nitrites neg · Glucose neg · Ketones neg · SG 1.015 · pH 6'],
  UPT: ['Urine pregnancy test', 'Bedside', 3, 'text', 'Negative'],
  PEF: ['Peak expiratory flow', 'Bedside', 3, 'text', 'PEF within 10% of predicted.'],
  RDT: ['Malaria rapid diagnostic test', 'Bedside', 15, 'text', 'Negative (HRP2 and pLDH bands absent).'],
  HIVR: ['HIV rapid test (with consent)', 'Bedside', 15, 'text', 'Non-reactive.'],
  FUND: ['Fundoscopy', 'Bedside', 3, 'text', 'Normal discs, vessels and macula bilaterally.'],
  SPIRO: ['Spirometry (pre/post bronchodilator)', 'Bedside', 30, 'text', 'FEV₁/FVC 0.80, FEV₁ 96% predicted. No significant reversibility.'],
  PANEL_FBC: ['FBC + differential', 'Bloods', 60, 'panel', 'FBC'],
  PANEL_UE: ['U&E + creatinine', 'Bloods', 60, 'panel', 'UE'],
  PANEL_LFT: ['LFTs', 'Bloods', 60, 'panel', 'LFT'],
  PANEL_CMP: ['Ca, Mg, PO₄', 'Bloods', 60, 'panel', 'CMP'],
  PANEL_CRP: ['CRP', 'Bloods', 60, 'panel', 'CRP'],
  PANEL_ESR: ['ESR', 'Bloods', 60, 'panel', 'ESR'],
  PANEL_PCT: ['Procalcitonin', 'Bloods', 90, 'panel', 'PCT'],
  PANEL_TROP: ['Troponin (hs-TnT) + CK', 'Bloods', 60, 'panel', 'TROP'],
  PANEL_BNP: ['NT-proBNP', 'Bloods', 90, 'panel', 'BNP'],
  PANEL_DDIM: ['D-dimer', 'Bloods', 60, 'panel', 'DDIM'],
  PANEL_LIP: ['Lipase + amylase', 'Bloods', 60, 'panel', 'LIP'],
  PANEL_COAG: ['Coagulation screen', 'Bloods', 60, 'panel', 'COAG'],
  PANEL_URATE: ['Uric acid', 'Bloods', 60, 'panel', 'URATE'],
  PANEL_GLUC: ['Glucose + HbA1c', 'Bloods', 60, 'panel', 'GLUC'],
  PANEL_LIPID: ['Lipogram', 'Bloods', 120, 'panel', 'LIPID'],
  PANEL_TFT: ['Thyroid function', 'Bloods', 120, 'panel', 'TFT'],
  PANEL_IRON: ['Iron studies', 'Bloods', 120, 'panel', 'IRON'],
  PANEL_HAEMAT: ['B12 + folate', 'Bloods', 240, 'panel', 'HAEMAT'],
  PANEL_HAEMOL: ['Haemolysis screen', 'Bloods', 90, 'panel', 'HAEMOL'],
  PANEL_ABG: ['Arterial blood gas', 'Bedside', 10, 'panel', 'ABG'],
  PANEL_LACT: ['Lactate', 'Bedside', 10, 'panel', 'LACT'],
  PANEL_CD4: ['CD4 count', 'Bloods', 240, 'panel', 'CD4'],
  PANEL_VL: ['HIV viral load', 'Bloods', 2880, 'panel', 'VL'],
  PANEL_STREP: ['ASOT + anti-DNase B', 'Bloods', 240, 'panel', 'STREP'],
  PANEL_COMP: ['Complement C3/C4', 'Bloods', 240, 'panel', 'COMP'],
  PANEL_PSA: ['PSA', 'Bloods', 240, 'panel', 'PSA'],
  PANEL_TUMR: ['Tumour markers', 'Bloods', 240, 'panel', 'TUMR'],
  PANEL_FACT: ['Factor VIII/IX + vWF studies', 'Bloods', 1440, 'panel', 'FACT'],
  PANEL_UPCR: ['Urine PCR/ACR', 'Bloods', 120, 'panel', 'UPCR'],
  PANEL_BHCG: ['Serum β-hCG', 'Bloods', 60, 'panel', 'BHCG'],
  PANEL_BONE: ['Vitamin D + PTH', 'Bloods', 1440, 'panel', 'BONE'],
  FILM: ['Peripheral blood smear', 'Bloods', 90, 'text', 'Normochromic normocytic red cells. Normal white cell and platelet morphology.'],
  MALSMEAR: ['Malaria thick + thin smear', 'Bloods', 60, 'text', 'No malaria parasites seen on thick and thin films.'],
  SERO: ['Autoimmune screen (ANA, anti-dsDNA, RF, anti-CCP)', 'Bloods', 1440, 'text', 'ANA negative. Anti-dsDNA negative. RF < 14 IU/mL. Anti-CCP negative.'],
  HBEP: ['Hb electrophoresis / HPLC', 'Bloods', 1440, 'text', 'HbA 97%, HbA₂ 2.6%, HbF 0.4%. Normal pattern.'],
  GXM: ['Group and crossmatch', 'Bloods', 45, 'text', 'Group O Rh(D) positive. Antibody screen negative. Units available.'],
  BC: ['Blood cultures ×2', 'Micro', 2880, 'text', 'No growth after 5 days.'],
  SPXP: ['Sputum Xpert MTB/RIF Ultra', 'Micro', 180, 'text', 'MTB not detected.'],
  SPMCS: ['Sputum MC&S', 'Micro', 2880, 'text', 'Normal upper respiratory flora.'],
  UMCS: ['Urine MC&S', 'Micro', 2880, 'text', 'No significant growth. WCC < 10/µL.'],
  STOOL: ['Stool MC&S + ova, cysts, parasites', 'Micro', 2880, 'text', 'No enteric pathogens isolated. No ova, cysts or parasites seen.'],
  THROAT: ['Throat swab culture', 'Micro', 2880, 'text', 'Normal oropharyngeal flora.'],
  CRAG: ['Serum cryptococcal antigen (CrAg)', 'Micro', 60, 'text', 'Negative.'],
  NPA: ['Nasopharyngeal aspirate (respiratory PCR panel)', 'Micro', 240, 'text', 'No respiratory viruses detected.'],
  ASP: ['Joint aspiration (cell count, Gram, crystals, culture)', 'Procedures', 60, 'text', 'Straw-coloured, WCC 300/µL, no crystals, Gram stain negative.'],
  LP: ['Lumbar puncture (CSF analysis)', 'Procedures', 60, 'text', 'Clear CSF. WCC 2/µL, protein 0.3 g/L, glucose 3.4 mmol/L (serum 5.5). Gram stain negative.'],
  ASCT: ['Diagnostic ascitic tap', 'Procedures', 60, 'text', 'No ascites to tap.'],
  PLEU: ['Diagnostic pleural tap', 'Procedures', 60, 'text', 'No effusion to tap.'],
  CXR: ['Chest X-ray (PA erect)', 'Imaging', 20, 'cxr'],
  AXR: ['Abdominal X-ray', 'Imaging', 30, 'text', 'Normal bowel gas pattern. No dilated loops, no free air, no calcification.'],
  XR: ['X-ray of the affected region', 'Imaging', 30, 'xr'],
  USABD: ['Ultrasound abdomen', 'Imaging', 45, 'text', 'Normal liver, gallbladder, CBD, pancreas, spleen and kidneys. No free fluid.'],
  USKUB: ['Ultrasound kidneys + bladder', 'Imaging', 45, 'text', 'Kidneys normal size and echotexture; no hydronephrosis. Bladder normal.'],
  ECHO: ['Echocardiogram', 'Imaging', 60, 'text', 'Normal chamber sizes. LVEF 60–65%. Valves normal. No pericardial effusion.'],
  DOPP: ['Lower limb venous Doppler', 'Imaging', 45, 'text', 'Compressible deep veins bilaterally. No DVT.'],
  CTH: ['CT head (non-contrast)', 'Imaging', 40, 'text', 'No acute intracranial abnormality.'],
  CTKUB: ['CT KUB (non-contrast)', 'Imaging', 40, 'text', 'No urinary tract calculi. No hydronephrosis.'],
  CTPA: ['CT pulmonary angiogram', 'Imaging', 60, 'text', 'No pulmonary embolus.'],
  CTABD: ['CT abdomen (contrast)', 'Imaging', 60, 'text', 'No acute abdominal abnormality.'],
  CTCH: ['CT chest (HRCT)', 'Imaging', 60, 'text', 'Normal lung parenchyma and airways.'],
  MRIS: ['MRI whole spine', 'Imaging', 120, 'text', 'Normal alignment. No cord or cauda equina compression.'],
  MRIK: ['MRI knee', 'Imaging', 120, 'text', 'Intact cruciate and collateral ligaments. Menisci intact.'],
  DEXA: ['DEXA scan', 'Imaging', 1440, 'text', 'T-score −0.4 (lumbar spine), −0.6 (femoral neck). Normal BMD.'],
  MAMMO: ['Mammogram + breast ultrasound', 'Imaging', 120, 'text', 'BI-RADS 1: negative.'],
  OGD: ['Upper GI endoscopy (OGD)', 'Procedures', 120, 'text', 'Normal oesophagus, stomach and duodenum. CLO test negative.'],
  COLO: ['Colonoscopy', 'Procedures', 240, 'text', 'Normal colonic mucosa to the terminal ileum.'],
  BX: ['Tissue biopsy + histology', 'Procedures', 4320, 'text', 'Benign tissue. No malignancy.'],
  BMA: ['Bone marrow aspirate + trephine', 'Procedures', 4320, 'text', 'Normocellular marrow with normal trilineage haematopoiesis.'],
  PAP: ['Cervical cytology / colposcopy', 'Procedures', 2880, 'text', 'Negative for intraepithelial lesion or malignancy.'],
  CTG: ['Cardiotocography (CTG)', 'Bedside', 30, 'text', 'Baseline 140 bpm, good variability, accelerations present, no decelerations.'],
};

/* ---------- formulary + procedures ---------- */
// key|Display name|aliases|classes
const FORMULARY_SRC = `
oxygen_np|Oxygen via nasal prongs (2–4 L/min)|nasal cannula,oxygen,o2|o2
oxygen_fm|Oxygen via face mask (6–10 L/min)|face mask,oxygen mask,o2 mask|o2 o2high
oxygen_nrb|Oxygen via non-rebreather (15 L/min)|non rebreather,nrb,high flow oxygen,100% oxygen|o2 o2high
oxygen_venturi|Controlled oxygen: Venturi 24–28% (target 88–92%)|venturi,controlled oxygen,28% oxygen|o2 o2controlled
ivfluid_bolus|IV crystalloid bolus (Ringer's lactate / 0.9% saline)|fluid bolus,ringers,ringer lactate,normal saline,saline,crystalloid,iv fluids,fluids,plasmalyte|fluid
ivfluid_maint|IV maintenance fluids|maintenance fluids|fluidmaint
ors|Oral rehydration solution (ORS)|ors,oral rehydration|ors
zinc|Zinc supplementation|zinc|zinc
blood_prbc|Packed red cell transfusion|blood transfusion,packed cells,prbc,red cells,transfuse|prbc
platelets|Platelet transfusion|platelets,platelet transfusion|platelets
ffp|Fresh frozen plasma|ffp,plasma|ffp
cryo|Cryoprecipitate|cryo|cryo
f8|Factor VIII concentrate|factor 8,factor viii,fviii|f8
f9|Factor IX concentrate|factor 9,factor ix,fix|f9
ddavp|Desmopressin (DDAVP)|desmopressin,ddavp|ddavp
txa|Tranexamic acid|tranexamic,txa|txa
vitk|Vitamin K (phytomenadione)|vitamin k,phytomenadione|vitk
adrenaline_im|Adrenaline 0.5 mg IM (1:1000) into anterolateral thigh|epinephrine im,adrenaline im,epipen,adrenaline,epinephrine|adrenaline_im
adrenaline_iv|Adrenaline IV bolus|iv adrenaline,epinephrine iv|adrenaline_iv
chlorphen|Chlorphenamine (antihistamine)|chlorpheniramine,chlorphenamine,antihistamine,promethazine,cetirizine,loratadine|antihist
hydrocort|Hydrocortisone IV|hydrocortisone|steroid steroid_sys
prednisone|Prednisone / prednisolone (oral)|prednisone,prednisolone,oral steroid|steroid steroid_sys
methylpred|Methylprednisolone IV|methylprednisolone,solumedrol|steroid steroid_sys
dexameth|Dexamethasone|dexamethasone|steroid steroid_sys
salb_neb|Salbutamol nebulisation|salbutamol,ventolin,albuterol,saba,beta agonist neb|saba
ipra_neb|Ipratropium bromide nebulisation|ipratropium,atrovent|sama
mgso4|Magnesium sulfate IV|magnesium sulphate,magnesium sulfate,mgso4|mgso4
aminoph|Aminophylline IV|aminophylline,theophylline|theoph
bud_form|Budesonide-formoterol inhaler (ICS-formoterol)|symbicort,budesonide formoterol,ics formoterol,ics-laba|ics laba
beclo|Beclomethasone inhaler (ICS)|beclomethasone,inhaled steroid,ics,fluticasone inhaler|ics
salmeterol|Salmeterol (LABA) alone|salmeterol,laba alone|laba labamono
tiotropium|Tiotropium (LAMA)|tiotropium,lama,spiriva|lama
lama_laba|LAMA + LABA inhaler|lama laba,lama+laba,umeclidinium vilanterol|lama laba
montelukast|Montelukast|montelukast,leukotriene receptor antagonist|ltra
azithro|Azithromycin|azithromycin,zithromax|abx macrolide
clarithro|Clarithromycin|clarithromycin|abx macrolide
amoxil|Amoxicillin|amoxicillin,amoxil|abx pen
coamox|Amoxicillin-clavulanate (co-amoxiclav)|augmentin,co-amoxiclav,amoxicillin clavulanate|abx pen
penv|Phenoxymethylpenicillin (penicillin VK)|penicillin v,pen vk,phenoxymethylpenicillin|abx pen
bicillin|Benzathine penicillin G IM (Bicillin)|benzathine penicillin,bicillin,bpg|abx pen
benzpen|Benzylpenicillin IV|benzylpenicillin,penicillin g|abx pen
cloxa|Cloxacillin / flucloxacillin|cloxacillin,flucloxacillin|abx pen
cefaz|Cefazolin IV|cefazolin|abx ceph
ceftri|Ceftriaxone IV|ceftriaxone,rocephin|abx ceph
cefurox|Cefuroxime|cefuroxime|abx ceph
piptaz|Piperacillin-tazobactam|tazocin,pip-taz,piperacillin|abx pen
meropen|Meropenem|meropenem,carbapenem|abx carb
vanco|Vancomycin|vancomycin|abx vanco nephrotox
genta|Gentamicin|gentamicin,amikacin,aminoglycoside|abx amino nephrotox
cipro|Ciprofloxacin|ciprofloxacin,cipro,levofloxacin,moxifloxacin,fluoroquinolone|abx fq
doxy|Doxycycline|doxycycline,tetracycline|abx tetra
metro|Metronidazole|metronidazole,flagyl|abx metro
tinid|Tinidazole|tinidazole|abx metro
cotrim|Co-trimoxazole|cotrimoxazole,bactrim,co-trimoxazole,trimethoprim|abx cotrim kraise
nitazox|Nitazoxanide|nitazoxanide|antipara
rhze|RHZE fixed-dose combination (rifampicin, isoniazid, pyrazinamide, ethambutol)|rhze,rifafour,tb treatment,anti-tb,antituberculous,rifampicin isoniazid pyrazinamide ethambutol|antitb rif inh
rif|Rifampicin|rifampicin,rifampin|antitb rif
inh|Isoniazid|isoniazid,inh|antitb inh
pyridox|Pyridoxine (vitamin B6)|pyridoxine,vitamin b6|b6
tld|TLD (tenofovir, lamivudine, dolutegravir)|tld,art,arvs,antiretroviral,tenofovir lamivudine dolutegravir|arv dtg tdf
dtg|Dolutegravir (extra dose)|dolutegravir,dtg|arv dtg
efv|Efavirenz-based ART (TEE)|efavirenz,tee|arv efv tdf
fluco|Fluconazole|fluconazole|antifungal azole
ampho|Amphotericin B|amphotericin|antifungal nephrotox
nystatin|Nystatin oral suspension|nystatin,miconazole oral gel|antifungal_topical
coartem|Artemether-lumefantrine (Coartem)|artemether lumefantrine,coartem,artemether|antimalarial act
artesunate|Artesunate IV|artesunate,iv artesunate|antimalarial artesunate
quinine|Quinine IV|quinine|antimalarial quinine
primaq|Primaquine (single low dose)|primaquine|antimalarial primaquine
chloroq|Chloroquine|chloroquine|antimalarial chloroquine
oseltam|Oseltamivir|oseltamivir,tamiflu|antiviral
paracet|Paracetamol|paracetamol,acetaminophen,panado|paracetamol
ibuprofen|Ibuprofen|ibuprofen,brufen,nurofen|nsaid
diclofenac|Diclofenac|diclofenac,voltaren|nsaid
naproxen|Naproxen|naproxen|nsaid
indomethacin|Indomethacin|indomethacin|nsaid
celecoxib|Celecoxib|celecoxib,cox-2 inhibitor|nsaid cox2
morphine|Morphine|morphine,opioid|opioid
tramadol|Tramadol|tramadol|opioid
codeine|Codeine|codeine,codeine linctus|opioid antitussive
dextrometh|Dextromethorphan / pholcodine cough suppressant|cough syrup,cough mixture,dextromethorphan,pholcodine,cough suppressant|antitussive
mucolytic|Mucolytic (acetylcysteine / carbocisteine)|mucolytic,acetylcysteine,carbocisteine,bromhexine|mucolytic
aspirin|Aspirin|aspirin,asa,ecotrin,disprin|aspirin antiplatelet
clopid|Clopidogrel|clopidogrel,plavix,p2y12|p2y12 antiplatelet
ticag|Ticagrelor|ticagrelor,brilinta|p2y12 antiplatelet
enox|Enoxaparin (LMWH)|enoxaparin,clexane,lmwh,low molecular weight heparin|anticoag lmwh
ufh|Unfractionated heparin|heparin,ufh|anticoag ufh
warfarin|Warfarin|warfarin|anticoag warfarin
rivarox|Rivaroxaban / apixaban (DOAC)|rivaroxaban,apixaban,doac,noac,dabigatran|anticoag doac
streptok|Streptokinase (thrombolysis)|streptokinase,thrombolysis,fibrinolysis|thrombolytic
alteplase|Alteplase / tenecteplase|alteplase,tenecteplase,tpa,rtpa|thrombolytic
gtn|Glyceryl trinitrate (sublingual / IV)|gtn,nitroglycerin,glyceryl trinitrate,nitrates,isosorbide dinitrate,isordil|nitrate
ismn|Isosorbide mononitrate (long-acting)|isosorbide mononitrate,ismn|nitrate
atorva|Atorvastatin|atorvastatin,statin,simvastatin,rosuvastatin|statin
enalapril|Enalapril (ACE inhibitor)|enalapril,ace inhibitor,acei,perindopril,lisinopril,captopril,ramipril|acei kraise
losartan|Losartan (ARB)|losartan,arb,candesartan,valsartan,telmisartan|arb kraise
amlodipine|Amlodipine|amlodipine,ccb,calcium channel blocker|ccb_dhp
nifedipine|Nifedipine (long-acting)|nifedipine,adalat|ccb_dhp
verapamil|Verapamil|verapamil|ccb_ndhp ratectrl
diltiazem|Diltiazem|diltiazem|ccb_ndhp ratectrl
hctz|Hydrochlorothiazide|hctz,hydrochlorothiazide,thiazide,indapamide,chlorthalidone|thiazide
furosemide|Furosemide|furosemide,lasix,frusemide,loop diuretic,bumetanide|loop
spiro|Spironolactone|spironolactone,aldactone,mra,eplerenone|mra kraise
amiloride|Amiloride|amiloride|kspare kraise
kcl|Potassium chloride supplement|potassium chloride,kcl,slow k,potassium supplement|ksupp kraise
bisoprolol|Bisoprolol (β1-selective)|bisoprolol,beta blocker,metoprolol,atenolol,nebivolol|bb bb1
carvedilol|Carvedilol|carvedilol|bb bbns
propranolol|Propranolol (non-selective β-blocker)|propranolol,inderal,timolol|bb bbns
labetalol|Labetalol|labetalol|bb bbns antihtnpreg
methyldopa|Methyldopa|methyldopa,aldomet|methyldopa antihtnpreg
hydralazine|Hydralazine|hydralazine|hydralazine antihtnpreg
digoxin|Digoxin|digoxin,lanoxin|digoxin ratectrl
amiodarone|Amiodarone|amiodarone,cordarone|amiodarone
adenosine|Adenosine|adenosine|adenosine
atropine|Atropine|atropine|atropine
dapagli|Dapagliflozin / empagliflozin (SGLT2 inhibitor)|dapagliflozin,empagliflozin,sglt2|sglt2
sacval|Sacubitril-valsartan|sacubitril,entresto,arni|arb kraise
noradren|Noradrenaline infusion|noradrenaline,norepinephrine,vasopressor,levophed|pressor
dobutamine|Dobutamine infusion|dobutamine,inotrope|inotrope
insulin|Insulin|insulin,actrapid|insulin
metformin|Metformin|metformin|metformin
gliclazide|Gliclazide|gliclazide,sulfonylurea|su
insdex|Insulin + dextrose (for hyperkalaemia)|insulin dextrose,insulin and dextrose,actrapid dextrose|insdex
cagluc|Calcium gluconate 10% IV|calcium gluconate,calcium chloride|cagluc
resonium|Sodium polystyrene sulfonate (Kayexalate)|kayexalate,resonium,k binder|kbinder
bicarb|Sodium bicarbonate|sodium bicarbonate,bicarbonate|bicarb
dextrose|Dextrose 50% / 10% IV|dextrose,d50,glucose iv|dextrose
thiamine|Thiamine|thiamine,vitamin b1|thiamine
naloxone|Naloxone|naloxone,narcan|naloxone
ppi|Omeprazole / pantoprazole (PPI)|omeprazole,pantoprazole,ppi,proton pump inhibitor,esomeprazole,lansoprazole|ppi
h2|Ranitidine / famotidine (H2RA)|ranitidine,famotidine,h2 blocker|h2
hpylori|H. pylori eradication (PPI + amoxicillin + clarithromycin)|triple therapy,h pylori eradication,h. pylori eradication|hpylori ppi abx
antacid|Antacid / alginate|antacid,gaviscon,alginate|antacid
metoclop|Metoclopramide|metoclopramide,maxolon,prokinetic|metoclop
ondans|Ondansetron|ondansetron,zofran,antiemetic|antiemetic
loperamide|Loperamide|loperamide,imodium,antidiarrhoeal,antimotility|antimotility
buscopan|Hyoscine butylbromide (Buscopan)|buscopan,hyoscine,antispasmodic,mebeverine|antispasmodic
peppermint|Peppermint oil|peppermint oil|antispasmodic
amitrip|Low-dose amitriptyline|amitriptyline,tca|tca
lactulose|Lactulose|lactulose|laxative osmotic
peg|Macrogol (PEG)|macrogol,peg,polyethylene glycol,movicol|laxative osmotic
senna|Senna / bisacodyl (stimulant laxative)|senna,bisacodyl,stimulant laxative|laxative stimulant
fibre|Fibre supplement (psyllium)|fibre,psyllium,fybogel,bulk laxative|laxative bulk
mesalazine|Mesalazine (5-ASA)|mesalazine,5-asa,sulfasalazine,asacol|aminosal
azathio|Azathioprine|azathioprine,imuran|azathioprine immunosupp
inflix|Infliximab / adalimumab (anti-TNF)|infliximab,adalimumab,anti-tnf,biologic|antitnf immunosupp
octreotide|Octreotide infusion|octreotide|octreotide
terlipressin|Terlipressin|terlipressin|terlipressin
albumin|Albumin infusion|albumin|albumin
f75|F-75 therapeutic milk|f75,f-75|f75
f100|F-100 / RUTF|f100,f-100,rutf,plumpy nut|rutf
vita|Vitamin A|vitamin a|vita
ursodeox|Ursodeoxycholic acid|ursodeoxycholic,urso|urso
allopurinol|Allopurinol|allopurinol,zyloprim|ult allopurinol
febuxostat|Febuxostat|febuxostat|ult
colchicine|Colchicine|colchicine|colchicine
ia_steroid|Intra-articular corticosteroid injection|intra articular steroid,joint injection|steroid_ia
mtx|Methotrexate|methotrexate|mtx immunosupp dmard
hcq|Hydroxychloroquine|hydroxychloroquine,plaquenil|hcq dmard
ssz|Sulfasalazine (as DMARD)|sulfasalazine dmard|dmard
alendronate|Alendronate (oral bisphosphonate)|alendronate,bisphosphonate,fosamax,risedronate|bisphos
zoledronic|Zoledronic acid IV|zoledronic acid,zoledronate|bisphos
denosumab|Denosumab|denosumab|denosumab
calcvitd|Calcium + vitamin D supplementation|calcium,vitamin d,cholecalciferol,ergocalciferol,calcium carbonate|calcvitd
alfacalc|Alfacalcidol / calcitriol|alfacalcidol,calcitriol,1-alpha|alfacalc
epo|Erythropoietin (ESA)|epo,erythropoietin,epoetin,esa|epo
ferrous|Oral iron (ferrous sulfate)|ferrous sulphate,ferrous sulfate,iron tablets,oral iron,iron|iron
ivfe|IV iron (ferric carboxymaltose)|iv iron,ferric carboxymaltose,ferinject|iron ivfe
folic|Folic acid|folic acid,folate|folic
b12inj|Vitamin B12 injections|hydroxocobalamin,b12,cyanocobalamin|b12
desferal|Iron chelation (deferasirox / desferrioxamine)|deferasirox,desferrioxamine,chelation,exjade|chelator
hydroxyurea|Hydroxyurea|hydroxyurea,hydroxycarbamide|hydroxyurea
atg|Antithymocyte globulin + ciclosporin|atg,antithymocyte,ciclosporin,cyclosporine|ist immunosupp
eltromb|Eltrombopag|eltrombopag|eltromb
rituximab|Rituximab|rituximab|ritux immunosupp
cyclophos|Cyclophosphamide|cyclophosphamide|cyclophos immunosupp chemo
tamoxifen|Tamoxifen|tamoxifen|tamoxifen
letrozole|Letrozole / anastrozole (aromatase inhibitor)|letrozole,anastrozole,aromatase inhibitor|ai_drug
trastuz|Trastuzumab|trastuzumab,herceptin|trastuz
doxorub|Doxorubicin|doxorubicin,adriamycin|chemo anthracycline
paclitax|Paclitaxel / docetaxel|paclitaxel,docetaxel,taxane|chemo
cisplatin|Cisplatin|cisplatin,carboplatin|chemo nephrotox
mapchemo|MAP chemotherapy (methotrexate, doxorubicin, cisplatin)|map chemotherapy,neoadjuvant chemotherapy|chemo mtx anthracycline
goserelin|GnRH agonist (goserelin / leuprolide) – ADT|goserelin,leuprolide,leuprorelin,adt,androgen deprivation,zoladex|adt
bicalut|Bicalutamide (anti-androgen)|bicalutamide|antiandrogen
tamsulosin|Tamsulosin (α1-blocker)|tamsulosin,alpha blocker,doxazosin,alfuzosin|alpha
finasteride|Finasteride (5α-reductase inhibitor)|finasteride,dutasteride,5 alpha reductase|5ari
mannitol|Mannitol|mannitol|mannitol
statin_lowdose|Low-intensity statin|low dose statin|statin
pde5|Sildenafil|sildenafil,viagra,tadalafil|pde5
nirsevimab|Nirsevimab (RSV monoclonal antibody)|nirsevimab,palivizumab|rsvmab
nasal_ster|Intranasal corticosteroid|intranasal steroid,mometasone nasal,fluticasone nasal,nasal spray steroid,budesonide nasal|nasalster
decong|Topical nasal decongestant (oxymetazoline)|oxymetazoline,decongestant,pseudoephedrine|decong
saline_nasal|Saline nasal irrigation|saline nasal,nasal irrigation,nasal saline|nasalsaline
proc_iv|Insert two large-bore IV cannulas|iv access,cannula,large bore|proc
proc_cath|Urinary catheter + strict input/output|urinary catheter,catheter,foley|proc catheter
proc_ngt|Nasogastric tube|ng tube,nasogastric|proc
proc_intub|Intubate and ventilate (call anaesthetics)|intubate,intubation,ventilate,mechanical ventilation|proc intubate
proc_niv|Non-invasive ventilation (BiPAP / CPAP)|niv,bipap,cpap|proc niv
proc_needle|Needle decompression / chest drain|needle decompression,chest drain,intercostal drain,icd|proc chestdrain
proc_pericard|Pericardiocentesis|pericardiocentesis|proc
proc_pci|Primary PCI (activate cath lab)|pci,primary pci,cath lab,angioplasty,stent,angiogram|proc pci
proc_cabg|Refer for CABG|cabg,bypass|proc
proc_dccv|Synchronised DC cardioversion|cardioversion,dc shock,synchronised shock|proc dccv
proc_defib|Defibrillate (unsynchronised) + ALS|defibrillate,defibrillation,cpr,als|proc defib
proc_pace|Transcutaneous / transvenous pacing|pacing,pacemaker|proc pace
proc_icu|Refer to ICU / high care|icu,high care,critical care|proc icu
proc_surg|Urgent surgical referral|surgeon,surgery,surgical referral,laparotomy|proc surgery
proc_ortho|Orthopaedic referral (reduction, fixation / ORIF)|orif,ortho,orthopaedic,reduction,internal fixation,im nail|proc ortho
proc_splint|Splint / immobilise, elevate, neurovascular checks|splint,backslab,immobilise,pop,cast|proc splint
proc_spine|Full spinal precautions (collar, log-roll, spinal board)|spinal precautions,c-collar,collar,log roll,spinal immobilisation|proc spine
proc_decomp|Urgent MRI + surgical decompression|decompression,spinal surgery,neurosurgery|proc decomp
proc_washout|Joint washout (arthrotomy / arthroscopic)|washout,arthrotomy,joint washout|proc washout
proc_dialysis|Haemodialysis|dialysis,haemodialysis,hemodialysis,rrt|proc dialysis
proc_plex|Plasma exchange|plasma exchange,plasmapheresis|proc plex
proc_parac|Therapeutic paracentesis (with albumin cover)|paracentesis,ascitic drain|proc
proc_band|Endoscopic variceal band ligation|banding,band ligation,evl|proc band
proc_endohaem|Endoscopic haemostasis (clip / injection / thermal)|endoscopic haemostasis,therapeutic endoscopy,clip|proc endohaem
proc_ercp|ERCP|ercp|proc
proc_chole|Laparoscopic cholecystectomy|cholecystectomy|proc chole
proc_urol|Urology referral (ureteroscopy / stent / nephrostomy)|ureteroscopy,stent,nephrostomy,lithotripsy,eswl,urology|proc urol
proc_turp|TURP|turp,prostatectomy|proc
proc_radio|Radiotherapy referral|radiotherapy,radiation|proc
proc_onc|Oncology referral / MDT|oncology,mdt,oncologist|proc onc
proc_pall|Palliative care referral|palliative,hospice|proc
proc_isol|Respiratory isolation + N95 for staff|isolation,n95,isolate|proc isolate
proc_notify|Notify (NMC) + contact tracing|notify,notification,contact tracing,nmc|proc notify
proc_dots|DOT + adherence counselling|dots,dot,adherence counselling,adherence|proc
proc_physio|Physiotherapy / rehab|physio,physiotherapy,rehab|proc
proc_diet|Dietician referral|dietician,dietitian,nutrition|proc diet
proc_smoke|Smoking cessation counselling|smoking cessation,quit smoking|proc smoke
proc_lifestyle|Lifestyle modification (diet, salt, exercise, weight)|lifestyle,diet,exercise,weight loss,salt restriction|proc lifestyle
proc_suction|Nasal suctioning + positioning|suction,nasal suction|proc
proc_ngfeed|NG feeding / IV fluids for hydration|ng feeds,nasogastric feeds|proc
proc_tourniquet|Direct pressure / elevate|pressure,compression|proc
proc_rice|Rest, ice, compression, elevation|rice,ice|proc
proc_acl|ACL reconstruction referral + prehab|acl reconstruction,reconstruction|proc
proc_cooling|Active cooling / antipyresis|cooling,tepid|proc
proc_elevate|Sit patient upright|sit upright,upright position|proc upright
proc_left|Left lateral position|left lateral|proc
proc_counsel|Counselling + education|counselling,education,counsel|proc counsel
proc_stop|Stop/hold regular medicines (sick-day rules)|stop medication,hold medication,stop meds,hold,stop nsaid,stop ace inhibitor,stop metformin,sick day rules,withhold|proc stopmed
`;
const FORMULARY = FORMULARY_SRC.trim().split('\n').map(l => {
  const [key, name, al, cls] = l.split('|');
  return {key, name, aliases: al.split(',').map(s => s.trim().toLowerCase()), cls: cls.trim().split(/\s+/)};
});
const DRUG = Object.fromEntries(FORMULARY.map(d => [d.key, d]));

function searchFormulary(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const d of FORMULARY) {
    const n = d.name.toLowerCase();
    let s = 0;
    if (n === q || d.aliases.includes(q)) s = 4; else if (n.startsWith(q)) s = 3; else if (d.aliases.some(a => a.startsWith(q))) s = 2.5; else if (n.includes(q)) s = 2; else if (d.aliases.some(a => a.includes(q))) s = 1;
    if (s) out.push([s, d]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
}

/* ---------- global consequence rules ----------
   ctx = {p, given:Set(keys), cls:Set(classes incl. home meds), d (drug being ordered), v, lab}
   Return sev: 'harm' (real harm), 'warn' (caution / suboptimal) */
const has = (ctx, c) => ctx.cls.has(c);
const dIs = (ctx, ...cs) => cs.some(c => ctx.d.cls.includes(c) || ctx.d.key === c);
const RULES = [
  {when: c => dIs(c, 'acei', 'arb') && c.p.flags.pregnant, sev: 'harm', title: 'Teratogenic in pregnancy',
    msg: c => `${c.p.first} is ${c.p.flags.ga || 'several'} weeks pregnant. ACE inhibitors and ARBs cross the placenta and block the fetal RAAS — fetal renal dysgenesis, oligohydramnios, skull hypoplasia, IUGR and neonatal renal failure (worst in the 2nd/3rd trimester). Stop it. Pregnancy-safe antihypertensives: methyldopa, nifedipine (long-acting), labetalol, hydralazine.`},
  {when: c => dIs(c, 'statin', 'warfarin', 'mtx', 'tetra', 'fq') && c.p.flags.pregnant, sev: 'harm', title: 'Avoid in pregnancy',
    msg: c => `${c.d.name} is avoided in pregnancy. ${dIs(c, 'warfarin') ? 'Warfarin causes embryopathy (nasal hypoplasia, stippled epiphyses) in weeks 6–12 and fetal intracranial bleeding later — use LMWH.' : dIs(c, 'statin') ? 'Statins block cholesterol synthesis needed for fetal development — stop until after delivery/breastfeeding.' : dIs(c, 'mtx') ? 'Methotrexate is an abortifacient and teratogen (folate antagonist).' : dIs(c, 'tetra') ? 'Tetracyclines bind calcium in fetal teeth and bone (discolouration, impaired growth).' : 'Fluoroquinolones are avoided because of cartilage toxicity in animal studies — choose a β-lactam or macrolide.'}`},
  {when: c => dIs(c, 'mra', 'kspare', 'ksupp') && (has(c, 'acei') || has(c, 'arb')) && (c.lab.K >= 5.0 || (c.lab.eGFR || 90) < 45), sev: 'harm', title: 'Hyperkalaemia',
    msg: c => `${c.d.name} on top of an ${has(c, 'acei') ? 'ACE inhibitor' : 'ARB'} with ${c.lab.K >= 5 ? `K⁺ already ${c.lab.K}` : `eGFR ${c.lab.eGFR}`}: both reduce aldosterone effect at the collecting duct (ACEi ↓ aldosterone production; ${dIs(c, 'mra') ? 'spironolactone blocks the mineralocorticoid receptor' : dIs(c, 'kspare') ? 'amiloride blocks ENaC so Na⁺ is not swapped for K⁺' : 'you are adding K⁺ directly'}). Less K⁺ is secreted into the urine → K⁺ climbs. Watch the ECG: peaked T waves → flattened P, wide QRS → sine wave → VF.`,
    fx: {lab: {K: +1.4}}},
  {when: c => dIs(c, 'acei') && has(c, 'arb') || dIs(c, 'arb') && has(c, 'acei'), sev: 'harm', title: 'Dual RAAS blockade',
    msg: () => 'ACE inhibitor + ARB together: no outcome benefit, but more hyperkalaemia, hypotension and AKI (ONTARGET). Use one or the other.', fx: {lab: {K: +0.6}}},
  {when: c => dIs(c, 'acei', 'arb') && (c.p.flags.aki || c.p.flags.hypovolaemic), sev: 'harm', title: 'RAAS blockade in a volume-depleted / AKI patient',
    msg: () => 'In AKI or hypovolaemia the kidney depends on angiotensin II constricting the efferent arteriole to keep GFR up. An ACEi/ARB dilates the efferent arteriole → glomerular pressure and GFR fall further. Hold it until renal function and volume recover.', fx: {lab: {Cr: +60, K: +0.4}}},
  {when: c => dIs(c, 'bb') && (c.p.flags.asthma), sev: 'harm', title: 'β-blocker in asthma',
    msg: () => 'β-blockers (even "cardioselective" ones at higher doses) block β2 receptors on bronchial smooth muscle → bronchospasm, and they blunt the response to salbutamol. Avoid all β-blockers in asthma.', fx: {v: {sat: -5, rr: +6}, sign: 'wheeze'}},
  {when: c => dIs(c, 'bb', 'ccb_ndhp') && (c.v.hr < 55 || c.p.flags.heartblock), sev: 'harm', title: 'Rate-slowing drug in bradycardia / heart block',
    msg: c => `Heart rate is ${c.v.hr}. β-blockers and non-dihydropyridine CCBs slow SA and AV node conduction — this can tip ${c.p.first} into complete heart block or asystole.`, fx: {v: {hr: -15, sbp: -15}}},
  {when: c => (dIs(c, 'bb') && has(c, 'ccb_ndhp')) || (dIs(c, 'ccb_ndhp') && has(c, 'bb')), sev: 'harm', title: 'β-blocker + verapamil/diltiazem',
    msg: () => 'Both block the AV node and depress contractility — risk of severe bradycardia, heart block, asystole and heart failure.', fx: {v: {hr: -20, sbp: -15}}},
  {when: c => dIs(c, 'ccb_ndhp') && c.p.flags.hfref, sev: 'harm', title: 'Negative inotrope in HFrEF',
    msg: () => 'Verapamil/diltiazem are negatively inotropic and worsen heart failure with reduced EF. If a CCB is needed, use amlodipine.', fx: {v: {sat: -3, rr: +4}}},
  {when: c => dIs(c, 'bb') && (c.p.flags.cardiogenic || c.p.flags.acuteHF), sev: 'harm', title: 'β-blocker in acute decompensated HF / shock',
    msg: () => 'Do not start (or up-titrate) a β-blocker while the patient is acutely decompensated or in cardiogenic shock — it removes the sympathetic support keeping cardiac output up. Start low once euvolaemic and stable.', fx: {v: {sbp: -15}}},
  {when: c => dIs(c, 'nitrate') && (c.v.sbp < 90 || c.p.flags.rvInfarct || has(c, 'pde5') || c.p.flags.pde5), sev: 'harm', title: 'Nitrate → profound hypotension',
    msg: c => c.p.flags.rvInfarct ? 'Inferior STEMI with RV involvement: the RV is preload-dependent. Nitrates venodilate, preload falls and cardiac output collapses. Check V4R before giving GTN in inferior MI; treat hypotension with fluid.' : (has(c, 'pde5') || c.p.flags.pde5) ? 'Sildenafil/tadalafil in the last 24–48 h: PDE5 inhibitors + nitrates both raise cGMP → severe, refractory hypotension.' : `Systolic BP is ${c.v.sbp}. Nitrates are contraindicated with SBP < 90 mmHg.`, fx: {v: {sbp: -30, hr: +15, gcs: -2}}},
  {when: c => dIs(c, 'nsaid') && c.p.flags.asthma && c.p.flags.aerd !== false, sev: 'warn', title: 'NSAID in asthma',
    msg: () => 'COX-1 inhibition shunts arachidonic acid down the 5-lipoxygenase pathway → more cysteinyl leukotrienes → bronchospasm in NSAID-sensitive asthma (AERD). Prefer paracetamol.'},
  {when: c => dIs(c, 'nsaid', 'aspirin') && (c.p.flags.pud || c.p.flags.gibleed), sev: 'harm', title: 'NSAID/aspirin with peptic ulcer or GI bleed',
    msg: () => 'NSAIDs inhibit COX-1 → less prostaglandin E2/I2 → less mucus and bicarbonate, more acid, reduced mucosal blood flow, plus impaired platelet function. In someone with an ulcer or bleed this causes rebleeding or perforation.', fx: {v: {hr: +12, sbp: -12}, lab: {Hb: -1.2}}},
  {when: c => dIs(c, 'nsaid') && ((c.lab.eGFR || 90) < 45 || c.p.flags.aki || c.p.flags.ckd), sev: 'harm', title: 'NSAID in kidney disease',
    msg: () => 'Prostaglandins dilate the afferent arteriole to protect GFR when perfusion is low. NSAIDs remove that → afferent constriction → GFR falls (AKI), plus Na⁺/water retention and hyperkalaemia. Combined with ACEi + diuretic it is the "triple whammy".', fx: {lab: {Cr: +45, K: +0.4}}},
  {when: c => dIs(c, 'nsaid') && (c.p.flags.hfref || c.p.flags.acuteHF), sev: 'harm', title: 'NSAID in heart failure',
    msg: () => 'NSAIDs cause Na⁺ and water retention and blunt diuretics → fluid overload and decompensation.', fx: {v: {sat: -3, rr: +3}}},
  {when: c => dIs(c, 'nsaid') && c.p.flags.pregnant && (c.p.flags.ga || 0) >= 28, sev: 'harm', title: 'NSAID in third trimester',
    msg: () => 'NSAIDs after ~28 weeks cause premature closure of the ductus arteriosus (PGE2 keeps it open) and oligohydramnios. Use paracetamol.'},
  {when: c => dIs(c, 'nsaid', 'aspirin', 'anticoag', 'antiplatelet') && c.p.flags.bleedingDisorder, sev: 'harm', title: 'Antiplatelet/anticoagulant in a bleeding disorder',
    msg: c => `${c.p.first} has a bleeding disorder. ${c.d.name} adds a platelet or coagulation defect on top → haemarthrosis, muscle haematoma, GI or intracranial bleeding.`, fx: {lab: {Hb: -1}}},
  {when: c => dIs(c, 'aspirin') && c.p.age < 16 && !c.p.flags.kawasaki && !c.p.flags.arfOK, sev: 'harm', title: 'Aspirin in a child',
    msg: () => 'Aspirin in children (especially with a viral illness) is linked to Reye syndrome — acute encephalopathy and fatty liver. Use paracetamol (or ibuprofen if not contraindicated).'},
  {when: c => dIs(c, 'thiazide', 'loop') && c.p.flags.gout, sev: 'warn', title: 'Diuretic in gout',
    msg: () => 'Thiazide and loop diuretics compete with urate for the OAT secretory transporter in the proximal tubule and cause volume contraction → ↑ urate reabsorption → precipitates gout. Losartan is mildly uricosuric if an antihypertensive is needed.'},
  {when: c => dIs(c, 'loop', 'thiazide') && (c.p.flags.hypovolaemic || c.p.flags.prerenal), sev: 'harm', title: 'Diuretic in a dry patient',
    msg: () => 'This patient is volume depleted (pre-renal). A diuretic removes more volume → lower renal perfusion → worse AKI and hypotension. Give fluid first.', fx: {v: {sbp: -12, hr: +10}, lab: {Cr: +40, Urea: +4}}},
  {when: c => dIs(c, 'metformin') && ((c.lab.eGFR || 90) < 30 || c.p.flags.aki || c.p.flags.shock || c.p.flags.sepsis), sev: 'harm', title: 'Metformin → lactic acidosis risk',
    msg: () => 'Metformin is renally cleared and inhibits hepatic gluconeogenesis from lactate. With eGFR < 30, AKI, sepsis or shock (tissue hypoxia + poor clearance) it accumulates → lactic acidosis. Hold it (sick-day rule).', fx: {lab: {Lact: +2}}},
  {when: c => dIs(c, 'steroid_sys') && c.p.flags.ks, sev: 'harm', title: 'Glucocorticoids in Kaposi sarcoma',
    msg: () => 'Steroids can cause explosive progression of KS (they enhance HHV-8 replication and spindle-cell proliferation) — even in KS-IRIS, where steroids are otherwise used for IRIS. Avoid unless life-threatening alternative indication.'},
  {when: c => dIs(c, 'steroid_sys') && c.p.flags.cerebralMalaria, sev: 'harm', title: 'Steroids in cerebral malaria',
    msg: () => 'Dexamethasone in cerebral malaria prolonged coma and increased complications in trials — not recommended.'},
  {when: c => dIs(c, 'steroid_sys') && c.p.flags.untreatedTB, sev: 'warn', title: 'Steroids before TB treatment',
    msg: () => 'Systemic steroids before anti-TB therapy is established can unmask/disseminate TB. Exclude/treat TB first (steroids only for specific indications, e.g. TB meningitis/pericarditis, with RHZE).'},
  {when: c => dIs(c, 'pen', 'ceph', 'carb') && c.p.flags.penAllergy, sev: 'harm', title: 'Penicillin allergy on the wristband',
    msg: c => `${c.p.first} has a documented penicillin allergy (${c.p.flags.penAllergy}). ${dIs(c, 'pen') ? 'This is a penicillin — anaphylaxis risk.' : 'Cephalosporins/carbapenems share the β-lactam ring; cross-reactivity is low (~1–2%) but avoid after an anaphylactic reaction.'} Alternatives depend on the infection: macrolide, doxycycline, fluoroquinolone, clindamycin, vancomycin.`, fx: c => c.p.flags.penAllergy === 'anaphylaxis' ? {v: {sbp: -35, hr: +30, sat: -6}, sign: 'urticaria'} : {sign: 'rash'}},
  {when: c => dIs(c, 'cotrim') && c.p.flags.sulfaAllergy, sev: 'harm', title: 'Sulfonamide allergy', msg: () => 'Documented sulfa allergy — co-trimoxazole can cause SJS/TEN and anaphylaxis.'},
  {when: c => dIs(c, 'rif') && has(c, 'dtg') && !c.given.has('dtg'), sev: 'warn', title: 'Rifampicin ↔ dolutegravir interaction',
    msg: () => 'Rifampicin is a potent CYP3A4 and UGT1A1 inducer → dolutegravir levels drop ~50% → viral failure and resistance. Give dolutegravir 50 mg twice daily (extra 50 mg dose 12 h after TLD) for the duration of rifampicin + 2 weeks.'},
  {when: c => dIs(c, 'rif') && (has(c, 'warfarin') || c.p.flags.ocp), sev: 'warn', title: 'Rifampicin is an enzyme inducer',
    msg: c => has(c, 'warfarin') ? 'Rifampicin induces CYP2C9/3A4 → warfarin metabolised faster → INR falls → clot risk. Monitor INR closely and adjust.' : 'Rifampicin induces metabolism of oestrogen/progestogen → contraceptive failure. Use injectable or copper IUD.'},
  {when: c => dIs(c, 'inh') && !c.cls.has('b6') && !c.given.has('pyridox'), sev: 'warn', title: 'No pyridoxine with isoniazid',
    msg: () => 'Isoniazid depletes pyridoxine (B6) → peripheral neuropathy, especially in HIV, diabetes, alcohol use, malnutrition and pregnancy. Give pyridoxine 25 mg daily.'},
  {when: c => dIs(c, 'allopurinol', 'ult') && c.p.flags.acuteGout && !has(c, 'ult'), sev: 'warn', title: 'Starting urate-lowering therapy mid-flare',
    msg: () => 'Starting allopurinol during an acute attack shifts urate out of crystals and can prolong/worsen the flare. Treat the flare first (NSAID, colchicine or steroid); start ULT ~2 weeks later with flare prophylaxis (and do NOT stop existing allopurinol during a flare).'},
  {when: c => dIs(c, 'aspirin') && c.p.flags.gout && !c.p.flags.needsAspirin, sev: 'warn', title: 'Low-dose aspirin raises urate',
    msg: () => 'Low-dose aspirin reduces renal urate excretion — can precipitate gout.'},
  {when: c => dIs(c, 'o2high') && c.p.flags.co2retainer, sev: 'harm', title: 'Uncontrolled high-flow O₂ in a CO₂ retainer',
    msg: () => 'In chronic hypercapnic COPD, high-flow oxygen worsens V/Q mismatch (releases hypoxic pulmonary vasoconstriction), Haldane effect and reduces hypoxic drive → pCO₂ rises → CO₂ narcosis and respiratory acidosis. Use a Venturi 24–28% and target SpO₂ 88–92%.', fx: {v: {gcs: -3, rr: -6, sat: +5}, lab: {pCO2: +2.5, pH: -0.1}}},
  {when: c => dIs(c, 'opioid') && (c.p.flags.co2retainer || c.p.flags.headInjury), sev: 'harm', title: 'Opioid respiratory depression',
    msg: c => c.p.flags.headInjury ? 'Opioids in head injury depress ventilation → ↑ pCO₂ → cerebral vasodilation → ↑ ICP, and they mask the GCS.' : 'Opioids blunt the respiratory drive in a patient already retaining CO₂ → hypercapnic respiratory failure.', fx: {v: {rr: -6, gcs: -2}}},
  {when: c => dIs(c, 'fluid') && (c.p.flags.acuteHF || c.p.flags.pulmOedema), sev: 'harm', title: 'Fluid bolus into pulmonary oedema',
    msg: () => 'This patient is congested (raised JVP, crackles). More volume raises left atrial and pulmonary capillary pressure → more fluid in the alveoli → hypoxia.', fx: {v: {sat: -6, rr: +6}}},
  {when: c => dIs(c, 'fluid') && c.p.flags.sam, sev: 'harm', title: 'Rapid IV fluids in severe acute malnutrition',
    msg: () => 'Children with SAM have reduced cardiac reserve and Na⁺/K⁺ pump dysfunction — rapid IV fluid causes heart failure. Use ReSoMal orally/NG slowly; IV only for shock, and cautiously.', fx: {v: {sat: -5, rr: +8}}},
  {when: c => dIs(c, 'antimotility') && (c.p.flags.bloodyDiarrhoea || c.p.age < 12 || c.p.flags.invasiveDiarrhoea), sev: 'harm', title: 'Antimotility agent',
    msg: c => c.p.age < 12 ? 'Loperamide is contraindicated in young children (ileus, CNS depression) and not recommended in children with gastroenteritis.' : 'In dysentery (Shigella, EHEC, amoebic) slowing gut transit keeps invasive organisms/toxin in contact with the mucosa → toxic megacolon, prolonged illness and (EHEC) HUS.'},
  {when: c => dIs(c, 'platelets') && c.p.flags.ttp, sev: 'harm', title: 'Platelet transfusion in TTP',
    msg: () => 'In TTP ADAMTS13 is deficient, so ultra-large vWF multimers keep building microthrombi. Transfused platelets are consumed into new microthrombi ("fuel on the fire") → strokes, MI, renal failure. Treat with urgent plasma exchange.', fx: {v: {gcs: -2}, lab: {Cr: +40}}},
  {when: c => dIs(c, 'iron') && c.p.flags.thal, sev: 'harm', title: 'Iron in thalassaemia',
    msg: () => 'The microcytosis in thalassaemia is not iron deficiency — iron stores are normal/high (ineffective erythropoiesis ↑ absorption via ↓ hepcidin, plus transfusions). Extra iron worsens iron overload (heart, liver, endocrine). Check ferritin; chelate if overloaded.'},
  {when: c => dIs(c, 'f8') && c.p.flags.haemB, sev: 'harm', title: 'Wrong factor', msg: () => 'This is haemophilia B (factor IX deficiency). Factor VIII will not correct the defect — give factor IX concentrate.'},
  {when: c => dIs(c, 'f9') && c.p.flags.haemA, sev: 'harm', title: 'Wrong factor', msg: () => 'This is haemophilia A (factor VIII deficiency). Give factor VIII concentrate (or DDAVP in mild A).'},
  {when: c => dIs(c, 'primaquine') && (c.p.flags.pregnant || c.p.flags.g6pd || c.p.age < 1), sev: 'harm', title: 'Primaquine', msg: () => 'Primaquine causes oxidative haemolysis in G6PD deficiency and is avoided in pregnancy and infants.'},
  {when: c => dIs(c, 'chloroquine') && c.p.flags.falciparum, sev: 'harm', title: 'Chloroquine-resistant P. falciparum',
    msg: () => 'P. falciparum in southern Africa is chloroquine-resistant. Use artemether-lumefantrine (uncomplicated) or IV artesunate (severe).'},
  {when: c => dIs(c, 'act') && c.p.flags.severeMalaria, sev: 'harm', title: 'Oral treatment for severe malaria',
    msg: () => 'This is severe/complicated malaria (impaired consciousness, high parasitaemia, organ dysfunction). It needs IV artesunate for at least 24 h first, then a full oral course of artemether-lumefantrine.'},
  {when: c => dIs(c, 'anticoag', 'thrombolytic', 'antiplatelet') && (c.p.flags.activeBleed || c.p.flags.haemStroke || c.p.flags.dissection), sev: 'harm', title: 'Antithrombotic with active bleeding',
    msg: c => c.p.flags.dissection ? 'Aortic dissection: anticoagulation/thrombolysis extends the dissection and causes catastrophic bleeding.' : c.p.flags.haemStroke ? 'Haemorrhagic stroke: antithrombotics expand the haematoma.' : 'This patient is actively bleeding — anticoagulants/antiplatelets worsen haemorrhage.', fx: {v: {sbp: -20, hr: +15, gcs: -1}, lab: {Hb: -1.5}}},
  {when: c => dIs(c, 'anticoag', 'antiplatelet') && c.lab.Plt < 50, sev: 'harm', title: 'Antithrombotic with severe thrombocytopenia', msg: c => `Platelets ${c.lab.Plt} ×10⁹/L — major bleeding risk.`},
  {when: c => dIs(c, 'thrombolytic') && c.p.flags.noCT, sev: 'harm', title: 'Thrombolysis without imaging', msg: () => 'Never thrombolyse a stroke before CT excludes haemorrhage.'},
  {when: c => dIs(c, 'nephrotox') && ((c.lab.eGFR || 90) < 40 || c.p.flags.aki), sev: 'warn', title: 'Nephrotoxin in reduced renal function',
    msg: c => `${c.d.name} is nephrotoxic. With ${c.p.flags.aki ? 'AKI' : `eGFR ${c.lab.eGFR}`}, avoid or dose by levels/renal function.`, fx: {lab: {Cr: +25}}},
  {when: c => dIs(c, 'bisphos') && ((c.lab.eGFR || 90) < 35), sev: 'warn', title: 'Bisphosphonate in low eGFR', msg: () => 'Bisphosphonates are renally cleared — avoid when eGFR < 35 (consider denosumab).'},
  {when: c => dIs(c, 'digoxin') && (c.lab.K < 3.5), sev: 'harm', title: 'Digoxin with hypokalaemia', msg: () => 'Digoxin competes with K⁺ at the Na⁺/K⁺-ATPase; low K⁺ increases digoxin binding → toxicity and arrhythmias.'},
  {when: c => dIs(c, 'saba') && c.p.flags.bronchiolitis, sev: 'warn', title: 'Bronchodilator in bronchiolitis',
    msg: () => 'Bronchiolitis wheeze is from epithelial sloughing and mucus plugging, not smooth-muscle bronchospasm, so salbutamol does not help and causes tachycardia/tremor. Supportive care: oxygen if SpO₂ < 92%, suction, feeds/hydration.', fx: {v: {hr: +20}}},
  {when: c => dIs(c, 'antitussive', 'mucolytic') && (c.p.flags.bronchiolitis || c.p.flags.bronchiectasis || c.p.age < 6), sev: 'warn', title: 'Cough suppressant / mucolytic',
    msg: () => 'Cough clears secretions. Suppressants (and mucolytics in small children who cannot expectorate) cause retention of secretions. Not recommended here.'},
  {when: c => dIs(c, 'abx') && c.p.flags.viralOnly, sev: 'warn', title: 'Antibiotic for a viral illness',
    msg: () => 'No bacterial indication: antibiotics will not shorten a viral illness, cause side effects (diarrhoea, allergy) and drive resistance.'},
  {when: c => dIs(c, 'adrenaline_iv') && c.p.flags.anaphylaxis && !c.p.flags.arrest, sev: 'harm', title: 'IV bolus adrenaline in a patient with a pulse',
    msg: () => 'IV bolus adrenaline in someone with a pulse causes severe hypertension, VT/VF and myocardial ischaemia. First-line is 0.5 mg IM (1:1000) into the anterolateral thigh, repeated every 5 min; IV adrenaline only as an infusion by experienced staff.', fx: {v: {hr: +40, sbp: +60}}},
  {when: c => dIs(c, 'antihist', 'steroid_sys') && c.p.flags.anaphylaxis && !c.given.has('adrenaline_im'), sev: 'warn', title: 'Second-line drug before adrenaline',
    msg: () => 'Antihistamines and steroids do not reverse airway oedema, bronchospasm or shock — they are adjuncts. Adrenaline IM is the only first-line drug; giving these first delays it.'},
  {when: c => dIs(c, 'metoclop') && c.p.flags.obstruction, sev: 'harm', title: 'Prokinetic in bowel obstruction', msg: () => 'Metoclopramide increases gut motility against a mechanical obstruction → risk of perforation.'},
  {when: c => dIs(c, 'opioid', 'laxative') && c.p.flags.ibsc && dIs(c, 'opioid'), sev: 'warn', title: 'Opioid in IBS-C', msg: () => 'Opioids slow transit (μ-receptors in the gut) → worse constipation and narcotic bowel syndrome.'},
  {when: c => dIs(c, 'laxative') && dIs(c, 'stimulant') && c.p.flags.obstruction, sev: 'harm', title: 'Stimulant laxative in obstruction', msg: () => 'Never give stimulant laxatives with suspected bowel obstruction.'},
  {when: c => dIs(c, 'immunosupp', 'antitnf') && c.p.flags.activeInfection, sev: 'harm', title: 'Immunosuppression with active infection', msg: () => 'Exclude/treat infection (including latent TB — screen before anti-TNF) before starting immunosuppression.'},
  {when: c => dIs(c, 'mtx') && has(c, 'cotrim'), sev: 'harm', title: 'Methotrexate + trimethoprim', msg: () => 'Both are antifolates → bone marrow suppression/pancytopenia.'},
  {when: c => dIs(c, 'fq', 'tetra') && c.p.age < 12, sev: 'warn', title: 'Avoid in young children', msg: c => dIs(c, 'tetra') ? 'Tetracyclines stain developing teeth (< 8 years).' : 'Fluoroquinolones are avoided in children where alternatives exist (cartilage concerns).'},
  {when: c => dIs(c, 'nitrate') && c.p.flags.severeAS, sev: 'harm', title: 'Vasodilator in severe aortic stenosis', msg: () => 'Fixed outflow obstruction: vasodilators drop BP without increasing cardiac output → syncope.'},
  {when: c => dIs(c, 'insulin') && c.lab.K < 3.3, sev: 'harm', title: 'Insulin with low K⁺', msg: () => 'Insulin drives K⁺ into cells — with K⁺ < 3.3 this causes dangerous hypokalaemia. Replace K⁺ first.'},
  {when: c => dIs(c, 'ddavp') && c.p.flags.haemB, sev: 'warn', title: 'DDAVP in haemophilia B', msg: () => 'Desmopressin releases vWF and factor VIII from endothelial stores — it does nothing for factor IX deficiency.'},
  {when: c => dIs(c, 'steroid_ia', 'steroid_sys') && c.p.flags.septicJoint, sev: 'harm', title: 'Steroid into an infected joint', msg: () => 'Steroids in septic arthritis suppress host defence and accelerate cartilage destruction. Aspirate, culture, IV antibiotics and washout.'},
  {when: c => dIs(c, 'fluid') && c.p.flags.nephroticOedema && !c.p.flags.hypovolaemic, sev: 'warn', title: 'Fluids in nephrotic oedema', msg: () => 'The oedema is from low oncotic pressure and Na⁺ retention — saline loads leak into tissues. Salt and fluid restriction with diuretics instead (unless intravascularly depleted).'},
];

/* ---------- comorbidity overlays (integration across systems) ---------- */
const OVERLAYS = [
  {id: 'pregnancy', cat: 'BCMH', label: 'Pregnancy',
    fits: p => p.sex === 'F' && p.age >= 18 && p.age <= 40 && !p.noPreg,
    apply: (p, r) => { const ga = r.int(14, 32); p.flags.pregnant = true; p.flags.ga = ga; p.preg = ga;
      p.prof.push([`${ga} weeks pregnant`, 1, 'Pregnancy changes physiology (↑ plasma volume, ↓ Hb, ↓ creatinine, ↑ ALP, hypercoagulable) and restricts drugs: no ACEi/ARB, statins, warfarin, tetracyclines, fluoroquinolones; caution NSAIDs (> 28 wks).']);
      p.hx.push(['Pregnancy', `Yes… I'm about ${ga} weeks. I've been going to the clinic for antenatal visits.`, 1, 'Ask every woman of reproductive age — she may not volunteer it.']);
      p.labAdj = Object.assign(p.labAdj || {}, {Hb: -1.0, Cr: -15, ALP: +60, Urea: -1});
      p.res = Object.assign(p.res || {}, {UPT: 'POSITIVE', PANEL_BHCG: null});
      p.ex.push(['Abdomen (obstetric)', `Gravid uterus, symphysis-fundal height ${ga - r.int(-1, 2)} cm, fetal heart 140 bpm.`, 0]);
      p.signs.push('pregnant'); },
    q: {s: 'integ', q: 'This patient is pregnant. How does that change your drug choices for her? Name the drugs you would avoid and what you would use instead.', a: 'Avoid ACE inhibitors/ARBs (fetal renal dysgenesis, oligohydramnios), statins, warfarin (embryopathy — use LMWH), tetracyclines (teeth/bone), fluoroquinolones, methotrexate, and NSAIDs after ~28 weeks (premature ductus closure). Safe(r) options: methyldopa, long-acting nifedipine, labetalol, hydralazine for BP; LMWH for anticoagulation; penicillins, cephalosporins and macrolides for infection; paracetamol for pain. Also consider physiological changes: ↓Hb (dilutional), ↓creatinine, hypercoagulability, and involve obstetrics.', kw: ['ace|acei|arb|enalapril|losartan', 'methyldopa|nifedipine|labetalol|hydralazine', 'warfarin|statin|tetracycline|quinolone|nsaid', 'lmwh|enoxaparin|heparin|penicillin|paracetamol']}},
  {id: 'ckd', cat: 'Renal', label: 'Chronic kidney disease (G3b–4)',
    fits: p => p.age >= 35 && !p.flags.ckd && !p.noCKD,
    apply: (p, r) => { const cr = r.int(160, 260); p.flags.ckd = true; p.labSet = Object.assign(p.labSet || {}, {Cr: cr}); p.labAdj = Object.assign(p.labAdj || {}, {Urea: +8, K: +0.6, Hb: -1.5, HCO3: -4, PO4: +0.5});
      p.prof.push(['Known CKD (diabetic/hypertensive)', 1, 'CKD changes drug dosing/clearance and makes hyperkalaemia, fluid overload and nephrotoxicity more likely.']);
      p.hx.push(['Kidney disease', `The clinic said my kidneys are weak — "stage 3 or 4". I'm on enalapril for it and they check my bloods every 3 months.`, 1]);
      p.meds.push('enalapril'); p.signs.push('pallor'); },
    q: {s: 'integ', q: 'This patient also has CKD (eGFR on the U&E). Which of your drugs need to be avoided or dose-adjusted, and what metabolic complications must you watch for?', a: 'Avoid NSAIDs (afferent constriction → AKI), metformin if eGFR < 30 (lactic acidosis), gentamicin/vancomycin/contrast unless essential (nephrotoxic, level-guided), bisphosphonates if eGFR < 35; dose-adjust renally cleared drugs (LMWH, many antibiotics, digoxin). Be careful adding spironolactone/K-sparing drugs or K⁺ supplements to an ACEi → hyperkalaemia. Watch for hyperkalaemia, metabolic acidosis, fluid overload, anaemia of CKD (↓EPO), CKD-MBD (↑PO₄, ↓Ca, ↑PTH) and uraemia.', kw: ['nsaid', 'metformin|gentamicin|nephrotox|contrast|dose', 'potassium|hyperkal|k+', 'acidosis|fluid|anaemia|phosphate|pth']}},
  {id: 'asthma', cat: 'Resp', label: 'Asthma',
    fits: p => !p.flags.asthma && !p.flags.copd && p.age >= 6,
    apply: (p, r) => { p.flags.asthma = true; p.prof.push(['Asthmatic since childhood', 1, 'Asthma means no β-blockers (even cardioselective) and caution with NSAIDs/aspirin.']);
      p.hx.push(['Chest / inhalers', 'I have asthma since I was small. I use the Symbicort pump twice a day and the blue one when it\'s bad.', 1]); p.meds.push('bud_form'); },
    q: {s: 'integ', q: 'This patient has asthma. Which drugs are risky for them, and why?', a: 'All β-blockers (including "cardioselective" bisoprolol/metoprolol at higher doses and topical timolol) block bronchial β2 receptors → bronchospasm and resistance to salbutamol. NSAIDs/aspirin can trigger bronchospasm in aspirin-exacerbated respiratory disease (COX-1 block shunts arachidonic acid to leukotrienes). Avoid cough suppressants/sedatives in an exacerbation. Adenosine can provoke bronchospasm.', kw: ['beta|β|bisoprolol|propranolol', 'β2|beta 2|bronchospasm|bronchoconstriction', 'nsaid|aspirin|ibuprofen', 'leukotriene|cox']}},
  {id: 'hiv', cat: 'BCMH', label: 'HIV on ART',
    fits: p => p.age >= 15 && !p.flags.hiv,
    apply: (p, r) => { const sup = r.chance(0.6); p.flags.hiv = true; p.labSet = Object.assign(p.labSet || {}, {CD4: sup ? r.int(350, 700) : r.int(60, 240), VL: sup ? 0 : r.int(4000, 180000)});
      p.prof.push(['Living with HIV', 1, 'Widens the differential (TB, OIs, lymphoma, KS), changes infection thresholds and adds drug interactions (rifampicin–dolutegravir).']);
      p.hx.push(['HIV', sup ? 'I\'m HIV positive since 2017. I take the one TLD tablet every night. My last blood was "undetectable".' : 'I\'m HIV positive… I was taking the TLD tablet but I stopped for a few months last year when I moved. I started again two months ago.', 1, sup ? '' : 'Defaulting ART → low CD4, risk of OIs and resistance.']);
      p.meds.push('tld'); },
    q: {s: 'integ', q: 'This patient is on TLD. What drug interactions and HIV-specific issues affect your plan?', a: 'TLD = tenofovir DF + lamivudine + dolutegravir. Rifampicin induces CYP3A4/UGT1A1 → halves dolutegravir levels → give DTG 50 mg twice daily during and 2 weeks after rifampicin. Polyvalent cations (antacids, iron, calcium, Mg) chelate dolutegravir — give DTG 2 h before or 6 h after. Tenofovir is nephrotoxic (check eGFR; avoid other nephrotoxins). Check CD4 and viral load (adherence/resistance), screen for TB (symptom screen, Xpert), CrAg if CD4 < 100–200, co-trimoxazole prophylaxis if CD4 < 200, and watch for IRIS after ART (re)initiation.', kw: ['rifampicin|rifampin', 'dolutegravir|dtg', 'twice|double|50 mg bd|bd', 'cd4|viral load|tb|crag|cotrimoxazole|iris|tenofovir|kidney']}},
  {id: 'diabetes', cat: 'BCMH', label: 'Type 2 diabetes on metformin',
    fits: p => p.age >= 30 && !p.flags.diabetes,
    apply: (p, r) => { p.flags.diabetes = true; p.labSet = Object.assign(p.labSet || {}, {Gluc: r.f(9, 16), HbA1c: r.f(7.4, 10.5)});
      p.prof.push(['Type 2 diabetic', 1, 'Diabetes: atypical/silent ischaemia, worse infections, autonomic neuropathy, renal disease; metformin must be held in AKI/sepsis/contrast.']);
      p.hx.push(['Sugar diabetes', 'I have sugar diabetes for about 8 years. I take metformin twice a day… sometimes I forget.', 1]); p.meds.push('metformin');
      if (p.build === 'normal' && r.chance(0.6)) p.build = 'obese'; },
    q: {s: 'integ', q: 'This patient has type 2 diabetes on metformin. How does the diabetes change the way they present, and what would you do with the metformin now?', a: 'Diabetes causes autonomic neuropathy → atypical/silent presentations (painless MI, dyspnoea or epigastric pain only), worse and more severe infections (impaired neutrophil function), and accelerated renal and vascular disease. Hold metformin (sick-day rule) when acutely unwell — dehydration, AKI, sepsis, shock, hypoxia or iodinated contrast — because it can accumulate and cause lactic acidosis; manage glucose with insulin in hospital, restart once eating and renal function is stable. Check HbA1c, renal function, and screen for complications.', kw: ['atypical|silent|painless|neuropathy', 'hold|stop|withhold|sick day', 'lactic', 'insulin|glucose|hba1c']}},
  {id: 'penallergy', cat: 'BCMH', label: 'Penicillin allergy',
    fits: p => !p.flags.penAllergy,
    apply: (p, r) => { const sev = r.pick(['anaphylaxis', 'rash', 'anaphylaxis']); p.flags.penAllergy = sev; p.allergies.push('Penicillin'); p.prof.push([`Penicillin allergy (${sev})`, 1, 'A true penicillin allergy changes your antibiotic choices — check what the reaction was.']);
      p.hx.push(['Allergies', sev === 'anaphylaxis' ? 'Yes! Penicillin. When I was 20 they gave me an injection and my throat closed — I nearly died.' : 'Penicillin gives me a rash, all over, itchy.', 1]); },
    q: {s: 'integ', q: 'The wristband says penicillin allergy. How would you clarify it and what does it change?', a: 'Clarify the reaction: immediate IgE-mediated (urticaria, angioedema, bronchospasm, anaphylaxis within an hour) vs delayed mild rash vs side effect (GI upset — not allergy) vs severe delayed (SJS/TEN, DRESS). True anaphylaxis: avoid all penicillins and generally avoid cephalosporins/carbapenems (low but real cross-reactivity via the β-lactam ring/side chains). Use alternatives by indication: macrolides (azithromycin/clarithromycin), doxycycline, fluoroquinolones, clindamycin, vancomycin; for ARF secondary prophylaxis, erythromycin. Document clearly.', kw: ['anaphylaxis|immediate|ige|urticaria', 'rash|side effect|delayed', 'cephalosporin|cross', 'macrolide|azithromycin|clarithromycin|erythromycin|doxycycline|clindamycin|vancomycin']}},
  {id: 'pud', cat: 'GIT', label: 'Peptic ulcer history',
    fits: p => !p.flags.pud && p.age >= 25,
    apply: (p, r) => { p.flags.pud = true; p.prof.push(['Previous bleeding stomach ulcer', 1, 'Prior PUD/GI bleed: avoid NSAIDs; aspirin/anticoagulants need PPI cover and caution.']);
      p.hx.push(['Stomach', 'Two years ago I vomited blood — they did a camera and said it was an ulcer from the pain pills I was taking for my knees.', 1]); },
    q: {s: 'integ', q: 'This patient had a bleeding peptic ulcer before. How does that affect your management?', a: 'Avoid NSAIDs (COX-1 inhibition ↓ protective prostaglandins → mucus/bicarbonate ↓, acid ↑, mucosal blood flow ↓; antiplatelet effect). If antiplatelets/anticoagulants are essential (e.g. ACS), give PPI cover and monitor for bleeding (Hb, melaena). Test and eradicate H. pylori if not done. Use paracetamol for analgesia.', kw: ['nsaid', 'ppi|omeprazole|pantoprazole', 'pylori', 'prostaglandin|bleed|paracetamol']}},
  {id: 'gout', cat: 'MSK', label: 'Gout on allopurinol',
    fits: p => p.sex === 'M' && p.age >= 35 && !p.flags.gout,
    apply: (p, r) => { p.flags.gout = true; p.labSet = Object.assign(p.labSet || {}, {Urate: r.f(0.42, 0.55, 2)}); p.prof.push(['Recurrent gout', 1, 'Gout: thiazide/loop diuretics and low-dose aspirin raise urate; drug choices matter.']);
      p.hx.push(['Joints', 'I get gout in my big toe, maybe twice a year. I take allopurinol.', 1]); p.meds.push('allopurinol'); },
    q: {s: 'integ', q: 'This patient has gout. Which of the drugs you might use could precipitate an attack, and how?', a: 'Thiazide and loop diuretics (compete with urate for OAT secretion in the proximal tubule and cause volume contraction → ↑ urate reabsorption), low-dose aspirin (↓ urate excretion), ciclosporin, pyrazinamide/ethambutol (↓ excretion), and cytotoxic chemotherapy (tumour lysis ↑ urate production). Don\'t stop allopurinol during a flare. Losartan is mildly uricosuric.', kw: ['thiazide|loop|diuretic|furosemide|hctz', 'aspirin', 'pyrazinamide|ciclosporin|chemotherapy', 'excretion|reabsorption|oat|tubule']}},
  {id: 'hf', cat: 'CVS', label: 'Heart failure (HFrEF)',
    fits: p => p.age >= 40 && !p.flags.hfref && !p.flags.acuteHF,
    apply: (p, r) => { p.flags.hfref = true; p.labSet = Object.assign(p.labSet || {}, {NTproBNP: r.int(900, 3500)}); p.prof.push(['Known heart failure (EF ~30%)', 1, 'HFrEF: careful with IV fluids, avoid NSAIDs, verapamil/diltiazem and TZDs.']);
      p.hx.push(['Heart', 'My heart is weak — they did a scan and said it\'s pumping at 30%. I take furosemide, enalapril and carvedilol. I sleep on three pillows.', 1]); p.meds.push('furosemide', 'enalapril', 'carvedilol'); p.signs.push('oedema'); p.ex.push(['Legs', 'Bilateral pitting oedema to mid-shin.', 1]); },
    q: {s: 'integ', q: 'This patient has HFrEF. What do you need to be careful of when treating their current problem?', a: 'Fluids: give small boluses and reassess (risk of pulmonary oedema). Avoid NSAIDs (Na⁺/water retention, blunt diuretics, AKI), non-DHP CCBs (verapamil/diltiazem — negative inotropes), thiazolidinediones, and don\'t abruptly stop β-blockers. Monitor K⁺ and creatinine on ACEi/MRA. Daily weights and fluid balance.', kw: ['fluid|bolus|pulmonary oedema', 'nsaid', 'verapamil|diltiazem|negative inotrop', 'potassium|creatinine|weight']}},
  {id: 'af_warfarin', cat: 'CVS', label: 'AF on warfarin',
    fits: p => p.age >= 55 && !p.flags.af,
    apply: (p, r) => { p.flags.af = true; p.flags.onWarfarin = true; p.labSet = Object.assign(p.labSet || {}, {INR: r.f(2.1, 3.6, 1)}); p.ecg = Object.assign(p.ecg || {}, {rhythm: 'af'});
      p.prof.push(['Atrial fibrillation on warfarin', 1, 'Warfarin: bleeding risk, INR monitoring and many interactions (antibiotics, NSAIDs, rifampicin).']);
      p.hx.push(['Blood thinner', 'I take warfarin for my heart beating funny. They check my INR at the clinic every month.', 1]); p.meds.push('warfarin'); },
    q: {s: 'integ', q: 'This patient is on warfarin for AF. Which interactions and safety issues matter for your management?', a: 'Warfarin (vitamin K antagonist, ↓ factors II, VII, IX, X) has a narrow therapeutic index and is CYP2C9 metabolised. Enzyme inhibitors/antibiotics (co-trimoxazole, metronidazole, fluconazole, macrolides, fluoroquinolones) raise INR → bleeding; inducers (rifampicin, carbamazepine) lower INR → stroke. NSAIDs/aspirin add bleeding risk. Check INR now and more often after starting new drugs; reversal with vitamin K ± FFP/PCC if bleeding. Consider CHA₂DS₂-VASc / HAS-BLED.', kw: ['inr', 'cyp|inhibitor|inducer|rifampicin|metronidazole|cotrimoxazole|fluconazole|antibiotic', 'nsaid|aspirin|bleed', 'vitamin k|ffp|reversal']}},
  {id: 'htn', cat: 'CVS', label: 'Hypertension on ACEi + thiazide',
    fits: p => p.age >= 35 && !p.flags.htn,
    apply: (p, r) => { p.flags.htn = true; p.prof.push(['Hypertensive on enalapril + HCTZ', 1, 'ACEi + diuretic + NSAID = "triple whammy" AKI; diuretics affect K⁺, Na⁺ and urate.']);
      p.hx.push(['Blood pressure', 'I have high blood pressure. Enalapril and the water pill, every morning.', 1]); p.meds.push('enalapril', 'hctz'); },
    q: {s: 'integ', q: 'This patient takes enalapril and hydrochlorothiazide. What is the "triple whammy" and what else must you check?', a: 'ACEi (efferent dilation) + diuretic (volume depletion) + NSAID (afferent constriction) together remove all of the kidney\'s autoregulation → AKI. So avoid NSAIDs, and in acute illness/dehydration hold the ACEi and diuretic (sick-day rules). Check U&E: thiazides cause hyponatraemia, hypokalaemia, hyperuricaemia, hyperglycaemia; ACEi causes hyperkalaemia and a creatinine rise.', kw: ['nsaid', 'afferent|efferent|autoregulation', 'aki|acute kidney', 'sodium|potassium|hyponat|hypokal|urate']}},
  {id: 'alcohol', cat: 'GIT', label: 'Alcohol use disorder',
    fits: p => p.age >= 20 && !p.flags.alcohol,
    apply: (p, r) => { p.flags.alcohol = true; p.labAdj = Object.assign(p.labAdj || {}, {GGT: +120, MCV: +9, AST: +40, ALT: +15, Plt: -60}); p.prof.push(['Heavy alcohol use', 1, 'Alcohol: thiamine before glucose, withdrawal risk, liver disease, aspiration, poor nutrition.']);
      p.hx.push(['Alcohol', 'Ja… maybe a 750 of brandy over a weekend, and beers in the week. If I don\'t drink I get the shakes in the morning.', 1, 'Morning shakes = physical dependence → withdrawal risk in hospital.']); },
    q: {s: 'integ', q: 'This patient drinks heavily and gets morning shakes. What do you need to add to your plan in hospital?', a: 'Give parenteral thiamine before glucose (prevent Wernicke encephalopathy: confusion, ataxia, ophthalmoplegia). Monitor for alcohol withdrawal (tremor, sweating, agitation, seizures at 12–48 h, delirium tremens at 48–96 h) using CIWA and treat with benzodiazepines. Check LFTs, INR, platelets, MCV, glucose, Mg/PO₄ (refeeding), consider liver disease when dosing drugs (paracetamol, sedatives). Brief intervention/referral.', kw: ['thiamine', 'withdrawal|delirium|seizure', 'benzodiazepine|diazepam|lorazepam', 'liver|lft|magnesium|phosphate|refeeding']}},
  {id: 'elderly', cat: 'MSK', label: 'Frail elderly',
    fits: p => p.age >= 70,
    apply: (p, r) => { p.flags.frail = true; p.prof.push(['Frail, lives alone, falls this year', 1, 'Frailty: atypical presentation (delirium, falls), polypharmacy, reduced renal reserve, osteoporotic fractures.']);
      p.hx.push(['Home', 'I live alone since my husband/wife passed. I fell twice this year in the bathroom. My grandchildren help with the shopping.', 1]); },
    q: {s: 'integ', q: 'This patient is frail and elderly. How does that change your assessment and prescribing?', a: 'Older patients present atypically (delirium, falls, "off legs", no fever or pain); creatinine underestimates renal impairment (low muscle mass) so dose by eGFR/CrCl; avoid anticholinergics, sedatives and opioids where possible (delirium, falls); review polypharmacy; consider osteoporosis and falls prevention, nutrition, pressure care, function and social support (MDT, OT/physio).', kw: ['atypical|delirium|falls', 'renal|egfr|creatinine|dose', 'polypharmacy|sedative|anticholinergic', 'osteoporosis|social|mdt|function']}},
];

/* ---------- presentation styles (messy real life) ---------- */
const DELAY_PHRASES = ['I thought it would go away on its own.', 'I was working, I couldn\'t take off.', 'The clinic queue was too long so I went home.', 'My gogo said to try the traditional medicine first.', 'I bought some pills at the pharmacy, it helped a bit.', 'I didn\'t have money for transport.', 'I was scared of what they would find.'];

/* ---------- case registry ---------- */
const CASES = [];
function CASE(def) { CASES.push(def); }
const CATS = [
  {id: 'BCMH', name: 'BCMH', sub: 'Immunity, infection, HIV'},
  {id: 'CVS', name: 'Cardiovascular', sub: 'Heart, BP, shock'},
  {id: 'Resp', name: 'Respiratory', sub: 'Airways, lungs, TB'},
  {id: 'Renal', name: 'Renal', sub: 'Kidney, urinary tract'},
  {id: 'GIT', name: 'GIT', sub: 'Gut, liver, biliary'},
  {id: 'MSK', name: 'MSK', sub: 'Bones, joints, spine'},
  {id: 'Haem', name: 'Cancer & Haem', sub: 'Blood, bleeding, tumours'},
];
