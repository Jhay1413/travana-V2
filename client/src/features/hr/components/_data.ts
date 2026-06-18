export type EmployeeStatus = "Active" | "On Leave" | "Probation" | "Archived";
export type EmploymentType = "Full-time" | "Part-time" | "Contractor";
export type DocStatus = "Uploaded" | "Missing" | "Expiring Soon";

export interface DocumentItem {
  id: string;
  name: string;
  category: "Contract" | "NDA" | "Right to Work" | "Policies" | "Training";
  status: DocStatus;
  updated: string;
}

export interface HolidayEntry {
  id: string;
  type: "Holiday" | "Sick" | "Other";
  from: string;
  to: string;
  days: number;
  status: "Approved" | "Pending" | "Rejected";
  reason?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  progress: number;
  status: "Not started" | "In progress" | "Completed";
  certificate?: string;
}

export interface HRNote {
  id: string;
  author: string;
  date: string;
  body: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: "Joined" | "Document" | "Leave" | "Training" | "Note" | "Review";
  title: string;
  detail?: string;
}

export interface OnboardingItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  team: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  location: string;
  email: string;
  phone: string;
  startDate: string;
  probationEnd?: string;
  manager: string;
  emergencyContact: { name: string; relation: string; phone: string };
  avatarColor: string;
  initials: string;
  holidayAllowance: number;
  holidayUsed: number;
  sickDaysYTD: number;
  documents: DocumentItem[];
  holidays: HolidayEntry[];
  training: TrainingModule[];
  notes: HRNote[];
  timeline: TimelineEvent[];
  onboarding: OnboardingItem[];
}

const onboardingTemplate = (overrides: Partial<Record<string, boolean>> = {}): OnboardingItem[] => [
  { id: "ob-1", label: "Contract signed", done: overrides["ob-1"] ?? true },
  { id: "ob-2", label: "NDA uploaded", done: overrides["ob-2"] ?? true },
  { id: "ob-3", label: "Right to work checked", done: overrides["ob-3"] ?? true },
  { id: "ob-4", label: "System access granted", done: overrides["ob-4"] ?? true },
  { id: "ob-5", label: "First week check-in completed", done: overrides["ob-5"] ?? true },
  { id: "ob-6", label: "Training started", done: overrides["ob-6"] ?? true },
];

