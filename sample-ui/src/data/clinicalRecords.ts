import type { PatientClinicalRecord } from "../types/clinical.ts";

// ---------------------------------------------------------------------------
// Record 1 — Angela Brooks  (patient-001)
// ---------------------------------------------------------------------------

const angelaBrooksFullText = `=== PATIENT CLINICAL RECORD ===

DEMOGRAPHICS:
Name: Angela Brooks | Age: 52 | Sex: Female | Weight: 68 kg | Height: 163 cm | BMI: 25.6
Race: White | Ethnicity: Non-Hispanic
ECOG Performance Status: 1

PROBLEM LIST:
1. C34.90 — Malignant neoplasm of unspecified part of bronchus or lung (onset: September 2025)
2. C79.31 — Secondary malignant neoplasm of brain (onset: March 2026; noted as "indeterminate, under surveillance")
3. Z85.118 — Personal history of other malignant neoplasm of bronchus and lung

LABORATORY RESULTS (collected April 8, 2026):
- ANC: 2,180 /\u00B5L (ref 1,500\u20138,000) — normal
- Platelets: 189 K/\u00B5L (ref 150\u2013400) — normal
- Hemoglobin: 11.8 g/dL (ref 12.0\u201316.0) — LOW
- WBC: 6.2 K/\u00B5L (ref 4.0\u201311.0) — normal
- Creatinine: 0.9 mg/dL (ref 0.6\u20131.2) — normal
- Total Bilirubin: 0.6 mg/dL (ref 0.1\u20131.2) — normal
- AST: 28 U/L (ref 10\u201340) — normal
- ALT: 32 U/L (ref 7\u201356) — normal
- Albumin: 3.8 g/dL (ref 3.5\u20135.5) — normal

CURRENT MEDICATIONS:
1. Carboplatin AUC 5 IV — COMPLETED (Nov 2025 \u2013 Feb 2026) — First-line NSCLC
2. Pemetrexed 500 mg/m\u00B2 IV — COMPLETED (Nov 2025 \u2013 Feb 2026) — First-line NSCLC
3. Dexamethasone 2 mg PO daily — ACTIVE (started Mar 2026) — CNS prophylaxis
4. Ondansetron 8 mg PO PRN — ACTIVE (started Nov 2025) — Antiemetic
5. Omeprazole 20 mg PO daily — ACTIVE (started Nov 2025) — GI prophylaxis

CLINICAL NOTES:

--- Pathology Report (Jan 14, 2026 \u2014 Dr. Sarah Chen, Pathology) ---
FINAL PATHOLOGY REPORT

Specimen: CT-guided percutaneous lung biopsy, right lower lobe.

Diagnosis: Pulmonary adenocarcinoma, moderately differentiated.

Microscopic: Malignant epithelial neoplasm with acinar and lepidic growth patterns. TTF-1 positive. CK7 positive. CK20 negative. Napsin-A positive.

Staging: pT3N2M1a (pleural metastasis confirmed on separate pleural fluid cytology).

Comment: Findings consistent with primary lung adenocarcinoma with pleural dissemination. Recommend molecular profiling for targetable alterations.

--- Genomic Profiling Report (Jan 28, 2026 \u2014 Tempus Molecular Diagnostics) ---
TEMPUS xT COMPREHENSIVE GENOMIC PROFILING REPORT

Patient: [REDACTED]
Specimen: Lung biopsy, RLL
Tumor content: 45%

Key Findings:
- EGFR exon 20 insertion (p.A767_V769dup) \u2014 DETECTED
- No ALK rearrangement
- No ROS1 rearrangement
- No BRAF V600E mutation
- No MET amplification
- TP53 R248W \u2014 DETECTED (variant of unknown significance)
- PD-L1 TPS: 15% (22C3 antibody)
- TMB: 4.2 mut/Mb (low)
- MSS (microsatellite stable)

Clinical Interpretation: EGFR exon 20 insertion detected. This alteration is typically resistant to first- and second-generation EGFR TKIs (erlotinib, gefitinib, afatinib). Patients may benefit from exon20-targeted therapies currently available in clinical trials. PD-L1 expression is low; immunotherapy benefit uncertain.

--- MRI Brain Imaging Report (Mar 30, 2026 \u2014 Dr. James Morton, Neuroradiology) ---
MRI BRAIN WITH AND WITHOUT CONTRAST

Clinical Indication: Staging evaluation. Known metastatic NSCLC.

Findings:
- New 4mm punctate enhancing focus in the right frontal lobe at the gray-white matter junction. This finding is indeterminate and could represent a small metastasis versus a vascular artifact.
- No surrounding edema. No mass effect. No midline shift.
- No other suspicious intracranial lesions identified.
- Ventricles and sulci are normal in size and configuration.

Impression:
1. New indeterminate 4mm enhancing focus, right frontal lobe. Cannot definitively characterize as metastatic disease versus artifact at this size.
2. Recommend short-interval follow-up MRI in 6 weeks for stability assessment.
3. Clinical correlation with treating oncologist recommended.

--- Progress Note (Apr 10, 2026 \u2014 Dr. Michael Torres, Thoracic Oncology) ---
PROGRESS NOTE \u2014 THORACIC ONCOLOGY CLINIC

Subjective: Patient returns for follow-up after completing 4 cycles of carboplatin/pemetrexed. She reports mild fatigue (grade 1) but is functionally independent. No new respiratory symptoms. Appetite stable.

Objective:
- ECOG Performance Status: 1
- Vital signs: BP 128/78, HR 76, Temp 98.4\u00B0F, SpO2 96% on RA
- Labs (April 8): ANC 2,180, Plt 189K, Hgb 11.8, Cr 0.9 \u2014 adequate organ function
- Imaging: CT chest (Mar 28) shows progressive right lower lobe mass (3.2 cm \u2192 4.1 cm). New right hilar lymphadenopathy. Brain MRI (Mar 30) with indeterminate 4mm right frontal lesion.

Assessment:
1. Metastatic NSCLC with EGFR exon 20 insertion \u2014 disease progression on first-line platinum-based chemotherapy.
2. Indeterminate brain lesion \u2014 too small for definitive characterization. Not amenable to biopsy. Will monitor.
3. ECOG 1, adequate organ function.

Plan:
1. Refer to clinical trials for EGFR exon 20-targeted therapy.
2. Screen for LU-021 trial eligibility (Phase 2 mobocertinib successor).
3. CNS finding requires discussion with PI before enrollment \u2014 does not clearly meet \u2018active CNS metastasis\u2019 exclusion but cannot be ruled out.
4. Follow-up MRI brain in 6 weeks.
5. Continue supportive medications.
`;

