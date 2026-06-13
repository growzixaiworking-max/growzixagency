'use client';

import { useApp } from '@/context/AppContext';
import { useState } from 'react';
import { TaskLog, Employee, Project } from '@/types';
import { formatDateShort, getCurrentDate } from '@/lib/dateUtils';
import Swal from 'sweetalert2';

export default function PerformancePage() {
  const { currentUser, employees, tasks, addTask, updateTask, deleteTask, projects } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskLog | null>(null);
  const [formData, setFormData] = useState<Partial<TaskLog>>({
      ordersStatus: 'Done',
      trackingStatus: 'Done',
      sheetsStatus: 'Done'
  });
  
  if (!currentUser) return null;

  const isAdmin = ['admin', 'superadmin'].includes(currentUser.role);
  const isManager = ['ecommerce', 'marketing', 'architecture'].includes(currentUser.role);
  const isEmployee = currentUser.role === 'employee';
  const userDept = currentUser.role;

  // 🔒 Find the Employee Profile
  const currentEmpProfile = employees.find(e => 
    e.id === currentUser.name || e.email === currentUser.email || e.id === currentUser.email
  );
  
  const isEcomEmployee = currentEmpProfile?.department === 'ecommerce';

  const departmentEmployees = isAdmin
    ? employees
    : employees.filter(e => e.department === (isEmployee ? currentEmpProfile?.department : userDept));

  const filteredTasks = tasks.filter(t => {
      if (isAdmin) return true;
      if (isManager) return departmentEmployees.some(e => e.id === t.employeeId);
      if (isEmployee) return t.employeeId === currentEmpProfile?.id || t.employeeName === currentEmpProfile?.name;
      return false;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const myAssignedAccounts = projects.filter(p => 
    p.department === 'ecommerce' && (p.handlerId === currentEmpProfile?.id || p.placerId === currentEmpProfile?.id)
  );

  const handleAdd = () => {
    setEditingTask(null);
    setFormData({
      employeeId: isEmployee ? currentEmpProfile?.id : '',
      date: getCurrentDate(),
      category: isEcomEmployee ? 'ecommerce' : (isManager ? userDept : 'general'),
      workingDays: 1, quality: 80, sales: 0, netProfit: 0, listings: 0,
      accountName: myAssignedAccounts.length > 0 ? myAssignedAccounts[0].projectName : 'General',
      ordersStatus: 'Done', trackingStatus: 'Done', sheetsStatus: 'Done',
      ordersReason: '', trackingReason: '', sheetsReason: '', task: ''
    });
    setShowModal(true);
  };

  const handleEdit = (task: TaskLog) => {
      if (isEmployee) return;
      setEditingTask(task);
      setFormData(task);
      setShowModal(true);
  };

  const handleSave = async () => {
    const targetEmpId = isEmployee ? currentEmpProfile?.id : formData.employeeId;
    if (!targetEmpId) { Swal.fire('Error', 'Staff selection required.', 'error'); return; }

    const targetEmp = employees.find(e => e.id === targetEmpId);
    if (!targetEmp) return;

    // Validation for Pending reasons
    if (formData.ordersStatus === 'Pending' && !formData.ordersReason) { Swal.fire('Reason?', 'Orders reason required.', 'warning'); return; }
    if (formData.trackingStatus === 'Pending' && !formData.trackingReason) { Swal.fire('Reason?', 'Tracking reason required.', 'warning'); return; }
    if (formData.sheetsStatus === 'Pending' && !formData.sheetsReason) { Swal.fire('Reason?', 'Sheets reason required.', 'warning'); return; }

    const profit = Number(formData.netProfit) || 0;
    const sales = Number(formData.sales) || 0;
    const roi = sales > 0 ? (profit / sales) * 100 : 0;
    const score = targetEmp.department === 'ecommerce' 
        ? Math.round(Math.min(roi / 25, 1) * 70 + 20)
        : 80;

    const task: TaskLog = {
      id: editingTask?.id || `TK${Date.now()}`,
      employeeId: targetEmpId,
      employeeName: targetEmp.name,
      date: formData.date || getCurrentDate(),
      task: formData.task || (targetEmp.department === 'ecommerce' ? `Account: ${formData.accountName}` : 'Performance Entry'),
      category: targetEmp.department,
      workingDays: 1, quality: 80, score,
      projectsAssigned: 0, projectsCompleted: 0, pendingProjects: 0, approvedProjects: 0, rejectedProjects: 0, clientResponses: 0, leadsGenerated: 0, emailsSent: 0, conversionRatio: 0,
      sales, netProfit: profit, listings: Number(formData.listings) || 0,
      accountName: formData.accountName || 'General',
      targetProfit: 5000,
      ordersStatus: formData.ordersStatus || 'Done',
      ordersReason: formData.ordersReason || '',
      trackingStatus: formData.trackingStatus || 'Done',
      trackingReason: formData.trackingReason || '',
      sheetsStatus: formData.sheetsStatus || 'Done',
      sheetsReason: formData.sheetsReason || ''
    };

    if (editingTask) await updateTask(editingTask.id, task);
    else await addTask(task);
    
    setShowModal(false);
    Swal.fire({ title: 'Success', icon: 'success', timer: 1000, showConfirmButton: false, toast: true });
  };

  const accountSummaries = filteredTasks.reduce((acc: any, t) => {
    const key = t.accountName || 'Others';
    if (!acc[key]) acc[key] = { sales: 0, profit: 0, count: 0 };
    acc[key].sales += (t.sales || 0);
    acc[key].profit += (t.netProfit || 0);
    acc[key].count++;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🚀 EXECUTIVE HEADER */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow)' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f2b42' }}>
            {isEcomEmployee || userDept === 'ecommerce' ? '🛍️ Account Performance Ledger' : '🎯 Performance Center'}
          </h2>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', marginTop: '4px' }}>
             {isEmployee ? `STAFF VIEW: ${currentUser.name.toUpperCase()}` : `MANAGER VIEW: ${userDept.toUpperCase()} SECTOR`}
          </div>
        </div>
        {(isEcomEmployee || !isEmployee) && (
            <button onClick={handleAdd} style={{ background: '#1e3a5f', color: '#fff', padding: '10px 25px', borderRadius: '15px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                + New Daily Entry
            </button>
        )}
      </div>

      {/* 📊 PERFORMANCE TABLE */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px', boxShadow: 'var(--shadow)' }}>
         <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Account</th>
                  <th style={thStyle}>Sales ($)</th>
                  <th style={thStyle}>Profit ($)</th>
                  <th style={thStyle}>Status (O/T/S)</th>
                  <th style={thStyle}>ROI %</th>
                  {!isEmployee && <th style={thStyle}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: 'var(--accent)' }}>{formatDateShort(t.date)}</td>
                    <td style={tdStyle}><strong>{t.accountName}</strong></td>
                    <td style={tdStyle}>$ {t.sales?.toLocaleString()}</td>
                    <td style={{ ...tdStyle, color: '#059669', fontWeight: '900' }}>$ {t.netProfit?.toLocaleString()}</td>
                    <td style={tdStyle}>
                       <span title={`Orders: ${t.ordersStatus} | Tracking: ${t.trackingStatus} | Sheets: ${t.sheetsStatus}`} style={{fontSize:'10px', fontWeight:'900', color: (t.ordersStatus==='Pending' || t.trackingStatus==='Pending' || t.sheetsStatus==='Pending' ? '#dc2626' : '#1e40af')}}>
                         {t.ordersStatus?.charAt(0)}/{t.trackingStatus?.charAt(0)}/{t.sheetsStatus?.charAt(0)}
                       </span>
                    </td>
                    <td style={tdStyle}>{t.sales && t.sales > 0 ? ((t.netProfit! / t.sales!) * 100).toFixed(1) : 0}%</td>
                    {!isEmployee && (
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleEdit(t)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => deleteTask(t.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </div>

      {/* 📊 SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
         {Object.entries(accountSummaries).map(([name, data]: [string, any]) => (
            <div key={name} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '20px' }}>
               <h4 style={{ fontSize: '12px', color: '#1e3a5f', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', fontWeight:'900' }}>📁 {name.toUpperCase()}</h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={sumRow}><span>Total Sales:</span> <strong style={{color:'#1e3a5f'}}>$ {data.sales.toLocaleString()}</strong></div>
                  <div style={sumRow}><span>Net Profit:</span> <strong style={{color:'#059669'}}>$ {data.profit.toLocaleString()}</strong></div>
                  <div style={sumRow}><span>Avg ROI:</span> <strong style={{color:'var(--accent)'}}>{data.sales > 0 ? ((data.profit / data.sales) * 100).toFixed(1) : 0}%</strong></div>
               </div>
            </div>
         ))}
      </div>

      {/* --- ENTRY MODAL --- */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding:'20px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '650px', padding: '35px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'25px'}}>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f2b42' }}>
                    {editingTask ? '📝 Update Performance Record' : '💰 Log New Daily Performance'}
                </h3>
                <button onClick={() => setShowModal(false)} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <label style={labelStyle}>REPORT DATE</label>
                    <input type="date" value={formData.date || getCurrentDate()} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>SELECT ACCOUNT</label>
                    <select value={formData.accountName || ''} onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} style={inputStyle}>
                        <option value="">Choose Account...</option>
                        {isEcomEmployee ? (
                            myAssignedAccounts.map(p => <option key={p.id} value={p.projectName}>{p.projectName}</option>)
                        ) : (
                            projects.filter(p => isAdmin || p.department === userDept).map(p => <option key={p.id} value={p.projectName}>{p.projectName}</option>)
                        )}
                        <option value="General">General / Other</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                <div>
                    <label style={labelStyle}>GROSS SALE ($)</label>
                    <input type="number" value={formData.sales || 0} onChange={(e) => setFormData({ ...formData, sales: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>NET PROFIT ($)</label>
                    <input type="number" value={formData.netProfit || 0} onChange={(e) => setFormData({ ...formData, netProfit: Number(e.target.value) })} style={{ ...inputStyle, color: '#059669', borderColor:'#059669' }} />
                </div>
                <div>
                    <label style={labelStyle}>LISTINGS</label>
                    <input type="number" value={formData.listings || 0} onChange={(e) => setFormData({ ...formData, listings: Number(e.target.value) })} style={inputStyle} />
                </div>
            </div>

            {/* 🛡️ SPECIALIZED E-COM STATUSES */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom:'15px' }}>
                    <div>
                        <label style={{...labelStyle, color:'#1e40af'}}>ORDERS</label>
                        <select value={formData.ordersStatus} onChange={(e) => setFormData({ ...formData, ordersStatus: e.target.value as any })} style={inputStyle}>
                            <option value="Done">Done</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div>
                        <label style={{...labelStyle, color:'#1e40af'}}>TRACKING</label>
                        <select value={formData.trackingStatus} onChange={(e) => setFormData({ ...formData, trackingStatus: e.target.value as any })} style={inputStyle}>
                            <option value="Done">Done</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div>
                        <label style={{...labelStyle, color:'#1e40af'}}>SHEETS</label>
                        <select value={formData.sheetsStatus} onChange={(e) => setFormData({ ...formData, sheetsStatus: e.target.value as any })} style={inputStyle}>
                            <option value="Done">Done</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                </div>

                {formData.ordersStatus === 'Pending' && (
                    <div style={{marginBottom:'10px'}}>
                        <label style={{...labelStyle, color:'#dc2626'}}>ORDERS PENDING REASON</label>
                        <input type="text" value={formData.ordersReason} onChange={(e) => setFormData({ ...formData, ordersReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                    </div>
                )}
                {formData.trackingStatus === 'Pending' && (
                    <div style={{marginBottom:'10px'}}>
                        <label style={{...labelStyle, color:'#dc2626'}}>TRACKING PENDING REASON</label>
                        <input type="text" value={formData.trackingReason} onChange={(e) => setFormData({ ...formData, trackingReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                    </div>
                )}
                {formData.sheetsStatus === 'Pending' && (
                    <div style={{marginBottom:'10px'}}>
                        <label style={{...labelStyle, color:'#dc2626'}}>SHEETS PENDING REASON</label>
                        <input type="text" value={formData.sheetsReason} onChange={(e) => setFormData({ ...formData, sheetsReason: e.target.value})} placeholder="Why is this pending?" style={{...inputStyle, borderColor:'#fecaca'}} />
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '25px' }}>
                <label style={labelStyle}>DAILY NOTE / GENERAL ISSUE</label>
                <textarea value={formData.task} onChange={(e) => setFormData({ ...formData, task: e.target.value})} placeholder="Report roadblocks..." style={{...inputStyle, height: '60px', resize:'none'}} />
            </div>

            {!isEmployee && (
                 <div style={{ marginBottom: '25px', background:'#f8fafc', padding:'15px', borderRadius:'12px', border:'1px solid #e2e8f0' }}>
                    <label style={{...labelStyle, color:'#1e40af'}}>VERIFY FOR STAFF MEMBER</label>
                    <select value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} style={inputStyle}>
                       <option value="">Choose Staff...</option>
                       {departmentEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                 </div>
            )}

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '12px 30px', borderRadius: '15px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color:'#64748b' }}>Discard</button>
                <button onClick={handleSave} style={{ padding: '12px 40px', borderRadius: '15px', background: '#0f2b42', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isEmployee ? 'Finalize & Submit' : 'Verify & Save'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '12px 15px', textAlign: 'left' as const, fontSize: '11px', color: '#64748b', fontWeight: '900' as const, textTransform: 'uppercase' as const };
const tdStyle = { padding: '12px 15px', fontSize: '13px', color: '#0f172a' };
const labelStyle = { fontSize: '10px', fontWeight: '900' as const, color: '#4a627a', marginBottom: '5px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', fontWeight: 'bold' as const };
const sumRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' };