export const employees: Employee[] = [
  {
    id: "emp-1",
    name: "Amelia Carter",
    role: "Senior Travel Consultant",
    team: "Luxury Escapes",
    status: "Active",
    employmentType: "Full-time",
    location: "London, UK",
    email: "amelia.carter@travana.co",
    phone: "+44 20 7946 1122",
    startDate: "12 Mar 2022",
    manager: "Priya Sharma",
    emergencyContact: { name: "Daniel Carter", relation: "Spouse", phone: "+44 7700 900123" },
    avatarColor: "bg-rose-100 text-rose-700",
    initials: "AC",
    holidayAllowance: 28,
    holidayUsed: 14,
    sickDaysYTD: 2,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "12 Mar 2022" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "12 Mar 2022" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Uploaded", updated: "10 Mar 2022" },
      { id: "d4", name: "Code of conduct policy", category: "Policies", status: "Uploaded", updated: "01 Jan 2026" },
      { id: "d5", name: "GDPR training certificate", category: "Training", status: "Expiring Soon", updated: "20 May 2025" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "10 Jul 2026", to: "24 Jul 2026", days: 10, status: "Approved", reason: "Summer break" },
      { id: "h2", type: "Sick", from: "03 Feb 2026", to: "04 Feb 2026", days: 2, status: "Approved", reason: "Flu" },
      { id: "h3", type: "Holiday", from: "21 Dec 2026", to: "31 Dec 2026", days: 7, status: "Pending", reason: "Family Christmas" },
    ],
    training: [
      { id: "t1", title: "Safeguarding & duty of care", progress: 100, status: "Completed", certificate: "Issued 14 Apr 2026" },
      { id: "t2", title: "Luxury supplier accreditation", progress: 100, status: "Completed", certificate: "Issued 02 Feb 2026" },
      { id: "t3", title: "ATOL refresher 2026", progress: 60, status: "In progress" },
    ],
    notes: [
      { id: "n1", author: "Priya Sharma", date: "18 Apr 2026", body: "Strong Q1 — exceeded client retention goals. Discussed lead consultant pathway." },
      { id: "n2", author: "HR Team", date: "02 Feb 2026", body: "Returned from sick leave, no follow-up required." },
    ],
    timeline: [
      { id: "tl1", date: "12 Mar 2022", type: "Joined", title: "Joined Travana", detail: "Senior Travel Consultant — Luxury Escapes" },
      { id: "tl2", date: "20 May 2025", type: "Training", title: "Completed GDPR training" },
      { id: "tl3", date: "10 Jul 2026", type: "Leave", title: "Holiday approved", detail: "10 days, summer" },
      { id: "tl4", date: "18 Apr 2026", type: "Review", title: "Quarterly review logged" },
    ],
    onboarding: onboardingTemplate(),
  },
  {
    id: "emp-2",
    name: "Marcus Bennett",
    role: "Travel Consultant",
    team: "City Breaks",
    status: "Probation",
    employmentType: "Full-time",
    location: "Manchester, UK",
    email: "marcus.bennett@travana.co",
    phone: "+44 161 555 2233",
    startDate: "06 Jan 2026",
    probationEnd: "06 Jul 2026",
    manager: "Priya Sharma",
    emergencyContact: { name: "Lillian Bennett", relation: "Mother", phone: "+44 7700 900456" },
    avatarColor: "bg-sky-100 text-sky-700",
    initials: "MB",
    holidayAllowance: 25,
    holidayUsed: 4,
    sickDaysYTD: 0,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "06 Jan 2026" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "06 Jan 2026" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Uploaded", updated: "04 Jan 2026" },
      { id: "d4", name: "Code of conduct policy", category: "Policies", status: "Missing", updated: "—" },
      { id: "d5", name: "Onboarding training certificate", category: "Training", status: "Missing", updated: "—" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "12 Apr 2026", to: "16 Apr 2026", days: 4, status: "Approved", reason: "City break" },
      { id: "h2", type: "Holiday", from: "01 Aug 2026", to: "08 Aug 2026", days: 6, status: "Pending", reason: "Family holiday" },
    ],
    training: [
      { id: "t1", title: "Travana onboarding pathway", progress: 70, status: "In progress" },
      { id: "t2", title: "Sabre booking system", progress: 35, status: "In progress" },
      { id: "t3", title: "Safeguarding & duty of care", progress: 0, status: "Not started" },
    ],
    notes: [
      { id: "n1", author: "Priya Sharma", date: "20 Apr 2026", body: "Probation midpoint review scheduled for 6 May. Coaching plan in place." },
    ],
    timeline: [
      { id: "tl1", date: "06 Jan 2026", type: "Joined", title: "Joined Travana", detail: "Travel Consultant — City Breaks" },
      { id: "tl2", date: "12 Apr 2026", type: "Leave", title: "Holiday approved" },
      { id: "tl3", date: "20 Apr 2026", type: "Note", title: "Probation midpoint scheduled" },
    ],
    onboarding: onboardingTemplate({ "ob-5": false, "ob-6": true }),
  },
  {
    id: "emp-3",
    name: "Priya Sharma",
    role: "Head of Consultant Operations",
    team: "Operations",
    status: "Active",
    employmentType: "Full-time",
    location: "London, UK",
    email: "priya.sharma@travana.co",
    phone: "+44 20 7946 5566",
    startDate: "02 Sep 2019",
    manager: "Jordan Pierce",
    emergencyContact: { name: "Anil Sharma", relation: "Brother", phone: "+44 7700 900789" },
    avatarColor: "bg-amber-100 text-amber-700",
    initials: "PS",
    holidayAllowance: 30,
    holidayUsed: 18,
    sickDaysYTD: 1,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "02 Sep 2019" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "02 Sep 2019" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Uploaded", updated: "30 Aug 2019" },
      { id: "d4", name: "Manager handbook 2026", category: "Policies", status: "Uploaded", updated: "10 Jan 2026" },
      { id: "d5", name: "Leadership programme certificate", category: "Training", status: "Uploaded", updated: "12 Nov 2025" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "20 May 2026", to: "30 May 2026", days: 8, status: "Approved", reason: "Greece" },
      { id: "h2", type: "Sick", from: "11 Mar 2026", to: "11 Mar 2026", days: 1, status: "Approved", reason: "Migraine" },
    ],
    training: [
      { id: "t1", title: "Performance coaching essentials", progress: 100, status: "Completed", certificate: "Issued 22 Jan 2026" },
      { id: "t2", title: "Safer recruitment", progress: 100, status: "Completed", certificate: "Issued 09 Mar 2026" },
      { id: "t3", title: "Mental health first aid", progress: 45, status: "In progress" },
    ],
    notes: [
      { id: "n1", author: "Jordan Pierce", date: "10 Apr 2026", body: "Promotion case being prepared for review board in Q3." },
    ],
    timeline: [
      { id: "tl1", date: "02 Sep 2019", type: "Joined", title: "Joined Travana", detail: "Senior Consultant" },
      { id: "tl2", date: "01 Apr 2023", type: "Review", title: "Promoted to Head of Consultant Operations" },
      { id: "tl3", date: "12 Nov 2025", type: "Training", title: "Leadership programme completed" },
    ],
    onboarding: onboardingTemplate(),
  },
  {
    id: "emp-4",
    name: "Sofia Russo",
    role: "Marketing Coordinator",
    team: "Marketing",
    status: "On Leave",
    employmentType: "Full-time",
    location: "Remote, IT",
    email: "sofia.russo@travana.co",
    phone: "+39 02 5555 7788",
    startDate: "15 Aug 2023",
    manager: "Jordan Pierce",
    emergencyContact: { name: "Luca Russo", relation: "Partner", phone: "+39 333 555 1234" },
    avatarColor: "bg-emerald-100 text-emerald-700",
    initials: "SR",
    holidayAllowance: 26,
    holidayUsed: 11,
    sickDaysYTD: 3,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "15 Aug 2023" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "15 Aug 2023" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Expiring Soon", updated: "20 Aug 2024" },
      { id: "d4", name: "Remote working policy", category: "Policies", status: "Uploaded", updated: "01 Feb 2026" },
      { id: "d5", name: "Brand guidelines training", category: "Training", status: "Uploaded", updated: "18 Sep 2025" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "28 Apr 2026", to: "12 May 2026", days: 10, status: "Approved", reason: "Family wedding" },
      { id: "h2", type: "Sick", from: "20 Jan 2026", to: "22 Jan 2026", days: 3, status: "Approved", reason: "Flu" },
    ],
    training: [
      { id: "t1", title: "Brand guidelines 2026", progress: 100, status: "Completed", certificate: "Issued 18 Sep 2025" },
      { id: "t2", title: "Paid social fundamentals", progress: 80, status: "In progress" },
      { id: "t3", title: "GDPR refresher", progress: 0, status: "Not started" },
    ],
    notes: [
      { id: "n1", author: "HR Team", date: "26 Apr 2026", body: "On approved leave 28 Apr – 12 May. Cover plan agreed." },
    ],
    timeline: [
      { id: "tl1", date: "15 Aug 2023", type: "Joined", title: "Joined Travana", detail: "Marketing Coordinator" },
      { id: "tl2", date: "28 Apr 2026", type: "Leave", title: "Holiday started" },
      { id: "tl3", date: "01 Feb 2026", type: "Document", title: "Remote working policy signed" },
    ],
    onboarding: onboardingTemplate(),
  },
  {
    id: "emp-5",
    name: "Daniel Okafor",
    role: "Finance Analyst",
    team: "Finance",
    status: "Active",
    employmentType: "Full-time",
    location: "London, UK",
    email: "daniel.okafor@travana.co",
    phone: "+44 20 7946 9090",
    startDate: "01 Oct 2024",
    manager: "Hannah Lee",
    emergencyContact: { name: "Grace Okafor", relation: "Sister", phone: "+44 7700 900222" },
    avatarColor: "bg-violet-100 text-violet-700",
    initials: "DO",
    holidayAllowance: 25,
    holidayUsed: 6,
    sickDaysYTD: 0,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "01 Oct 2024" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "01 Oct 2024" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Uploaded", updated: "28 Sep 2024" },
      { id: "d4", name: "Anti-bribery policy", category: "Policies", status: "Uploaded", updated: "01 Jan 2026" },
      { id: "d5", name: "AML training certificate", category: "Training", status: "Uploaded", updated: "12 Feb 2026" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "23 Mar 2026", to: "27 Mar 2026", days: 4, status: "Approved" },
      { id: "h2", type: "Holiday", from: "10 Aug 2026", to: "21 Aug 2026", days: 9, status: "Pending", reason: "Visiting family" },
    ],
    training: [
      { id: "t1", title: "AML & financial crime", progress: 100, status: "Completed", certificate: "Issued 12 Feb 2026" },
      { id: "t2", title: "Advanced Excel for finance", progress: 50, status: "In progress" },
      { id: "t3", title: "Safeguarding & duty of care", progress: 100, status: "Completed", certificate: "Issued 03 Nov 2025" },
    ],
    notes: [
      { id: "n1", author: "Hannah Lee", date: "12 Mar 2026", body: "Excellent year-end audit support. Recommend a discretionary bonus." },
    ],
    timeline: [
      { id: "tl1", date: "01 Oct 2024", type: "Joined", title: "Joined Travana", detail: "Finance Analyst" },
      { id: "tl2", date: "12 Feb 2026", type: "Training", title: "AML certificate issued" },
      { id: "tl3", date: "12 Mar 2026", type: "Note", title: "Bonus recommendation logged" },
    ],
    onboarding: onboardingTemplate(),
  },
  {
    id: "emp-6",
    name: "Elena Vasquez",
    role: "Customer Care Specialist",
    team: "Customer Care",
    status: "Archived",
    employmentType: "Part-time",
    location: "Edinburgh, UK",
    email: "elena.vasquez@travana.co",
    phone: "+44 131 555 4040",
    startDate: "11 May 2021",
    manager: "Priya Sharma",
    emergencyContact: { name: "Mateo Vasquez", relation: "Father", phone: "+44 7700 900333" },
    avatarColor: "bg-slate-100 text-slate-700",
    initials: "EV",
    holidayAllowance: 18,
    holidayUsed: 18,
    sickDaysYTD: 4,
    documents: [
      { id: "d1", name: "Employment contract", category: "Contract", status: "Uploaded", updated: "11 May 2021" },
      { id: "d2", name: "NDA agreement", category: "NDA", status: "Uploaded", updated: "11 May 2021" },
      { id: "d3", name: "Right to work check", category: "Right to Work", status: "Uploaded", updated: "10 May 2021" },
      { id: "d4", name: "Leaver checklist", category: "Policies", status: "Uploaded", updated: "28 Feb 2026" },
      { id: "d5", name: "Exit interview notes", category: "Policies", status: "Uploaded", updated: "01 Mar 2026" },
    ],
    holidays: [
      { id: "h1", type: "Holiday", from: "18 Feb 2026", to: "28 Feb 2026", days: 8, status: "Approved", reason: "Final leave before exit" },
    ],
    training: [
      { id: "t1", title: "Customer care excellence", progress: 100, status: "Completed", certificate: "Issued 14 Jun 2024" },
      { id: "t2", title: "Complaint handling", progress: 100, status: "Completed", certificate: "Issued 09 Sep 2025" },
    ],
    notes: [
      { id: "n1", author: "HR Team", date: "01 Mar 2026", body: "Exit interview completed. Positive feedback on team culture." },
    ],
    timeline: [
      { id: "tl1", date: "11 May 2021", type: "Joined", title: "Joined Travana", detail: "Customer Care Specialist" },
      { id: "tl2", date: "01 Mar 2026", type: "Note", title: "Exit interview completed" },
      { id: "tl3", date: "28 Feb 2026", type: "Leave", title: "Final day" },
    ],
    onboarding: onboardingTemplate(),
  },
];