const angelaBrooks: PatientClinicalRecord = {
  patientId: "patient-001",
  demographics: {
    age: 52,
    sex: "Female",
    weight: "68 kg",
    height: "163 cm",
    bmi: "25.6",
    race: "White",
    ethnicity: "Non-Hispanic",
  },
  ecogPerformanceStatus: 1,
  problemList: [
    {
      code: "C34.90",
      description:
        "Malignant neoplasm of unspecified part of bronchus or lung",
      onset: "2025-09",
    },
    {
      code: "C79.31",
      description:
        "Secondary malignant neoplasm of brain (indeterminate, under surveillance)",
      onset: "2026-03",
    },
    {
      code: "Z85.118",
      description:
        "Personal history of other malignant neoplasm of bronchus and lung",
      onset: "2025-09",
    },
  ],
  labs: [
    {
      test: "ANC",
      value: "2180",
      unit: "/\u00B5L",
      referenceRange: "1,500\u20138,000",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "Platelets",
      value: "189",
      unit: "K/\u00B5L",
      referenceRange: "150\u2013400",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "Hemoglobin",
      value: "11.8",
      unit: "g/dL",
      referenceRange: "12.0\u201316.0",
      date: "2026-04-08",
      flag: "low",
    },
    {
      test: "WBC",
      value: "6.2",
      unit: "K/\u00B5L",
      referenceRange: "4.0\u201311.0",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "Creatinine",
      value: "0.9",
      unit: "mg/dL",
      referenceRange: "0.6\u20131.2",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "Total Bilirubin",
      value: "0.6",
      unit: "mg/dL",
      referenceRange: "0.1\u20131.2",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "AST",
      value: "28",
      unit: "U/L",
      referenceRange: "10\u201340",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "ALT",
      value: "32",
      unit: "U/L",
      referenceRange: "7\u201356",
      date: "2026-04-08",
      flag: "normal",
    },
    {
      test: "Albumin",
      value: "3.8",
      unit: "g/dL",
      referenceRange: "3.5\u20135.5",
      date: "2026-04-08",
      flag: "normal",
    },
  ],
  medications: [
    {
      name: "Carboplatin AUC 5",
      route: "IV",
      status: "completed",
      startDate: "2025-11",
      endDate: "2026-02",
      indication: "First-line NSCLC",
    },
    {
      name: "Pemetrexed 500 mg/m\u00B2",
      route: "IV",
      status: "completed",
      startDate: "2025-11",
      endDate: "2026-02",
      indication: "First-line NSCLC",
    },
    {
      name: "Dexamethasone 2 mg PO",
      route: "PO",
      status: "active",
      startDate: "2026-03",
      indication: "CNS prophylaxis",
    },
    {
      name: "Ondansetron 8 mg PO PRN",
      route: "PO",
      status: "active",
      startDate: "2025-11",
      indication: "Antiemetic",
    },
    {
      name: "Omeprazole 20 mg PO",
      route: "PO",
      status: "active",
      startDate: "2025-11",
      indication: "GI prophylaxis",
    },
  ],
  notes: [
    {
      type: "pathology",
      title: "Final Pathology Report — Lung Biopsy",
      date: "2026-01-14",
      author: "Dr. Sarah Chen, Pathology",
      text: "FINAL PATHOLOGY REPORT\n\nSpecimen: CT-guided percutaneous lung biopsy, right lower lobe.\n\nDiagnosis: Pulmonary adenocarcinoma, moderately differentiated.\n\nMicroscopic: Malignant epithelial neoplasm with acinar and lepidic growth patterns. TTF-1 positive. CK7 positive. CK20 negative. Napsin-A positive.\n\nStaging: pT3N2M1a (pleural metastasis confirmed on separate pleural fluid cytology).\n\nComment: Findings consistent with primary lung adenocarcinoma with pleural dissemination. Recommend molecular profiling for targetable alterations.",
    },
    {
      type: "genomic",
      title: "Tempus xT Comprehensive Genomic Profiling",
      date: "2026-01-28",
      author: "Tempus Molecular Diagnostics",
      text: "TEMPUS xT COMPREHENSIVE GENOMIC PROFILING REPORT\n\nPatient: [REDACTED]\nSpecimen: Lung biopsy, RLL\nTumor content: 45%\n\nKey Findings:\n- EGFR exon 20 insertion (p.A767_V769dup) \u2014 DETECTED\n- No ALK rearrangement\n- No ROS1 rearrangement\n- No BRAF V600E mutation\n- No MET amplification\n- TP53 R248W \u2014 DETECTED (variant of unknown significance)\n- PD-L1 TPS: 15% (22C3 antibody)\n- TMB: 4.2 mut/Mb (low)\n- MSS (microsatellite stable)\n\nClinical Interpretation: EGFR exon 20 insertion detected. This alteration is typically resistant to first- and second-generation EGFR TKIs (erlotinib, gefitinib, afatinib). Patients may benefit from exon20-targeted therapies currently available in clinical trials. PD-L1 expression is low; immunotherapy benefit uncertain.",
    },
    {
      type: "imaging",
      title: "MRI Brain With and Without Contrast",
      date: "2026-03-30",
      author: "Dr. James Morton, Neuroradiology",
      text: "MRI BRAIN WITH AND WITHOUT CONTRAST\n\nClinical Indication: Staging evaluation. Known metastatic NSCLC.\n\nFindings:\n- New 4mm punctate enhancing focus in the right frontal lobe at the gray-white matter junction. This finding is indeterminate and could represent a small metastasis versus a vascular artifact.\n- No surrounding edema. No mass effect. No midline shift.\n- No other suspicious intracranial lesions identified.\n- Ventricles and sulci are normal in size and configuration.\n\nImpression:\n1. New indeterminate 4mm enhancing focus, right frontal lobe. Cannot definitively characterize as metastatic disease versus artifact at this size.\n2. Recommend short-interval follow-up MRI in 6 weeks for stability assessment.\n3. Clinical correlation with treating oncologist recommended.",
    },
    {
      type: "progress",
      title: "Progress Note \u2014 Thoracic Oncology Clinic",
      date: "2026-04-10",
      author: "Dr. Michael Torres, Thoracic Oncology",
      text: "PROGRESS NOTE \u2014 THORACIC ONCOLOGY CLINIC\n\nSubjective: Patient returns for follow-up after completing 4 cycles of carboplatin/pemetrexed. She reports mild fatigue (grade 1) but is functionally independent. No new respiratory symptoms. Appetite stable.\n\nObjective:\n- ECOG Performance Status: 1\n- Vital signs: BP 128/78, HR 76, Temp 98.4\u00B0F, SpO2 96% on RA\n- Labs (April 8): ANC 2,180, Plt 189K, Hgb 11.8, Cr 0.9 \u2014 adequate organ function\n- Imaging: CT chest (Mar 28) shows progressive right lower lobe mass (3.2 cm \u2192 4.1 cm). New right hilar lymphadenopathy. Brain MRI (Mar 30) with indeterminate 4mm right frontal lesion.\n\nAssessment:\n1. Metastatic NSCLC with EGFR exon 20 insertion \u2014 disease progression on first-line platinum-based chemotherapy.\n2. Indeterminate brain lesion \u2014 too small for definitive characterization. Not amenable to biopsy. Will monitor.\n3. ECOG 1, adequate organ function.\n\nPlan:\n1. Refer to clinical trials for EGFR exon 20-targeted therapy.\n2. Screen for LU-021 trial eligibility (Phase 2 mobocertinib successor).\n3. CNS finding requires discussion with PI before enrollment \u2014 does not clearly meet \u2018active CNS metastasis\u2019 exclusion but cannot be ruled out.\n4. Follow-up MRI brain in 6 weeks.\n5. Continue supportive medications.",
    },
  ],
  fullRecordText: angelaBrooksFullText,
};

