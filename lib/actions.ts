'use server';

import { prisma } from '@/lib/prisma';
import { Employee, AttendanceRecord, TaskLog, Expense, Income, AuditLog, User, LeaveRequest, Announcement, Project, MonthlySchedule, Bill, Notification, BreakRequest, Department } from '@/types';
import { revalidatePath } from 'next/cache';
import { getCurrentDate } from './dateUtils';

// --- User Actions ---
export async function getUsers() { try { return await prisma.user.findMany(); } catch (e) { return []; } }
export async function addUserAction(user: any) { try { return await prisma.user.create({ data: user }); } catch (e) { return null; } }
export async function updateUserAction(id: string, updates: any) { try { return await prisma.user.update({ where: { id }, data: updates }); } catch (e) { return null; } }
export async function deleteUserAction(id: string) { try { await prisma.user.delete({ where: { id } }); return true; } catch (e) { return false; } }

// --- Project Actions (WITH SHADOW PERSISTENCE & RESCUE LOGIC) ---
export async function getProjects() {
  try {
    const rawProjects = await (prisma.project as any).findMany({ orderBy: { createdAt: 'desc' } });
    return processRawProjects(rawProjects);
  } catch (error) { 
    try {
      const rescued = await prisma.$queryRawUnsafe('SELECT id, "projectName", status, "startDate", "clientName", scope, "totalBudget", "amountReceived" FROM "Project" ORDER BY "createdAt" DESC');
      return processRawProjects(rescued);
    } catch (sqlErr) { return []; }
  }
}

function processRawProjects(rawProjects: any) {
  return (rawProjects || []).map((p: any) => {
    const nameStr: string = p.projectName || "";
    let extraData: any = {};
    if (nameStr.startsWith('S:')) { try { extraData = JSON.parse(nameStr.substring(2)); } catch (e) {} }
    const actualName = extraData.projectName || nameStr.replace(/^S:\{.*\}\s?/, '') || "Project";
    const rawDept = extraData.department || p.department || "";
    const finalDept = (rawDept === "" || rawDept === "general") ? "ecommerce" : rawDept;
    let finalStatus = p.status || extraData.status || "Active";
    if (finalDept === "ecommerce") { if (["Working on", "New Project", "pending", "active"].includes(finalStatus)) finalStatus = "Active"; }
    return { ...p, ...extraData, projectName: actualName, projectNo: extraData.projectNo || p.projectNo || "", department: finalDept, cost: Number(extraData.cost || p.totalBudget || 0), status: finalStatus, handlerName: extraData.handlerName || "", placerName: extraData.placerName || "", handlerId: extraData.handlerId || "", placerId: extraData.placerId || "" };
  });
}

export async function addProjectAction(project: Project) {
  const superData = { ...project };
  const compositeName = `S:${JSON.stringify(superData)}`;
  const dbData = { id: project.id, projectName: compositeName, clientName: project.clientName || "Client", scope: project.scope || project.issue || "", totalBudget: Math.floor(Number(project.cost || 0)), amountReceived: Math.floor(Number(project.amountReceived || 0)), status: project.status || "Active", startDate: project.startDate || new Date().toISOString().split('T')[0], deadline: project.deadline || "" };
  try { await (prisma as any).project.create({ data: dbData }); revalidatePath('/'); return project; } catch (error: any) {
    const q = `INSERT INTO "Project" (id, "projectName", "clientName", scope, "totalBudget", "amountReceived", status, "startDate", deadline, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`;
    await prisma.$executeRawUnsafe(q, dbData.id, dbData.projectName, dbData.clientName, dbData.scope, dbData.totalBudget, dbData.amountReceived, dbData.status, dbData.startDate, dbData.deadline);
    revalidatePath('/'); return project;
  }
}

export async function updateProjectAction(id: string, updates: Partial<Project>) {
  try {
    const p = await (prisma.project as any).findUnique({ where: { id } });
    if (!p) return null;
    let currentData: any = {};
    if (p.projectName?.startsWith('S:')) { try { currentData = JSON.parse(p.projectName.substring(2)); } catch (e) {} }
    const mergedData = { ...currentData, ...updates };
    const compositeName = `S:${JSON.stringify(mergedData)}`;
    const dbUpdates: any = { projectName: compositeName, status: updates.status || p.status || 'Active', clientName: updates.clientName || currentData.clientName || 'Client', scope: updates.scope || updates.issue || currentData.scope || '', totalBudget: Math.floor(Number(mergedData.cost || 0)), updatedAt: new Date() };
    await (prisma.project as any).update({ where: { id }, data: dbUpdates });
    revalidatePath('/'); return mergedData;
  } catch (e: any) {
    if (updates.status) { await prisma.$executeRawUnsafe(`UPDATE "Project" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, updates.status, id); }
    revalidatePath('/'); return updates;
  }
}

export async function deleteProjectAction(id: string) {
  try { await prisma.project.delete({ where: { id } }); revalidatePath('/'); } catch (e) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = $1`, id); revalidatePath('/'); } catch (sqlE) {}
  }
}

