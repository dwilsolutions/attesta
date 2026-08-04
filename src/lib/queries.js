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
