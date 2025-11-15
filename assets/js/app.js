/* Shared JS for SHMS frontend
   - Handles simple login routing, sidebar collapse, toasts, sample data placeholders
   - Replace client-side logic with backend integration where indicated
*/
document.addEventListener('DOMContentLoaded', ()=>{
  // Toast helper
  window.showToast = function(message, type='success'){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `\n      <div class="toast align-items-center text-bg-${type} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">\n        <div class="d-flex">\n          <div class="toast-body">${message}</div>\n          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>\n        </div>\n      </div>`;
    document.body.appendChild(wrapper);
    setTimeout(()=> wrapper.remove(), 3000);
  };

  // Simple login handler used on login modal/page - supports API and SPA routing
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', async e=>{
      e.preventDefault();
      const role = document.getElementById('roleSelect').value;
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const alertEl = document.getElementById('loginAlert');
      alertEl.classList.add('d-none');
      // Basic validation
      if(!email || !password){ alertEl.classList.remove('d-none'); alertEl.textContent = 'Please provide email and password.'; return; }

      // Try server-side login first, but always fall back to demo behavior
      let usedServer = false;
      try{
        const res = await fetch('/api/login', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, role }) });
        if(res.ok){ const data = await res.json(); if(data && data.success){
          // store token if present
          if(data.token) localStorage.setItem('shms.token', data.token);
            // store minimal user info
            try{ localStorage.setItem('shms.user', JSON.stringify(data.user || { email })); }catch(e){}
          // show section with server-provided user
          const modalEl = document.getElementById('mainLoginModal');
          const hideModal = modalEl ? (bootstrap.Modal.getOrCreateInstance(modalEl)) : null;
          showSection(role, data.user || { email });
          if(hideModal) hideModal.hide();
          showToast('Logged in', 'success');
          usedServer = true;
        } }
      } catch(err){ /* server not available or network error - fallback to demo */ }

      if(!usedServer){
        // Fallback/demo authentication
        const validDemo = (email === 'admin@shms.test' || email.includes('@')) && password.length >= 4;
        if(!validDemo){ alertEl.classList.remove('d-none'); alertEl.textContent = 'Invalid credentials.'; return; }
        // hide landing and show SPA section (demo)
        const modalEl = document.getElementById('mainLoginModal'); const m = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null; if(m) m.hide();
        const demoUser = { email, name: email.split('@')[0], room: '' };
        try{ localStorage.setItem('shms.user', JSON.stringify(demoUser)); }catch(e){}
        showSection(role, demoUser);
        showToast('Logged in (demo)', 'success');
      }
    });
  }

  // Sidebar collapse toggle for dashboard pages
  document.querySelectorAll('[data-toggle="sidebar"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      // toggle the closest sidebar inside the current section
      const section = btn.closest('[data-section]');
      const sidebar = section ? section.querySelector('.sidebar') : document.getElementById('mainSidebar');
      sidebar?.classList.toggle('d-none');
    });
  });

  // SPA helpers
  window.showSection = function(role, user={}){
    // hide landing parts
    document.querySelectorAll('#hero, #features, #contact, section.py-3').forEach(el=> el?.classList?.add('d-none'));
    // hide all role sections
    document.querySelectorAll('[data-section]').forEach(el=> el.classList.add('d-none'));
    const id = role ? role.toLowerCase() + '-section' : null;
    const section = id ? document.getElementById(id) : null;
    if(section){ section.classList.remove('d-none'); section.scrollIntoView({behavior:'smooth'}); }
    // set user email/name if present
  if(user && user.email){ const emailEls = document.querySelectorAll('.user-email'); emailEls.forEach(e=> e.textContent = user.email); }
  if(user && user.name){ const nameEls = document.querySelectorAll('.user-name'); nameEls.forEach(e=> e.textContent = user.name); }
  if(user && user.room){ const roomEls = document.querySelectorAll('.user-room'); roomEls.forEach(e=> e.textContent = (user.room ? ('Room ' + user.room) : '')); }
    // bind logout buttons
    document.querySelectorAll('.btn-logout').forEach(b=> b.addEventListener('click', logout));
    // load role-specific data
    loadSectionData(role);
  };

  window.logout = function(){
    // hide sections and show landing
    document.querySelectorAll('[data-section]').forEach(el=> el.classList.add('d-none'));
    document.querySelectorAll('#hero, #features, #contact, section.py-3').forEach(el=> el?.classList?.remove('d-none'));
    window.scrollTo({top:0, behavior:'smooth'});
    // clear token and user info
    try{ localStorage.removeItem('shms.token'); }catch(e){}
  };
  

  // Token helpers & api wrapper
  function getToken(){ return localStorage.getItem('shms.token'); }
  function removeToken(){ localStorage.removeItem('shms.token'); }
  async function apiFetch(url, opts={}){
    const token = getToken();
    opts.headers = opts.headers || {};
    if(token) opts.headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, opts);
  }

  async function loadSectionData(role){
    try {
      if (role === 'Admin') {
        // fetch stats, students, complaints
        const statsRes = await apiFetch('/api/stats');
        const stRes = await apiFetch('/api/students');
        const cRes = await apiFetch('/api/complaints');

        if (statsRes && statsRes.ok) {
          const body = await statsRes.json();
          const stats = body.stats || {};
          const statsContainer = document.getElementById('statsRow');
          if (statsContainer) {
            const cards = [
              { label: 'Total Students', value: stats.totalStudents || 0 },
              { label: 'Pending Complaints', value: stats.pendingComplaints || 0 },
              { label: 'Resolved Complaints', value: stats.resolvedComplaints || 0 },
              { label: 'Total Outpasses', value: stats.totalOutpasses || 0 },
              { label: 'Pending Outpasses', value: stats.pendingOutpasses || 0 }
            ];
            statsContainer.innerHTML = cards.map(s => {
              return `<div class="col-6 col-md-3 mb-3"><div class="p-3 stat-card"><h5>${s.value}</h5><div class="text-muted-small">${s.label}</div></div></div>`;
            }).join('');
          }
        }

        if (stRes && stRes.ok) {
          const students = await stRes.json();
          const tb = document.getElementById('studentsTbody');
          if (tb) tb.innerHTML = students.map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.room || ''}</td><td>${s.email || ''}</td><td><button class='btn btn-sm btn-outline-primary'>View</button> <button class='btn btn-sm btn-outline-warning'>Edit</button></td></tr>`).join('');
        }

        if (cRes && cRes.ok) {
          const complaints = await cRes.json();
          const cb = document.getElementById('complaintsTbody');
          if (cb) cb.innerHTML = complaints.map(c => `<tr><td>${c.id}</td><td>${c.category || ''}</td><td>${c.student || c.student_id || ''}</td><td><span class='badge bg-${(c.status || '').toLowerCase() === 'resolved' ? 'success' : 'warning'}'>${c.status || 'Pending'}</span></td><td><button class='btn btn-sm btn-outline-success' data-id='${c.id}' data-action='resolve'>Resolve</button></td></tr>`).join('');
        }
      }

      if (role === 'Warden') {
        const res = await apiFetch('/api/outpasses');
        if (res && res.ok) {
          const list = await res.json();
          const tb = document.getElementById('outpassTbody');
          if (tb) {
            const rows = list.filter(o => {
              const s = (o.status || '').toLowerCase();
              return s === 'pending' || s === 'open';
            }).map(o => `<tr><td>${o.id}</td><td>${o.student || o.student_id || ''}</td><td>${o.date || (o.from_date ? o.from_date.slice(0,10) : '') || ''}</td><td>${o.type || ''}</td><td><button class='btn btn-sm btn-success' data-action-approve data-id='${o.id}' data-action='approve'>Approve</button><button class='btn btn-sm btn-danger ms-1' data-action-reject data-id='${o.id}' data-action='reject'>Reject</button></td></tr>`);
            tb.innerHTML = rows.join('');
          }
        }
      }
    } catch (e) {
      console.warn('Could not load section data', e);
    }
  }

  // Admin notice persistence helper: POST to API if available else localStorage
  async function postNoticeApi(notice){
    try{
      const res = await apiFetch('/api/notices', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(notice) });
      if(res.ok) return await res.json();
    }catch(e){/* ignore */}
    return null;
  }

  // Listen for admin notice publish (delegated)
  document.addEventListener('click', async (e)=>{
    const target = e.target;
    if(target && target.id === 'postAdminNotice'){
      e.preventDefault();
      const title = document.getElementById('noticeTitleAdmin')?.value?.trim();
      const category = document.getElementById('noticeCategoryAdmin')?.value || 'General';
      const content = document.getElementById('noticeContentAdmin')?.value?.trim();
      if(!title || !content){ showToast('Please complete title and content', 'danger'); return; }
      const notice = { id: Date.now(), title, category, date: new Date().toISOString().slice(0,10), content, archived:false };
      const apiRes = await postNoticeApi(notice);
      if(apiRes && apiRes.success){ showToast('Notice saved to server', 'success'); }
      else{
        // save in localStorage for demo
        const key = 'shms.notices.v1'; const list = JSON.parse(localStorage.getItem(key) || '[]'); list.push(notice); localStorage.setItem(key, JSON.stringify(list)); showToast('Notice saved locally (demo)', 'success');
      }
      // refresh notice board if present
      try{ if(window.renderNotices) window.renderNotices(); }catch(e){}
      const modal = bootstrap.Modal.getInstance(document.getElementById('addNoticeModal')) || null; if(modal) modal.hide();
    }
  });

  // Student complaint submission
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'submitComplaint'){
      e.preventDefault();
      const cat = document.getElementById('complaintCategory')?.value;
      const details = document.getElementById('complaintText')?.value;
      if(!cat || !details){ showToast('Please provide complaint details','danger'); return; }
      const payload = { id: Date.now(), category: cat, student: document.querySelector('.user-email')?.textContent || 'student', details, status:'Pending', created:new Date().toISOString() };
      try{ await apiFetch('/api/complaints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); showToast('Complaint submitted','success'); }
      catch(err){ // fallback local
        const key='shms.complaints.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push(payload); localStorage.setItem(key,JSON.stringify(list)); showToast('Complaint saved locally (demo)','success'); }
      document.getElementById('complaintForm')?.reset();
    }
  });

  // Outpass request submission
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'submitOutpass'){
      e.preventDefault();
      const type = document.getElementById('outType')?.value; const date = document.getElementById('outDate')?.value; const time = document.getElementById('outTime')?.value; const reason = document.getElementById('outReason')?.value;
      if(!date || !time || !reason){ showToast('Please complete outpass form','danger'); return; }
      const payload = { id: Date.now(), student: document.querySelector('.user-email')?.textContent||'student', type, date, time, reason, status:'Pending'};
      try{ await apiFetch('/api/outpasses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); showToast('Outpass requested','success'); }
      catch(err){ const key='shms.outpasses.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push(payload); localStorage.setItem(key,JSON.stringify(list)); showToast('Outpass saved locally (demo)','success'); }
      document.getElementById('outpassForm')?.reset();
    }
  });

  // Visitor register
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'registerVisitor'){
      e.preventDefault();
      const name = document.getElementById('vName')?.value; const phone = document.getElementById('vPhone')?.value; const purpose = document.getElementById('vPurpose')?.value; const toSee = document.getElementById('vToSee')?.value;
      if(!name || !toSee){ showToast('Please complete visitor form','danger'); return; }
      const payload = { id: Date.now(), name, phone, purpose, toSee, in:new Date().toISOString() };
      try{ await apiFetch('/api/visitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); showToast('Visitor registered','success'); }
      catch(err){ const key='shms.visitors.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push(payload); localStorage.setItem(key,JSON.stringify(list)); showToast('Visitor saved locally (demo)','success'); }
      document.getElementById('visitorForm')?.reset();
    }
  });

  // Verify outpass (security)
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'verifyBtn'){
      e.preventDefault();
      const q = document.getElementById('verifyId')?.value.trim(); if(!q){ showToast('Enter Outpass ID or email','danger'); return; }
      try{
        const res=await apiFetch('/api/outpasses'); const data=await res.json(); const found = data.find(o=> String(o.id)===q || o.student===q || String(o.student_id)===q);
        if(found){
          // Mark as checked out
          try{
            const u = await apiFetch(`/api/outpasses/${found.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Checked Out' }) });
            if(u.ok) showToast('Outpass checked out: '+(found.student||found.student_id),'success');
            else showToast('Outpass found but could not mark (server)', 'warning');
          }catch(err){ showToast('Outpass checked out (local)', 'success'); }
        } else showToast('Outpass not found','danger');
      }
      catch(err){ const list=JSON.parse(localStorage.getItem('shms.outpasses.v1')||'[]'); const found=list.find(o=> String(o.id)===q || o.student===q); if(found){ showToast('Outpass valid (local): '+found.student,'success'); // mark local as checked out
          const idx=list.findIndex(o=>String(o.id)===String(found.id)); if(idx>=0){ list[idx].status='Checked Out'; localStorage.setItem('shms.outpasses.v1', JSON.stringify(list)); }
        } else showToast('Outpass not found','danger'); }
    }
  });

  // Mark returned (security) - optionally a button with id 'markReturnedBtn'
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'markReturnedBtn'){
      e.preventDefault();
      const q = document.getElementById('verifyId')?.value.trim(); if(!q){ showToast('Enter Outpass ID or email','danger'); return; }
      try{
        const res = await apiFetch('/api/outpasses'); const data = await res.json(); const found = data.find(o=> String(o.id)===q || o.student===q || String(o.student_id)===q);
        if(found){ const u = await apiFetch(`/api/outpasses/${found.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Returned' }) }); if(u.ok) showToast('Marked returned','success'); else showToast('Could not mark returned (server)','warning'); }
        else showToast('Outpass not found','danger');
      }catch(err){ const list=JSON.parse(localStorage.getItem('shms.outpasses.v1')||'[]'); const found=list.find(o=> String(o.id)===q || o.student===q); if(found){ const idx=list.findIndex(o=>String(o.id)===String(found.id)); if(idx>=0){ list[idx].status='Returned'; localStorage.setItem('shms.outpasses.v1', JSON.stringify(list)); showToast('Marked returned (local)','success'); } } else showToast('Outpass not found','danger'); }
    }
  });

  // Warden approve/reject handlers - delegated via outpassTbody
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-action-approve], [data-action-reject]');
    if(!btn) return;
    e.preventDefault();
    const id = btn.dataset.id; if(!id) return;
    const action = btn.dataset.action === 'approve' ? 'Approved' : 'Rejected';
    try{ await apiFetch(`/api/outpasses/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ status: action })}); showToast('Outpass '+action.toLowerCase(),'success'); }
    catch(err){ // local fallback
      const key='shms.outpasses.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); const idx=list.findIndex(o=>String(o.id)===String(id)); if(idx>=0){ list[idx].status=action; localStorage.setItem(key,JSON.stringify(list)); showToast('Outpass '+action.toLowerCase()+' (local)','success'); }
    }
  });

  // Resolve complaint (admin/warden)
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-action="resolve"]');
    if(!btn) return;
    e.preventDefault();
    const id = btn.dataset.id; if(!id) return;
    try{
      const res = await apiFetch(`/api/complaints/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Resolved' }) });
      if(res.ok){ showToast('Complaint marked resolved','success'); }
      else { showToast('Could not mark resolved (server)','warning'); }
      // refresh admin stats/UI
      try{ loadSectionData('Admin'); }catch(e){}
    }catch(err){
      // local fallback: update localStorage complaints
      const key='shms.complaints.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); const idx=list.findIndex(c=>String(c.id)===String(id)); if(idx>=0){ list[idx].status='Resolved'; localStorage.setItem(key,JSON.stringify(list)); showToast('Marked resolved (local)','success'); }
    }
  });

  // Generate CSV report (students + complaints)
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'generateReportBtn'){
      e.preventDefault();
      // try fetch from backend
      (async ()=>{
        try{
          const res = await apiFetch('/api/reports'); if(res.ok){ const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='report.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('Report downloaded','success'); return; }
        }catch(err){}
        // fallback: build CSV from localStorage samples
        const students = JSON.parse(localStorage.getItem('shms.students.v1')||'[]'); const complaints = JSON.parse(localStorage.getItem('shms.complaints.v1')||'[]');
        let csv = 'Type,ID,Name,Detail,Status\n';
        students.forEach(s=> csv += `Student,${s.id || ''},${s.name||''},${s.room||''},${''}\n`);
        complaints.forEach(c=> csv += `Complaint,${c.id},${c.student||''},${c.category||c.details||''},${c.status||''}\n`);
        const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='report.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('Report downloaded (local)','success');
      })();
    }
  });

  // Save Room (admin) - modal
  document.addEventListener('click', async (e)=>{
    if(e.target && (e.target.id === 'saveRoomBtnModal' || e.target.id === 'saveRoomBtn')){
      e.preventDefault();
      const no = document.getElementById('roomNo')?.value; const block = document.getElementById('roomBlock')?.value;
      if(!no){ showToast('Enter room number','danger'); return; }
      const payload = { id: Date.now(), room:no, block };
      try{ await apiFetch('/api/rooms', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); showToast('Room saved (server)','success'); }
      catch(err){ const key='shms.rooms.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push(payload); localStorage.setItem(key,JSON.stringify(list)); showToast('Room saved locally (demo)','success'); }
      const modal = bootstrap.Modal.getInstance(document.getElementById('addRoomModal')); if(modal) modal.hide();
    }
  });

  // Feedback submission (if a feedback form/button exists)
  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.id === 'submitFeedback'){
      e.preventDefault();
      const mess = document.getElementById('feedbackMess')?.value || '';
      const rating = Number(document.getElementById('feedbackRating')?.value || 0);
      const comments = document.getElementById('feedbackComments')?.value || '';
      const anonymous = document.getElementById('feedbackAnonymous')?.checked;
      if(!mess || !rating){ showToast('Please select mess and rating','danger'); return; }
      const payload = { mess, rating, comments, student: anonymous ? null : (document.querySelector('.user-email')?.textContent || null) };
      try{ await apiFetch('/api/feedbacks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); showToast('Feedback submitted','success'); }
      catch(err){ const key='shms.feedbacks.v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push(payload); localStorage.setItem(key,JSON.stringify(list)); showToast('Feedback saved locally (demo)','success'); }
      const form = document.getElementById('feedbackForm'); if(form) form.reset();
    }
  });

  // Example: populate tables from sample JSON if present
  const sampleJsonEl = document.getElementById('sample-json');
  if(sampleJsonEl){
    try{
      const data = JSON.parse(sampleJsonEl.textContent);
      // Example: render basic cards for dashboard stats if containers exist
      const statsContainer = document.getElementById('statsRow');
      if(statsContainer && data.stats){
        statsContainer.innerHTML = data.stats.map(s=>`<div class="col-6 col-md-3 mb-3"><div class="p-3 stat-card"><h5>${s.value}</h5><div class="text-muted-small">${s.label}</div></div></div>`).join('');
      }
      // Render sample table rows if table body placeholders exist
      if(data.students && document.getElementById('studentsTbody')){
        const tb = document.getElementById('studentsTbody');
        tb.innerHTML = data.students.map(st=>`<tr><td>${st.id}</td><td>${st.name}</td><td>${st.room}</td><td>${st.email}</td><td><button class='btn btn-sm btn-outline-primary'>View</button></td></tr>`).join('');
      }
    }catch(e){console.warn('Invalid sample JSON', e)}
  }

});