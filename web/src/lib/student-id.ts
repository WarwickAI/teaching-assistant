// Accepts the ID with or without its leading "u", such as u2154321, and returns just the digits.
export const parseStudentId = (text: string) => /^u?([0-9]{7})$/i.exec(text.trim())?.[1];
