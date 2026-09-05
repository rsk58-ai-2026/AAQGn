/**
 * PROJECT AI 〜人類最後のアップデートが始まる〜
 * js/staff.js - 付き添いスタッフスマホ専用UI制御 (アサイン確定3問のみ表示版)
 */

const StaffApp = {
  deviceId: '',
  currentStaffName: '',
  currentGroupName: '',
  selectedDifficulty: 'normal',
  assignedQuestions: [], // 入口で確定した3問
  isCheatsVisible: false,
  pollingTimer: null,

  init() {
    const role = AppStorage.getRole();
    if (role !== CONFIG.ROLES.STAFF) return;

    const screen = document.getElementById('staff-screen');
    if (screen) screen.classList.remove('hidden');

    this.initDeviceId();

    const savedGroup = AppStorage.getStaffActiveGroup();
    if (savedGroup && savedGroup.deviceId === this.deviceId && savedGroup.groupName) {
      this.currentStaffName = savedGroup.staffName || 'スタッフ';
      this.currentGroupName = savedGroup.groupName || 'グループ';
      this.selectedDifficulty = savedGroup.difficulty || 'normal';
      this.renderActiveView();
    } else {
      this.renderSetupView();
    }
  },

  initDeviceId() {
    this.deviceId = AppStorage.getStaffDeviceId();

    const headerDevId = document.getElementById('staff-header-dev-id');
    if (headerDevId) headerDevId.textContent = `DEV: ${this.deviceId}`;

    const inputDevId = document.getElementById('staff-input-dev-id');
    if (inputDevId) inputDevId.value = this.deviceId;
  },

  selectDiff(diff, btnElem) {
    this.selectedDifficulty = diff;
    const chips = document.querySelectorAll('.staff-diff-selector .btn-diff-chip');
    chips.forEach(b => b.classList.remove('active'));
    if (btnElem) btnElem.classList.add('active');
  },

  generateAndStart(event) {
    if (event) event.preventDefault();

    const staffInput = document.getElementById('staff-input-staff-name');
    const groupInput = document.getElementById('staff-input-group-name');

    this.currentStaffName = staffInput && staffInput.value.trim() ? staffInput.value.trim() : 'スタッフ';
    this.currentGroupName = groupInput && groupInput.value.trim() ? groupInput.value.trim() : '';

    if (!this.currentGroupName) {
      alert('グループ名を入力してください');
      if (groupInput) groupInput.focus();
      return;
    }

    AppStorage.saveStaffActiveGroup({
      deviceId: this.deviceId,
      staffName: this.currentStaffName,
      groupName: this.currentGroupName,
      difficulty: this.selectedDifficulty,
      isExEntry: this.selectedDifficulty === 'ex'
    });

    this.assignedQuestions = [];
    this.renderActiveView();
  },

  renderActiveView() {
    const setupView = document.getElementById('staff-view-setup');
    const activeView = document.getElementById('staff-view-active');

    if (setupView) setupView.classList.add('hidden');
    if (activeView) activeView.classList.remove('hidden');

    const devBadge = document.getElementById('staff-active-dev-badge');
    const diffBadge = document.getElementById('staff-active-diff-badge');
    const groupNameElem = document.getElementById('staff-active-group-name');
    const staffNameElem = document.getElementById('staff-active-staff-name');

    if (devBadge) devBadge.textContent = this.deviceId;
    if (diffBadge) diffBadge.textContent = String(this.selectedDifficulty).toUpperCase();
    if (groupNameElem) groupNameElem.textContent = this.currentGroupName;
    if (staffNameElem) staffNameElem.textContent = `担当: ${this.currentStaffName}`;

    setTimeout(() => {
      this.generateQRCode();
    }, 50);

    // 入口で確定した3問をロード & 定期同期開始
    this.loadAssignedQuestions();
    this.startAssignedPolling();
  },

  startAssignedPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    // 割り当て問題がまだ0件の場合は5秒ごとに確認
    this.pollingTimer = setInterval(() => {
      if (this.assignedQuestions.length < 3) {
        this.loadAssignedQuestions(true);
      }
    }, 5000);
  },

  /**
   * サーバーからこのグループ専用に確定された3問を取得
   */
  async loadAssignedQuestions(silent = false) {
    try {
      const res = await API.getAssignedQuestions(this.deviceId);
      if (res && res.success && res.hasActiveGroup && Array.isArray(res.questions) && res.questions.length > 0) {
        this.assignedQuestions = res.questions;
        this.renderAssignedCheats();
      } else {
        if (!silent) {
          this.renderPendingCheats();
        }
      }
    } catch (e) {
      if (!silent) {
        this.renderPendingCheats();
      }
    }
  },

  renderAssignedCheats() {
    const r1Container = document.getElementById('cheat-list-room1');
    const r2Container = document.getElementById('cheat-list-room2');
    const r3Container = document.getElementById('cheat-list-room3');

    if (!r1Container || !r2Container || !r3Container) return;

    const renderCard = (q, roomNum) => {
      if (!q) {
        return `<div class="text-muted py-1" style="font-size:12px;">第${roomNum}問: 未確定</div>`;
      }
      const hintsHtml = (q.hints && q.hints.length > 0)
        ? `<div class="cheat-exp"><strong>ヒント:</strong> ${q.hints.join(' / ')}</div>`
        : '';

      return `
        <div class="cheat-item" style="border-left: 3px solid var(--neon-cyan);">
          <div class="cheat-item-head">
            <span class="badge badge-secondary font-mono">${q.id || '--'}</span>
            <span class="font-cyber font-bold text-highlight">[${String(q.difficulty || '').toUpperCase()}]</span>
          </div>
          <p class="cheat-qtext mt-1"><strong>問題:</strong> ${q.question_text || ''}</p>
          <div class="cheat-ans-box mt-1">
            <span class="cheat-label">正解:</span>
            <strong class="text-success font-mono font-bold" style="font-size:15px;">${q.answer || '--'}</strong>
          </div>
          ${hintsHtml}
          ${q.explanation ? `<div class="cheat-exp mt-1"><span class="cheat-label">解説:</span> ${q.explanation}</div>` : ''}
        </div>
      `;
    };

    const q1 = this.assignedQuestions.find(q => String(q.room) === '1') || this.assignedQuestions[0];
    const q2 = this.assignedQuestions.find(q => String(q.room) === '2') || this.assignedQuestions[1];
    const q3 = this.assignedQuestions.find(q => String(q.room) === '3') || this.assignedQuestions[2];

    r1Container.innerHTML = renderCard(q1, 1);
    r2Container.innerHTML = renderCard(q2, 2);
    r3Container.innerHTML = renderCard(q3, 3);
  },

  renderPendingCheats() {
    const msg = `
      <div class="text-center py-2 text-warning" style="font-size:12px;">
        <span class="material-symbols-outlined icon-xs">info</span> 入口受付後に、このグループの3問が確定して表示されます
      </div>
    `;
    const r1 = document.getElementById('cheat-list-room1');
    const r2 = document.getElementById('cheat-list-room2');
    const r3 = document.getElementById('cheat-list-room3');
    if (r1) r1.innerHTML = msg;
    if (r2) r2.innerHTML = msg;
    if (r3) r3.innerHTML = msg;
  },

  generateQRCode() {
    const container = document.getElementById('staff-qrcode-container');
    if (!container) return;

    container.innerHTML = `
      <div class="qr-loading-placeholder">
        <span class="material-symbols-outlined" style="font-size:28px; animation:spin 1s infinite linear;">sync</span>
        <span>QR生成中...</span>
      </div>
    `;

    const payload = {
      device_id: this.deviceId,
      staff_name: this.currentStaffName,
      group_name: this.currentGroupName,
      difficulty: this.selectedDifficulty,
      is_ex_entry: this.selectedDifficulty === 'ex',
      ts: Date.now()
    };

    const rawJson = JSON.stringify(payload);

    if (typeof QRCode === 'function') {
      try {
        container.innerHTML = '';
        const utf8String = unescape(encodeURIComponent(rawJson));
        new QRCode(container, {
          text: utf8String,
          width: 220,
          height: 220,
          colorDark: '#050813',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });

        setTimeout(() => {
          const hasGraphic = container.querySelector('canvas') || container.querySelector('img');
          if (!hasGraphic) {
            this.generateQRCodeFallbackAPI(container, rawJson, payload);
          }
        }, 150);
        return;
      } catch (err) {
        console.warn('[StaffApp] QRCode.js 生成失敗:', err);
      }
    }

    this.generateQRCodeFallbackAPI(container, rawJson, payload);
  },

  generateQRCodeFallbackAPI(container, rawJson, payload) {
    const encodedData = encodeURIComponent(rawJson);
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodedData}&margin=2`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.alt = '認証用QRコード';
    img.style.width = '220px';
    img.style.height = '220px';
    img.style.display = 'block';

    img.onload = () => {
      container.innerHTML = '';
      container.appendChild(img);
    };

    img.onerror = () => {
      const backupUrl = `https://quickchart.io/qr?size=220&text=${encodedData}`;
      const backupImg = new Image();
      backupImg.style.width = '220px';
      backupImg.style.height = '220px';
      backupImg.style.display = 'block';

      backupImg.onload = () => {
        container.innerHTML = '';
        container.appendChild(backupImg);
      };

      backupImg.onerror = () => {
        this.renderEmergencyFallbackText(container, payload);
      };

      backupImg.src = backupUrl;
    };

    img.src = apiUrl;
  },

  renderEmergencyFallbackText(container, payload) {
    container.innerHTML = `
      <div class="qr-fallback-emergency">
        <div class="qr-fallback-title">OFFLINE AUTH CODE</div>
        <div class="qr-fallback-dev">${payload.device_id}</div>
        <div class="qr-fallback-group">${payload.group_name}</div>
        <div class="qr-fallback-diff">[${String(payload.difficulty).toUpperCase()}]</div>
        <p style="font-size:10px; color:#94a3b8; margin-top:6px; line-height:1.2;">
          ※QR生成サーバーに接続できません<br>各ブースで手動登録してください
        </p>
        <button type="button" class="qr-fallback-retry-btn" onclick="StaffApp.generateQRCode()">
          再試行
        </button>
      </div>
    `;
  },

  renderSetupView() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    const setupView = document.getElementById('staff-view-setup');
    const activeView = document.getElementById('staff-view-active');
    if (setupView) setupView.classList.remove('hidden');
    if (activeView) activeView.classList.add('hidden');

    const groupInput = document.getElementById('staff-input-group-name');
    if (groupInput) groupInput.value = '';
  },

  finishAndReset() {
    if (confirm('現在のグループ案内を終了し、次のグループ登録画面に戻りますか？')) {
      if (this.pollingTimer) clearInterval(this.pollingTimer);
      AppStorage.clearStaffActiveGroup();
      this.assignedQuestions = [];
      this.renderSetupView();
    }
  },

  toggleCheatsVisibility() {
    this.isCheatsVisible = !this.isCheatsVisible;
    const body = document.getElementById('cheat-sheet-body');
    const label = document.getElementById('cheat-toggle-label');
    const btn = document.getElementById('btn-toggle-cheats');

    if (body) body.classList.toggle('hidden', !this.isCheatsVisible);
    if (label) label.textContent = this.isCheatsVisible ? '答えを隠す' : '答えを表示';
    if (btn) btn.classList.toggle('btn-warning', this.isCheatsVisible);

    // 開いたタイミングで最新の問題を再取得
    if (this.isCheatsVisible && this.assignedQuestions.length < 3) {
      this.loadAssignedQuestions();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  StaffApp.init();
});