// Data layer. Real Supabase data when configured, deterministic mock
// data otherwise, so the UI is buildable and browsable offline.
import { supabase, hasSupabase } from "./supabase";

/* ---- mock fallbacks ------------------------------------------------ */
const MOCK_FAMILIES = [
  { id: "ac", name: "Access Control",            controls: 24, objectives: 142, satisfied: 61, claims: 4 },
  { id: "au", name: "Audit & Accountability",    controls: 14, objectives: 88,  satisfied: 40, claims: 2 },
  { id: "cm", name: "Configuration Management",  controls: 17, objectives: 96,  satisfied: 33, claims: 6 },
  { id: "ia", name: "Identification & Auth",     controls: 15, objectives: 110, satisfied: 52, claims: 3 },
  { id: "sc", name: "System & Comms Protection", controls: 26, objectives: 138, satisfied: 44, claims: 5 },
  { id: "si", name: "System & Info Integrity",   controls: 17, objectives: 101, satisfied: 39, claims: 3 },
];

const MOCK_CONTROLS = {
  ac: [["ac-2","Account Management"],["ac-3","Access Enforcement"],["ac-6","Least Privilege"],["ac-17","Remote Access"]],
  au: [["au-2","Event Logging"],["au-3","Content of Audit Records"],["au-6","Audit Review, Analysis, and Reporting"]],
  cm: [["cm-2","Baseline Configuration"],["cm-6","Configuration Settings"],["cm-7","Least Functionality"]],
  ia: [["ia-2","Identification and Authentication (Organizational Users)"],["ia-5","Authenticator Management"]],
  sc: [["sc-7","Boundary Protection"],["sc-8","Transmission Confidentiality and Integrity"],["sc-13","Cryptographic Protection"]],
  si: [["si-2","Flaw Remediation"],["si-4","System Monitoring"]],
};

function mockObjectives(controlId) {
  return [
    { objective_id: `${controlId}_obj.a`, statement: "Sample determination statement (a) — organization-defined personnel or roles are identified.", narrative_approved: true,  evidence_linked: true,  coverage: "satisfied" },
    { objective_id: `${controlId}_obj.b`, statement: "Sample determination statement (b) — the process is defined and documented.", narrative_approved: true,  evidence_linked: false, coverage: "partial" },
    { objective_id: `${controlId}_obj.c`, statement: "Sample determination statement (c) — records are reviewed at the defined frequency.", narrative_approved: false, evidence_linked: false, coverage: "gap" },
  ];
}

/* ---- assessment resolution ---------------------------------------- */
// The app works against one assessment at a time. Resolve Krome's Class C
// assessment id once; cache it. Mock mode returns a sentinel.
let _assessmentId = null;
export async function resolveAssessment(systemName = "Krome") {
  if (!hasSupabase) return "mock-assessment";
  if (_assessmentId) return _assessmentId;
  const { data, error } = await supabase
    .from("assessment")
    .select("id, system:system_id!inner(name)")
    .eq("system.name", systemName)
    .limit(1)
    .maybeSingle();
  if (error || !data) { console.error("resolveAssessment", error); return null; }
  _assessmentId = data.id;
  return _assessmentId;
}

/* ---- queries ------------------------------------------------------- */
export async function getFamilies(systemName = "Krome") {
  if (!hasSupabase) return MOCK_FAMILIES;
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return MOCK_FAMILIES;
  const { data, error } = await supabase.rpc("family_rollup", { p_assessment: assessment });
  if (error) { console.error("family_rollup", error); return MOCK_FAMILIES; }
  // apply nice labels client-side is unnecessary; SQL already returns name,
  // but family_rollup uses initcap — prefer the label fn output if present.
  return data;
}

export async function getControlsInFamily(family, systemName = "Krome") {
  if (!hasSupabase) return (MOCK_CONTROLS[family] || []).map(([control_id, title]) => ({
    control_id, title, objectives: 3, satisfied: 1, claims: 1,
  }));
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("controls_in_family", {
    p_assessment: assessment, p_family: family,
  });
  if (error) { console.error("controls_in_family", error); return []; }
  return data;
}

