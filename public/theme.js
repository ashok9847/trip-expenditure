// Apply the saved theme before first paint to avoid a flash.
// (A separate file rather than inline, so the Content Security Policy can forbid inline scripts.)
try {
  var s = JSON.parse(localStorage.getItem('tripsplit:v1') || '{}');
  var t = s && s.settings && s.settings.theme;
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
