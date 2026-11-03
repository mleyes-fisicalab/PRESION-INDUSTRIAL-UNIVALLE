/* Configuración de MathJax: el cuaderno compone cada página al abrirla */
window.MathJax = {
  tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
  svg: { fontCache: 'global' },
  startup: { typeset: false, ready() { MathJax.startup.defaultReady(); MathJax.startup.promise.then(() => window.__onMathJax && window.__onMathJax()); } }
};