export async function getObjectivesForControl(controlId, systemName = "Krome") {
  if (!hasSupabase) return mockObjectives(controlId);
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase
    .from("v_objective_state")
    .select("objective_id, statement, narrative_approved, evidence_linked, coverage")
    .eq("assessment_id", assessment)
    .eq("control_id", controlId)
    .order("objective_id");
  if (error) { console.error("getObjectivesForControl", error); return []; }
  return data;
}

export async function saveOnboarding(answers, plan) {
  if (!hasSupabase) { console.log("mock saveOnboarding", { answers, plan }); return "mock-assessment"; }
  const { data: org, error: orgErr } = await supabase.rpc("ensure_org", { p_name: "Eccalon" });
  if (orgErr) { console.error(orgErr); throw orgErr; }
  const { data, error } = await supabase.rpc("create_assessment_from_onboarding", {
    p_org: org,
    p_system_name: answers.system_name || "New System",
    p_framework: plan.frameworkId || "fedramp-class-c",
    p_answers: answers,
    p_plan: plan,
  });
  if (error) { console.error("create_assessment_from_onboarding", error); throw error; }
  _assessmentId = data; // route into the just-created assessment
  return data;
}

/* ---- stage 4: narrative proposals ---------------------------------- */
export async function getProposals(controlId, systemName = "Krome") {
  if (!hasSupabase) {
    return [
      { proposal_id: "m1", objective_id: `${controlId}_obj.a`, draft_text: "The organization identifies and selects account types via Entra ID, consistent with documented access-control policy.", rationale: "Source policy §3.1 lists account types.", confidence: "high", status: "proposed" },
    ];
  }
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("proposals_for_review", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("proposals_for_review", error); return []; }
  return data;
}

export async function acceptProposal(proposalId, editor, finalText) {
  if (!hasSupabase) { console.log("mock accept", proposalId); return; }
  const { error } = await supabase.rpc("accept_proposal", {
    p_proposal: proposalId, p_editor: editor, p_final_text: finalText,
  });
  if (error) { console.error("accept_proposal", error); throw error; }
}

/* ---- stage 5: evidence ---------------------------------------------- */
export async function reviewEvidence(controlId, { urls, pasted_text, title }) {
  if (!hasSupabase) {
    return { ok: true, files_read: (urls||[]).length, matches: [
      { objective_id: `${controlId}_obj`, method: "examine",
        supports: "Sample: the linked evidence shows the control enforced.", confidence: "high" },
    ] };
  }
  const { data, error } = await supabase.functions.invoke("review-evidence", {
    body: { control_id: controlId, urls, pasted_text, title },
  });
  if (error) { console.error("review-evidence", error); return { ok: false, reason: String(error) }; }
  return data;
}

export async function linkEvidence(objective, { assessment, title, url, artifactType, method, supports }, systemName = "Krome") {
  if (!hasSupabase) { console.log("mock linkEvidence", objective); return; }
  const a = assessment || await resolveAssessment(systemName);
  const { error } = await supabase.rpc("link_evidence", {
    p_assessment: a, p_objective: objective, p_title: title, p_url: url,
    p_artifact_type: artifactType, p_method: method, p_supports: supports,
  });
  if (error) { console.error("link_evidence", error); throw error; }
}

export async function getEvidenceForControl(controlId, systemName = "Krome") {
  if (!hasSupabase) return [];
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("evidence_for_control", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("evidence_for_control", error); return []; }
  return data;
}

/* ---- stage 5: already-linked check --------------------------------- */
export async function getLinkedUrls(controlId, systemName = "Krome") {
  // returns { url: [objective_id, ...] } for artifacts already linked on this control
  if (!hasSupabase) return {};
  const ev = await getEvidenceForControl(controlId, systemName);
  const map = {};
  (ev || []).forEach((e) => { (map[e.url] ||= []).push(e.objective_id); });
  return map;
}

