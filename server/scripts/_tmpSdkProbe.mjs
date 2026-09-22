try {
  const named = await import("plagiarism-checker");
  console.log("named import keys sample:", Object.keys(named).slice(0, 12).join(", "));
  console.log("has Copyleaks:", typeof named.Copyleaks);
  console.log("has CopyleaksFileSubmissionModel:", typeof named.CopyleaksFileSubmissionModel);
  console.log("has CopyleaksStartRequestModel:", typeof named.CopyleaksStartRequestModel);
  console.log("default present:", typeof named.default, named.default ? Object.keys(named.default).slice(0, 12).join(", ") : "");
} catch (e) {
  console.log("IMPORT ERROR:", e.message);
}