// ---------------------------------------------------------------------------
// Record 2 — Diane Foster  (patient-003)
// ---------------------------------------------------------------------------

const dianeFosterFullText = `=== PATIENT CLINICAL RECORD ===

DEMOGRAPHICS:
Name: Diane Foster | Age: 47 | Sex: Female | Weight: 72 kg | Height: 170 cm | BMI: 24.9
Race: Black or African American | Ethnicity: Non-Hispanic
ECOG Performance Status: 0

PROBLEM LIST:
1. C50.919 \u2014 Malignant neoplasm of unspecified site of unspecified female breast (onset: June 2025)
2. C77.3 \u2014 Secondary and unspecified malignant neoplasm of axillary lymph nodes (onset: June 2025)
3. C78.7 \u2014 Secondary malignant neoplasm of liver (onset: March 2026)

LABORATORY RESULTS (collected April 12, 2026):
- ANC: 3,400 /\u00B5L (ref 1,500\u20138,000) \u2014 normal
- Platelets: 220 K/\u00B5L (ref 150\u2013400) \u2014 normal
- Hemoglobin: 13.1 g/dL (ref 12.0\u201316.0) \u2014 normal
- WBC: 7.8 K/\u00B5L (ref 4.0\u201311.0) \u2014 normal
- Creatinine: 0.7 mg/dL (ref 0.6\u20131.2) \u2014 normal
- Total Bilirubin: 0.4 mg/dL (ref 0.1\u20131.2) \u2014 normal
- AST: 22 U/L (ref 10\u201340) \u2014 normal
- ALT: 19 U/L (ref 7\u201356) \u2014 normal
- LDH: 245 U/L (ref 120\u2013246) \u2014 normal
- CA 15-3: 68 U/mL (ref <30) \u2014 HIGH

CURRENT MEDICATIONS:
1. Doxorubicin 60 mg/m\u00B2 IV \u2014 COMPLETED (Jul\u2013Sep 2025) \u2014 Neoadjuvant AC for TNBC
2. Cyclophosphamide 600 mg/m\u00B2 IV \u2014 COMPLETED (Jul\u2013Sep 2025) \u2014 Neoadjuvant AC for TNBC
3. Paclitaxel 80 mg/m\u00B2 weekly IV \u2014 COMPLETED (Oct 2025\u2013Jan 2026) \u2014 Adjuvant T for TNBC
4. Tamoxifen \u2014 NOT prescribed (ER-negative)
5. Acetaminophen 650 mg PO PRN \u2014 ACTIVE \u2014 Pain management
6. Lorazepam 0.5 mg PO PRN \u2014 ACTIVE \u2014 Anxiety

CLINICAL NOTES:

--- Surgical Pathology Report (Jun 18, 2025 \u2014 Dr. Patricia Williams, Breast Pathology) ---
SURGICAL PATHOLOGY REPORT

Specimen: Left breast, modified radical mastectomy.

Diagnosis: Invasive ductal carcinoma, high-grade (Grade 3, Nottingham score 9/9).

Immunohistochemistry:
- Estrogen Receptor (ER): Negative (0%)
- Progesterone Receptor (PR): Negative (0%)
- HER2/neu: Negative (IHC 1+, FISH non-amplified, ratio 1.1)
- Ki-67 proliferation index: 85%

Tumor size: 3.8 cm greatest dimension.
Margins: Negative (closest margin 4 mm, deep).
Lymphovascular invasion: Present.
Axillary lymph nodes: 4 of 18 positive for metastatic carcinoma.

Final staging: pT2N2aM0, Stage IIIA.

Comment: Triple-negative breast cancer (TNBC). High proliferative index. Recommend genomic profiling for potential targeted therapy options.

--- Genomic Profiling Report (Jul 8, 2025 \u2014 Foundation Medicine) ---
FOUNDATIONONE CDx COMPREHENSIVE GENOMIC PROFILING

Specimen: Breast, mastectomy
Tumor content: 60%

Genomic Findings:
- No targetable alterations identified in BRCA1, BRCA2, PIK3CA, AKT1, or ESR1
- TP53 R175H \u2014 DETECTED (pathogenic)
- MYC amplification \u2014 DETECTED
- No NTRK fusions detected

Biomarkers:
- TMB: 8 mut/Mb (intermediate)
- MSS (microsatellite stable)
- PD-L1 CPS: 12 (positive, by Ventana SP142 assay)
  Note: CPS \u226510 is typically considered positive for immunotherapy eligibility in TNBC.

Clinical Interpretation: No actionable targetable alterations. PD-L1 CPS 12 supports potential eligibility for immunotherapy-based regimens. TMB intermediate \u2014 may have some predictive value for checkpoint inhibitor response.

--- CT Chest/Abdomen/Pelvis Imaging Report (Apr 5, 2026 \u2014 Dr. Karen Liu, Body Imaging) ---
CT CHEST/ABDOMEN/PELVIS WITH IV CONTRAST

Clinical Indication: Restaging. Known TNBC, post-mastectomy, post-adjuvant chemotherapy.

Findings:
Chest: No pulmonary metastases. Post-surgical changes left chest wall, stable. No pleural effusion.
Abdomen:
- Liver: Two new hypodense lesions in the right hepatic lobe measuring 12 mm (segment VI) and 8 mm (segment VII). Enhancement pattern suspicious for metastatic disease. No prior liver lesions for comparison.
- No biliary dilatation. Gallbladder unremarkable.
- Pancreas, spleen, adrenals: Normal.
- No ascites.
Pelvis: Unremarkable. No lymphadenopathy.

Impression:
1. New hepatic lesions suspicious for metastatic disease. Recommend biopsy or short-interval follow-up.
2. No evidence of pulmonary metastatic disease.
3. Post-surgical changes, stable.

--- Progress Note (Apr 11, 2026 \u2014 Dr. Rachel Kim, Breast Oncology) ---
PROGRESS NOTE \u2014 BREAST ONCOLOGY CLINIC

Subjective: Patient presents for results review. She reports feeling well. No bone pain, no jaundice, no abdominal distention. Weight stable. Sleep and appetite normal.

Objective:
- ECOG Performance Status: 0 \u2014 fully active
- Vital signs: BP 118/72, HR 68, Temp 98.2\u00B0F, SpO2 99% on RA
- Labs (April 12): All within normal limits. CA 15-3 elevated at 68 (was 34 in January).
- CT (April 5): New hepatic metastases \u2014 disease progression.

Assessment:
1. Triple-negative breast cancer with new hepatic metastases \u2014 disease progression after neoadjuvant AC and adjuvant paclitaxel.
2. PD-L1 CPS 12 \u2014 eligible for immunotherapy combination trials.
3. Excellent performance status (ECOG 0). No active autoimmune conditions.
4. No prior immunotherapy exposure.

Plan:
1. Screen for BRC-PD1-042 trial (PD-L1-enriched TNBC, combination immunotherapy).
2. Liver biopsy to confirm metastatic TNBC (scheduled April 18).
3. No contraindications to immunotherapy identified. No active autoimmune disease. Not on systemic immunosuppressants.
4. Continue supportive care.
5. Return in 2 weeks with biopsy results.
`;