// --- Task/Performance Actions (WITH RESCUE LOGIC) ---
export async function getTasks() {
  try {
    const rawTasks = await (prisma.taskLog as any).findMany({ orderBy: { createdAt: 'desc' } });
    return processRawTasks(rawTasks);
  } catch (error) { 
    // 🛡️ TASK RESCUE: If schema mismatch, use Raw SQL for base columns
    try {
      const rescued = await prisma.$queryRawUnsafe('SELECT id, "employeeId", "employeeName", date, task, category FROM "TaskLog" ORDER BY "createdAt" DESC');
      return processRawTasks(rescued);
    } catch (sqlErr) { return []; }
  }
}

function processRawTasks(rawTasks: any) {
  return (rawTasks || []).map((t: any) => {
    let extra: any = {};
    if (t.task?.startsWith('S:')) { try { extra = JSON.parse(t.task.substring(2)); } catch (e) {} }
    return { 
        ...t, 
        ...extra, 
        task: extra.task || t.task, 
        workingDays: t.hours || 1,
        quality: extra.quality || t.quality || 80,
        score: extra.score || t.score || 0
    };
  });
}

export async function addTaskAction(task: TaskLog) {
  const compositeTask = `S:${JSON.stringify(task)}`;
  // 🛡️ CRITICAL: Only send valid DB columns to Prisma to avoid "Disappearing Data" error
  const cleanData: any = {
    id: task.id,
    employeeId: task.employeeId,
    employeeName: task.employeeName,
    date: task.date,
    task: compositeTask,
    category: task.category,
    hours: 1,
    completion: 100,
    quality: task.quality || 80,
    score: task.score || 0
  };

  try {
    await prisma.taskLog.create({ data: cleanData });
    revalidatePath('/');
    return task;
  } catch (error) {
    const q = `INSERT INTO "TaskLog" (id, "employeeId", "employeeName", date, task, category, hours, completion, quality, score, "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`;
    await prisma.$executeRawUnsafe(q, cleanData.id, cleanData.employeeId, cleanData.employeeName, cleanData.date, compositeTask, cleanData.category, 1, 100, 80, cleanData.score);
    revalidatePath('/');
    return task;
  }
}

export async function updateTaskAction(id: string, updates: Partial<TaskLog>) {
  try {
    const existing = await (prisma.taskLog as any).findUnique({ where: { id } });
    if (!existing) return null;
    let currentData: any = {};
    if (existing.task?.startsWith('S:')) { try { currentData = JSON.parse(existing.task.substring(2)); } catch (e) {} }
    const merged = { ...currentData, ...updates };
    const compositeTask = `S:${JSON.stringify(merged)}`;
    
    // Only update the 'task' column which holds our JSON metadata
    await (prisma.taskLog as any).update({ where: { id }, data: { task: compositeTask, updatedAt: new Date() } });
    revalidatePath('/');
    return merged;
  } catch (e) { return null; }
}