/* ---- stage 5/4: reversibility -------------------------------------- */
export async function unlinkEvidence(objective, artifactId, systemName = "Krome") {
  if (!hasSupabase) { console.log("mock unlink", artifactId); return; }
  const assessment = await resolveAssessment(systemName);
  const { error } = await supabase.rpc("unlink_evidence", {
    p_assessment: assessment, p_objective: objective, p_artifact: artifactId,
  });
  if (error) { console.error("unlink_evidence", error); throw error; }
}

export async function editNarrative(objective, newText, editor, systemName = "Krome") {
  if (!hasSupabase) { console.log("mock editNarrative", objective); return; }
  const assessment = await resolveAssessment(systemName);
  const { error } = await supabase.rpc("edit_narrative", {
    p_assessment: assessment, p_objective: objective, p_new_text: newText, p_editor: editor,
  });
  if (error) { console.error("edit_narrative", error); throw error; }
}

export async function removeNarrative(objective, systemName = "Krome") {
  if (!hasSupabase) { console.log("mock removeNarrative", objective); return; }
  const assessment = await resolveAssessment(systemName);
  const { error } = await supabase.rpc("remove_narrative", {
    p_assessment: assessment, p_objective: objective,
  });
  if (error) { console.error("remove_narrative", error); throw error; }
}

export async function getNarratives(controlId, systemName = "Krome") {
  if (!hasSupabase) return {};
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return {};
  const { data, error } = await supabase.rpc("narrative_for_control", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("narrative_for_control", error); return {}; }
  const map = {};
  (data || []).forEach((r) => { map[r.objective_id] = r.body_text; });
  return map;
}

/* ---- governing docs: policies & procedures (the -1 controls) -------- */
export async function saveGoverningDoc(family, docType, title, sections, systemName = "Krome") {
  if (!hasSupabase) { console.log("mock saveGoverningDoc", family, docType); return null; }
  const assessment = await resolveAssessment(systemName);
  const { data, error } = await supabase.rpc("save_governing_doc", {
    p_assessment: assessment, p_family: family, p_doc_type: docType,
    p_title: title, p_sections: sections,
  });
  if (error) { console.error("save_governing_doc", error); throw error; }
  return data; // the new doc_id
}

// Tag a doc's sections to the controls they address (AI pass at ingest).
export async function tagSections(docId, family) {
  if (!hasSupabase) { console.log("mock tagSections", docId); return; }
  const { data, error } = await supabase.functions.invoke("tag-sections", {
    body: { doc_id: docId, family },
  });
  if (error) { console.error("tag-sections", error); return; }
  return data;
}

// Governing-doc sections that apply to a control (via section-control mapping).
export async function getDocsForControl(controlId, systemName = "Krome") {
  if (!hasSupabase) return [];
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("docs_for_control", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("docs_for_control", error); return []; }
  // group flat rows -> [{doc_id, doc_type, title, sections:[...]}]
  const byDoc = {};
  (data || []).forEach((r) => {
    if (!byDoc[r.doc_id]) byDoc[r.doc_id] = {
      doc_id: r.doc_id, doc_type: r.doc_type, title: r.doc_title, sections: [],
    };
    byDoc[r.doc_id].sections.push({
      section_id: r.section_id, heading: r.heading, body_text: r.body_text,
      sort_order: r.sort_order, confidence: r.confidence,
    });
  });
  return Object.values(byDoc);
}

export async function getGoverningDocs(family, systemName = "Krome") {
  if (!hasSupabase) return [];
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("governing_docs_for_family", {
    p_assessment: assessment, p_family: family,
  });
  if (error) { console.error("governing_docs_for_family", error); return []; }
  // group flat rows -> [{doc_id, doc_type, title, status, sections:[...]}]
  const byDoc = {};
  (data || []).forEach((r) => {
    if (!byDoc[r.doc_id]) byDoc[r.doc_id] = {
      doc_id: r.doc_id, doc_type: r.doc_type, title: r.title, status: r.status, sections: [],
    };
    if (r.section_id) byDoc[r.doc_id].sections.push({
      section_id: r.section_id, heading: r.heading, body_text: r.body_text, sort_order: r.sort_order,
    });
  });
  return Object.values(byDoc);
}

