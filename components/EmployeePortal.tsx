'use client';

import { useApp } from '@/context/AppContext';
import { useState, useEffect } from 'react';
import { getCurrentDate, formatTimeAMPM, formatDateShort } from '@/lib/dateUtils';
import Swal from 'sweetalert2';
import { AttendanceRecord, TaskLog, Project } from '@/types';
import Loader from './Loader';

export default function EmployeePortal() {
  const { currentUser, employees, attendance, addAttendance, updateAttendance, logout, tasks, addTask, projects } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'portal' | 'history' | 'performance'>('portal');
  
  // Performance Modal State
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [perfData, setPerfData] = useState<Partial<TaskLog>>({
    date: getCurrentDate(),
    sales: 0,
    netProfit: 0,
    listings: 0,
    accountName: '',
    task: '',
    ordersStatus: 'Done',
    trackingStatus: 'Done',
    sheetsStatus: 'Done',
    ordersReason: '',
    trackingReason: '',
    sheetsReason: ''
  });

  // Local state to prevent race conditions while context updates
  const [localActiveLock, setLocalActiveLock] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!currentUser) return null;

  const employee = employees.find(e => 
    e.id === currentUser.name || 
    e.name.toLowerCase() === currentUser.name.toLowerCase() || 
    e.email.toLowerCase() === currentUser.email.toLowerCase() || 
    e.id === currentUser.email
  );

  const isEcom = employee?.department === 'ecommerce';

  // 🛡️ ATTENDANCE LOGIC
  const myAttendanceRecords = attendance.filter(a => a.employeeId === employee?.id);
  const latestSession = myAttendanceRecords.length > 0 
    ? [...myAttendanceRecords].sort((a, b) => new Date(b.date + ' ' + (b.checkIn === '--' ? '00:00' : b.checkIn)).getTime() - new Date(a.date + ' ' + (a.checkIn === '--' ? '00:00' : a.checkIn)).getTime())[0]
    : null;

  const hasActiveShift = latestSession && latestSession.checkOut === '--';
  const isAlreadyProcessedToday = !!myAttendanceRecords.find(a => a.date === getCurrentDate());
  const currentHour = currentTime.getHours();
  const isRestrictedTime = currentHour >= 23 || currentHour < 12;

  // 📈 PERFORMANCE LOGIC
  const myPerformance = tasks.filter(t => t.employeeId === employee?.id || t.employeeName === employee?.name).sort((a, b) => b.date.localeCompare(a.date));
  const myAssignedAccounts = projects.filter(p => {
    if (p.department !== 'ecommerce') return false;
    const isHandler = p.handlerId === employee?.id || p.handlerName?.toLowerCase() === employee?.name.toLowerCase();
    const isPlacer = p.placerId === employee?.id || p.placerName?.toLowerCase() === employee?.name.toLowerCase();
    return isHandler || isPlacer;
  });

  const handleCheckIn = async () => {
    if (!employee) return;
    if (hasActiveShift || localActiveLock || isAlreadyProcessedToday) return;
    if (isRestrictedTime) return;

    setIsProcessing(true);
    setLocalActiveLock(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const newRecord: AttendanceRecord = {
      id: `ATT${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: getCurrentDate(),
      checkIn: timeStr,
      checkOut: '--',
      status: 'present',
      hours: 0, overtime: 0, lateEntry: note ? `Note: ${note}` : '00:00', earlyExit: '00:00', breakIn: '', breakOut: ''
    };

    try {
      await addAttendance(newRecord);
      setNote('');
      Swal.fire({ title: 'Shift Started', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (e) {
      setLocalActiveLock(false);
      Swal.fire('Error', 'Failed', 'error');
    } finally { setIsProcessing(false); }
  };

  const handleCheckOut = async () => {
    if (!latestSession) return;
    setIsProcessing(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const updates: Partial<AttendanceRecord> = {
      checkOut: timeStr,
      hours: (now.getTime() - new Date(latestSession.date + ' ' + latestSession.checkIn).getTime()) / (1000 * 60 * 60)
    };

    try {
      await updateAttendance(latestSession.id, updates);
      setLocalActiveLock(false);
      Swal.fire({ title: 'Shift Ended', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', 'Failed', 'error'); } finally { setIsProcessing(false); }
  };

  const handleSavePerformance = async () => {
    if (!employee || !perfData.accountName) {
      Swal.fire('Error', 'Account selection is required.', 'error');
      return;
    }

    // Validation for reasons if Pending
    if (perfData.ordersStatus === 'Pending' && !perfData.ordersReason) { Swal.fire('Reason Required', 'Please provide a reason for Pending Orders.', 'warning'); return; }
    if (perfData.trackingStatus === 'Pending' && !perfData.trackingReason) { Swal.fire('Reason Required', 'Please provide a reason for Pending Tracking.', 'warning'); return; }
    if (perfData.sheetsStatus === 'Pending' && !perfData.sheetsReason) { Swal.fire('Reason Required', 'Please provide a reason for Pending Sheets.', 'warning'); return; }

    const profit = Number(perfData.netProfit) || 0;
    const sales = Number(perfData.sales) || 0;
    const roi = sales > 0 ? (profit / sales) * 100 : 0;
    const score = Math.round(Math.min(roi / 25, 1) * 70 + 20);

    const task: TaskLog = {
      id: `TK${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: perfData.date || getCurrentDate(),
      task: perfData.task || `Account: ${perfData.accountName}`,
      category: 'ecommerce',
      workingDays: 1, quality: 80, score,
      projectsAssigned: 0, projectsCompleted: 0, pendingProjects: 0, approvedProjects: 0, rejectedProjects: 0, clientResponses: 0, leadsGenerated: 0, emailsSent: 0, conversionRatio: 0,
      sales, netProfit: profit, listings: Number(perfData.listings) || 0,
      accountName: perfData.accountName || 'Store',
      targetProfit: 5000,
      ordersStatus: perfData.ordersStatus,
      ordersReason: perfData.ordersReason,
      trackingStatus: perfData.trackingStatus,
      trackingReason: perfData.trackingReason,
      sheetsStatus: perfData.sheetsStatus,
      sheetsReason: perfData.sheetsReason
    };

    await addTask(task);
    setShowPerfModal(false);
    setPerfData({ date: getCurrentDate(), sales: 0, netProfit: 0, listings: 0, accountName: '', task: '', ordersStatus:'Done', trackingStatus:'Done', sheetsStatus:'Done', ordersReason:'', trackingReason:'', sheetsReason:'' });
    Swal.fire({ title: 'Logged!', icon: 'success', timer: 1000, showConfirmButton: false });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      
      {/* 🚀 TOP BAR */}
      <div style={{ width: '100%', maxWidth: '1000px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#fff' }}>🚀</div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>{employee?.name}</h2>
            <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: '900' }}>ID: {employee?.id} • {employee?.department.toUpperCase()} UNIT</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <NavBtn label="Duty Hub" active={view === 'portal'} onClick={() => setView('portal')} />
          <NavBtn label="Work History" active={view === 'history'} onClick={() => setView('history')} />
          {isEcom && <NavBtn label="Performance" active={view === 'performance'} onClick={() => setView('performance')} />}
          <button onClick={logout} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '8px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: '900' }}>Exit</button>
        </div>
      </div>

      {/* 🏢 MAIN CONTENT */}
      <div style={{ width: '100%', maxWidth: (view === 'portal' ? '500px' : '1000px') }}>
        {view === 'portal' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '32px', padding: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', textAlign: 'center' }}>
             <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
               <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '900', marginBottom: '5px' }}>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
               <div style={{ fontSize: '42px', fontWeight: '900', color: '#0f172a' }}>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
             </div>
             
             {hasActiveShift || localActiveLock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div style={{ background: '#fff7ed', padding: '15px', borderRadius: '15px', border: '1px solid #fed7aa', color: '#9a3412', fontWeight: '900', fontSize: '12px' }}>⚠️ ACTIVE SESSION SINCE {latestSession?.checkIn}</div>
                   <button onClick={handleCheckOut} disabled={isProcessing} style={{ width: '100%', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '20px', padding: '20px', fontSize: '18px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 20px rgba(220,38,38,0.2)' }}>⏹️ FINISH DUTY</button>
                </div>
             ) : isAlreadyProcessedToday ? (
                <div style={{ padding: '30px', background: '#ecfdf5', borderRadius: '20px', border: '1px solid #10b981' }}>
                  <div style={{ fontSize: '30px' }}>✅</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>Attendance Done</div>
                  <div style={{ fontSize: '11px', color: '#065f46', marginTop: '10px' }}>Next session tomorrow after 12:00 PM.</div>
                </div>
             ) : isRestrictedTime ? (
                <div style={{ padding: '30px', background: '#fef2f2', borderRadius: '20px', border: '1px solid #fecaca' }}>
                   <div style={{ fontSize: '30px' }}>🕒</div>
                   <div style={{ fontSize: '16px', fontWeight: '900', color: '#dc2626' }}>Shift Restricted</div>
                   <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '10px' }}>Window: 12:00 PM — 11:00 PM</div>
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <textarea placeholder="Morning Note..." value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', height: '80px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '15px', padding: '15px', outline: 'none', fontWeight:'bold' }} />
                   <button onClick={handleCheckIn} disabled={isProcessing} style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '20px', padding: '20px', fontSize: '18px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 20px rgba(5, 150, 105, 0.2)' }}>▶ START DUTY</button>
                </div>
             )}
          </div>
        )}

        {view === 'history' && (
           <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>Hazri Ledger (Last 30 Days)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={thStyle}>Date</th><th style={thStyle}>In</th><th style={thStyle}>Out</th><th style={thStyle}>Hours</th><th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendanceRecords.map(rec => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>{formatDateShort(rec.date)}</td>
                      <td style={{ ...tdStyle, color: '#059669', fontWeight: 'bold' }}>{formatTimeAMPM(rec.checkIn)}</td>
                      <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 'bold' }}>{rec.checkOut === '--' ? '--' : formatTimeAMPM(rec.checkOut)}</td>
                      <td style={tdStyle}>{rec.hours.toFixed(2)}h</td>
                      <td style={tdStyle}><span style={{ fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '6px', background: '#f1f9fe', color: '#1e40af' }}>{rec.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        )}

        {view === 'performance' && (
           <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>📊 My Account Performance</h3>
                <button onClick={() => { setPerfData({...perfData, accountName: myAssignedAccounts[0]?.projectName || '', date: getCurrentDate()}); setShowPerfModal(true); }} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+ Log Daily Entry</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={thStyle}>Date</th><th style={thStyle}>Account</th><th style={thStyle}>Sales</th><th style={thStyle}>Profit</th><th style={thStyle}>Status (O/T/S)</th><th style={thStyle}>ROI</th>
                    </tr>
                    </thead>
                    <tbody>
                    {myPerformance.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={tdStyle}>{formatDateShort(t.date)}</td>
                            <td style={tdStyle}><strong>{t.accountName}</strong></td>
                            <td style={tdStyle}>$ {t.sales?.toLocaleString()}</td>
                            <td style={{ ...tdStyle, color: '#059669', fontWeight: 'bold' }}>$ {t.netProfit?.toLocaleString()}</td>
                            <td style={tdStyle}>
                               <span title={`Orders: ${t.ordersStatus} | Tracking: ${t.trackingStatus} | Sheets: ${t.sheetsStatus}`} style={{fontSize:'10px', fontWeight:'900', color:'#1e40af'}}>
                                 {t.ordersStatus?.charAt(0)}/{t.trackingStatus?.charAt(0)}/{t.sheetsStatus?.charAt(0)}
                               </span>
                            </td>
                            <td style={tdStyle}>{t.sales ? ((t.netProfit! / t.sales!) * 100).toFixed(1) : 0}%</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
           </div>
        )}
      </div>

      {/* 💰 PERFORMANCE MODAL */}
      {showPerfModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding:'20px' }}>
             <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px', padding: '30px', maxHeight:'90vh', overflowY:'auto' }}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>New Daily Report</h3>
                    <button onClick={() => setShowPerfModal(false)} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer'}}>✕</button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={labelStyle}>SELECT ACCOUNT</label>
                        <select value={perfData.accountName} onChange={(e) => setPerfData({...perfData, accountName: e.target.value})} style={inputStyle}>
                            <option value="">Choose Assigned Account...</option>
                            {myAssignedAccounts.map(p => <option key={p.id} value={p.projectName}>{p.projectName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>DATE</label>
                        <input type="date" value={perfData.date} onChange={(e) => setPerfData({...perfData, date: e.target.value})} style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div>
                        <label style={labelStyle}>DAILY SALE ($)</label>
                        <input type="number" value={perfData.sales} onChange={(e) => setPerfData({...perfData, sales: Number(e.target.value)})} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>DAILY PROFIT ($)</label>
                        <input type="number" value={perfData.netProfit} onChange={(e) => setPerfData({...perfData, netProfit: Number(e.target.value)})} style={{...inputStyle, color: '#059669'}} />
                    </div>
                    <div>
                        <label style={labelStyle}>LISTINGS</label>
                        <input type="number" value={perfData.listings} onChange={(e) => setPerfData({...perfData, listings: Number(e.target.value)})} style={inputStyle} />
                    </div>
                </div>

                {/* 🛡️ SPECIALIZED E-COM STATUSES */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom:'15px' }}>
                        <div>
                            <label style={{...labelStyle, color:'#1e40af'}}>ORDERS</label>
                            <select value={perfData.ordersStatus} onChange={(e) => setPerfData({...perfData, ordersStatus: e.target.value as any})} style={inputStyle}>
                                <option value="Done">Done</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div>
                            <label style={{...labelStyle, color:'#1e40af'}}>TRACKING</label>
                            <select value={perfData.trackingStatus} onChange={(e) => setPerfData({...perfData, trackingStatus: e.target.value as any})} style={inputStyle}>
                                <option value="Done">Done</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div>
                            <label style={{...labelStyle, color:'#1e40af'}}>SHEETS</label>
                            <select value={perfData.sheetsStatus} onChange={(e) => setPerfData({...perfData, sheetsStatus: e.target.value as any})} style={inputStyle}>
                                <option value="Done">Done</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                    </div>

                    {/* DYNAMIC REASON BOXES */}
                    {perfData.ordersStatus === 'Pending' && (
                        <div style={{marginBottom:'10px'}}>
                            <label style={{...labelStyle, color:'#dc2626'}}>ORDERS PENDING REASON</label>
                            <input type="text" value={perfData.ordersReason} onChange={(e) => setPerfData({...perfData, ordersReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                        </div>
                    )}
                    {perfData.trackingStatus === 'Pending' && (
                        <div style={{marginBottom:'10px'}}>
                            <label style={{...labelStyle, color:'#dc2626'}}>TRACKING PENDING REASON</label>
                            <input type="text" value={perfData.trackingReason} onChange={(e) => setPerfData({...perfData, trackingReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                        </div>
                    )}
                    {perfData.sheetsStatus === 'Pending' && (
                        <div style={{marginBottom:'10px'}}>
                            <label style={{...labelStyle, color:'#dc2626'}}>SHEETS PENDING REASON</label>
                            <input type="text" value={perfData.sheetsReason} onChange={(e) => setPerfData({...perfData, sheetsReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '25px' }}>
                    <label style={labelStyle}>DAILY NOTE / GENERAL ISSUE</label>
                    <textarea value={perfData.task} onChange={(e) => setPerfData({...perfData, task: e.target.value})} placeholder="Report any roadblocks or additional notes..." style={{...inputStyle, height: '60px', resize:'none'}} />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowPerfModal(false)} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px 25px', borderRadius: '12px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSavePerformance} style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '10px 30px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Submit Report</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
}

function NavBtn({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{ background: active ? '#1e40af' : '#f1f5f9', color: active ? '#fff' : '#475569', border: 'none', padding: '8px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: '0.2s' }}>{label}</button>
  );
}

const thStyle = { padding: '12px 15px', textAlign: 'left' as const, fontSize: '11px', color: '#64748b', fontWeight: '900' as const, textTransform: 'uppercase' as const };
const tdStyle = { padding: '12px 15px', fontSize: '13px', color: '#0f172a' };
const labelStyle = { fontSize: '10px', fontWeight: '900' as const, color: '#4a627a', marginBottom: '5px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 'bold' as const };
