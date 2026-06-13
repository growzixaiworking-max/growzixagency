export type UserRole = 'superadmin' | 'admin' | 'hrmanager' | 'teamleader' | 'employee' | 'viewer' | 'ecommerce' | 'marketing' | 'architecture';

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Employee {
  id: string;
  name: string;
  fatherName: string;
  cnic?: string;
  phone: string;
  address: string;
  email: string;
  department: string;
  position: string;
  salary: number;
  status: 'active' | 'inactive';
  joinDate: string;
  monthlyHours: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  breakIn: string;
  breakOut: string;
  lateEntry: string;
  earlyExit: string;
  overtime: number;
  status: 'present' | 'absent' | 'leave' | 'late' | 'half-day';
  hours: number;
}

export interface TaskLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  task: string;
  category: string;
  workingDays: number;
  quality: number;
  score: number;
  projectsAssigned: number;
  projectsCompleted: number;
  pendingProjects: number;
  approvedProjects: number;
  rejectedProjects: number;
  clientResponses: number;
  leadsGenerated: number;
  emailsSent: number;
  conversionRatio: number;
  ordersHandled?: number;
  netProfit?: number;
  accountName?: string;
  sales?: number;
  listings?: number;
  targetProfit?: number;
  trackingSet?: boolean;
  ordersStatus?: 'Done' | 'Pending';
  ordersReason?: string;
  trackingStatus?: 'Done' | 'Pending';
  trackingReason?: string;
  sheetsStatus?: 'Done' | 'Pending';
  sheetsReason?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy: string;
  submittedBy: string;
  department?: string;
}

export interface Bill {
  id: string;
  date: string;
  billType: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  paidDate?: string;
  paidAmount?: number;
  notes?: string;
}

export interface Income {
  id: string;
  date: string;
  client: string;
  project: string;
  amount: number;
  status: 'received' | 'pending';
  department?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  sender: string;
  recipient: string;
  read: boolean;
  createdAt: Date;
}

export interface BreakRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  type: 'sick' | 'casual' | 'annual' | 'paid';
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  priority: 'normal' | 'high';
  createdAt: Date;
  seenBy?: string; // Stringified JSON or comma-separated list of "Name|Role|Time"
}

export interface Project {
  id: string;
  projectNo: string;
  projectName: string;
  employeeName: string;
  scope: string;
  cost: number;
  totalBudget: number; 
  amountReceived: number;
  paymentStatus: 'upfront_50' | 'remaining_50' | '100_received' | 'not_received';
  paymentMethod: string;
  workingDays: number;
  startDate: string;
  deadline: string;
  clientName: string;
  clientEmail: string;
  managerName: string;
  managerEmail: string;
  department: string;
  issue?: string;
  handlerId?: string;
  handlerName?: string;
  placerId?: string;
  placerName?: string;
  status: 'active' | 'completed' | 'on-hold' | 'pending' | 'approved' | 'rejected' | 'Working on' | 'Submited' | 'Close' | 'on hold' | 'New Project' | 'Active' | 'Inactive' | 'Waiting';
}

export interface MonthlySchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  weeklyOffs?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