export async function editGoverningSection(sectionId, body) {
  if (!hasSupabase) { console.log("mock editGoverningSection", sectionId); return; }
  const { error } = await supabase.rpc("edit_governing_section", {
    p_section: sectionId, p_body: body,
  });
  if (error) { console.error("edit_governing_section", error); throw error; }
}

export async function setGoverningStatus(docId, status, editor = "duane.wilson@eccalon.com") {
  if (!hasSupabase) { console.log("mock setGoverningStatus", docId, status); return; }
  const { error } = await supabase.rpc("set_governing_status", {
    p_doc: docId, p_status: status, p_editor: editor,
  });
  if (error) { console.error("set_governing_status", error); throw error; }
}

// map a family id -> which control is its "-1"
export function dashOneControl(family) { return `${family.toLowerCase()}-1`; }

/* ---- unified reconciliation ---------------------------------------- */
export async function getControlDossier(controlId, systemName = "Krome") {
  if (!hasSupabase) return { control_id: controlId, objectives: [], governing_docs: [] };
  const assessment = await resolveAssessment(systemName);
  const { data, error } = await supabase.rpc("control_dossier", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("control_dossier", error); return { control_id: controlId, objectives: [], governing_docs: [] }; }
  return data;
}

export async function runReconcile(controlId, systemName = "Krome") {
  if (!hasSupabase) {
    return { ok: true, requirements: { verdict: "partial", detail: "Sample reconcile result." },
      consistency: { verdict: "consistent", issues: [] }, improvements: [] };
  }
  const assessment = await resolveAssessment(systemName);
  const { data, error } = await supabase.functions.invoke("reconcile", {
    body: { assessment_id: assessment, control_id: controlId },
  });
  if (error) { console.error("reconcile", error); return { ok: false, reason: String(error) }; }
  return data;
}

export async function getReconciliation(controlId, systemName = "Krome") {
  if (!hasSupabase) return null;
  const assessment = await resolveAssessment(systemName);
  const { data, error } = await supabase.rpc("get_reconciliation", {
    p_assessment: assessment, p_scope_type: "control", p_scope_id: controlId,
  });
  if (error) { console.error("get_reconciliation", error); return null; }
  return (data && data[0]) || null;
}

/* ---- FedRAMP SAR requirements (from SRTM) --------------------------- */
export async function getSarForControl(controlId) {
  if (!hasSupabase) return [];
  const { data, error } = await supabase.rpc("sar_for_control", { p_control: controlId });
  if (error) { console.error("sar_for_control", error); return []; }
  return data || [];
}

/* ---- dashboard ------------------------------------------------------ */
export async function getDashboardStats(systemName = "Krome") {
  const empty = {
    objectives: { total: 0, satisfied: 0, partial: 0, gap: 0 },
    controls: { total: 0, satisfied: 0 },
    buckets: { missing_evidence: 0, missing_narrative: 0 },
    conflicts: 0, families: [], attention: [],
  };
  if (!hasSupabase) return empty;
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return empty;
  const { data, error } = await supabase.rpc("dashboard_stats", { p_assessment: assessment });
  if (error) { console.error("dashboard_stats", error); return empty; }
  return { ...empty, ...(data || {}) };
}


// Map every section of a doc to a single control (no AI, no spread).
export async function mapDocToControl(docId, controlId) {
  if (!hasSupabase) { console.log("mock mapDocToControl", docId, controlId); return; }
  const { error } = await supabase.rpc("map_doc_to_control", {
    p_doc: docId, p_control: controlId,
  });
  if (error) { console.error("map_doc_to_control", error); throw error; }
}

/* ---- final package -------------------------------------------------- */
export async function getPackageData(controlId = null, systemName = "Krome") {
  if (!hasSupabase) return [];
  const assessment = await resolveAssessment(systemName);
  if (!assessment) return [];
  const { data, error } = await supabase.rpc("package_data", {
    p_assessment: assessment, p_control: controlId,
  });
  if (error) { console.error("package_data", error); return []; }
  return data || [];
}