export async function deleteTaskAction(id: string) {
  try { await prisma.taskLog.delete({ where: { id } }); revalidatePath('/'); } catch (e) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "TaskLog" WHERE id = $1`, id); revalidatePath('/'); } catch (sqlE) {}
  }
}

// --- Rest of actions (Employees, Attendance, etc.) ---
export async function getEmployees() {
  try { 
    const raw = await prisma.employee.findMany({ orderBy: { updatedAt: 'desc' } });
    return raw.map((e: any) => {
      let extra: any = {};
      if (e.fatherName?.startsWith('S:')) { try { extra = JSON.parse(e.fatherName.substring(2)); } catch (err) {} }
      return { ...e, fatherName: extra.fatherName || e.fatherName || '', cnic: extra.cnic || '' };
    });
  } catch (e) { return []; }
}

export async function addEmployeeAction(employee: Employee) {
  try {
    const superFather = `S:${JSON.stringify({ fatherName: employee.fatherName, cnic: employee.cnic || '' })}`;
    const data = { id: employee.id, name: employee.name, fatherName: superFather, phone: employee.phone, address: employee.address, email: employee.email, department: employee.department, position: employee.position, salary: employee.salary || 0, monthlyHours: 176, status: 'active', joinDate: getCurrentDate() };
    return await prisma.employee.create({ data: data as any });
  } catch (e) { throw e; }
}

export async function updateEmployeeAction(id: string, updates: Partial<Employee>) {
  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    let extra: any = {};
    if (existing?.fatherName?.startsWith('S:')) { try { extra = JSON.parse(existing.fatherName.substring(2)); } catch (err) {} }
    const superFather = `S:${JSON.stringify({ fatherName: updates.fatherName || extra.fatherName, cnic: updates.cnic || extra.cnic })}`;
    const data: any = { ...updates };
    if (updates.fatherName || updates.cnic) data.fatherName = superFather;
    // @ts-ignore
    delete data.cnic;
    return await prisma.employee.update({ where: { id }, data: data as any });
  } catch (e) { throw e; }
}

export async function deleteEmployeeAction(id: string) { try { await prisma.employee.delete({ where: { id } }); } catch (e) {} }

export async function getAttendance() { try { return await prisma.attendanceRecord.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }

export async function addAttendanceAction(record: AttendanceRecord) {
  try { return await prisma.attendanceRecord.create({ data: record as any }); } catch (e) {
    const q = `INSERT INTO "AttendanceRecord" (id, "employeeId", "employeeName", date, "checkIn", "checkOut", "breakIn", "breakOut", "lateEntry", "earlyExit", overtime, status, hours, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`;
    await prisma.$executeRawUnsafe(q, record.id, record.employeeId, record.employeeName, record.date, record.checkIn, record.checkOut, record.breakIn || "", record.breakOut || "", record.lateEntry || "", record.earlyExit || "", record.overtime || 0, record.status, record.hours || 0);
    return record;
  }
}

export async function updateAttendanceAction(id: string, updates: Partial<AttendanceRecord>) { try { return await prisma.attendanceRecord.update({ where: { id }, data: updates as any }); } catch (e) { throw e; } }
export async function deleteAttendanceAction(id: string) { try { await prisma.attendanceRecord.delete({ where: { id } }); } catch (e) {} }

export async function getAnnouncements() {
  try {
    const raw = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    return raw.map((a: any) => {
      if (a.content?.startsWith('S:')) { try { const extra = JSON.parse(a.content.substring(2)); return { ...a, ...extra }; } catch (e) { return a; } }
      return a;
    });
  } catch (e) { return []; }
}

export async function markAnnouncementAsReadAction(id: string, name: string, role: string) {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) return null;
    let currentData: any = {};
    if (ann.content?.startsWith('S:')) { try { currentData = JSON.parse(ann.content.substring(2)); } catch (e) {} }
    const seenBy = currentData.seenBy || "";
    if (seenBy.includes(name)) return ann;
    const now = new Date();
    const receipt = `${name} (${role.toUpperCase()}) at ${now.toLocaleTimeString()}`;
    currentData.seenBy = seenBy ? `${seenBy}\n${receipt}` : receipt;
    const content = `S:${JSON.stringify(currentData)}`;
    return await prisma.announcement.update({ where: { id }, data: { content } as any });
  } catch (e) { return null; }
}

export async function addAnnouncementAction(announcement: Announcement) {
  const content = `S:${JSON.stringify(announcement)}`;
  try { return await prisma.announcement.create({ data: { ...announcement, content, createdAt: new Date() } as any }); } catch (e) { return null; }
}

export async function updateAnnouncementAction(id: string, updates: Partial<Announcement>) {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) return null;
    let currentData: any = {};
    if (ann.content?.startsWith('S:')) { try { currentData = JSON.parse(ann.content.substring(2)); } catch (e) {} }
    const merged = { ...currentData, ...updates };
    const content = `S:${JSON.stringify(merged)}`;
    return await prisma.announcement.update({ where: { id }, data: { title: updates.title || ann.title, content } as any });
  } catch (e) { return null; }
}

export async function deleteAnnouncementAction(id: string) { try { await prisma.announcement.delete({ where: { id } }); } catch (e) {} }

export async function getAuditLogs() { try { return await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addAuditLogAction(log: AuditLog) { try { return await prisma.auditLog.create({ data: log as any }); } catch (e) { return null; } }

export async function getLeaveRequests() { try { return await prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addLeaveRequestAction(request: LeaveRequest) { try { return await prisma.leaveRequest.create({ data: request as any }); } catch (e) { throw e; } }
export async function updateLeaveRequestAction(id: string, updates: Partial<LeaveRequest>) { try { return await prisma.leaveRequest.update({ where: { id }, data: updates as any }); } catch (e) { throw e; } }
export async function deleteLeaveRequestAction(id: string) { try { await prisma.leaveRequest.delete({ where: { id } }); } catch (e) {} }

export async function getExpenses() { try { return await prisma.expense.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addExpenseAction(expense: Expense) { try { return await prisma.expense.create({ data: expense as any }); } catch (e) { throw e; } }
export async function updateExpenseAction(id: string, updates: Partial<Expense>) { try { return await prisma.expense.update({ where: { id }, data: updates as any }); } catch (e) { throw e; } }
export async function deleteExpenseAction(id: string) { try { await prisma.expense.delete({ where: { id } }); } catch (e) {} }

export async function getIncome() { try { return await prisma.income.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addIncomeAction(income: Income) { try { return await prisma.income.create({ data: income as any }); } catch (e) { throw e; } }
export async function updateIncomeAction(id: string, updates: Partial<Income>) { try { return await prisma.income.update({ where: { id }, data: updates as any }); } catch (e) { throw e; } }
export async function deleteIncomeAction(id: string) { try { await prisma.income.delete({ where: { id } }); } catch (e) {} }

export async function getBills() { try { return await prisma.bill.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addBillAction(bill: Bill) { try { return await prisma.bill.create({ data: bill as any }); } catch (e) { return null; } }
export async function updateBillAction(id: string, updates: Partial<Bill>) { try { return await prisma.bill.update({ where: { id }, data: updates as any }); } catch (e) { return null; } }
export async function deleteBillAction(id: string) { try { await prisma.bill.delete({ where: { id } }); } catch (e) {} }

export async function getNotifications() { try { return await (prisma as any).notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }); } catch (e) { return []; } }
export async function addNotificationAction(notif: any) { try { return await (prisma as any).notification.create({ data: notif }); } catch (e) { return null; } }
export async function markNotificationReadAction(id: string) { try { return await (prisma as any).notification.update({ where: { id }, data: { read: true } }); } catch (e) { return null; } }
export async function markAllNotificationsReadAction(recipient: string) { try { return await (prisma as any).notification.updateMany({ where: { recipient, read: false }, data: { read: true } }); } catch (e) { return null; } }

export async function getDepartments() { try { return await prisma.department.findMany({ orderBy: { name: 'asc' } }); } catch (e) { return []; } }
export async function addDepartmentAction(name: string) { try { return await prisma.department.create({ data: { name } as any }); } catch (e) { return null; } }
export async function updateDepartmentAction(id: string, name: string) { try { return await prisma.department.update({ where: { id }, data: { name } as any }); } catch (e) { return null; } }
export async function deleteDepartmentAction(id: string) { try { await prisma.department.delete({ where: { id } }); } catch (e) {} }

export async function getMonthlySchedules() { try { return await prisma.monthlySchedule.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addMonthlyScheduleAction(schedule: MonthlySchedule) { try { return await prisma.monthlySchedule.create({ data: schedule as any }); } catch (e) { return null; } }
export async function updateMonthlyScheduleAction(id: string, updates: Partial<MonthlySchedule>) { try { return await prisma.monthlySchedule.update({ where: { id }, data: updates as any }); } catch (e) { return null; } }
export async function deleteMonthlyScheduleAction(id: string) { try { await prisma.monthlySchedule.delete({ where: { id } }); } catch (e) {} }

export async function getBreakRequests() { try { const p = prisma as any; return await p.breakRequest.findMany({ orderBy: { createdAt: 'desc' } }); } catch (e) { return []; } }
export async function addBreakRequestAction(data: any) { try { const p = prisma as any; return await p.breakRequest.create({ data: data as any }); } catch (e) { return null; } }
export async function updateBreakRequestAction(id: string, updates: any) { try { const p = prisma as any; return await p.breakRequest.update({ where: { id }, data: updates as any }); } catch (e) { return null; } }
export async function deleteBreakRequestAction(id: string) { try { const p = prisma as any; await p.breakRequest.delete({ where: { id } }); } catch (e) {} }