const dianeFoster: PatientClinicalRecord = {
  patientId: "patient-003",
  demographics: {
    age: 47,
    sex: "Female",
    weight: "72 kg",
    height: "170 cm",
    bmi: "24.9",
    race: "Black or African American",
    ethnicity: "Non-Hispanic",
  },
  ecogPerformanceStatus: 0,
  problemList: [
    {
      code: "C50.919",
      description:
        "Malignant neoplasm of unspecified site of unspecified female breast",
      onset: "2025-06",
    },
    {
      code: "C77.3",
      description:
        "Secondary and unspecified malignant neoplasm of axillary lymph nodes",
      onset: "2025-06",
    },
    {
      code: "C78.7",
      description: "Secondary malignant neoplasm of liver",
      onset: "2026-03",
    },
  ],
  labs: [
    {
      test: "ANC",
      value: "3400",
      unit: "/\u00B5L",
      referenceRange: "1,500\u20138,000",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "Platelets",
      value: "220",
      unit: "K/\u00B5L",
      referenceRange: "150\u2013400",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "Hemoglobin",
      value: "13.1",
      unit: "g/dL",
      referenceRange: "12.0\u201316.0",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "WBC",
      value: "7.8",
      unit: "K/\u00B5L",
      referenceRange: "4.0\u201311.0",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "Creatinine",
      value: "0.7",
      unit: "mg/dL",
      referenceRange: "0.6\u20131.2",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "Total Bilirubin",
      value: "0.4",
      unit: "mg/dL",
      referenceRange: "0.1\u20131.2",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "AST",
      value: "22",
      unit: "U/L",
      referenceRange: "10\u201340",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "ALT",
      value: "19",
      unit: "U/L",
      referenceRange: "7\u201356",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "LDH",
      value: "245",
      unit: "U/L",
      referenceRange: "120\u2013246",
      date: "2026-04-12",
      flag: "normal",
    },
    {
      test: "CA 15-3",
      value: "68",
      unit: "U/mL",
      referenceRange: "<30",
      date: "2026-04-12",
      flag: "high",
    },
  ],
  medications: [
    {
      name: "Doxorubicin 60 mg/m\u00B2",
      route: "IV",
      status: "completed",
      startDate: "2025-07",
      endDate: "2025-09",
      indication: "Neoadjuvant AC for TNBC",
    },
    {
      name: "Cyclophosphamide 600 mg/m\u00B2",
      route: "IV",
      status: "completed",
      startDate: "2025-07",
      endDate: "2025-09",
      indication: "Neoadjuvant AC for TNBC",
    },
    {
      name: "Paclitaxel 80 mg/m\u00B2 weekly",
      route: "IV",
      status: "completed",
      startDate: "2025-10",
      endDate: "2026-01",
      indication: "Adjuvant T for TNBC",
    },
    {
      name: "Acetaminophen 650 mg PO PRN",
      route: "PO",
      status: "active",
      startDate: "2025-06",
      indication: "Pain management",
    },
    {
      name: "Lorazepam 0.5 mg PO PRN",
      route: "PO",
      status: "active",
      startDate: "2025-06",
      indication: "Anxiety",
    },
  ],
  notes: [
    {
      type: "pathology",
      title: "Surgical Pathology Report \u2014 Left Breast Mastectomy",
      date: "2025-06-18",
      author: "Dr. Patricia Williams, Breast Pathology",
      text: "SURGICAL PATHOLOGY REPORT\n\nSpecimen: Left breast, modified radical mastectomy.\n\nDiagnosis: Invasive ductal carcinoma, high-grade (Grade 3, Nottingham score 9/9).\n\nImmunohistochemistry:\n- Estrogen Receptor (ER): Negative (0%)\n- Progesterone Receptor (PR): Negative (0%)\n- HER2/neu: Negative (IHC 1+, FISH non-amplified, ratio 1.1)\n- Ki-67 proliferation index: 85%\n\nTumor size: 3.8 cm greatest dimension.\nMargins: Negative (closest margin 4 mm, deep).\nLymphovascular invasion: Present.\nAxillary lymph nodes: 4 of 18 positive for metastatic carcinoma.\n\nFinal staging: pT2N2aM0, Stage IIIA.\n\nComment: Triple-negative breast cancer (TNBC). High proliferative index. Recommend genomic profiling for potential targeted therapy options.",
    },
    {
      type: "genomic",
      title: "FoundationOne CDx Comprehensive Genomic Profiling",
      date: "2025-07-08",
      author: "Foundation Medicine",
      text: "FOUNDATIONONE CDx COMPREHENSIVE GENOMIC PROFILING\n\nSpecimen: Breast, mastectomy\nTumor content: 60%\n\nGenomic Findings:\n- No targetable alterations identified in BRCA1, BRCA2, PIK3CA, AKT1, or ESR1\n- TP53 R175H \u2014 DETECTED (pathogenic)\n- MYC amplification \u2014 DETECTED\n- No NTRK fusions detected\n\nBiomarkers:\n- TMB: 8 mut/Mb (intermediate)\n- MSS (microsatellite stable)\n- PD-L1 CPS: 12 (positive, by Ventana SP142 assay)\n  Note: CPS \u226510 is typically considered positive for immunotherapy eligibility in TNBC.\n\nClinical Interpretation: No actionable targetable alterations. PD-L1 CPS 12 supports potential eligibility for immunotherapy-based regimens. TMB intermediate \u2014 may have some predictive value for checkpoint inhibitor response.",
    },
    {
      type: "imaging",
      title: "CT Chest/Abdomen/Pelvis With IV Contrast",
      date: "2026-04-05",
      author: "Dr. Karen Liu, Body Imaging",
      text: "CT CHEST/ABDOMEN/PELVIS WITH IV CONTRAST\n\nClinical Indication: Restaging. Known TNBC, post-mastectomy, post-adjuvant chemotherapy.\n\nFindings:\nChest: No pulmonary metastases. Post-surgical changes left chest wall, stable. No pleural effusion.\nAbdomen:\n- Liver: Two new hypodense lesions in the right hepatic lobe measuring 12 mm (segment VI) and 8 mm (segment VII). Enhancement pattern suspicious for metastatic disease. No prior liver lesions for comparison.\n- No biliary dilatation. Gallbladder unremarkable.\n- Pancreas, spleen, adrenals: Normal.\n- No ascites.\nPelvis: Unremarkable. No lymphadenopathy.\n\nImpression:\n1. New hepatic lesions suspicious for metastatic disease. Recommend biopsy or short-interval follow-up.\n2. No evidence of pulmonary metastatic disease.\n3. Post-surgical changes, stable.",
    },
    {
      type: "progress",
      title: "Progress Note \u2014 Breast Oncology Clinic",
      date: "2026-04-11",
      author: "Dr. Rachel Kim, Breast Oncology",
      text: "PROGRESS NOTE \u2014 BREAST ONCOLOGY CLINIC\n\nSubjective: Patient presents for results review. She reports feeling well. No bone pain, no jaundice, no abdominal distention. Weight stable. Sleep and appetite normal.\n\nObjective:\n- ECOG Performance Status: 0 \u2014 fully active\n- Vital signs: BP 118/72, HR 68, Temp 98.2\u00B0F, SpO2 99% on RA\n- Labs (April 12): All within normal limits. CA 15-3 elevated at 68 (was 34 in January).\n- CT (April 5): New hepatic metastases \u2014 disease progression.\n\nAssessment:\n1. Triple-negative breast cancer with new hepatic metastases \u2014 disease progression after neoadjuvant AC and adjuvant paclitaxel.\n2. PD-L1 CPS 12 \u2014 eligible for immunotherapy combination trials.\n3. Excellent performance status (ECOG 0). No active autoimmune conditions.\n4. No prior immunotherapy exposure.\n\nPlan:\n1. Screen for BRC-PD1-042 trial (PD-L1-enriched TNBC, combination immunotherapy).\n2. Liver biopsy to confirm metastatic TNBC (scheduled April 18).\n3. No contraindications to immunotherapy identified. No active autoimmune disease. Not on systemic immunosuppressants.\n4. Continue supportive care.\n5. Return in 2 weeks with biopsy results.",
    },
  ],
  fullRecordText: dianeFosterFullText,
};

