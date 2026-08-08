// Accepts +91, 91, leading 0, or bare 10 digit; returns canonical 10-digit or null
export function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  let ten;
  if (digits.length === 10) ten = digits;
  else if (digits.length === 12 && digits.startsWith("91")) ten = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) ten = digits.slice(1);
  else return null;
  if (!/^[6-9]/.test(ten)) return null;
  return ten;
}

export function validatePhone(input) {
  return normalizePhone(input) !== null;
}

// Human-friendly formatting: "+91 98765 43210"
export function formatIndianPhone(input) {
  const ten = normalizePhone(input);
  if (!ten) return input || "";
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}
