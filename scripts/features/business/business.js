/**
 * StairsLife — features/business/business.js
 * onEnterBusiness, switchBizTab, loadBizProfile.
 * Phase 3 — Modularisasi.
 */
'use strict';

async function onEnterBusiness() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data || {};
    TokenManager.setUser(user);

    const name = user.full_name || 'Pengguna';

    // Greeting
    const greetEl = document.querySelector('#biz-tab-0 .dash-greeting');
    if (greetEl) greetEl.textContent = `Selamat datang, ${name}! 🏢`;

    // Profil hero card (tab 5)
    const profileNameEl = document.querySelector('#screen-business .profile-name');
    if (profileNameEl) profileNameEl.textContent = name;

    const profileAvatarEl = document.querySelector('#screen-business .profile-avatar');
    if (profileAvatarEl) {
      profileAvatarEl.textContent = name.charAt(0).toUpperCase();
    }

    const profileUniEl = document.querySelector('#screen-business .profile-uni');
    if (profileUniEl) {
      const bizType = user.business_type || 'Bisnis';
      const location = user.location || '';
      profileUniEl.textContent = `${bizType}${location ? ' · ' + location : ''}`;
    }

  } catch (e) {
    console.error('Gagal load biz user:', e);
  }

  try {
    const res      = await ProjectsAPI.getMyProjects();
    const projects = res.data || [];
    window._bizProjects = projects;

    const totalProject      = projects.length;
    const activeProject     = projects.filter(p => p.status === 'inProgress').length;
    const completedProject  = projects.filter(p => p.status === 'completed').length;
    let   totalApplications = 0;
    projects.forEach(p => { totalApplications += p.applicant_count || 0; });

    const kpiEls = document.querySelectorAll('#biz-tab-0 .stat-card-value');
    if (kpiEls[0]) kpiEls[0].textContent = totalProject;
    if (kpiEls[1]) kpiEls[1].textContent = totalApplications;
    if (kpiEls[2]) kpiEls[2].textContent = activeProject;

    // Total pengeluaran dari payments
    try {
      const payRes  = await PaymentsAPI.getMyPayments();
      const pays    = payRes.data || [];
      const total   = pays.reduce((s, p) => s + (p.amount || 0), 0);
      if (kpiEls[3]) {
        kpiEls[3].textContent = total >= 1000000
          ? `Rp ${(total / 1000000).toFixed(1)}jt`
          : `Rp ${(total / 1000).toFixed(0)}K`;
      }
    } catch (_) {}

    renderBizRecentProjectsFromAPI(projects);
  } catch (e) {
    console.error('Gagal load biz projects:', e);
  }

  await renderBizRecentAppsAPI();
}

async function switchBizTab(i) {
  document.querySelectorAll('#screen-business .sidebar-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.tab) === i));
  document.querySelectorAll('#biz-bnav .bnav-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.tab) === i));
  document.querySelectorAll('[id^="biz-tab-"]').forEach(el => el.classList.toggle('active', el.id === `biz-tab-${i}`));
  document.getElementById('biz-main')?.scrollTo(0, 0);

  if (i === 1) await renderMyProjectsAPI();
  if (i === 2) await renderIncomingApps();
  if (i === 3) await renderPayments();         // M1 FIX: panggil renderPayments
  if (i === 4) renderBizChatList();
  if (i === 5) await loadBizProfile();
}

async function loadBizProfile() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data;
    const nameEl   = document.querySelector('#screen-business .profile-name');
    if (nameEl) nameEl.textContent = user.full_name;
    const avatarEl = document.querySelector('#screen-business .profile-avatar');
    if (avatarEl) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
  } catch (error) {
    console.error('Gagal load profil bisnis:', error);
  }
}

/* ================================================================
   CHAT TAB — bisnis
   Merender daftar chat kontrak (room dengan freelancer) menggunakan
   data dari API kontrak aktif + WebSocket status.
   ================================================================ */
let _bizChatFilter = 'all';