// ---------------------------------------------------------------------------
// Record 3 — Robert Hale  (patient-002)
// ---------------------------------------------------------------------------

const robertHaleFullText = `=== PATIENT CLINICAL RECORD ===

DEMOGRAPHICS:
Name: Robert Hale | Age: 71 | Sex: Male | Weight: 84 kg | Height: 178 cm | BMI: 26.5
Race: White | Ethnicity: Non-Hispanic
ECOG Performance Status: 2

PROBLEM LIST:
1. C34.90 \u2014 Malignant neoplasm of unspecified part of bronchus or lung (onset: August 2025)
2. I21.9 \u2014 Acute myocardial infarction, unspecified (onset: January 15, 2026)
3. I25.10 \u2014 Atherosclerotic heart disease of native coronary artery (onset: January 2026)
4. E11.65 \u2014 Type 2 diabetes mellitus with hyperglycemia (onset: 2019)
5. I10 \u2014 Essential (primary) hypertension (onset: 2015)

LABORATORY RESULTS (collected April 6, 2026):
- ANC: 1,200 /\u00B5L (ref 1,500\u20138,000) \u2014 LOW
- Platelets: 98 K/\u00B5L (ref 150\u2013400) \u2014 LOW
- Hemoglobin: 9.8 g/dL (ref 13.5\u201317.5) \u2014 LOW
- WBC: 3.4 K/\u00B5L (ref 4.0\u201311.0) \u2014 LOW
- Creatinine: 1.8 mg/dL (ref 0.7\u20131.3) \u2014 HIGH
- Total Bilirubin: 1.4 mg/dL (ref 0.1\u20131.2) \u2014 HIGH
- AST: 52 U/L (ref 10\u201340) \u2014 HIGH
- ALT: 48 U/L (ref 7\u201356) \u2014 normal
- BUN: 32 mg/dL (ref 7\u201320) \u2014 HIGH
- HbA1c: 7.8% (ref <5.7%) \u2014 HIGH
- Troponin I: <0.01 ng/mL (ref <0.04) \u2014 normal (post-recovery)

CURRENT MEDICATIONS:
1. Carboplatin AUC 5 IV \u2014 COMPLETED (Sep 2025\u2013Dec 2025) \u2014 First-line NSCLC
2. Pemetrexed 500 mg/m\u00B2 IV \u2014 COMPLETED (Sep 2025\u2013Dec 2025) \u2014 First-line NSCLC
3. Aspirin 81 mg PO daily \u2014 ACTIVE (started Jan 2026) \u2014 Post-MI antiplatelet
4. Clopidogrel 75 mg PO daily \u2014 ACTIVE (started Jan 2026) \u2014 Post-PCI DAPT
5. Metoprolol Succinate 50 mg PO daily \u2014 ACTIVE \u2014 Post-MI beta-blocker
6. Atorvastatin 80 mg PO daily \u2014 ACTIVE \u2014 High-intensity statin post-MI
7. Lisinopril 10 mg PO daily \u2014 ACTIVE \u2014 Heart failure prevention post-MI
8. Metformin 1000 mg PO BID \u2014 ACTIVE \u2014 Type 2 diabetes
9. Insulin Glargine 20 units SubQ QHS \u2014 ACTIVE \u2014 Basal insulin

CLINICAL NOTES:

--- Surgical Pathology Report (Sep 10, 2025 \u2014 Dr. Alan Park, Pathology) ---
SURGICAL PATHOLOGY REPORT

Specimen: CT-guided percutaneous biopsy, left upper lobe mass.

Diagnosis: Non-small cell lung carcinoma, poorly differentiated, favor adenocarcinoma.

Microscopic: Malignant cells with solid growth pattern. TTF-1: Positive (weak). CK7: Positive. P40: Negative. Synaptophysin: Negative.

Staging: Clinical stage IV (T4N3M1b) \u2014 based on FDG-avid bone metastases (L3 vertebral body, right iliac crest) on PET-CT.

Comment: Poorly differentiated carcinoma consistent with NSCLC, adenocarcinoma subtype. Recommend liquid biopsy for comprehensive genomic profiling given limited tissue.

--- Genomic Profiling Report (Oct 2, 2025 \u2014 Guardant Health) ---
GUARDANT360 LIQUID BIOPSY REPORT

Specimen: Peripheral blood, cfDNA

Genomic Findings:
- EGFR exon 20 insertion (p.D770_N771insGD) \u2014 DETECTED (VAF 8.2%)
- TP53 Y220C \u2014 DETECTED (VAF 12.1%)
- STK11 loss \u2014 DETECTED (VAF 6.4%)
- No ALK, ROS1, RET, or MET alterations detected

Biomarkers:
- Blood TMB: 6.3 mut/Mb
- MSS (microsatellite stable)

Clinical Interpretation: EGFR exon 20 insertion detected. This alteration confers resistance to standard EGFR TKIs. Exon20-targeted therapies or clinical trials recommended. STK11 loss may predict reduced benefit from immunotherapy.

--- Cardiac Catheterization and PCI Report (Jan 17, 2026 \u2014 Dr. Robert Singh, Interventional Cardiology) ---
CARDIAC CATHETERIZATION AND PCI REPORT

Indication: NSTEMI. Troponin peak 2.4 ng/mL on January 15, 2026. ECG showed ST depression in leads V4-V6.

Procedure: Left heart catheterization via right radial artery approach.

Findings:
- Left main: Patent
- LAD: 80% stenosis in the mid-segment \u2014 CULPRIT LESION
- LCx: 40% stenosis, non-flow-limiting
- RCA: Patent
- LVEF estimated at 45% (mildly reduced)

Intervention: Successful PCI to mid-LAD with drug-eluting stent (Xience Sierra 3.0 x 18 mm). TIMI 3 flow restored. No complications.

Post-procedure plan:
1. Dual antiplatelet therapy (aspirin + clopidogrel) for minimum 12 months
2. High-intensity statin
3. Beta-blocker and ACE inhibitor
4. Cardiology follow-up in 4 weeks
5. Clear for oncology treatment resumption after 4-week recovery period \u2014 with cardiac monitoring

--- Progress Note (Apr 8, 2026 \u2014 Dr. William Nakamura, Thoracic Oncology) ---
PROGRESS NOTE \u2014 THORACIC ONCOLOGY CLINIC

Subjective: Patient returns after completing platinum-based chemotherapy and recovering from NSTEMI in January. He reports increasing fatigue, dyspnea on exertion (climbing one flight of stairs), and decreased appetite. Weight down 4 kg over 2 months.

Objective:
- ECOG Performance Status: 2 \u2014 ambulatory, capable of self-care, unable to carry out work activities, up and about more than 50% of waking hours
- Vital signs: BP 138/82, HR 72, Temp 98.6\u00B0F, SpO2 93% on RA
- Labs (April 6): Pancytopenia \u2014 ANC 1,200, Plt 98K, Hgb 9.8. Renal insufficiency \u2014 Cr 1.8, BUN 32. Elevated transaminases \u2014 AST 52. Bilirubin 1.4.
- CT chest (April 2): Progressive disease \u2014 LUL mass 5.8 cm (was 4.2 cm). New contralateral mediastinal lymphadenopathy.
- No brain MRI performed this visit.

Assessment:
1. Metastatic NSCLC with EGFR exon 20 insertion \u2014 disease progression on first-line carboplatin/pemetrexed.
2. Status post NSTEMI (January 15, 2026) \u2014 only 83 days ago. Cardiac stent in place. On DAPT.
3. Declining performance status (ECOG 2). Weight loss. Functional decline.
4. Pancytopenia \u2014 likely treatment-related myelosuppression. ANC 1,200 (below most trial thresholds of \u22651,500). Platelets 98K (below most thresholds of \u2265100K).
5. Renal insufficiency \u2014 creatinine 1.8 (above most trial thresholds of \u22641.5).

Plan:
1. Clinical trial screening for EGFR exon 20-targeted therapy.
2. IMPORTANT: Multiple barriers to trial eligibility:
   a. MI within 6 months (most trials exclude cardiac events within 6 months)
   b. Inadequate organ function (ANC, platelets, creatinine all out of range)
   c. ECOG 2 (many trials require ECOG 0-1)
3. Will screen for LU-021 but anticipate exclusions.
4. Transfusion support if hemoglobin drops below 8.
5. Cardiology follow-up for ongoing cardiac monitoring.
6. Discuss palliative care options and goals of care.
`;

