/** Fictional demo documents. Every name, number and address is invented; numbers pass their check digits on purpose. */
export interface Demo {
  id: string;
  title: string;
  hint: string;
  task: string;
  text: string;
}

export const DEMOS: Demo[] = [
  {
    id: "client-email",
    title: "Client email to an accountant",
    hint: "Tax season: a client sends a SIN, a bank account and a spouse's name.",
    task: "Draft a short, warm reply that confirms what we received and lists what is still missing for the return.",
    text: `Subject: Our 2026 return - documents

Hi Priya,

Thanks for the reminder. Attached are my T4 from Harbourline Logistics and Elena's T4A from the Ottawa-Carleton School Board. My SIN is 728 146 390 and Elena's is on last year's file.

We moved in August, the new address is 1187 Bank Street, Unit 4, Ottawa, ON K1S 3X7. The RRSP refund should go to our joint account, client no. TDX-448120, and you can reach me at 613-555-0142 or marco.ricci@example.com.

One thing I'm not sure about: Elena started freelancing in October (about $6,200 so far). Does she need to register for GST/HST?

Thanks,
Marco Ricci`,
  },
  {
    id: "medical-note",
    title: "Clinic discharge note",
    hint: "A patient wants their discharge note explained in plain words.",
    task: "Explain this note to the patient in plain language: what happened, what to take, and when to come back.",
    text: `RIDEAU VALLEY HEALTH CENTRE - DISCHARGE SUMMARY

Patient: Daniel Okonkwo
DOB: 1984-03-17    OHIP: 5832-049-174-AB    MRN: RVH-2209114
Attending: Dr. Hannah Lindqvist
Admitted: 2026-11-02    Discharged: 2026-11-05

Mr. Okonkwo presented with community-acquired pneumonia, right lower lobe, confirmed on chest X-ray. Treated with IV ceftriaxone, switched to oral amoxicillin-clavulanate 875/125 mg twice daily on day 2. SpO2 96% on room air at discharge.

Plan: complete 7 days of antibiotics. Follow-up with family physician Dr. Samuel Brandt (Westboro Family Practice, 613-555-0199) in 7-10 days. Repeat chest X-ray in 6 weeks. Return to ED if shortness of breath, fever above 39 C, or chest pain.

Emergency contact: Grace Okonkwo (spouse), 613-555-0176.`,
  },
  {
    id: "resume",
    title: "Résumé for a job application",
    hint: "A job seeker wants feedback without handing their identity to a chatbot.",
    task: "Give three concrete improvements to this résumé for a Senior Operations Analyst role, then rewrite the summary.",
    text: `MARIANA KOWALCZYK
41 Laurier Avenue East, Ottawa, ON K1N 6R2 | (613) 555-0187 | mariana.kowalczyk@example.com

SUMMARY
Operations person with 9 years in logistics. Good with Excel and people.

EXPERIENCE
Harbourline Logistics, Ottawa - Operations Coordinator, 2021-present
- Ran the daily dispatch for 40 trucks
- Built a new Excel tracker for late deliveries

Maple Crest Foods, Kingston - Inventory Clerk, 2016-2021
- Counted stock, handled supplier calls

EDUCATION
Algonquin College - Supply Chain Management diploma, 2016

REFERENCES
Tomasz Wieczorek, former manager, 613-555-0123`,
  },
];
