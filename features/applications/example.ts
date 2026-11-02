import type { ApplicationInput, Requirement } from "@/lib/contracts";

export const examplePosting = `Analyse, design and develop an apps based on customer, business and Bank's operational needs.
Perform system testing, both unit tests and system integration tests, to ensure that the application can be used and connected to other required systems.
Monitor and maintain apps performance and enhancement to suit the needs of customers, business, and the Bank's operations.
Develop and manage documentation related to apps development.

Requirements
At least 2-4 years of Web Developer experience using TypeScript, React.js, and Next.js.
Proficiency in React.js and Next.js is required.
Good understanding of micro frontend architecture.
Familiar with Linux CLI and have knowledge about Git Flow.
Additional experience with client-side tools like React Query, Redux is preferred.
Knowledge of infrastructure like Docker and Kubernetes.
Familiar with Java and Spring Boot.
Good communication and collaboration skill.
Good understanding of software security.
Able to do code testing, bug troubleshooting, and provide application support.
Updated on technological developments.
Preferred Experience in Banking Industry.`;
const required = [
  "At least 2 years of web development using TypeScript, React.js and Next.js",
  "Proficiency in React.js and Next.js",
  "Understanding of micro frontend architecture",
  "Familiarity with Linux CLI and Git Flow",
  "Knowledge of Docker and Kubernetes",
  "Familiarity with Java and Spring Boot",
  "Good communication and collaboration",
  "Understanding of software security",
  "Code testing, bug troubleshooting and application support",
  "Keeping up with technological developments",
];
const responsibilities = [
  "Analyse, design and develop apps for customer, business and banking operational needs",
  "Perform unit and system integration testing",
  "Monitor, maintain and improve application performance",
  "Develop and manage application documentation",
];
export const exampleRequirements: Requirement[] = [
  ...required.map((text, i) => ({
    id: `req${i}`,
    text,
    group: "required" as const,
  })),
  ...responsibilities.map((text, i) => ({
    id: `duty${i}`,
    text,
    group: "responsibility" as const,
  })),
  {
    id: "pref1",
    text: "Experience with React Query or Redux",
    group: "preferred",
  },
  {
    id: "pref2",
    text: "Experience in the banking industry",
    group: "preferred",
  },
];
export const blankApplication: ApplicationInput = {
  workMode: "",
  location: "",
  company: "",
  role: "",
  posting: "",
  requirements: [],
  url: "",
  notes: "",
  status: "Saved",
  appliedDate: "",
  nextActionDate: "",
  submittedRevisionId: null,
};
export const exampleApplication: ApplicationInput = {
  ...blankApplication,
  company: "Bank (example)",
  role: "Web Developer",
  posting: examplePosting,
  requirements: exampleRequirements,
};
