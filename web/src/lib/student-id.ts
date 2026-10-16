// The assistant asks this before anything else, and again until the answer looks like a student ID.
export const studentIdQuestion = "Before we start, what's your student ID? It's the 7-digit number on your university card, like 2154321.";

// Accepts the ID with or without its leading "u", such as u2154321, and returns just the digits.
export const parseStudentId = (text: string) => /^u?([0-9]{7})$/i.exec(text.trim())?.[1];