export const roles = Array.from(new Set(employees.map((e) => e.role)));
export const locations = Array.from(new Set(employees.map((e) => e.location)));
export const statuses: EmployeeStatus[] = ["Active", "On Leave", "Probation", "Archived"];

export interface Reminder {
  id: string;
  type: "Probation" | "Document" | "Holiday" | "Contract";
  message: string;
  employee: string;
  due: string;
  severity: "high" | "medium" | "low";
}

export const reminders: Reminder[] = [
  { id: "r1", type: "Probation", message: "Probation review due", employee: "Marcus Bennett", due: "06 Jul 2026", severity: "high" },
  { id: "r2", type: "Document", message: "Right to work expiring", employee: "Sofia Russo", due: "20 Aug 2026", severity: "medium" },
  { id: "r3", type: "Document", message: "Code of conduct policy missing", employee: "Marcus Bennett", due: "Overdue", severity: "high" },
  { id: "r4", type: "Holiday", message: "Holiday request awaiting approval", employee: "Amelia Carter", due: "21 Dec 2026", severity: "medium" },
  { id: "r5", type: "Holiday", message: "Holiday request awaiting approval", employee: "Daniel Okafor", due: "10 Aug 2026", severity: "low" },
  { id: "r6", type: "Contract", message: "Contract review reminder", employee: "Priya Sharma", due: "02 Sep 2026", severity: "low" },
];
