export const formatDateOnlyAsPTBR = (dateString?: string | null, defaultValue = "-"): string => {
  if (!dateString) return defaultValue;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return defaultValue;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export const formatDateTimeAsPTBR = (dateString?: string | null, defaultValue = "-"): string => {
  if (!dateString) return defaultValue;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return defaultValue;
  return date.toLocaleDateString("pt-BR");
};

export const formatDateForInput = (dateString?: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getUtcDateOnlyTimestamp = (dateString?: string | null): number | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};
