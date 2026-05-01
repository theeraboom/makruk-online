(function () {
  // Apply saved theme as early as possible to avoid flash
  try {
    if (localStorage.getItem('makruk_dark') === '1') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function updateBtn(btn) {
    if (!btn) return;
    btn.textContent = isDark() ? '☀️' : '🌙';
    btn.title = isDark() ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
  }

  function toggle() {
    if (isDark()) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('makruk_dark', '0'); } catch (e) {}
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('makruk_dark', '1'); } catch (e) {}
    }
    document.querySelectorAll('#darkToggleBtn').forEach(updateBtn);
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#darkToggleBtn').forEach((btn) => {
      updateBtn(btn);
      btn.onclick = toggle;
    });
  });

  window.Theme = { toggle, isDark };
})();
