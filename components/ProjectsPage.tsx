'use client';

import { useApp } from '@/context/AppContext';
import { useState } from 'react';
import { Project, Employee } from '@/types';
import { formatDateShort, getCurrentDate } from '@/lib/dateUtils';
import Swal from 'sweetalert2';

export default function ProjectsPage() {
  const { currentUser, projects, addProject, updateProject, deleteProject, employees } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewTab, setViewTab] = useState<'active' | 'archives'>('active');
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState<Partial<Project>>({
    status: 'Working on',
    paymentStatus: 'upfront_50',
    cost: 0,
    amountReceived: 0,
    workingDays: 0,
    startDate: getCurrentDate(),
    department: ''
  });

  if (!currentUser) return null;

  const isAdmin = ['admin', 'superadmin'].includes(currentUser.role);
  const isManager = ['ecommerce', 'marketing', 'architecture'].includes(currentUser.role);
  const isEmployee = currentUser.role === 'employee';
  const userDept = currentUser.role;

  const departments = [
    { id: 'ecommerce', label: 'E-Commerce' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'architecture', label: 'Architecture' }
  ];

  // 🔒 SECURITY: Employees only see accounts where they are Handler or Placer
  const authProjects = projects.filter(p => {
      if (isAdmin) return true;
      if (isManager) return p.department === currentUser.role;
      if (isEmployee) {
          const empProfile = employees.find(e => 
            e.id === currentUser.name || 
            e.name.toLowerCase() === currentUser.name.toLowerCase() || 
            e.email.toLowerCase() === currentUser.email.toLowerCase()
          );
          if (empProfile?.department === 'ecommerce') {
              return p.handlerId === empProfile.id || p.placerId === empProfile.id || 
                     p.handlerName?.toLowerCase() === empProfile.name.toLowerCase() || 
                     p.placerName?.toLowerCase() === empProfile.name.toLowerCase();
          }
          return p.employeeName?.toLowerCase() === currentUser.name.toLowerCase();
      }
      return false;
  });

  const handleAdd = (deptId: string) => {
    setEditingProject(null);
    setFormData({
      status: deptId === 'ecommerce' ? 'Active' : 'Working on',
      paymentStatus: 'upfront_50',
      cost: 0,
      amountReceived: 0,
      workingDays: 0,
      startDate: getCurrentDate(),
      managerName: currentUser.name,
      managerEmail: currentUser.email,
      department: deptId,
      issue: '',
      scope: '',
      handlerId: '',
      placerId: '',
      paymentMethod: '',
      clientName: '',
      clientEmail: ''
    });
    setShowModal(true);
  };

  const handleEdit = (p: Project) => {
    setEditingProject(p);
    setFormData(p);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.projectName || !formData.projectNo) {
      Swal.fire('Error', 'Account/Project ID and Name are required!', 'error');
      return;
    }

    const handler = employees.find(e => e.id === formData.handlerId);
    const placer = employees.find(e => e.id === formData.placerId);

    const projectData: Project = {
      id: editingProject?.id || `PRJ-${Date.now()}`,
      projectNo: formData.projectNo || '',
      projectName: formData.projectName || '',
      employeeName: formData.employeeName || (handler ? handler.name : ''),
      scope: formData.scope || '',
      cost: Number(formData.cost) || 0,
      totalBudget: Number(formData.cost) || 0,
      amountReceived: Number(formData.amountReceived) || 0,
      paymentStatus: formData.paymentStatus || 'upfront_50',
      paymentMethod: formData.paymentMethod || '',
      workingDays: Number(formData.workingDays) || 0,
      startDate: formData.startDate || getCurrentDate(),
      deadline: formData.deadline || '',
      clientName: formData.clientName || 'N/A',
      clientEmail: formData.clientEmail || 'N/A',
      managerName: formData.managerName || currentUser.name,
      managerEmail: formData.managerEmail || currentUser.email,
      department: formData.department || userDept,
      issue: formData.issue || '',
      handlerId: formData.handlerId || '',
      handlerName: handler?.name || '',
      placerId: formData.placerId || '',
      placerName: placer?.name || '',
      status: (formData.status as any) || (formData.department === 'ecommerce' ? 'Active' : 'Working on')
    };

    if (editingProject) await updateProject(editingProject.id, projectData);
    else await addProject(projectData);
    
    setShowModal(false);
    Swal.fire({ title: 'Saved Successfully', icon: 'success', timer: 1000, showConfirmButton: false, toast: true });
  };

  const toggleAccountStatus = (id: string, newStatus: any) => {
    updateProject(id, { status: newStatus });
    Swal.fire({ title: `Status: ${newStatus}`, icon: 'success', timer: 800, showConfirmButton: false, toast: true });
  };

  const formatCurrency = (amount: number | undefined | null) => `$ ${(amount || 0).toLocaleString()}`;

  const displayProjects = authProjects.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const isSearchMatch = !searchQuery || p.projectName.toLowerCase().includes(searchLower) || p.projectNo.toLowerCase().includes(searchLower) || p.employeeName.toLowerCase().includes(searchLower);
    if (searchQuery) return isSearchMatch;
    if (viewTab === 'archives') return selectedArchiveMonth ? p.startDate.startsWith(selectedArchiveMonth) : false;
    if (viewTab === 'active') return statusFilter === 'all' ? true : p.status === statusFilter;
    return false;
  });

  const ecomEmployees = employees.filter(e => e.department === 'ecommerce');
  const isEcomView = formData.department === 'ecommerce';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow)', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#fff' }}>📁</div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)' }}>
                {userDept === 'ecommerce' ? '🛒 E-Commerce Account Center' : 'Project Master Engine'}
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700' }}>Active Folder: {displayProjects.length} records</div>
          </div>
        </div>
        {!isEmployee && (
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg3)', padding: '5px', borderRadius: '12px' }}>
               <StatusToggle label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} color="var(--accent)" />
               {userDept === 'ecommerce' ? (
                 <>
                    <StatusToggle label="Active" active={statusFilter === 'Active'} onClick={() => setStatusFilter('Active')} color="#059669" />
                    <StatusToggle label="Waiting" active={statusFilter === 'Waiting'} onClick={() => setStatusFilter('Waiting')} color="#ea580c" />
                    <StatusToggle label="Inactive" active={statusFilter === 'Inactive'} onClick={() => setStatusFilter('Inactive')} color="#4b5563" />
                 </>
               ) : (
                 <>
                    <StatusToggle label="Working" active={statusFilter === 'Working on'} onClick={() => setStatusFilter('Working on')} color="#2563eb" />
                    <StatusToggle label="New" active={statusFilter === 'New Project'} onClick={() => setStatusFilter('New Project')} color="#7c3aed" />
                    <StatusToggle label="Submited" active={statusFilter === 'Submited'} onClick={() => setStatusFilter('Submited')} color="#059669" />
                 </>
               )}
            </div>
        )}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px 8px 30px', color: 'var(--text)', outline: 'none', width: '180px' }} />
        </div>
      </div>

      {!isEmployee && (
        <div style={{ display: 'flex', gap: '8px', padding: '4px', background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', width: 'fit-content' }}>
            <button onClick={() => { setViewTab('active'); setSelectedArchiveMonth(null); }} style={{ background: viewTab === 'active' ? 'var(--accent)' : 'transparent', color: viewTab === 'active' ? '#fff' : 'var(--text2)', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Current Ledger</button>
            <button onClick={() => setViewTab('archives')} style={{ background: viewTab === 'archives' ? 'var(--accent)' : 'transparent', color: viewTab === 'archives' ? '#fff' : 'var(--text2)', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>History Archives</button>
        </div>
      )}

      {(viewTab === 'active' || isEmployee) && (
          <>
            {departments.map(dept => {
              // 🛡️ ONLY show relevant department
              if (!isAdmin && currentUser.role !== dept.id && !isEmployee) return null;
              if (isEmployee && !authProjects.some(p => p.department === dept.id)) return null;

              const deptProjects = displayProjects.filter(p => p.department === dept.id);
              
              if (dept.id === 'ecommerce') {
                  const activeAccounts = deptProjects.filter(p => p.status !== 'Inactive');
                  const inactiveAccounts = deptProjects.filter(p => p.status === 'Inactive');
                  return (
                    <div key={dept.id} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        {/* 1. ACTIVE ACCOUNTS */}
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>🛒 ACTIVE ACCOUNTS ({activeAccounts.length})</h3>
                                {!isEmployee && <button onClick={() => handleAdd('ecommerce')} style={{ background: 'var(--accent)', color: '#fff', padding: '10px 25px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+ New Account Registration</button>}
                            </div>
                            <ProjectTable projects={activeAccounts} isEcom={true} formatCurrency={formatCurrency} formatDateShort={formatDateShort} handleEdit={handleEdit} handleDelete={(id: string) => deleteProject(id)} onToggleStatus={toggleAccountStatus} isEmployee={isEmployee} />
                        </div>

                        {/* 2. INACTIVE ACCOUNTS */}
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px', opacity: 0.8 }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#64748b', marginBottom: '15px' }}>📁 INACTIVE ACCOUNTS ARCHIVE ({inactiveAccounts.length})</h3>
                            <ProjectTable projects={inactiveAccounts} isEcom={true} formatCurrency={formatCurrency} formatDateShort={formatDateShort} handleEdit={handleEdit} handleDelete={(id: string) => deleteProject(id)} onToggleStatus={toggleAccountStatus} isEmployee={isEmployee} />
                        </div>
                    </div>
                  );
              }

              return (
                <div key={dept.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '20px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text)' }}>🏢 {dept.label} Unit</h3>
                    {!isEmployee && <button onClick={() => handleAdd(dept.id)} style={{ background: 'var(--accent)', color: '#fff', padding: '10px 25px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+ New Project</button>}
                  </div>
                  <ProjectTable projects={deptProjects} formatCurrency={formatCurrency} formatDateShort={formatDateShort} handleEdit={handleEdit} handleDelete={(id: string) => deleteProject(id)} isEmployee={isEmployee} />
                </div>
              );
            })}
          </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '32px', width: '100%', maxWidth: '850px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg3)' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f2b42' }}>
                  {isEcomView ? (editingProject ? '📝 Update Account' : '🚀 New Account Registration') : (editingProject ? '📝 Update Project' : '🚀 New Project')}
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '24px' }}>✕</button>
            </div>
            <div style={{ padding: '30px' }}>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <label style={labelStyle}>START DATE</label>
                    <input type="date" value={formData.startDate || ''} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isEcomView ? 'ACCOUNT ID' : 'PROJECT NO'}</label>
                    <input type="text" value={formData.projectNo || ''} onChange={(e) => setFormData({ ...formData, projectNo: e.target.value })} style={inputStyle} placeholder="e.g. EC-101" />
                  </div>
                  <div>
                    <label style={labelStyle}>STATUS</label>
                    {isEcomView ? (
                      <select value={formData.status || 'Active'} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} style={inputStyle}>
                        <option value="Active">Active</option>
                        <option value="Waiting">Waiting</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <select value={formData.status || 'Working on'} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} style={inputStyle}>
                        <option value="Working on">Working on</option>
                        <option value="New Project">New Project</option>
                        <option value="Submited">Submited</option>
                        <option value="on hold">on hold</option>
                      </select>
                    )}
                  </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <label style={labelStyle}>{isEcomView ? 'ACCOUNT NAME' : 'PROJECT NAME'}</label>
                    <input type="text" value={formData.projectName || ''} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} style={inputStyle} placeholder="Title" />
                  </div>
                  <div>
                    <label style={labelStyle}>{isEcomView ? 'LATEST ISSUE / NOTE' : 'SCOPE OF WORK'}</label>
                    <input type="text" value={formData.issue || formData.scope || ''} onChange={(e) => setFormData({ ...formData, issue: e.target.value, scope: e.target.value })} style={inputStyle} placeholder="Details" />
                  </div>
               </div>

               {isEcomView ? (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', background:'#f8fafc', padding:'20px', borderRadius:'15px', border:'1px solid #e2e8f0' }}>
                    <div>
                        <label style={{...labelStyle, color:'#1e40af'}}>ASSIGN HANDLER (STAFF)</label>
                        <select value={formData.handlerId || ''} onChange={(e) => setFormData({ ...formData, handlerId: e.target.value })} style={inputStyle}>
                            <option value="">Select Handler...</option>
                            {ecomEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{...labelStyle, color:'#1e40af'}}>ASSIGN PLACER (STAFF)</label>
                        <select value={formData.placerId || ''} onChange={(e) => setFormData({ ...formData, placerId: e.target.value })} style={inputStyle}>
                            <option value="">Select Placer...</option>
                            {ecomEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                 </div>
               ) : (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>ASSIGN STAFF MEMBER</label>
                    <input type="text" value={formData.employeeName || ''} onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })} style={inputStyle} placeholder="Staff Name" />
                  </div>
               )}

               {/* 💰 Financials & Timeline (HIDDEN FOR E-COMMERCE PER USER REQUEST) */}
               {!isEcomView && (
                 <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div>
                            <label style={labelStyle}>TOTAL COST ($)</label>
                            <input type="number" value={formData.cost || 0} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>RECEIVED ($)</label>
                            <input type="number" value={formData.amountReceived || 0} onChange={(e) => setFormData({ ...formData, amountReceived: Number(e.target.value) })} style={{...inputStyle, color:'#059669', fontWeight:'900'}} />
                        </div>
                        <div>
                            <label style={labelStyle}>PAYMENT METHOD</label>
                            <input type="text" value={formData.paymentMethod || ''} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} style={inputStyle} placeholder="Paypal/Bank" />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div>
                            <label style={labelStyle}>WORKING DAYS</label>
                            <input type="number" value={formData.workingDays || 0} onChange={(e) => setFormData({ ...formData, workingDays: Number(e.target.value) })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>PAYMENT STATUS</label>
                            <select value={formData.paymentStatus || 'upfront_50'} onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })} style={inputStyle}>
                            <option value="not_received">Not Received</option>
                            <option value="upfront_50">Upfront 50% Received</option>
                            <option value="remaining_50">Remaining 50% Received</option>
                            <option value="100_received">100% Fully Received</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>DEADLINE</label>
                            <input type="date" value={formData.deadline || ''} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={labelStyle}>CLIENT NAME</label>
                            <input type="text" value={formData.clientName || ''} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} style={inputStyle} placeholder="Client Name" />
                        </div>
                        <div>
                            <label style={labelStyle}>CLIENT EMAIL</label>
                            <input type="email" value={formData.clientEmail || ''} onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })} style={inputStyle} placeholder="client@example.com" />
                        </div>
                    </div>
                 </>
               )}

               {/* E-Commerce Only: Total Profit Field */}
               {isEcomView && (
                 <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>TOTAL PROFIT ($)</label>
                    <input type="number" value={formData.cost || 0} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} style={inputStyle} />
                 </div>
               )}

               {/* Manager Metadata Row */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div>
                    <label style={labelStyle}>MY NAME (MANAGER)</label>
                    <input type="text" value={formData.managerName || ''} onChange={(e) => setFormData({ ...formData, managerName: e.target.value })} style={inputStyle} placeholder="Your Name" />
                  </div>
                  <div>
                    <label style={labelStyle}>MY EMAIL (MANAGER)</label>
                    <input type="email" value={formData.managerEmail || ''} onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })} style={inputStyle} placeholder="your@email.com" />
                  </div>
               </div>

               <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowModal(false)} style={{ padding: '12px 30px', borderRadius: '15px', border: '1px solid #cbd5e1', background: 'transparent', color: '#1e3a5f', fontWeight: 'bold', cursor: 'pointer' }}>Discard</button>
                  <button onClick={handleSave} style={{ padding: '12px 50px', borderRadius: '15px', background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(30,58,95,0.2)' }}>Finalize & Save</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusToggle({ label, active, onClick, color }: any) {
  return (
    <button onClick={onClick} style={{ background: active ? color : 'transparent', color: active ? '#fff' : '#64748b', border: 'none', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', transition: '0.2s' }}>{label}</button>
  );
}

function ProjectTable({ projects, isEcom, formatCurrency, formatDateShort, handleEdit, handleDelete, onToggleStatus, isEmployee }: any) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
        <thead>
          <tr style={{ background: '#f8fafd', borderBottom: '2px solid #e2e8f0' }}>
            <th style={thStyle}>{isEcom ? 'Start Date' : 'No'}</th>
            <th style={thStyle}>{isEcom ? 'Account Name' : 'Project Details'}</th>
            <th style={thStyle}>{isEcom ? 'Status' : 'Client'}</th>
            <th style={thStyle}>{isEcom ? 'Agent Name' : 'Financials'}</th>
            <th style={thStyle}>{isEcom ? 'Issue' : 'Timeline'}</th>
            <th style={thStyle}>{isEcom ? 'Total Profit' : 'Status'}</th>
            {!isEmployee && <th style={thStyle}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {projects.map((p: Project) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
              <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight:'bold' }}>{isEcom ? formatDateShort(p.startDate) : p.projectNo}</td>
              <td style={tdStyle}>
                <div style={{ fontSize: '13px', fontWeight: '900', color: '#1e3a5f' }}>{p.projectName}</div>
                {!isEcom && <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>Staff: {p.employeeName}</div>}
              </td>
              <td style={tdStyle}>
                {isEcom ? (
                   <span style={{ 
                     fontSize: '9px', padding: '3px 8px', borderRadius: '6px', fontWeight: '900', textTransform: 'uppercase',
                     background: p.status === 'Active' ? '#ecfdf5' : p.status === 'Waiting' ? '#fff7ed' : '#f3f4f6',
                     color: p.status === 'Active' ? '#059669' : p.status === 'Waiting' ? '#ea580c' : '#4b5563',
                     border: '1px solid currentColor'
                   }}>{p.status}</span>
                ) : <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>{p.clientName}</div>}
              </td>
              <td style={tdStyle}>
                {isEcom ? (
                   <div>
                     <div style={{fontSize:'11px', fontWeight:'900', color:'#1e40af'}}>H: {p.handlerName || '—'}</div>
                     <div style={{fontSize:'11px', fontWeight:'900', color:'#4338ca'}}>P: {p.placerName || '—'}</div>
                   </div>
                ) : <div style={{ fontSize: '13px', fontWeight: '900', color: '#059669' }}>{formatCurrency(p.cost)}</div>}
              </td>
              <td style={tdStyle}>
                {isEcom ? (
                   <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '900' }}>{p.issue || 'CLEARED'}</div>
                ) : (
                   <>
                    <div style={{ fontSize: '10px', color: '#0f172a' }}>S: {formatDateShort(p.startDate)}</div>
                    <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold' }}>D: {formatDateShort(p.deadline)}</div>
                   </>
                )}
              </td>
              <td style={tdStyle}>
                {isEcom ? <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatCurrency(p.cost)}</div> : (
                  <span style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', color: 'var(--accent)' }}>{p.status}</span>
                )}
              </td>
              {!isEmployee && (
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '10px', alignItems:'center' }}>
                    <button onClick={() => handleEdit(p)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                    {isEcom && (
                      <button 
                        onClick={() => onToggleStatus(p.id, p.status === 'Inactive' ? 'Active' : 'Inactive')} 
                        style={{ background: p.status === 'Inactive' ? '#ecfdf5' : '#fef2f2', border: '1px solid currentColor', color: p.status === 'Inactive' ? '#059669' : '#dc2626', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: '900' }}
                      >
                        {p.status === 'Inactive' ? 'ACTIVATE' : 'DEACTIVATE'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(p.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#ef4444' }}>🗑️</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {projects.length === 0 && (
             <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No accounts found in this folder.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle = { fontSize: '10px', fontWeight: '900' as const, color: '#4a627a', marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cfdfed', borderRadius: '12px', color: '#0f172a', outline: 'none', fontSize: '13px', fontWeight:'bold' as const };
const thStyle = { padding: '12px 15px', textAlign: 'left' as const, fontSize: '11px', color: '#1e3a5f', fontWeight: '900' as const, textTransform: 'uppercase' as const };
const tdStyle = { padding: '12px 15px', fontSize: '13px', color: '#0f172a' };