const robertHale: PatientClinicalRecord = {
  patientId: "patient-002",
  demographics: {
    age: 71,
    sex: "Male",
    weight: "84 kg",
    height: "178 cm",
    bmi: "26.5",
    race: "White",
    ethnicity: "Non-Hispanic",
  },
  ecogPerformanceStatus: 2,
  problemList: [
    {
      code: "C34.90",
      description:
        "Malignant neoplasm of unspecified part of bronchus or lung",
      onset: "2025-08",
    },
    {
      code: "I21.9",
      description: "Acute myocardial infarction, unspecified",
      onset: "2026-01-15",
    },
    {
      code: "I25.10",
      description:
        "Atherosclerotic heart disease of native coronary artery",
      onset: "2026-01",
    },
    {
      code: "E11.65",
      description: "Type 2 diabetes mellitus with hyperglycemia",
      onset: "2019",
    },
    {
      code: "I10",
      description: "Essential (primary) hypertension",
      onset: "2015",
    },
  ],
  labs: [
    {
      test: "ANC",
      value: "1200",
      unit: "/\u00B5L",
      referenceRange: "1,500\u20138,000",
      date: "2026-04-06",
      flag: "low",
    },
    {
      test: "Platelets",
      value: "98",
      unit: "K/\u00B5L",
      referenceRange: "150\u2013400",
      date: "2026-04-06",
      flag: "low",
    },
    {
      test: "Hemoglobin",
      value: "9.8",
      unit: "g/dL",
      referenceRange: "13.5\u201317.5",
      date: "2026-04-06",
      flag: "low",
    },
    {
      test: "WBC",
      value: "3.4",
      unit: "K/\u00B5L",
      referenceRange: "4.0\u201311.0",
      date: "2026-04-06",
      flag: "low",
    },
    {
      test: "Creatinine",
      value: "1.8",
      unit: "mg/dL",
      referenceRange: "0.7\u20131.3",
      date: "2026-04-06",
      flag: "high",
    },
    {
      test: "Total Bilirubin",
      value: "1.4",
      unit: "mg/dL",
      referenceRange: "0.1\u20131.2",
      date: "2026-04-06",
      flag: "high",
    },
    {
      test: "AST",
      value: "52",
      unit: "U/L",
      referenceRange: "10\u201340",
      date: "2026-04-06",
      flag: "high",
    },
    {
      test: "ALT",
      value: "48",
      unit: "U/L",
      referenceRange: "7\u201356",
      date: "2026-04-06",
      flag: "normal",
    },
    {
      test: "BUN",
      value: "32",
      unit: "mg/dL",
      referenceRange: "7\u201320",
      date: "2026-04-06",
      flag: "high",
    },
    {
      test: "HbA1c",
      value: "7.8",
      unit: "%",
      referenceRange: "<5.7%",
      date: "2026-04-06",
      flag: "high",
    },
    {
      test: "Troponin I",
      value: "<0.01",
      unit: "ng/mL",
      referenceRange: "<0.04",
      date: "2026-04-06",
      flag: "normal",
    },
  ],
  medications: [
    {
      name: "Carboplatin AUC 5",
      route: "IV",
      status: "completed",
      startDate: "2025-09",
      endDate: "2025-12",
      indication: "First-line NSCLC",
    },
    {
      name: "Pemetrexed 500 mg/m\u00B2",
      route: "IV",
      status: "completed",
      startDate: "2025-09",
      endDate: "2025-12",
      indication: "First-line NSCLC",
    },
    {
      name: "Aspirin 81 mg PO daily",
      route: "PO",
      status: "active",
      startDate: "2026-01",
      indication: "Post-MI antiplatelet",
    },
    {
      name: "Clopidogrel 75 mg PO daily",
      route: "PO",
      status: "active",
      startDate: "2026-01",
      indication: "Post-PCI DAPT",
    },
    {
      name: "Metoprolol Succinate 50 mg PO daily",
      route: "PO",
      status: "active",
      startDate: "2026-01",
      indication: "Post-MI beta-blocker",
    },
    {
      name: "Atorvastatin 80 mg PO daily",
      route: "PO",
      status: "active",
      startDate: "2026-01",
      indication: "High-intensity statin post-MI",
    },
    {
      name: "Lisinopril 10 mg PO daily",
      route: "PO",
      status: "active",
      startDate: "2026-01",
      indication: "Heart failure prevention post-MI",
    },
    {
      name: "Metformin 1000 mg PO BID",
      route: "PO",
      status: "active",
      startDate: "2019",
      indication: "Type 2 diabetes",
    },
    {
      name: "Insulin Glargine 20 units SubQ QHS",
      route: "SubQ",
      status: "active",
      startDate: "2019",
      indication: "Basal insulin",
    },
  ],
  notes: [
    {
      type: "pathology",
      title: "Surgical Pathology Report \u2014 LUL Biopsy",
      date: "2025-09-10",
      author: "Dr. Alan Park, Pathology",
      text: "SURGICAL PATHOLOGY REPORT\n\nSpecimen: CT-guided percutaneous biopsy, left upper lobe mass.\n\nDiagnosis: Non-small cell lung carcinoma, poorly differentiated, favor adenocarcinoma.\n\nMicroscopic: Malignant cells with solid growth pattern. TTF-1: Positive (weak). CK7: Positive. P40: Negative. Synaptophysin: Negative.\n\nStaging: Clinical stage IV (T4N3M1b) \u2014 based on FDG-avid bone metastases (L3 vertebral body, right iliac crest) on PET-CT.\n\nComment: Poorly differentiated carcinoma consistent with NSCLC, adenocarcinoma subtype. Recommend liquid biopsy for comprehensive genomic profiling given limited tissue.",
    },
    {
      type: "genomic",
      title: "Guardant360 Liquid Biopsy Report",
      date: "2025-10-02",
      author: "Guardant Health",
      text: "GUARDANT360 LIQUID BIOPSY REPORT\n\nSpecimen: Peripheral blood, cfDNA\n\nGenomic Findings:\n- EGFR exon 20 insertion (p.D770_N771insGD) \u2014 DETECTED (VAF 8.2%)\n- TP53 Y220C \u2014 DETECTED (VAF 12.1%)\n- STK11 loss \u2014 DETECTED (VAF 6.4%)\n- No ALK, ROS1, RET, or MET alterations detected\n\nBiomarkers:\n- Blood TMB: 6.3 mut/Mb\n- MSS (microsatellite stable)\n\nClinical Interpretation: EGFR exon 20 insertion detected. This alteration confers resistance to standard EGFR TKIs. Exon20-targeted therapies or clinical trials recommended. STK11 loss may predict reduced benefit from immunotherapy.",
    },
    {
      type: "procedure",
      title: "Cardiac Catheterization and PCI Report",
      date: "2026-01-17",
      author: "Dr. Robert Singh, Interventional Cardiology",
      text: "CARDIAC CATHETERIZATION AND PCI REPORT\n\nIndication: NSTEMI. Troponin peak 2.4 ng/mL on January 15, 2026. ECG showed ST depression in leads V4-V6.\n\nProcedure: Left heart catheterization via right radial artery approach.\n\nFindings:\n- Left main: Patent\n- LAD: 80% stenosis in the mid-segment \u2014 CULPRIT LESION\n- LCx: 40% stenosis, non-flow-limiting\n- RCA: Patent\n- LVEF estimated at 45% (mildly reduced)\n\nIntervention: Successful PCI to mid-LAD with drug-eluting stent (Xience Sierra 3.0 x 18 mm). TIMI 3 flow restored. No complications.\n\nPost-procedure plan:\n1. Dual antiplatelet therapy (aspirin + clopidogrel) for minimum 12 months\n2. High-intensity statin\n3. Beta-blocker and ACE inhibitor\n4. Cardiology follow-up in 4 weeks\n5. Clear for oncology treatment resumption after 4-week recovery period \u2014 with cardiac monitoring",
    },
    {
      type: "progress",
      title: "Progress Note \u2014 Thoracic Oncology Clinic",
      date: "2026-04-08",
      author: "Dr. William Nakamura, Thoracic Oncology",
      text: "PROGRESS NOTE \u2014 THORACIC ONCOLOGY CLINIC\n\nSubjective: Patient returns after completing platinum-based chemotherapy and recovering from NSTEMI in January. He reports increasing fatigue, dyspnea on exertion (climbing one flight of stairs), and decreased appetite. Weight down 4 kg over 2 months.\n\nObjective:\n- ECOG Performance Status: 2 \u2014 ambulatory, capable of self-care, unable to carry out work activities, up and about more than 50% of waking hours\n- Vital signs: BP 138/82, HR 72, Temp 98.6\u00B0F, SpO2 93% on RA\n- Labs (April 6): Pancytopenia \u2014 ANC 1,200, Plt 98K, Hgb 9.8. Renal insufficiency \u2014 Cr 1.8, BUN 32. Elevated transaminases \u2014 AST 52. Bilirubin 1.4.\n- CT chest (April 2): Progressive disease \u2014 LUL mass 5.8 cm (was 4.2 cm). New contralateral mediastinal lymphadenopathy.\n- No brain MRI performed this visit.\n\nAssessment:\n1. Metastatic NSCLC with EGFR exon 20 insertion \u2014 disease progression on first-line carboplatin/pemetrexed.\n2. Status post NSTEMI (January 15, 2026) \u2014 only 83 days ago. Cardiac stent in place. On DAPT.\n3. Declining performance status (ECOG 2). Weight loss. Functional decline.\n4. Pancytopenia \u2014 likely treatment-related myelosuppression. ANC 1,200 (below most trial thresholds of \u22651,500). Platelets 98K (below most thresholds of \u2265100K).\n5. Renal insufficiency \u2014 creatinine 1.8 (above most trial thresholds of \u22641.5).\n\nPlan:\n1. Clinical trial screening for EGFR exon 20-targeted therapy.\n2. IMPORTANT: Multiple barriers to trial eligibility:\n   a. MI within 6 months (most trials exclude cardiac events within 6 months)\n   b. Inadequate organ function (ANC, platelets, creatinine all out of range)\n   c. ECOG 2 (many trials require ECOG 0-1)\n3. Will screen for LU-021 but anticipate exclusions.\n4. Transfusion support if hemoglobin drops below 8.\n5. Cardiology follow-up for ongoing cardiac monitoring.\n6. Discuss palliative care options and goals of care.",
    },
  ],
  fullRecordText: robertHaleFullText,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const clinicalRecords: PatientClinicalRecord[] = [
  angelaBrooks,
  dianeFoster,
  robertHale,
];

export function getClinicalRecord(
  patientId: string,
): PatientClinicalRecord | undefined {
  return clinicalRecords.find((r) => r.patientId === patientId);
}