async function renderBizChatList(query = '') {
  const container = document.getElementById('biz-chat-list-container');
  if (!container) return;

  const wsEl = document.getElementById('biz-ws-status');
  if (wsEl) {
    wsEl.innerHTML = SocketManager.isConnected()
      ? `<span style="color:var(--teal)">🔌 Terhubung</span>`
      : `<span style="color:var(--text-muted)">○ Offline</span>`;
  }

  container.innerHTML = skeletons.applicationCards(3);

  try {
    // 1. Kontrak aktif (ada chat berbasis kontrak)
    const contractsRes = await ContractsAPI.getMyContracts();
    const contracts    = (contractsRes.data || []).filter(c =>
      c.status === 'active' || c.status === 'pending_review',
    );

    // 2. Inquiry dari mahasiswa (pre-contract questions)
    let inquiries = [];
    try {
      const inqRes = await MessagesAPI.getInquiries();
      inquiries    = inqRes.data || [];
    } catch (_) {
      // Backend mungkin belum punya endpoint ini — fallback ke CHATS lokal
      inquiries = CHATS.filter(c => c.type === 'inquiry');
    }

    const q = query.toLowerCase();

    // Build contract chat items
    const contractItems = contracts
      .filter(c => {
        const freelancer = c.users_contracts_student_idTousers?.full_name || '';
        const title      = c.projects?.title || '';
        return !q || freelancer.toLowerCase().includes(q) || title.toLowerCase().includes(q);
      })
      .filter(() => _bizChatFilter === 'all' || _bizChatFilter === 'contract');

    // Build inquiry items
    // Filter 'inquiry' (bukan 'support') — inquiry = pertanyaan mahasiswa sebelum apply
    const inquiryItems = (Array.isArray(inquiries) ? inquiries : [])
      .filter(inq => {
        // Coba semua kemungkinan field nama dari berbagai format backend response
        const sender = inq.sender?.full_name || inq.sender?.name ||
                       inq.user?.full_name   || inq.student?.full_name ||
                       inq.sender_name       || inq.from?.full_name ||
                       inq.senderName        || '';
        const proj   = inq.project_title || inq.projectTitle || inq.project?.title || '';
        return !q || sender.toLowerCase().includes(q) || proj.toLowerCase().includes(q);
      })
      .filter(() => _bizChatFilter === 'all' || _bizChatFilter === 'inquiry');

    if (!contractItems.length && !inquiryItems.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">Belum ada chat</div>
          <p class="empty-state-desc">Chat kontrak aktif dan pertanyaan dari mahasiswa akan muncul di sini.</p>
        </div>`;
      return;
    }

    let html = '';

    // Contract chats
    html += contractItems.map(c => {
      const freelancer = c.users_contracts_student_idTousers || {};
      const project    = c.projects || {};
      const name       = freelancer.full_name || 'Freelancer';
      const title      = project.title || 'Project';
      const budget     = c.agreed_budget ? `Rp ${c.agreed_budget.toLocaleString('id-ID')}` : '';

      return `
        <div class="chat-list-item" onclick="bizOpenContractChat('${c.id}','${name}','${title}')">
          <div class="chat-avatar">${name.charAt(0)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
              <span class="chat-name">${name}</span>
              ${statusBadge(c.status === 'pending_review' ? 'pending_review' : 'active')}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${title}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${budget}</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
    }).join('');

    // Inquiry chats (dari mahasiswa yang belum apply)
    if (inquiryItems.length) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;padding:12px 0 6px">Pertanyaan Project</div>`;
      html += inquiryItems.map(inq => {
        // Handle berbagai format response backend
        // Coba semua kemungkinan field nama mahasiswa
        const senderName = inq.sender?.full_name   ||
                           inq.sender?.name        ||
                           inq.user?.full_name     ||
                           inq.student?.full_name  ||
                           inq.sender_name         ||
                           inq.from?.full_name     ||
                           inq.senderName          ||
                           inq.name                ||
                           'Mahasiswa';

        const projTitle  = inq.project_title  || inq.projectTitle  ||
                           inq.project?.title || 'Project';
        const lastMsg    = inq.last_message   || inq.lastMessage   ||
                           inq.content        || inq.last          ||
                           'Pertanyaan baru';
        const inquiryId  = inq.id;
        const senderId   = inq.sender?.id     || inq.user?.id      ||
                           inq.student?.id    || inq.senderId      || null;

        return `
          <div class="chat-list-item" onclick="bizOpenInquiryChat('${inquiryId}','${senderName}','${projTitle}','${senderId || ''}')">
            <div class="chat-avatar" style="background:var(--amber-light);color:var(--amber-dark)">${senderName.charAt(0)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
                <span class="chat-name">${senderName}</span>
                <span class="badge badge-amber" style="font-size:10px">Pertanyaan</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">❓ ${projTitle}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lastMsg}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16"><polyline points="9 18 15 12 9 6"/></svg>
          </div>`;
      }).join('');
    }

    container.innerHTML = html;

    // Update badge
    const badgeEl  = document.getElementById('biz-chat-badge');
    const total    = contractItems.length + inquiryItems.length;
    if (badgeEl) {
      badgeEl.textContent = total;
      badgeEl.style.display = total > 0 ? '' : 'none';
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat chat</div><p class="empty-state-desc">${e.message}</p></div>`;
  }
}

async function bizOpenInquiryChat(inquiryId, senderName, projectTitle, senderId) {
  const chatEl = document.getElementById('chat-room-avatar');
  const nameEl = document.getElementById('chat-room-name');
  const statEl = document.getElementById('chat-room-status');

  if (chatEl) chatEl.textContent = senderName.charAt(0);
  if (nameEl) nameEl.textContent = senderName;
  if (statEl) statEl.innerHTML   = `<span style="color:var(--text-muted)">Pertanyaan: ${projectTitle}</span>`;

  goTo('screen-chat-room');

  // Cari messages inquiry dari backend
  activeChatId = inquiryId;
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) messagesEl.innerHTML = skeletons.notifItems(3);

  // NOTE: fitur inquiry belum punya endpoint backend (lihat MessagesAPI di api.js).
  // Sementara, kita tampilkan placeholder + biarkan UI render dari CHATS lokal.

  // Fallback: tampilkan dari CHATS lokal
  const localChat = CHATS.find(c => c.id === inquiryId);
  if (localChat && CHAT_MESSAGES[inquiryId]) {
    renderChatMessages();
  } else if (messagesEl) {
    messagesEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px">
        <div style="font-size:36px;margin-bottom:12px">💬</div>
        <div style="font-size:14px;font-weight:600">Chat dengan ${senderName}</div>
        <div style="font-size:13px;color:var(--text-secondary)">Tentang: ${projectTitle}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:12px">Fitur inquiry chat masih dalam pengembangan</div>
      </div>`;
  }

  // Setup send untuk balasan inquiry — saat ini akan error karena endpoint belum ada,
  // tapi pesan error sudah jelas dari MessagesAPI.replyInquiry.
  window._sendMessageOverride = async (text) => {
    try {
      await MessagesAPI.replyInquiry(inquiryId, text);
      // Branch ini hanya akan tercapai saat backend inquiry sudah ada
      if (messagesEl) {
        const bubble = document.createElement('div');
        bubble.className = 'msg-row';
        bubble.style.alignItems = 'flex-end';
        bubble.innerHTML = `
          <div class="msg-bubble me">${text}</div>
          <div class="msg-time">${new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}</div>`;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    } catch (e) {
      showToast(e.message, 'info');
    }
  };
}
function filterBizChats() {
  const q = document.getElementById('biz-chat-search')?.value || '';
  renderBizChatList(q);
}

function setBizChatFilter(f, btn) {
  _bizChatFilter = f;
  document.querySelectorAll('#biz-chat-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderBizChatList();
}

async function bizOpenContractChat(contractId, targetName, projectTitle) {
  // Set header chat room
  document.getElementById('chat-room-avatar').textContent = targetName.charAt(0);
  document.getElementById('chat-room-name').textContent   = targetName;
  document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--text-muted)">Kontrak: ${projectTitle}</span>`;
  goTo('screen-chat-room');
  await loadContractChatRoom(contractId, targetName, `Kontrak: ${projectTitle}`);
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.onEnterBusiness     = onEnterBusiness;
window.switchBizTab        = switchBizTab;
window.loadBizProfile      = loadBizProfile;
window.renderBizChatList   = renderBizChatList;
window.filterBizChats      = filterBizChats;
window.setBizChatFilter    = setBizChatFilter;
window.bizOpenContractChat = bizOpenContractChat;
window.bizOpenInquiryChat  = bizOpenInquiryChat;
