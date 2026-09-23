// 로컬 서버가 준 Plugin API 스크립트를 실행하고 결과를 UI로 돌려준다. use_figma와 같은 규약: 스크립트는 top-level await + return.
figma.showUI(__html__, { width: 260, height: 90 });
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
figma.ui.onmessage = async ({ id, code }) => {
  try {
    const value = await new AsyncFunction('figma', code)(figma);
    figma.ui.postMessage({ id, ok: true, value });
  } catch (e) {
    figma.ui.postMessage({ id, ok: false, error: String(e && e.message ? e.message + '\n' + e.stack : e) });
  }
};
