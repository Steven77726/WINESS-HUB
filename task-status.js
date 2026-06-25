export function normalizedStatusKey(status) {
  return String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export function finalStatusKind(status) {
  const key = normalizedStatusKey(status);
  if (["valide", "validee", "validated", "prete", "prete avec manquants", "facture"].includes(key)) return "validated";
  if (["recupere", "recuperee", "recovered"].includes(key)) return "recovered";
  if (["livre", "livree", "delivered"].includes(key)) return "delivered";
  if (["termine", "terminee", "completed"].includes(key)) return "completed";
  return "";
}

export function isCompletedStatus(status) {
  return Boolean(finalStatusKind(status));
}
